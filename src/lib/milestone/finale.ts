/* src/lib/milestone/finale.ts — P9 (maelezo.md 13): ripoti ya mwisho kutoka kwa DATA HALISI.
 * Daaghij: deterministic — kila sehemu inajengwa kutoka run state (milestones, defects, signoffs, evidence).
 * Sharia ya juu: ripoti HAIsémi "imekamilika" isipokuwa MILESTONES ZOTE zikiwa SIGNED_OFF* + ukaguzi wa deploy upstampi. */
import type { CheckResult, Defect, EvidencePack, MilestonesRunState, SignOff, StepRecord } from "./types";

export interface FinaleInput {
  project: string;
  brief: string;
  run: MilestonesRunState;
  /** optional: muhtasari ya ledger (kutoka boardRunner) — anthology nzima ya maamuzi */
  ledgerText?: string;
  /** ripoti za Computer za kila milestone (M1-build-report.md) kama zipo */
  computerReports?: Record<string, string>;
  /** URL ya GitHub/Vercel kama zipo (kutoka CU phase) */
  githubUrl?: string;
  liveUrl?: string;
  producedBy?: string;
}

export interface FinaleOutput {
  markdown: string;
  /** hali halisi kama ilivyo (never lie) */
  statusLabel: "KAMILI" | "SEHEMU" | "IMESIMAMA";
  /** maelezo ya kwa nini label hiyo */
  statusDetail: string;
  /** sehemu 7 (sehemu 13) — kwa validator yadar interface */
  sections: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, string>;
}

const MAX_PERMS = ["SIGNED_OFF", "SIGNED_OFF_WITH_WAIVERS"] as const;

function statusOf(run: MilestonesRunState): { label: FinaleOutput["statusLabel"]; detail: string } {
  const ms = run.map.milestones;
  const st = (id: string) => run.states[id]?.status || "DISCUSSING";
  const signed = ms.filter((m) => (MAX_PERMS as readonly string[]).includes(st(m.id))).length;
  const caps = ms.filter((m) => st(m.id) === "CAP_REACHED").map((m) => m.id);
  const blocked = ms.filter((m) => { const x = st(m.id); return x === "BLOCKED" || (x as string) === "HAUJENGWA"; }).map((m) => m.id);
  if (signed === ms.length && ms.length > 0) return { label: "KAMILI", detail: `milestones zote ${ms.length} zimesajiliwa SIGNED_OFF` };
  if (blocked.length || caps.length) return { label: "IMESIMAMA", detail: `zilizosimama: ${[...caps, ...blocked].join(", ")}` };
  return { label: "SEHEMU", detail: `zilizosainiwa: ${signed}/${ms.length} (wengine bado ndani ya raundi)` };
}

function laneGist(id: string): string { return id.slice(0, 24); }

/** MilestoneReport kldan (5.7) — khalkana `computerReports` map (kama zipo) */
function pickSection(text: string, headRe: RegExp): string {
  const m = text.match(headRe);
  return m && typeof m[1] === "string" ? m[1].trim().slice(0, 1200) : "";
}

export function buildMilestonesFinalReport(inp: FinaleInput): FinaleOutput {
  const { run, brief, project } = inp;
  const st = statusOf(run);
  const ms = run.map.milestones;
  const msStates = (id: string) => run.states[id];

  /* ---- 1: muhtasari vs brief ---- */
  const s1 = [
    `**Brief ya CEO:** ${brief.replace(/\s+/g, " ").trim().slice(0, 500) || "(haipo)"}`,
    ``,
    `**Hali ya mwisho:** ${st.label} — ${st.detail}.`,
    `**Kilicho ombwa dhidi ya kilichogandwa:** milestones ${ms.length} ilipangwa; ${ms.filter((m) => (MAX_PERMS as readonly string[]).includes(msStates(m.id)?.status || "")).length} zimesainiwa.`,
    ...(run.liveCheck ? [`**Live smoke check (C10):** ${run.liveCheck.ok ? `✅ OK (${run.liveCheck.status})` : run.liveCheck.url ? `⚠️ status ${run.liveCheck.status}` : "⚠️ haijafanyika (URL haipo)"}${run.liveCheck.url ? ` — ${run.liveCheck.url}` : ""}`] : []),
  ].join("\n");

  /* ---- 2: milestones na HALI (+ raundi) ---- */
  const msRows = ms.map((m) => {
    const s = msStates(m.id);
    const lanesUsed = (s?.lanesUsed || []).length;
    const fallbackLanes = (s?.lanesUsed || []).filter((l) => l.fallback).length;
    return `| ${m.id} | ${m.title} | ${m.phase} | **${s?.status || "—"}**${s?.signedTag ? ` · \`${s.signedTag}\`` : ""} | ${s?.round ?? 0}/${s?.maxRounds || 10} | lanes ${lanesUsed}${fallbackLanes ? ` (fallback ${fallbackLanes})` : ""} |`;
  });
  // C9 (10.4): lanes zilizotumika KWA JINA per milestone — mwamuzi wa export anaona wadhifa wa lanes
  const laneDetail = ms
    .map((m) => {
      const lanes = msStates(m.id)?.lanesUsed || [];
      if (!lanes.length) return null;
      const by = new Map<string, number>();
      for (const l of lanes) by.set(l.lane, (by.get(l.lane) || 0) + 1);
      return `- ${m.id}: ${[...by.entries()].map(([ln, n]) => `\`${ln}\` ×${n}`).join(", ")}`;
    })
    .filter((x): x is string => !!x);
  const s2 = [
    `| Milestone | Kichwa | Awamu | Hali | Raundi | Lanes |`,
    `|---|---|---|---|---|---|`,
    ...msRows,
    ``,
    ...(laneDetail.length ? [`**Lanes zilizotumika kwa jina (10.4):**`, ...laneDetail] : []),
    ``,
    `_Hatari za hali:_ \`CAP_REACHED\` = kikomo cha raundi 10 kimefikiwa; \`BLOCKED/HAUJENGWA\` = imesimama (sababu zimeorodheshwa); \`SIGNED_OFF_WITH_WAIVERS\` = minor zimepewa waivers rasmi.`,
  ].join("\n");

  /* ---- 3: maamuzi muhimu (ledger) + mapendekezo yaliyokubaliwa ---- */
  const s3 = inp.ledgerText
    ? inp.ledgerText.trim().slice(0, 6000)
    : `(Muhtasari rasmi boardUtils kutoka mini-reports — kiambatisho cha report).`;

  /* ---- 4: makosa yaliyobaki na waivers (kila moja + sababu) ---- */
  const openBs = run.defects.filter((d) => ["INHERITED", "OPEN", "IN_FIX", "REOPENED"].includes(d.status));
  const waived = run.defects.filter((d) => d.status === "WAIVED");
  const s4Lines: string[] = [];
  if (openBs.length) {
    s4Lines.push(`**Makosa yaliyobaki (${openBs.length}):**`);
    for (const d of openBs) {
      const last = d.history[d.history.length - 1];
      s4Lines.push(`- \`${d.id}\` [${d.severity}] (${d.milestoneId}, status ${d.status}) — ${d.title}. Inayojaribu #${d.attempts}; mstari wa historia: ${d.history.map((h) => `R${h.round}:${h.result}`).join(" → ")}${last?.cause ? ` (sababu: ${last.cause})` : ""}.`);
    }
  } else s4Lines.push(`Hakuna makosa yaliyobaki mazima.`);
  s4Lines.push(``);
  if (waived.length) {
    s4Lines.push(`**Waivers (${waived.length}) — zimekubaliwa rasmi:**`);
    for (const d of waived) s4Lines.push(`- \`${d.id}\` — ${d.title}: ${d.waiveReason || "(sababu haijashekiriwa)"}${d.waiveApprovedBy?.length ? ` [wameidhinishwa: ${d.waiveApprovedBy.join(", ")}]` : ""}`);
  } else s4Lines.push(`Hakuna waivers.`);
  const s4 = s4Lines.join("\n");

  /* ---- 5: ushahidi (screenshots ids, checks za mwisho, URLs) ---- */
  const evKeys = Object.keys(run.evidence || {});
  const lastEvKey = evKeys.sort().pop();
  const ev: EvidencePack | undefined = lastEvKey ? (run.evidence as Record<string, EvidencePack>)[lastEvKey] : undefined;
  const checks: CheckResult[] = ev?.checks || [];
  const pass = checks.filter((c) => c.result === "PASS").length;
  const fail = checks.filter((c) => c.result === "FAIL").length;
  const shots = (ev?.screenshots || []).map((s) => s.id);
  const links: string[] = [];
  if (inp.githubUrl) links.push(`GitHub: ${inp.githubUrl}`);
  if (inp.liveUrl) links.push(`Live: ${inp.liveUrl}`);
  const s5 = [
    `**Vipimo vya mwisho (${lastEvKey || "—"}):** PASS ${pass}, FAIL ${fail}${checks.length ? ` ya ${checks.length}` : ""}.`,
    shots.length ? `Screenshots: ${shots.join(", ")}${ev?.gitDiffSummary ? ` — diff: ${ev.gitDiffSummary.filesChanged} faili, +${ev.gitDiffSummary.insertions}/-${ev.gitDiffSummary.deletions}` : ""}` : `Screenshots: hakuna zilizochukuliwa (au si visual).`,
    ev?.regression?.length ? `⚠️ Regression dhidi ya baselines: ${ev.regression.map((r) => `${r.route}@${r.viewport} (${r.changedPct}%)`).join(", ")}.` : `Hakuna regression iliyogunduliwa kwenye vipimo vya mwisho.`,
    links.length ? links.join(" · ") : `URL hazijapokelewa bado — harness/deploy inazishuata (12.6).`,
  ].join("\n");

  /* ---- 6: usalama na kiufundi (kutoka ripoti za Computer kama zipo) ---- */
  const securityBits: string[] = [];
  for (const [mid, rep] of Object.entries(inp.computerReports || {})) {
    const sec = pickSection(rep, /##\s*(?:6\.\s*)?Usalama[^\n]*\n([\s\S]*?)(?=\n##|\Z)/i) || pickSection(rep, /security[^\n]*\n([\s\S]*?)(?=\n##|\Z)/i);
    if (sec) securityBits.push(`**${mid}:** ${sec.replace(/\s+/g, " ").trim().slice(0, 400)}`);
  }
  const s6 = securityBits.length ? securityBits.join("\n") : "Tazama ripoti za Computer kwenye `.xmd/reports/` za repo — sehemu za usalama zimeorodheshwa hapo. API keys hazisomwi output (router/engine) — redaction active.";

  /* ---- 7: jinsi ya kuendesha/kujaribu + hatari na hatua ---- */
  const risks: string[] = [];
  if (st.label !== "KAMILI") risks.push(`Hali halisi ni ${st.label} (${st.detail}) — usizitumie kama uzalishaji kamili.`);
  const inherited = run.defects.filter((d) => d.status === "INHERITED");
  if (inherited.length) risks.push(`${inherited.length} makosa yaliokwenda mbele (INHERITED) — yataziangalia run/kipindi kijacho.`);
  const s7 = [
    `**Kuendesha**: angalia repo ya GitHub; mazingira ya kuendesha yako kwenye \`README\` cha repo (anda na Vercel).`,
    `**Kujaribu**: vipimo vilivyopita/PASS vimeorodheshwa kwenye sehemu 5 — jaribu tena kupitia harness (\`vitest run\`) au kurasa zilizodombwa hiwapo.`,
    `**Hatari zikiwa zimebajo:** ${risks.length ? risks.join(" · ") : "hakuna zilizojulikana."}`,
  ].join("\n");

  const md = [
    `# Ripoti ya Mwisho: ${project}`,
    ``,
    `_Imeandikwa na mfumo wa milestones (data halisi ya run, ${inp.producedBy || "mfumo"}, ${new Date().toISOString()}). Haiidai "imekamilika" isipokuwa milestones zote zimepita sign-off + ukaguzi wa deploy (sheria ya sehemu 13).._`,
    ``,
    `## 1. Muhtasari wa Mradi`,
    s1,
    `## 2. Milestones na Hali Zake`,
    s2,
    `## 3. Maamuzi Muhimu ya Board`,
    s3,
    `## 4. Makosa Yaliyobaki na Waivers`,
    s4,
    `## 5. Ushahidi`,
    s5,
    `## 6. Usalama na Kiufundi`,
    s6,
    `## 7. Kuendesha, Kujaribu, Hatari na Hatua Zifuatazo`,
    s7,
  ].join("\n\n");

  return {
    markdown: md,
    statusLabel: st.label,
    statusDetail: st.detail,
    sections: { 1: s1, 2: s2, 3: s3, 4: s4, 5: s5, 6: s6, 7: s7 },
  };
}
