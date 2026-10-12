// src/lib/milestone/schemas.ts — validators za mkono (zod haipo kwenye repo — maelezo.md 5).
// Kila kitu kinachotoka kwa LLM kipite hapa; kikishindwa mkaguzi anarudishiwa makosa (hadi mara 3),
// kisha njia ya dharura inayotajwa husika (mf. ramani: fallback ceil(N/4)).
import type {
  AcceptanceCheck, AnalystOutput, ChangeOrder, CheckType, Defect, DefectHistoryEntry,
  DiagnosisCode, EvidencePack, Milestone, MilestoneMap, Receipt, ReviewMode, SignOff,
} from "./types";

/* ========================= msingi wa validators ========================= */

export interface VerdictOk<T> { ok: true; value: T }
export interface VerdictBad { ok: false; errors: string[] }
export type Verdict<T> = VerdictOk<T> | VerdictBad;

const ok = <T>(value: T): Verdict<T> => ({ ok: true, value });
const bad = (...errors: string[]): VerdictBad => ({ ok: false, errors });

const isStr = (x: unknown, min = 1): x is string => typeof x === "string" && x.trim().length >= min;
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const isArr = Array.isArray;
const oneOf = <T extends string>(x: unknown, list: readonly T[]): x is T => typeof x === "string" && (list as readonly string[]).includes(x);

/** Utafutaji wa JSON kwenye jibu la LLM — kwanza fence ```...```, kisha { ... } mpana zaidi. */
export function parseJsonFromLLM(text: string): unknown | null {
  const t = String(text || "");
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fence?.[1], t];
  for (const c of candidates) {
    if (!c) continue;
    const s = c.indexOf("{");
    const e = c.lastIndexOf("}");
    if (s < 0 || e <= s) continue;
    try { return JSON.parse(c.slice(s, e + 1)); } catch { /* next */ }
  }
  return null;
}

/* ========================= 8.3 AcceptanceCheck ========================= */

export const CHECK_TYPES: readonly CheckType[] = [
  "command", "grep", "dom_exists", "computed_style", "no_horizontal_overflow", "console_clean",
  "contrast_min", "touch_target_min", "http", "file_exists", "file_contains", "screenshot_taken",
];

export function validateAcceptanceCheck(x: unknown, where = "check"): Verdict<AcceptanceCheck> {
  if (!isObj(x)) return bad(`${where}: si kitu cha JSON`);
  const type = x.type;
  if (!oneOf(type, CHECK_TYPES)) return bad(`${where}.type: '${String(type)}' haikubaliki (aina: ${CHECK_TYPES.join(", ")})`);
  const c = x as unknown as AcceptanceCheck;
  const req = (okCond: boolean, msg: string) => { if (!okCond) throw msg; };
  try {
    switch (type) {
      case "command": req(isStr(c.cmd), `${where}.cmd inahitajika`); break;
      case "grep":
        req(isStr(c.pattern), `${where}.pattern inahitajika`);
        req(isArr(c.paths) && (c.paths as string[]).every((p) => isStr(p)), `${where}.paths = [faili…] inahitajika`);
        break;
      case "dom_exists": req(isStr(c.route), `${where}.route inahitajika`); req(isStr(c.selector), `${where}.selector inahitajika`); break;
      case "computed_style":
        req(isStr(c.route), `${where}.route inahitajika`); req(isStr(c.selector), `${where}.selector inahitajika`);
        req(isStr(c.property), `${where}.property inahitajika`);
        req(isStr(c.expected) || (isArr(c.forbidden) && (c.forbidden as string[]).length > 0), `${where}: expected au forbidden[] — mojawapo lazima`);
        break;
      case "no_horizontal_overflow": req(isArr(c.routes) && (c.routes as string[]).length > 0, `${where}.routes=[…] inahitajika`); break;
      case "console_clean": req(isArr(c.routes) && (c.routes as string[]).length > 0, `${where}.routes=[…] inahitajika`); break;
      case "contrast_min": req(isStr(c.selector), `${where}.selector inahitajika`); req(isNum(c.min), `${where}.min (namba) inahitajika`); break;
      case "touch_target_min": req(isStr(c.selector), `${where}.selector inahitajika`); req(isNum(c.px), `${where}.px (namba) inahitajika`); break;
      case "http":
        req(isStr(c.method), `${where}.method inahitajika`); req(isStr(c.url), `${where}.url inahitajika`);
        req(isNum(c.status), `${where}.status (namba) inahitajika`);
        break;
      case "file_exists": req(isStr(c.path), `${where}.path inahitajika`); break;
      case "file_contains": req(isStr(c.path), `${where}.path inahitajika`); req(isStr(c.text), `${where}.text inahitajika`); break;
      case "screenshot_taken": req(isStr(c.route), `${where}.route inahitajika`); break;
    }
  } catch (e) { return bad(String(e)); }
  return ok(c);
}

export function validateAcceptanceList(x: unknown, where: string): Verdict<AcceptanceCheck[]> {
  if (!isArr(x) || x.length === 0) return bad(`${where}: orodha ya acceptance LAZIMA iwe na angalau kipimo kimoja`);
  const out: AcceptanceCheck[] = [];
  const errs: string[] = [];
  x.forEach((c, i) => {
    const v = validateAcceptanceCheck(c, `${where}[${i}]`);
    if (v.ok) out.push(v.value); else errs.push(...v.errors);
  });
  return errs.length ? bad(...errs) : ok(out);
}

/* ========================= 5.1 MilestoneMap ========================= */

const REVIEW_MODES: readonly ReviewMode[] = ["visual", "technical", "mixed"];

/** Majina yanayokubalika → ids za AGENTS. Hati inatumia ["optimus","ultron","vextron"]; code inatumia ["pm","designer",…]. */
export const AGENT_ALIASES: Record<string, string> = {
  pm: "pm", optimus: "pm",
  designer: "designer", ultron: "designer",
  frontend: "frontend", vextron: "frontend",
  backend: "backend", megatron: "backend",
  qa: "qa", cybertron: "qa",
};
export const ALL_AGENT_IDS = ["pm", "designer", "frontend", "backend", "qa"] as const;

function normalizeRoster(x: unknown): { roster?: string[]; error?: string } {
  if (!isArr(x) || x.length === 0) return { error: `roster: orodha isiyo tupu ya agents inahitajika` };
  const out: string[] = [];
  for (const r of x) {
    const id = AGENT_ALIASES[String(r).toLowerCase().trim()];
    if (!id) return { error: `roster: '${String(r)}' si agent anayejulikana (${ALL_AGENT_IDS.join("/")} au majina yao)` };
    if (!out.includes(id)) out.push(id);
  }
  if (!out.includes("pm")) out.unshift("pm"); // Optimus kila mara — kiongozi wa mpango/ledger
  return { roster: out };
}

/** Tarajiwa: ramani inafunika agenda 1..N, mpangilio, bila mapengo wala overlap, reviewMode halali, roster halali. */
export function validateMilestoneMap(x: unknown, totalAgendas: number, sessionId = ""): Verdict<MilestoneMap> {
  if (!isObj(x)) return bad("ramani: si kitu cha JSON");
  const ms = x.milestones;
  if (!isArr(ms) || ms.length === 0) return bad("ramani: milestones[] haipo au ni tupu");
  const errs: string[] = [];
  const out: Milestone[] = [];
  let expectFrom = 1;
  const ids = new Set<string>();
  ms.forEach((raw, i) => {
    const where = `milestones[${i}]`;
    if (!isObj(raw)) { errs.push(`${where}: si kitu`); return; }
    const id = isStr(raw.id) ? raw.id : `M${i + 1}`;
    if (ids.has(id)) errs.push(`${where}.id '${id}' imejirudia`); else ids.add(id);
    const agendas = raw.agendas;
    if (!isObj(agendas) || !isNum(agendas.from) || !isNum(agendas.to)) { errs.push(`${where}.agendas.from/to hazikubaliki`); return; }
    const from = Math.trunc(agendas.from as number), to = Math.trunc(agendas.to as number);
    if (from < expectFrom) errs.push(`${where}: overlap — agenda ${from}..${to} inagongana na iliyotangulia (inayotarajiwa kuanzia ${expectFrom})`);
    if (from > expectFrom) errs.push(`${where}: pengo — agenda ${expectFrom}..${from - 1} haziko kwenye milestone yoyote`);
    if (to < from) errs.push(`${where}: to (${to}) < from (${from})`);
    if (to > totalAgendas) errs.push(`${where}: to (${to}) inazidi idadi ya agendas (${totalAgendas})`);
    expectFrom = to + 1;
    if (!isStr(raw.title)) errs.push(`${where}.title inahitajika`);
    if (!oneOf(raw.reviewMode, REVIEW_MODES)) errs.push(`${where}.reviewMode '${String(raw.reviewMode)}' (ina ruhusiwa: ${REVIEW_MODES.join("/")})`);
    const ro = normalizeRoster(raw.roster);
    if (ro.error) errs.push(`${where}.${ro.error}`);
    out.push({
      id,
      title: String(raw.title || "").trim(),
      agendas: { from, to },
      phase: isStr(raw.phase, 0) ? String(raw.phase) : String(raw.title || ""),
      reviewMode: (oneOf(raw.reviewMode, REVIEW_MODES) ? raw.reviewMode : "visual") as ReviewMode,
      roster: ro.roster || ["pm"],
      rationale: isStr(raw.rationale, 0) ? String(raw.rationale) : "",
    });
  });
  if (expectFrom <= totalAgendas) errs.push(`ramani: agendas ${expectFrom}..${totalAgendas} hazijafunikwa na milestone yoyote`);
  if (errs.length) return bad(...errs);
  return ok({
    version: 1,
    sessionId: isStr(x.sessionId, 0) ? String(x.sessionId) : sessionId,
    totalAgendas,
    generatedBy: isStr(x.generatedBy, 0) ? String(x.generatedBy) : "optimus@gemini-flash",
    usedFallback: !!x.usedFallback,
    milestones: out,
  });
}

/** Njia ya dharura ya 4.2: kila milestone ≈ agenda 4 (ceil(N/4) milestones), mpangilio wa mfululizo. */
export function fallbackMilestoneMap(totalAgendas: number, sessionId: string, mode: ReviewMode = "visual"): MilestoneMap {
  const n = Math.max(1, totalAgendas);
  const k = Math.max(1, Math.ceil(n / 4));
  const per = Math.ceil(n / k);
  const milestones: Milestone[] = [];
  for (let i = 0; i < k; i++) {
    const from = i * per + 1;
    const to = Math.min(n, from + per - 1);
    milestones.push({
      id: `M${i + 1}`,
      title: `Milestone ${i + 1} (agenda ${from}–${to})`,
      agendas: { from, to },
      phase: i === 0 ? "foundation" : i === k - 1 ? "final" : `phase-${i + 1}`,
      reviewMode: mode,
      roster: ["pm", "designer", "frontend", "backend"],
      rationale: "Ramani ya dharura (fallback) — LLM ya ramani ilishindwa mara 3; umegawanyiko wa wastani.",
    });
  }
  return {
    version: 1, sessionId, totalAgendas: n, generatedBy: "code@fallback", usedFallback: true, milestones,
  };
}

/* ========================= 5.4 Defect ========================= */

const SEVERITIES = ["blocker", "major", "medium", "minor"] as const;
export const DIAGNOSIS_CODES: readonly DiagnosisCode[] = [
  "NOT_ATTEMPTED", "ATTEMPTED_WRONG", "AMBIGUOUS_ORDER", "CONFLICT_WITH_DECISION", "TECH_BLOCKER", "REGRESSION_CAUSED",
];

export function validateDefect(x: unknown, where = "defect"): Verdict<Defect> {
  if (!isObj(x)) return bad(`${where}: si kitu`);
  const errs: string[] = [];
  if (!isStr(x.id)) errs.push(`${where}.id ('D-###') inahitajika`);
  if (!isStr(x.milestoneId) && !isStr(x.milestone, 0)) errs.push(`${where}.milestoneId inahitajika`);
  if (!oneOf(x.severity, SEVERITIES)) errs.push(`${where}.severity '${String(x.severity)}' (ina ruhusiwa: ${SEVERITIES.join("/")})`);
  if (!isStr(x.title)) errs.push(`${where}.title inahitajika`);
  if (!isStr(x.expected, 0) && !isStr(x.actual, 0)) errs.push(`${where}: expected/actual — angalau moja inahitajika`);
  if (errs.length) return bad(...errs);
  const d = x as unknown as Defect;
  return ok({
    ...d,
    milestoneId: (d.milestoneId || String((x as any).milestone || "")).trim(),
    reportedBy: isArr(d.reportedBy) ? d.reportedBy.filter((r) => isStr(r)) as string[] : [],
    evidence: isArr(d.evidence) ? d.evidence.filter((e) => isStr(e)) as string[] : [],
    foundInRound: isNum(d.foundInRound) ? d.foundInRound : 0,
    area: isStr(d.area, 0) ? d.area : "unknown",
    status: "OPEN",
    attempts: 0,
    history: [] as DefectHistoryEntry[],
  });
}

/* ========================= 5.5 ChangeOrder ========================= */

const CO_MODES = ["standard", "concrete", "pair_patch", "split", "redecide"] as const;

export function validateChangeOrder(x: unknown, where = "CO"): Verdict<ChangeOrder> {
  if (!isObj(x)) return bad(`${where}: si kitu`);
  const errs: string[] = [];
  if (!isStr(x.id)) errs.push(`${where}.id ('CO-###') inahitajika`);
  if (!isStr(x.current, 0)) errs.push(`${where}.current (hali ya sasa) inahitajika`);
  if (!isStr(x.desired)) errs.push(`${where}.desired (hali inayotakiwa) inahitajika`);
  if (!isObj(x.location) || !isArr((x.location as any).files) || ((x.location as any).files as unknown[]).length === 0)
    errs.push(`${where}.location.files = [faili…] inahitajika`);
  const acc = validateAcceptanceList(x.acceptance, `${where}.acceptance`);
  if (!acc.ok) errs.push(...acc.errors);
  if (x.mode !== undefined && !oneOf(x.mode, CO_MODES)) errs.push(`${where}.mode '${String(x.mode)}' (ina ruhusiwa: ${CO_MODES.join("/")})`);
  if (x.diagnosis !== undefined && x.diagnosis !== null && !oneOf(x.diagnosis, DIAGNOSIS_CODES))
    errs.push(`${where}.diagnosis '${String(x.diagnosis)}' (ina ruhusiwa: ${DIAGNOSIS_CODES.join("/")})`);
  if (!isArr(x.defectIds) || (x.defectIds as unknown[]).length === 0) errs.push(`${where}.defectIds=[D-### …] inahitajika — kosa lisilo na CO halikubaliki`);
  if (errs.length) return bad(...errs);
  const co = x as unknown as ChangeOrder;
  return ok({
    ...co,
    attempt: isNum(co.attempt) ? co.attempt : 1,
    priority: isNum(co.priority) ? co.priority : 99,
    location: {
      files: co.location.files.filter((f) => isStr(f)),
      route: isStr(co.location.route, 0) ? co.location.route : undefined,
      selector: isStr(co.location.selector, 0) ? co.location.selector : undefined,
    },
    acceptance: acc.ok ? acc.value : [],
    mode: oneOf(co.mode, CO_MODES) ? co.mode : "standard",
    patch: typeof co.patch === "string" ? co.patch : null,
  });
}

/* ========================= 5.6 Receipt ========================= */

const RECEIPT_STATUSES = ["DONE", "PARTIAL", "BLOCKED", "CANNOT"] as const;

export function validateReceipt(x: unknown, where = "receipt"): Verdict<Receipt> {
  if (!isObj(x)) return bad(`${where}: si kitu`);
  const errs: string[] = [];
  if (!isStr(x.orderId)) errs.push(`${where}.orderId inahitajika`);
  if (!oneOf(x.status, RECEIPT_STATUSES)) errs.push(`${where}.status '${String(x.status)}' (ina ruhusiwa: ${RECEIPT_STATUSES.join("/")})`);
  if (!isArr(x.filesChanged)) errs.push(`${where}.filesChanged=[] inahitajika (hata tupu yenye BLOCKED/CANNOT)`);
  if (errs.length) return bad(...errs);
  const r = x as unknown as Receipt;
  r.filesChanged = (r.filesChanged as unknown[]).filter((f) => isObj(f) && isStr((f as any).path)).map((f: any) => ({
    path: String(f.path),
    summary: isStr(f.summary, 0) ? String(f.summary) : "",
    before: isStr(f.before, 0) ? String(f.before) : undefined,
    after: isStr(f.after, 0) ? String(f.after) : undefined,
  }));
  r.commandsRun = isArr(r.commandsRun) ? (r.commandsRun as unknown[]).filter((c) => isStr(c)) as string[] : [];
  r.blockedReason = typeof r.blockedReason === "string" ? r.blockedReason : null;
  return ok({ ...r });
}

/* ========================= Uchambuzi wa mkaguzi na Sign-off ========================= */

export function validateAnalystOutput(x: unknown, where = "analyst"): Verdict<AnalystOutput> {
  if (!isObj(x)) return bad(`${where}: si kitu`);
  if (!isStr(x.reviewer)) return bad(`${where}.reviewer inahitajika`);
  const defectsOut: AnalystOutput["defects"] = [];
  const errs: string[] = [];
  if (isArr(x.defects)) {
    x.defects.forEach((d, i) => {
      const v = validateDefect(d, `${where}.defects[${i}]`);
      if (v.ok) { const { status, attempts, history, ...rest } = v.value; defectsOut.push(rest); }
      else errs.push(...v.errors);
    });
  }
  if (errs.length) return bad(...errs);
  return ok({
    reviewer: String(x.reviewer),
    findings: isStr(x.findings, 0) ? String(x.findings) : "",
    defects: defectsOut,
    suggestions: isArr(x.suggestions)
      ? (x.suggestions as unknown[]).filter((s) => isObj(s) && isStr((s as any).title)).map((s: any) => ({ title: String(s.title), detail: isStr(s.detail, 0) ? String(s.detail) : "" }))
      : [],
  });
}

export function validateEvidencePack(x: unknown): Verdict<EvidencePack> {
  if (!isObj(x) || !isStr(x.milestoneId) || !isNum(x.round)) return bad("evidencePack: milestoneId/round vinahitajika");
  const p = x as unknown as EvidencePack;
  return ok({
    milestoneId: p.milestoneId, round: p.round,
    screenshots: isArr(p.screenshots) ? p.screenshots : [],
    domMetrics: isArr(p.domMetrics) ? p.domMetrics : [],
    checks: isArr(p.checks) ? p.checks : [],
    commands: isArr(p.commands) ? p.commands : [],
    gitDiffSummary: isObj(p.gitDiffSummary)
      ? { filesChanged: Number(p.gitDiffSummary.filesChanged) || 0, insertions: Number(p.gitDiffSummary.insertions) || 0, deletions: Number(p.gitDiffSummary.deletions) || 0 }
      : { filesChanged: 0, insertions: 0, deletions: 0 },
    regression: isArr(p.regression) ? p.regression : [],
    consoleErrors: isArr(p.consoleErrors) ? p.consoleErrors.filter((e) => isStr(e)) as string[] : [],
  });
}

export function newDefectId(existing: { id: string }[]): string {
  let n = 0;
  for (const d of existing) { const m = /^D-(\d+)$/.exec(d.id); if (m) n = Math.max(n, parseInt(m[1], 10)); }
  return `D-${String(n + 1).padStart(3, "0")}`;
}
export function newCOId(existing: { id: string }[]): string {
  let n = 0;
  for (const d of existing) { const m = /^CO-(\d+)$/.exec(d.id); if (m) n = Math.max(n, parseInt(m[1], 10)); }
  return `CO-${String(n + 1).padStart(3, "0")}`;
}
export function newCheckId(existing: { id?: string }[]): string {
  let n = 0;
  for (const d of existing) { const m = /^C-(\d+)$/.exec(d.id || ""); if (m) n = Math.max(n, parseInt(m[1], 10)); }
  return `C-${String(n + 1).padStart(3, "0")}`;
}

export { type SignOff as _SignOff };
