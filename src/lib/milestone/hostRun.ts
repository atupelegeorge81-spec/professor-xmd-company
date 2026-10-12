// src/lib/milestone/hostRun.ts — host ya run() (boardRunner): inaendesha pipeline ya milestones
// moja baada ya nyingine (4.4–4.9), IDEMPOTENT (milestones zilizosainiwa zinarukwa), na inarudisha
// hali ya kuhitimisha runner-finale bila kupendelera kama run mpya.
import { runMilestonePipeline, type OrchestratorDeps, type MilestonePipelineResult } from "./orchestrate";
import { writeMilestonesState } from "./state";
import { generateMilestonePlan } from "./planGen";
import * as review from "./reviewLLM";
import type { LaneCall, MilestonesRunState } from "./types";

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
  deps?: Partial<OrchestratorDeps>;
  concurrencySignal?: AbortSignal;
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
        callLLM: planLLM,
      });
      return { md: plan.md, title: plan.title, checks: plan.checks, blocked: plan.blocked, errors: plan.errors };
    },
    // P8-REST (maelezo 10.2–10.4): rekodi ya lane kwa KILA call ya judge + rekodi ya visionDegraded staki-runner.
    // onLane inaitwa baada ya judgeClient kufaulu — inakilisha LaneCall kwenye hali ya milestone.
    analyse: review.llmAnalyse({ waitNote: (m) => hooks.blog("info", m), onLane: (rec) => recordJudgeLane(run, { stepId: `M.Review.analyse`, tier: rec.lane, provider: rec.lane, model: rec.lane, visionCapable: rec.visionCapable, fallback: rec.fallback }) }),
    discussAndMerge: review.llmDiscussAndMerge({ waitNote: (m) => hooks.blog("info", m), onLane: (rec) => recordJudgeLane(run, { stepId: `M.Review.merge`, tier: rec.lane, provider: rec.lane, model: rec.lane, visionCapable: rec.visionCapable, fallback: rec.fallback }) }),
    verifyRound: review.llmVerifyRound({ waitNote: (m) => hooks.blog("info", m), onLane: (rec) => recordJudgeLane(run, { stepId: `M.Verify`, tier: rec.lane, provider: rec.lane, model: rec.lane, visionCapable: rec.visionCapable, fallback: rec.fallback }) }),
    rewriteConcrete: review.llmRewriteConcrete({ onLane: (rec) => recordJudgeLane(run, { stepId: `M.Co.rewrite`, tier: rec.lane, provider: rec.lane, model: rec.lane, visionCapable: rec.visionCapable, fallback: rec.fallback }) }),
    pairPatch: review.llmPairPatch({ onLane: (rec) => recordJudgeLane(run, { stepId: `M.Co.pairPatch`, tier: rec.lane, provider: rec.lane, model: rec.lane, visionCapable: rec.visionCapable, fallback: rec.fallback }) }),
    redecide: review.llmRedecide({ onLane: (rec) => recordJudgeLane(run, { stepId: `M.Co.redecide`, tier: rec.lane, provider: rec.lane, model: rec.lane, visionCapable: rec.visionCapable, fallback: rec.fallback }), vision: true, waitNote: (m) => hooks.blog("info", m) }),
    ...(args.deps || {}),
  } as OrchestratorDeps;

  let legacy = 0;
  for (;;) {
    const mid = nextMilestoneToRun(run);
    if (!mid) break;
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
    {
      const mdef = run.map.milestones.find((x) => x.id === mid);
      const payload = { id: mid, title: mdef?.title || mid, total: run.map.milestones.length, index: run.map.milestones.findIndex((x) => x.id === mid) + 1, status: "PLANNING", maxRounds: run.states?.[mid]?.maxRounds || 10 };
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
    hooks.blog("success", `🏁 Kimataifa: milestones zote ${all.length} zimefungwa (${signedOff.length} za kukubaliwa, ${legacy} defects rithi).`);
  }
  return { done, results, signedOff, incomplete, legacy };
}
