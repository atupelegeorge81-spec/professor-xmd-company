// src/lib/milestone/state.ts — mashine ya hali + persistence (maelezo.md 5.2, 11).
// Hali inabeba kwenye chip fiche ya runner.items (MS_PREFIX) — inategemea mfumo uliopo wa
// persist() wa boardRunner, hivyo server ikifa/resume hali inarudi kamili (11.1–11.3).
import type { Milestone, MilestoneMap, MilestoneState, MilestoneStatus, MilestonesRunState } from "./types";

export const MS_PREFIX = "__professor_xmd_milestones__v1__";
export const MS_CHIP_ID = "xmd_milestones_state";

/* ========================= chip codec ========================= */

export function readMilestonesState(items: unknown[]): MilestonesRunState | null {
  const it = [...(items || [])].reverse().find((x: any) => x?.kind === "chip" && typeof x?.text === "string" && x.text.startsWith(MS_PREFIX)) as any;
  if (!it) return null;
  try { return JSON.parse(it.text.slice(MS_PREFIX.length)); } catch { return null; }
}

export function writeMilestonesState(items: any[], run: MilestonesRunState): MilestonesRunState {
  const text = MS_PREFIX + JSON.stringify(run);
  const idx = items.findIndex((x: any) => x?.kind === "chip" && (x?.id === MS_CHIP_ID || (typeof x?.text === "string" && x.text.startsWith(MS_PREFIX))));
  const item = { kind: "chip", id: MS_CHIP_ID, text };
  if (idx >= 0) items[idx] = item; else items.push(item);
  return run;
}

/* ========================= ujenzi wa run state ========================= */

const iso = () => new Date().toISOString();

export function initMilestonesRun(sessionId: string, map: MilestoneMap): MilestonesRunState {
  const now = iso();
  const states: Record<string, MilestoneState> = {};
  for (const m of map.milestones) {
    states[m.id] = {
      id: m.id,
      status: "DISCUSSING",
      round: 0,
      maxRounds: 10,
      currentStepId: `${m.id}.D.discuss`,
      startedAt: now,
      updatedAt: now,
      lanesUsed: [],
    };
  }
  return {
    version: 1,
    sessionId,
    map,
    states,
    currentMilestoneId: map.milestones[0]?.id || null,
    defects: [],
    cos: [],
    crs: [],
    signoffs: [],
    stepsDone: {},
    plans: {},
    evidence: {},
  };
}

/* ========================= mashine ya hali (11.1) ========================= */

/** Mabadiliko yanayokubalika. PAUSED_* → inarudi pausedFrom (kuna uhusiano wazi — angalia canTransition). */
const TRANSITIONS: Record<MilestoneStatus, MilestoneStatus[]> = {
  DISCUSSING: ["PLANNING", "BLOCKED", "PAUSED_QUOTA", "PAUSED_INFRA"],
  PLANNING: ["BUILDING", "BLOCKED", "PAUSED_QUOTA", "PAUSED_INFRA"],
  BUILDING: ["EVIDENCE", "BLOCKED", "PAUSED_QUOTA", "PAUSED_INFRA"],
  EVIDENCE: ["REVIEW_R0", "BLOCKED", "PAUSED_QUOTA", "PAUSED_INFRA"],
  REVIEW_R0: ["FIXING", "SIGNED_OFF", "BLOCKED", "PAUSED_QUOTA", "PAUSED_INFRA"],
  FIXING: ["VERIFYING", "CAP_REACHED", "BLOCKED", "PAUSED_QUOTA", "PAUSED_INFRA"],
  VERIFYING: ["FIXING", "SIGNED_OFF", "SIGNED_OFF_WITH_WAIVERS", "CAP_REACHED", "BLOCKED", "PAUSED_QUOTA", "PAUSED_INFRA"],
  SIGNED_OFF: [],
  SIGNED_OFF_WITH_WAIVERS: [],
  CAP_REACHED: [],
  BLOCKED: ["PLANNING", "PAUSED_QUOTA", "PAUSED_INFRA"],
  PAUSED_QUOTA: [], // resume: nenda pausedFrom
  PAUSED_INFRA: [],
};

const TERMINAL = new Set<MilestoneStatus>(["SIGNED_OFF", "SIGNED_OFF_WITH_WAIVERS", "CAP_REACHED"]);

export function canTransition(from: MilestoneStatus, to: MilestoneStatus): boolean {
  if (from === to) return true;
  if (from === "PAUSED_QUOTA" || from === "PAUSED_INFRA") return true; // resume inarudi pausedFrom (controller anateua)
  return (TRANSITIONS[from] || []).includes(to);
}

export interface AdvanceResult {
  ok: boolean;
  state: MilestoneState;
  changed: boolean; // false = stepId tayari ilikuwa DONE (idempotent skip)
  error?: string;
}

/**
 * Hatua yenye uwezo wa kujirudia salama (11.2): stepId ikiisha kufanikisha, kuirudia ni no-op.
 * Mabadiliko yanasajiliwa KABLA ya kuanza kazi ndefu inayofuata (11.1).
 */
export function advance(run: MilestonesRunState, milestoneId: string, to: MilestoneStatus, stepId: string): AdvanceResult {
  const st = run.states[milestoneId];
  if (!st) return { ok: false, state: st, changed: false, error: `milestone ${milestoneId} haipo` };
  const doneStep = run.stepsDone[stepId];
  if (doneStep) {
    if (st.status === to) return { ok: true, state: st, changed: false }; // tayari tumefika — idempotent
    // stepId sawa lakini hali tofauti → resume ilinasa katikati; sasa tumalizie (bado idempotent kwa matokeo)
  }
  if (TERMINAL.has(st.status)) return { ok: false, state: st, changed: false, error: `milestone ${milestoneId} iko kwenye hali ya mwisho (${st.status}) — haitabadilika tena` };
  if (!canTransition(st.status, to)) {
    return { ok: false, state: st, changed: false, error: `mabadiliko marufuku: ${st.status} → ${to} (milestone ${milestoneId})` };
  }
  const now = iso();
  // P3: rekodi ya stepId huandikwa hata hali inaporudi jina jina (mark("PLANNING","X") → mark("PLANNING","X"))
  run.stepsDone[stepId] = { stepId, result: "DONE", at: now };
  if (fromIsSame(st.status, to)) {
    st.currentStepId = stepId;
    st.updatedAt = now;
    return { ok: true, state: st, changed: false };
  }
  if (to === "PAUSED_QUOTA" || to === "PAUSED_INFRA") st.pausedFrom = st.status;
  else st.pausedFrom = undefined;
  st.status = to;
  st.currentStepId = stepId;
  st.updatedAt = now;
  return { ok: true, state: st, changed: true };

  function fromIsSame(a: MilestoneStatus, b: MilestoneStatus) { return a === b; }
}

/**\n * Resume baada ya pause: rudi hali iliyokuwepo kabla ya PAUSED_*. stepId mpya huandikwa.              */
export function resumeFromPause(run: MilestonesRunState, milestoneId: string, stepId: string): AdvanceResult {
  const st = run.states[milestoneId];
  if (!st) return { ok: false, state: st!, changed: false, error: `milestone ${milestoneId} haipo` };
  if (st.status !== "PAUSED_QUOTA" && st.status !== "PAUSED_INFRA") return { ok: false, state: st, changed: false, error: `${milestoneId} haiko kwenye pause (${st.status})` };
  const back = st.pausedFrom || "DISCUSSING";
  st.status = back;
  st.pausedFrom = undefined;
  st.currentStepId = stepId;
  st.updatedAt = iso();
  run.stepsDone[stepId] = { stepId, result: `RESUMED→${back}`, at: iso() };
  return { ok: true, state: st, changed: true };
}

/** Milestone ya kwanza isiyo terminal — ndiyo "sasa" kwa controller. */
export function currentMilestone(run: MilestonesRunState): Milestone | null {
  for (const m of run.map.milestones) {
    const st = run.states[m.id];
    if (st && !TERMINAL.has(st.status)) return m;
  }
  return null;
}

export function milestoneById(run: MilestonesRunState, id: string): Milestone | null {
  return run.map.milestones.find((m) => m.id === id) || null;
}

export function isMilestoneDone(run: MilestonesRunState, id: string): boolean {
  const st = run.states[id];
  return !!st && TERMINAL.has(st.status);
}

/** Je agenda hi ndiyo ya MWISHO kwenye M yake? (trigger ya 4.4 — code inaamua, si LLM) */
export function isLastAgendaOfMilestone(run: MilestonesRunState, id: string, agendaIndex: number): boolean {
  const m = milestoneById(run, id);
  return !!m && agendaIndex === m.agendas.to;
}

/** Milestone inayomiliki agenda hii (kwa map ya run hii). */
export function milestoneOfAgenda(run: MilestonesRunState, agendaIndex: number): Milestone | null {
  return run.map.milestones.find((m) => agendaIndex >= m.agendas.from && agendaIndex <= m.agendas.to) || null;
}

/** Je yote yamefika mwisho? (ripoti ya mwisho inaruhusiwa) */
export function allMilestonesTerminal(run: MilestonesRunState): boolean {
  return run.map.milestones.every((m) => TERMINAL.has(run.states[m.id]?.status || "DISCUSSING"));
}

/** MUONGOZO wa 4.4 (idempotent): kama tayari hatua hii imepita, usianzishe tena. */
export function alreadyDone(run: MilestonesRunState, stepId: string): boolean {
  return !!run.stepsDone[stepId];
}

export { TERMINAL as TERMINAL_STATUSES };
