// src/lib/milestone/host.ts — daraja la uunganishaji na boardRunner (P2: Hatua A–C, 4.1–4.2).
// Kanuni kuu kutoka maelezo.md: CODE inaamua hatua inayofuata (si LLM); hijazo zote zinanyumbana
// juu ya state chip (resume salama); LLM hutumika kupitia judge chain (Flash kwanza, 10.1–10.2).
import type { BoardEvent } from "@/lib/types";
import type { LogEntry } from "@/lib/types";
import { judgeChat } from "@/lib/broker/judge";
import { generateMilestoneMap } from "./mapGen";
import type { MilestoneMap, MilestonesRunState, ReviewMode } from "./types";
import {
  initMilestonesRun, readMilestonesState, writeMilestonesState, milestoneById,
} from "./state";

export interface MsHooks {
  bcast: (e: BoardEvent) => void;
  blog: (t: LogEntry["type"], msg: string) => void;
  addChip: (t: string) => void;
  persist: (status: string, title?: string) => Promise<void>;
  recordLane?: (milestoneId: string, rec: { call: string; lane: string; visionCapable: boolean; fallback?: boolean }) => void;
}

/** Milestones zinawaka kwa code mode (computerPlanned) + env XMD_MILESTONES != "off". */
export function milestonesEnabledFor(computerPlanned: boolean, mode?: string): boolean {
  if (process.env.XMD_MILESTONES === "off") return false;
  return !!computerPlanned || mode === "code";
}

/** callLLM kwa generateMilestoneMap: judge chain (Flash kwanza 10.1), message lamba. */
async function llmViaJudge(agentId: string, call: string, system: string, user: string, record?: (lane: string, vision: boolean, fb: boolean) => void): Promise<string> {
  const r = await judgeChat({
    agentId, call,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    maxTokens: 6000,
  });
  if (r.ok) {
    record?.(r.rec.lane, r.rec.visionCapable, r.rec.fallback);
    return r.text;
  }
  if ("wait" in r) throw new Error(`lane za hukumu ziko busy sasa: ${r.wait.reason}`);
  throw new Error(r.error);
}

export interface EnsureMapIO {
  sessionId: string;
  project: string;
  brief?: string;
  agenda: { index: number; item: string }[];
  items: unknown[]; // runner.items (chip inahifadhiwa humo)
  computerPlanned: boolean;
  /** tests: call ya LLM iliyochanganywa. Default: judgeChat. */
  callLLM?: (system: string, user: string) => Promise<string>;
  defaultMode?: ReviewMode;
}

export interface EnsureMapOut {
  run: MilestonesRunState | null;
  fresh: boolean; // ramani mpya imeundwa (vs imepuliziwa kutoka chip)
  map?: MilestoneMap;
  skipped?: string; // sababu ya kuruka (mf. plan mode / env off)
}

/** Events za UI za ramani nzima (replay/live). */
export function emitMapEvents(run: MilestonesRunState, hooks: MsHooks): void {
  for (const m of run.map.milestones) {
    const st = run.states[m.id];
    hooks.bcast({
      type: "milestone",
      milestone: {
        id: m.id, title: m.title, status: st?.status || "DISCUSSING",
        round: st?.round || 0, maxRounds: st?.maxRounds || 10,
        mode: m.reviewMode, active: run.currentMilestoneId === m.id,
      },
    });
  }
}

/**
 * Hatua A–C (4.1–4.2): ramani ipo → ipulizie kutoka chip (resume); hakuna → izalishi (flash),
 * ithibitishe kwa code, iandaze, iandabile kwenye chip + persist + chip ya wazi ya wastaajibu.
 */
export async function ensureMilestonesMap(io: EnsureMapIO, hooks: MsHooks): Promise<EnsureMapOut> {
  if (!milestonesEnabledFor(io.computerPlanned)) return { run: null, fresh: false, skipped: "plan mode / XMD_MILESTONES=off" };
  const existing = readMilestonesState(io.items) as MilestonesRunState | null;
  if (existing && existing.map?.milestones?.length && existing.map.totalAgendas === io.agenda.length) {
    emitMapEvents(existing, hooks);
    hooks.addChip(`🗺️ Ramani ya milestones (imepuliziwa): ${existing.map.milestones.map((m) => `${m.id} (${m.agendas.from}-${m.agendas.to}: ${m.title})`).join(" · ")}`);
    return { run: existing, fresh: false };
  }
  const caller = io.callLLM
    ? (system: string, user: string) => io.callLLM!(system, user)
    : (system: string, user: string) => llmViaJudge("pm", `${io.agenda[0]?.index ?? 1}..${io.agenda.length}.map`, system, user, (lane, vision, fb) => {
        hooks.recordLane?.(firstMilestoneId(io.items), { call: "A.map", lane, visionCapable: vision, fallback: fb });
      });
  // Q-003-UX: card ya RAMANI — SHIMMER {pending} tunapofanya LLM (Optimus anatengeneza),
  // kisha orodha KAMILI ya milestones ikikatwa na validator (umbo kama AgendaBuildCard)
  const itemsArr = io.items as Array<Record<string, unknown>>;
  const MSMAP_ID = "msmap_main";
  if (!itemsArr.some((x) => x?.kind === "msMap" && x.id === MSMAP_ID)) {
    itemsArr.push({ kind: "msMap", id: MSMAP_ID, total: 0, pending: true, milestones: [] });
    hooks.bcast({ type: "msMap", pending: true, total: 0, milestones: [] } as BoardEvent);
  }
  let gen: Awaited<ReturnType<typeof generateMilestoneMap>>;
  try {
    gen = await generateMilestoneMap({
      callLLM: caller,
      agenda: io.agenda,
      sessionId: io.sessionId,
      project: io.project,
      brief: io.brief,
      defaultMode: io.defaultMode,
    });
  } catch (e) {
    // shimmer isindelee milele — ondoa pending kabla ya kurudisha hitilafu juu
    const ix = itemsArr.findIndex((x) => x?.kind === "msMap" && x.id === MSMAP_ID && x.pending);
    if (ix >= 0) itemsArr.splice(ix, 1);
    throw e;
  }
  {
    const card = {
      kind: "msMap", id: MSMAP_ID,
      total: gen.map.milestones.length, pending: false, fallback: gen.usedFallback,
      milestones: gen.map.milestones.map((m) => ({ id: m.id, title: m.title, from: m.agendas.from, to: m.agendas.to, mode: m.reviewMode, roster: m.roster })),
    };
    const ix = itemsArr.findIndex((x) => x?.kind === "msMap" && x.id === MSMAP_ID);
    if (ix >= 0) itemsArr[ix] = card; else itemsArr.push(card);
    hooks.bcast({ type: "msMap", pending: false, total: card.total, fallback: gen.usedFallback, milestones: card.milestones } as BoardEvent);
  }
  const run = initMilestonesRun(io.sessionId, gen.map);
  run.currentMilestoneId = gen.map.milestones[0]?.id || null;
  // kwa matumizi ya lane record: Flash inaonekana (TIERS zingine = visionDegraded on visual only)
  if (gen.usedFallback) {
    hooks.blog("warning", "🗺️ Ramani ya dharura (LLM ya milestones ilishindwa mara 3) — umegawanyiko wa wastani umewekwa; itapitishwa na yote.");
  }
  writeMilestonesState(io.items, run);
  emitMapEvents(run, hooks);
  const parts = gen.map.milestones.map((m) => `${m.id} (${m.reviewMode}${m.agendas.from === m.agendas.to ? ` agenda ${m.agendas.from}` : ` agenda ${m.agendas.from}–${m.agendas.to}`}: ${m.title})`).join(" · ");
  hooks.addChip(`🗺️ Ramani ya milestones (${gen.map.milestones.length})${gen.usedFallback ? " [dharura]" : ""}: ${parts}`);
  hooks.blog("system", `🗺️ Ramani imekatwa (${gen.map.milestones.length} milestones${gen.usedFallback ? ", dharura" : ""}) — kila milestone itajadiliwa, kujengwa, kukaguliwa, kusainiwa.`);
  return { run, fresh: true, map: gen.map };
}

function firstMilestoneId(items: unknown[]): string {
  // recordLane default sink (scrapers hukaa — haitumiwi direct)
  return "M1";
}

/** Milestone ya agenda hii + roster (kwa 4.3) — helper ya run() ipate kitu rahisi. */
export function rosterForAgenda(run: MilestonesRunState, agendaIndex: number): string[] {
  const m = run.map.milestones.find((x) => agendaIndex >= x.agendas.from && agendaIndex <= x.agendas.to);
  return m?.roster || ["pm"];
}

export { milestoneById };
