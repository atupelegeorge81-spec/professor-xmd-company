// src/lib/milestone/hostRun.ts — host ya run() (boardRunner): inaendesha pipeline ya milestones
// moja baada ya nyingine (4.4–4.9), IDEMPOTENT (milestones zilizosainiwa zinarukwa), na inarudisha
// hali ya kuhitimisha runner-finale bila kupendelera kama run mpya.
import { runMilestonePipeline, type OrchestratorDeps, type MilestonePipelineResult } from "./orchestrate";
import { writeMilestonesState } from "./state";
import { generateMilestonePlan } from "./planGen";
import { extendMilestoneMap } from "./mapGen";
import * as review from "./reviewLLM";
import type { LaneCall, MilestonesRunState } from "./types";
import { AGENTS as TEAM_AGENTS } from "../team";
import { buildOCB } from "./ocb";

export interface HostRunHooks {
  blog: (level: "info" | "success" | "warning" | "error" | "system", msg: string) => void;
  addChip: (text: string) => void;
  bcast: (evt: unknown) => void;
  persist: (reason: string, title?: string) => Promise<unknown>;
}

export interface HostRunArgs {
  runner: { id: string; sessionId: string; project: string; items: unknown[] };
  run: MilestonesRunState;
  hooks: HostRunHooks;
  /** mradi/brief — Optimus (planGen) anahitaji */
  project: string;
  brief?: string;
  facts?: import("../board/factSheet").FactSheet | null;
  ledgerShort?: string;
  /** LLM call (broker) kwa plan generation — planGen yenyewe inatengeneza prompt + validators. */
  callLLM: (agentId: string, messages: { role: string; content: string }[], maxTokens: number) => Promise<string>;
  /** host inaweza kujazwa na deps zinazofanywa na module zilizonza (bench/engine adapter — P4+) */
  /** C5 (4.2.7): idadi halisi ya agenda sasa (kutoka boardRunner) — ikizidi map.totalAgendas, ramani inapanuliwa. */
  agendaCount?: number;
  /** C4 (7.6): utafutaji wa web kwa wakaguzi (host inajua jina/sekreti za search — module hii haizi). */
  searchFn?: (q: string) => Promise<string>;
  deps?: Partial<OrchestratorDeps>;
  concurrencySignal?: AbortSignal;
  /** R64 (maelezo 4.4 TRIGGER): ukiwekwa, host inafanya trigger kwa milestones zenye agenda ZAKE ZOTE zimefungwa TU.
   * Milestone ya kwanza isiyo-terminal yenye agenda haikubazwa-zimefungwa nzima → host inakwamisha (mjadala unaendelea Mk+1 inaanza). */
  lockedAgendas?: Set<number>;
  /** R64 (maelezo 4.5 #1): MINI-REPORTS za agenda za milestone — chanzo kikuu cha mpango wa Mk (inaitwa kwa kila milestone). */
  miniReportsFor?: (milestone: { id: string; agendas: { from: number; to: number } }) => Promise<string[]>;
}

export interface HostRunResult {
  done: boolean;            // milestones ZOTE zimeisha (SIGNED_OFF/CAP_REACHED/BLOCKED)
  results: MilestonePipelineResult[];
  signedOff: string[];      // milestones zilizosainiwa (waivers zikiwemo)
  incomplete: string[];     // zilizofungwa bila sign-off (BLOCKED/PAUSED/CAP_REACHED)
  legacy: number;           // idadi ya defects za kale ambazo ZIMERITHI shughuli (OPEN) — si sign-off
}

/** Chagua milestone inayofuatia kufanyiwa kazi: ya kwanza isiyo terminal. */
export function nextMilestoneToRun(run: MilestonesRunState): string | null {
  for (const m of run.map.milestones) {
    const st = run.states[m.id]?.status;
    if (!["SIGNED_OFF", "SIGNED_OFF_WITH_WAIVERS", "BLOCKED", "CAP_REACHED", "HAUJENGWA"].includes(st || "")) return m.id;
  }
  return null;
}

const TERMINAL_OFF = (s?: string) => ["SIGNED_OFF", "SIGNED_OFF_WITH_WAIVERS"].includes(s || "");

/**
 * Endesha pipeline kwa milestone MOJA — call hii ndiyo trigger ya mwisho baada ya agenda.
 * Idempotent: status terminal → haitaendeshwa tena (ruku haraka).
 */
export async function runMilestonesHost(args: HostRunArgs): Promise<HostRunResult> {
  const { run, hooks } = args;
  const results: MilestonePipelineResult[] = [];

  // C5 (4.2.7): agenda imeongezeka KATI YA RUN → panua ramani; zilizosainiwa HAIGUSWI kamwe
  if (typeof args.agendaCount === "number" && args.agendaCount > run.map.totalAgendas) {
    const oldTotal = run.map.totalAgendas;
    const grown = extendMilestoneMap(run.map, run, args.agendaCount);
    if (grown) {
      run.map = grown.map;
      const now = new Date().toISOString();
      for (const id of grown.removed) delete run.states[id];
      for (const id of grown.added) {
        run.states[id] = { id, status: "DISCUSSING", round: 0, maxRounds: 10, currentStepId: `${id}.D.discuss`, startedAt: now, updatedAt: now, lanesUsed: [] };
      }
      // defects zilizokuwa OPEN kwa milestones zilizokatishwa — ziwe by milestone ya kwanza ya ziada
      if (grown.added.length) {
        const firstAdded = grown.added[0];
        for (const d of run.defects) if (grown.removed.includes(d.milestoneId) && !["SIGNED_OFF", "SIGNED_OFF_WITH_WAIVERS"].includes("")) d.milestoneId = firstAdded;
      }
      hooks.blog("info", `\u{1f5fa}\ufe0f ramani_updated: agenda ${oldTotal} \u2192 ${args.agendaCount} — mpya: ${grown.added.join(", ")} (zilizosainiwa: hazikuguswa).`);
      hooks.addChip(`\u{1f5fa}\ufe0f Ramani imesasishwa kati ya kazi (C5): agenda ${oldTotal} \u2192 ${args.agendaCount}. Milestones zilizosainiwa zimebaki sawa.`);
      writeMilestonesState(args.runner.items, run);
      await hooks.persist("ramani_updated").catch(() => null);
    } else {
      hooks.blog("warning", `\u{1f5fa}\ufe0f agenda imeongezeka (${run.map.totalAgendas} \u2192 ${args.agendaCount}) lakini muunganiko wa ramani hauko salama — ninaendelea na ramani ya zamani.`);
    }
  }
  const signedOff: string[] = [];

/** P8-REST: rekodi ya lane kwa kila call ya hukumu (10.4). */
function recordJudgeLane(run: MilestonesRunState, partial: { stepId: string; tier: string; provider?: string; model?: string; visionCapable: boolean; fallback: boolean }): void {
  const mid = run.currentMilestoneId || "?";
  const st = run.states?.[mid];
  const call: LaneCall = { call: `${partial.stepId}.${Date.now().toString(36)}`, lane: partial.tier, visionCapable: partial.visionCapable, fallback: partial.fallback || undefined };
  if (st) { st.lanesUsed = [...(st.lanesUsed || []), call].slice(-500); }
}

  const incomplete: string[] = [];

  // deps halisi za LLM (P3 wiring); computerBuild/collectEvidence hutoka args.deps (injini/harness)
  const planLLM = (system: string, user: string) =>
    args.callLLM("pm", [{ role: "system", content: system }, { role: "user", content: user }], 4000);
  const deps: OrchestratorDeps = {
    log: (msg) => hooks.blog("info", msg),
    chip: (msg) => hooks.addChip(msg),
    generatePlan: async (milestone, run) => {
      const plan = await generateMilestonePlan({
        project: args.project, brief: args.brief, milestone,
        ledgerShort: args.ledgerShort || "(ledger ya Board imefungwa kwenye mjadala)",
        facts: args.facts ?? null,
        inheritedDefects: run.defects.filter((d) => d.status === "INHERITED"),
        // R64 (4.5): mini-reports za agenda za Mk — chanzo kikuu cha mpango (zinapatikana baada ya agenda zake kufungwa)
        miniReports: args.miniReportsFor ? await args.miniReportsFor(milestone).catch(() => []) : undefined,
        callLLM: planLLM,
      });
      return { md: plan.md, title: plan.title, checks: plan.checks, blocked: plan.blocked, errors: plan.errors };
    },
    // P8-REST (maelezo 10.2–10.4): rekodi ya lane kwa KILA call ya judge + rekodi ya visionDegraded staki-runner.
    // onLane inaitwa baada ya judgeClient kufaulu — inakilisha LaneCall kwenye hali ya milestone.
    // §6.1.2: OCB kwa kila call ya judge ni WAJIBU — inapata mapito ya hukumilo (warmagnified) na picha.
    ocbFor: (roleId: string, step: string, round?: number): string => {
      try {
        const team = TEAM_AGENTS.slice(0, 5).map((a) => ({ id: a.id, name: a.name, role: a.role }));
        return buildOCB({
          project: args.project, brief: args.brief || args.project, team,
          run, map: run.map, roleId, step, round,
          milestoneId: run.currentMilestoneId || undefined,
          next: "kuzipokea ushahidi mpya na kuiga uamuzi sahihi kwa vipimo vya code",
          reader: "wakaguzi wa raundi / Board ili kufanya hukumu sahihi",
        });
      } catch { return `=== OCB (mfupi) ===\nHapa tulipo: ${step}\nMilestone: ${run.currentMilestoneId || "?"}`; }
    },
    // 4.6: ledger slice ya kweli kwa StartPack (Board imefungwa kwenye mjadala) — si placeholder
    ledgerFor: () => args.ledgerShort || "(ledger ya Board haikupatikana kwa phase hii)",

    // C8 (PENDEKEZO): browser_eval gate — kutoka env MS_BROWSER_EVAL=1
    browserEvalRequired: process.env.MS_BROWSER_EVAL === "1",
    analyse: review.llmAnalyse({ waitNote: (m) => hooks.blog("info", m), search: args.searchFn, onLane: (rec) => recordJudgeLane(run, { stepId: `M.Review.analyse`, tier: rec.lane, provider: rec.lane, model: rec.lane, visionCapable: rec.visionCapable, fallback: rec.fallback }) }),
    discussAndMerge: review.llmDiscussAndMerge({ waitNote: (m) => hooks.blog("info", m), onLane: (rec) => recordJudgeLane(run, { stepId: `M.Review.merge`, tier: rec.lane, provider: rec.lane, model: rec.lane, visionCapable: rec.visionCapable, fallback: rec.fallback }) }),
    verifyRound: review.llmVerifyRound({ waitNote: (m) => hooks.blog("info", m), search: args.searchFn, onLane: (rec) => recordJudgeLane(run, { stepId: `M.Verify`, tier: rec.lane, provider: rec.lane, model: rec.lane, visionCapable: rec.visionCapable, fallback: rec.fallback }) }),
    rewriteConcrete: review.llmRewriteConcrete({ onLane: (rec) => recordJudgeLane(run, { stepId: `M.Co.rewrite`, tier: rec.lane, provider: rec.lane, model: rec.lane, visionCapable: rec.visionCapable, fallback: rec.fallback }) }),
    pairPatch: review.llmPairPatch({ onLane: (rec) => recordJudgeLane(run, { stepId: `M.Co.pairPatch`, tier: rec.lane, provider: rec.lane, model: rec.lane, visionCapable: rec.visionCapable, fallback: rec.fallback }) }),
    redecide: review.llmRedecide({ onLane: (rec) => recordJudgeLane(run, { stepId: `M.Co.redecide`, tier: rec.lane, provider: rec.lane, model: rec.lane, visionCapable: rec.visionCapable, fallback: rec.fallback }), vision: true, waitNote: (m) => hooks.blog("info", m) }),
    ...(args.deps || {}),
  } as OrchestratorDeps;
  // R64/R63: badge ya </> Computer inatokea UJENZI unapoanza kweli (si wakati Optimus anaandika mpango) — decorate computerBuild.
  const realBuild = (deps as OrchestratorDeps).computerBuild;
  if (typeof realBuild === "function") {
    (deps as OrchestratorDeps).computerBuild = async (req) => {
      const midB = String(req?.label || "").split(" ")[0] || run.currentMilestoneId || "";
      if (midB) hooks.bcast({ type: "msStart", milestone: { id: midB, status: "BUILDING", round: Number(req?.round) || 0 } });
      return realBuild(req);
    };
  }

  let legacy = 0;
  for (;;) {
    const mid = nextMilestoneToRun(run);
    if (!mid) break;
    // R64 (4.4 TRIGGER): host iliyotuitwa katikati ya mjadala inafanya trigger tu kwa milestones zenye agenda zimefungwa nzima
    if (args.lockedAgendas) {
      const mt = run.map.milestones.find((x) => x.id === mid);
      if (mt) {
        let triggered = true;
        for (let i = mt.agendas.from; i <= mt.agendas.to; i++) if (!args.lockedAgendas.has(i)) { triggered = false; break; }
        if (!triggered) {
          hooks.blog("info", `🗺️ ${mid}: bado ina agenda hazikulungwa (${mt.agendas.from}–${mt.agendas.to}) — TRIGGER haijapata; mjadala unaendelea.`);
          break;
        }
      }
    }
    const st = run.states[mid]?.status;
    if (TERMINAL_OFF(st) || ["BLOCKED", "CAP_REACHED", "HAUJENGWA"].includes(st || "")) continue;
    if (["PAUSED_QUOTA", "PAUSED_INFRA"].includes(st || "")) {
      // sio sisi kuanzia: controller (auto-resume) ndiyo inayopeleka kuendelea — rudi, hali ya pause ni halisi
      hooks.blog("info", `⏸️ ${mid}: imeachwa kwenye PAUSED (${run.states[mid].pausedFrom}) — auto-resume itaichukua.`);
      incomplete.push(mid);
      break;
    }
    if (args.concurrencySignal?.aborted) break;

    hooks.bcast({ type: "milestone", id: mid, index: run.map.milestones.findIndex((x) => x.id === mid) + 1, total: run.map.milestones.length });
    // Q-003 (uamuzi wa mmiliki): card kamili kama agenda inapoanza milele — bcast + persistence
    // R63: payload kamili (from/to/mode/roster) — adapter inai-patch card iliyopo (lifecycle DISCUSSING → PLANNING)
    {
      const mdef = run.map.milestones.find((x) => x.id === mid);
      const payload = {
        id: mid, title: mdef?.title || mid, total: run.map.milestones.length, index: run.map.milestones.findIndex((x) => x.id === mid) + 1,
        status: "PLANNING", maxRounds: run.states?.[mid]?.maxRounds || 10,
        from: mdef?.agendas?.from, to: mdef?.agendas?.to, mode: mdef?.reviewMode,
        roster: Array.isArray(mdef?.roster) ? mdef!.roster.map(String) : undefined,
      };
      hooks.bcast({ type: "msStart", milestone: payload });
      if (!(args.runner.items as unknown[]).some((x) => (x as { kind?: string; milestone?: { id?: string } }).kind === "msStart" && (x as { milestone?: { id?: string } }).milestone?.id === mid)) {
        (args.runner.items as unknown[]).push({ kind: "msStart", id: `ms_start_${mid.toLowerCase()}_${Date.now().toString(36)}`, milestone: payload, shown: 1, createdAt: new Date().toISOString() });
        await hooks.persist(`milestone_start_${mid.toLowerCase()}`).catch(() => {});
      }
    }
    hooks.addChip(` Milestone ${mid} (${run.map.milestones.find((x) => x.id === mid)?.title || mid}) — Optimus anaandika Mpango → Computer anajenga → ukaguzi.`);
    try {
      const r = await runMilestonePipeline(args.runner.items, run, deps, mid);
      results.push(r);
      writeMilestonesState(args.runner.items, run);
      if (r.signedOff) {
        signedOff.push(mid);
        hooks.blog("success", `✅ Milestone ${mid}: SIGNED_OFF baada ya raundi ${r.rounds}.`);
        // R63: card ya milestone iandahiwe SIGNED_OFF (lock) — live patch + persistence
        hooks.bcast({ type: "msStart", milestone: { id: mid, status: "SIGNED_OFF", round: r.rounds } });
        const pit = (args.runner.items as unknown[]).find((x) => (x as unknown as { kind?: string; milestone?: { id?: string } }).kind === "msStart" && (x as unknown as { milestone?: { id?: string } }).milestone?.id === mid) as { milestone?: Record<string, unknown> } | undefined;
        if (pit?.milestone) { pit.milestone = { ...pit.milestone, status: "SIGNED_OFF", round: r.rounds }; }
        hooks.addChip(`✅ Milestone ${mid} imekubaliwa (SIGNED_OFF) — raundi ${r.rounds}, defects ${r.defectsTotal}, wazi ${r.defectsOpen}.`);
        await hooks.persist(`milestone_signed_${mid.toLowerCase()}`).catch(() => {});
      }
      const af = run.states[mid]?.status;
      if (TERMINAL_OFF(af)) continue;
      // isiyo sign-off: CAP_REACHED/BLOCKED/HAUJENGWA/PAUSED — state ndiyo chanzo cha ukweli; endelee kwa milestones zifuatazo tu kwa HAUJENGWA/CAP/BLOCKED
      if (["BLOCKED", "CAP_REACHED", "HAUJENGWA"].includes(af || "")) {
        hooks.blog("warning", `⚠️ Milestone ${mid}: ${af} — hazards zinazorekodiwa; pipeline inaendelea milestones zifuatazo (hakuna haramu).`);
        incomplete.push(mid);
        continue;
      }
      if (["PAUSED_QUOTA", "PAUSED_INFRA"].includes(af || "")) { incomplete.push(mid); break; }
      // hali nyingine za kati (BUILDING/VERIFYING…) bila kurudi sign-off — hakika host iwindiwe tena
      incomplete.push(mid);
      break;
    } catch (e: any) {
      const st2 = run.states[mid]?.status;
      if (["PAUSED_QUOTA", "PAUSED_INFRA"].includes(st2 || "")) { incomplete.push(mid); break; }
      // hitilafu isiyotarajiwa: kusitisha ni haramu (spec §0.1 stability) — rekodi + fungua hostsSuspended
      const msg = String(e?.message || e).slice(0, 220);
      hooks.blog("error", `❌ Milestone ${mid} pipeline imekufa: ${msg}`);
      incomplete.push(mid);
      break;
    }
  }

  // defects INHERITED kutoka milestones za awali hazishughulikii hapa (hazina sign-off — wabakihe ledger)
  legacy = run.defects.filter((d) => d.status === "INHERITED").length;
  const all = run.map.milestones;
  const done = all.every((m) => ["SIGNED_OFF", "SIGNED_OFF_WITH_WAIVERS", "BLOCKED", "CAP_REACHED", "HAUJENGWA"].includes(run.states[m.id]?.status || ""));
  if (done) {
    // C10 (4.10): smoke check ya LIVE URL kabla ya kutangaza kuhitimisha — harness inapima server-side
    const cuMeta = ((args.runner as unknown as Record<string, unknown>)?.cu || undefined) as Record<string, unknown> | undefined;
    const links = (cuMeta?.links || undefined) as Record<string, unknown> | undefined;
    const liveUrl = typeof links?.live === "string" ? links.live : "";
    if (liveUrl && /^https?:\/\//.test(liveUrl)) {
      const chk = await liveUrlCheck(liveUrl);
      run.liveCheck = { url: liveUrl, ok: chk.ok, status: chk.status, at: new Date().toISOString() };
      writeMilestonesState(args.runner.items, run);
      if (chk.ok) {
        hooks.blog("success", `\u{1f310} Live URL smoke check: OK (${chk.status}) — ${liveUrl}`);
        hooks.addChip(`\u{1f310} Live URL imejibu (${chk.status}) — run imefungwa kwa mafanikio.`);
      } else {
        hooks.blog("warning", `\u{1f310} Live URL smoke check: status ${chk.status} — ${liveUrl} (ripoti inaeleza; kagua deploy).`);
        hooks.addChip(`\u26a0\ufe0f Live URL haikujibu (${chk.status}) — kagua deploy kabla ya kuanzia mwisho.`);
      }
    } else {
      run.liveCheck = { url: "", ok: false, status: 0, at: new Date().toISOString() };
      hooks.blog("warning", "\u{1f310} Live URL haipo — smoke check imerukwa (C10: ripoti inaeleza).");
    }
    hooks.blog("success", `\u{1f3c1} Kimataifa: milestones zote ${all.length} zimefungwa (${signedOff.length} za kukubaliwa, ${legacy} defects rithi).`);
  }
  return { done, results, signedOff, incomplete, legacy };
}

/** C10: ping ya live URL — HEAD kwanza (GET fallback), timeout salama, redirect inafuatwa. */
export async function liveUrlCheck(url: string, timeoutMs = 10_000): Promise<{ ok: boolean; status: number }> {
  const attempt = async (method: "HEAD" | "GET"): Promise<number> => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { method, redirect: "follow", signal: ctl.signal });
      return r.status;
    } finally { clearTimeout(t); }
  };
  try {
    let status = await attempt("HEAD");
    if (status === 405 || status === 501 || status === 429) status = await attempt("GET");
    return { ok: status >= 200 && status < 400, status };
  } catch { return { ok: false, status: 0 }; }
}
