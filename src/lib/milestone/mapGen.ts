// src/lib/milestone/mapGen.ts — Hatua B+C ya 4.2: Optimus (Gemini Flash) anaandika ramani ya
// milestones; CODE inaihakiki (validateMilestoneMap). Batili → makosa yanarudishwa kwa LLM
// (hadi mara 3); zikishindwa zote → ramani ya dharura ceil(N/4) (kimaelezo: "mpango wa dharura").
import type { MilestoneMap, ReviewMode } from "./types";
import { fallbackMilestoneMap, parseJsonFromLLM, validateMilestoneMap } from "./schemas";

export interface AgendaItemLite { index: number; item: string }

export interface MapGenIO {
  /** call ya LLM (board inaunganisha pmClient ya Gemini Flash). Inarudisha maandishi. */
  callLLM: (system: string, user: string) => Promise<string>;
  agenda: AgendaItemLite[];
  sessionId: string;
  project: string;
  brief?: string;
  defaultMode?: ReviewMode;
}

export interface MapGenResult {
  map: MilestoneMap;
  attempts: number;
  lastErrors: string[];
  /** lanesUsed ya 10.4 inajaza kupitia ONESHO la nje (hapa tunatoa metadata tu) */
  usedFallback: boolean;
}

/** Prompt ya ramani (maandishi ya pekee — sheria: JSON TUPU). */
export function mapPrompt(i: { project: string; brief?: string; agenda: AgendaItemLite[]; defaultMode: ReviewMode }, retryErrors?: string[], retryNum?: number): { system: string; user: string } {
  const system = [
    "Wewe ni Optimus (Project Manager) wa timu ya wajenzi wa programu.",
    "KAZI YA SIKU HIZI: gawanya agenda ya mradi kuwa RAMANI YA MILESTONES (Mpango wa hatua_{-kubwa}).",
    "JIBU: JSON TUPEKEE. Hakuna maelezo ya ziada, hakuna maandishi ya nje ya JSON.",
    "Kanuni za ramani (CODE itazihakiki — kikosa moja, unarudishiwa makosa):",
    "- milestones zinafunika agenda 1..N ZOTE, kwa mpangilio, bila pengo wala overlap.",
    "- kila milestone: id (M1,M2,…), title, agendas{from,to}, phase, reviewMode ('visual'|'technical'|'mixed'), roster ya agents wanaohitajika (majina au ids: optimus/ultron/vextron/megatron/cybertron), rationale.",
    "- KUKUBALI: misombo mingi — UI/vipengele vya kuonekana; technical — backend/usalama/DB/deploy; mixed — zote.",
    "- wikwazo: milestone wa mwisho lazima ufunge na agenda ya mwisho (N).",
    "Muundo halisi (mfano – usiuongeze kingine majeureni):",
    '{ "milestones": [ { "id":"M1","title":"Msingi","agendas":{"from":1,"to":4},"phase":"foundation","reviewMode":"visual","roster":["optimus","ultron","vextron"],"rationale":"…" } ] }',
  ].join("\n");
  const user = [
    `MRADI: ${i.project}`,
    i.brief ? `BRIEF YA CEO: ${i.brief}` : null,
    `AGENDA (N=${i.agenda.length}):`,
    ...i.agenda.map((a) => `${a.index}. ${a.item}`),
    i.defaultMode ? `MODE YA DEFAULT ikiwa hujui: ${i.defaultMode}` : null,
    retryNum ? `UKOSAPI WA JARIBIO LILILOPITA (${retryNum}):` : null,
    ...(retryErrors || []).map((e) => `- ${e}`),
    retryNum ? "Rekebisha ramani yote upya uihakikishe: 1..N zinafunikwa, bila overlap, reviewMode halali." : null,
    "TTOA JSON PEKEE.",
  ].filter(Boolean).join("\n");
  return { system, user };
}

/**
 * Tengeneza ramani salama: hadi majaribio 3; kila jaribio rally & validator; zikishindwa → fallback.
 * (Hii ni sehemu ya code inayoamua — si LLM; LLM hupendekeza tu.)
 */
export async function generateMilestoneMap(io: MapGenIO): Promise<MapGenResult> {
  const N = io.agenda.length;
  let lastErrors: string[] = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { system, user } = mapPrompt(
      { project: io.project, brief: io.brief, agenda: io.agenda, defaultMode: io.defaultMode || "visual" },
      lastErrors.length ? lastErrors : undefined,
      attempt > 1 ? attempt - 1 : undefined,
    );
    let text = "";
    try { text = await io.callLLM(system, user); } catch (e) {
      lastErrors = [`LLM ilishindwa kuitwa: ${String((e as Error)?.message || e).slice(0, 200)}`];
      continue;
    }
    const parsed = parseJsonFromLLM(text);
    if (!parsed) { lastErrors = ["jibu halikuwa na JSON inayosomeka"]; continue; }
    const v = validateMilestoneMap(parsed, N, io.sessionId);
    if (v.ok) {
      return { map: v.value, attempts: attempt, lastErrors, usedFallback: false };
    }
    lastErrors = v.errors;
  }
  // Njiya ya dharura ya hati (4.2): ceil(N/4) kwa sehemu sawa — hii NI kukubalika kwa hati,
  // lakini iko wazi usedFallback=true (ripoti mkataba wa kuonesha).
  return {
    map: fallbackMilestoneMap(N, io.sessionId, io.defaultMode || "visual"),
    attempts: 3,
    lastErrors,
    usedFallback: true,
  };
}
