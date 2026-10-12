// src/lib/milestone/ocb.ts — Operation Context Block (maelezo.md §6) — inajengwa na CODE pekee
// kutoka hali halisi (MilestoneMap/MilestoneState/defects). LLM hatiwi kabisa hapa (§6.1.1).
// §6.1.4: muundo huu una snapshot tests (kila hatua × jukumu) — kubadili mumbu = kuvunja snapshots.
import { currentMilestone } from "./state";
import type { Milestone, MilestoneMap, MilestonesRunState } from "./types";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
}

export interface OcbArgs {
  project: string;       // jina la mradi
  brief?: string;        // muhtasari wa ombi la CEO (default: project)
  team: TeamMember[];    // kikosi chote (agents.ts)
  run: MilestonesRunState;
  map: MilestoneMap;
  roleId: string;        // agent anayepewa OCB hii
  step: string;          // hatua ya sasa kwa lugha fupi ("UKO HAPA")
  next: string;          // KINACHOFUATA (hatua 1–2 zijazo)
  milestoneId?: string;  // default: currentMilestone(run)
  round?: number;        // raundi x/10 inapofaa (0 ujaurihusiwa — Raundi 0 ya ukaguzi)
  reader?: string;       // MATOKEO YAKO YATASOMWA NA (default: timu ya Board)
}

const FLOW_LINES: string[] = [
  " 1) Agenda + ramani ya milestones (Optimus)",
  " 2) Kwa kila milestone: mjadala wa agenda -> ledger + mini-reports",
  " 3) Milestone ikifungwa: Optimus anaandika Mpango wa Milestone",
  " 4) Computer anajenga + anaandika Ripoti ya Milestone",
  " 5) Mfumo unakusanya ushahidi (picha/vipimo/matokeo ya amri)",
  " 6) Wakaguzi wawili wanachambua, timu inajadili, Optimus anaandika Maagizo ya Mabadiliko",
  " 7) Computer anarekebisha; ushahidi mpya; wakaguzi wanathibitisha (hadi RAUNDI 10)",
  " 8) Wakipitisha: milestone inayofuata. Milestones zote zikiisha: Optimus anaandika Ripoti ya Mwisho kwa CEO,",
  "    Computer ana-push/deploy mwisho.",
];

const XMD_COMPUTER_LINES: string[] = [
  "- XMD Computer: mhandisi anayejenga kwa vitendo kwenye sandbox. Anaandika code, anaendesha amri,",
  "  anapiga screenshots. HAONI mjadala wetu. Anajua tu: Mpango wa Milestone, ledger,",
  "  Maagizo ya Mabadiliko. Anachukua maagizo KWA NENO. Hawezi kuuliza maswali.",
];

const DEFAULT_READER = "timu nzima ya Board (na Computer anapokaguliwa kutegemea matokeo yako)";

function openMilestones(run: MilestonesRunState): string[] {
  return run.map.milestones
    .filter((m) => ["SIGNED_OFF", "SIGNED_OFF_WITH_WAIVERS"].includes(run.states[m.id]?.status || ""))
    .map((m) => m.id);
}

function openDefects(run: MilestonesRunState): number {
  return run.defects.filter((d) => ["OPEN", "IN_FIX", "REOPENED"].includes(d.status)).length;
}

function waiversOf(run: MilestonesRunState): number {
  return run.defects.filter((d) => d.status === "WAIVED").length;
}

function teamLines(team: TeamMember[], roster: string[] | null): string[] {
  const lines: string[] = [];
  for (const m of team) {
    if (m.id === "pm") {
      lines.push("- Optimus: kiongozi, anaandika agenda, ramani ya milestones, mipango, ripoti ya mwisho.");
      continue;
    }
    // QA (Cybertron) huonekana tu kama yuko kwenye roster ya milestone (§6.2)
    if (m.id === "qa" && !(roster && roster.includes("qa"))) continue;
    const offRoster = roster && !roster.includes(m.id);
    lines.push(`- ${m.name}: ${m.role}${offRoster ? "      (hayupo kwenye roster ya milestone hii)" : ""}`);
  }
  return [...lines, ...XMD_COMPUTER_LINES];
}

function milestoneSeg(ms: Milestone | null, map: MilestoneMap): string {
  if (!ms) return "";
  const ordinal = map.milestones.findIndex((x) => x.id === ms.id) + 1;
  return ` | Milestone ${ms.id}: ${ms.title} (agenda ${ms.agendas.from}–${ms.agendas.to}) ${ordinal}/${map.milestones.length}`;
}

/** buildOCB (§6.2) — muundo wa kudumu: ramani haibadiliki kwa mtu; hali ndiyo inayobadilika. */
export function buildOCB(a: OcbArgs): string {
  const ms = (a.milestoneId ? a.map.milestones.find((x) => x.id === a.milestoneId) : undefined) || currentMilestone(a.run);
  const roster = ms?.roster || null;
  const done = openMilestones(a.run);
  const roundSeg = a.round !== undefined ? ` | RAUNDI ${a.round}/10` : "";
  return [
    "=== MAZINGIRA YA OPERESHENI (usiyapuuze) ===",
    `MRADI: ${a.project}. Ombi la CEO kwa ufupi: ${a.brief || a.project}`,
    "",
    "TIMU YETU:",
    ...teamLines(a.team, roster),
    "",
    "MTIRIRIKO WA OPERESHENI:",
    ...FLOW_LINES,
    "",
    `UKO HAPA: ${a.step}${milestoneSeg(ms, a.map)}${roundSeg}`,
    `WANAOSHIRIKI MILESTONE HII: ${roster ? roster.map((id) => a.team.find((t) => t.id === id)?.name || id).join(", ") : "(hakuna bado)"}`,
    `KINACHOFUATA: ${a.next}`,
    `MATOKEO YAKO YATASOMWA NA: ${a.reader ?? DEFAULT_READER}`,
    "",
    `HALI: maamuzi yaliyofungwa: ${Object.keys(a.run.stepsDone).length}; milestones zilizokamilika: ${done.length ? done.join(", ") : "hakuna bado"}; makosa wazi: ${openDefects(a.run)}; waivers: ${waiversOf(a.run)}.`,
    "KANUNI: ledger ndiyo mwamuzi; usipingane na maamuzi yaliyofungwa bila kuyaita 'ombi la mabadiliko';",
    "toa ushahidi (kitambulisho cha picha, kipimo, au matokeo ya amri) kwa kila dai.",
    "=== MWISHO WA MAZINGIRA ===",
  ].join("\n");
}

/** buildOCBC (§6.3) — OCB kamili + kifungu cha Computer: mkataba wa kumaliza, wakaguzi, CONFLICT. */
export function buildOCBC(a: OcbArgs): string {
  const base = buildOCB(a);
  const ms = (a.milestoneId ? a.map.milestones.find((x) => x.id === a.milestoneId) : undefined) || currentMilestone(a.run);
  const msTail = ms ? ` — ${ms.id}: ${ms.title}.` : ".";
  const here =
    a.round !== undefined && a.round > 0
      ? `raundi ${a.round}/10 ya marekebisho ya CO${msTail}`
      : `ujenzi wa mwanzo wa milestone hii${msTail}`;
  return [
    base,
    "=== TOLEO LA COMPUTER (OCB-C) — soma kwa makini ===",
    `UKO HAPA SASA: ${here}`,
    "KAZI YAKO ITAKAGULIWA: wakaguzi wawili (Designer + Frontend) wataichambua kazi yako pamoja na vipimo vya code (harness).",
    "Unatarajiwa kurudisha RISITI kwa kila Agizo la Mabadiliko (CO): faili zilizoguswa, kabla/baada, amri ulizoendesha.",
    "HUTAMALIZA hadi: (a) Ripoti ya Milestone imeandikwa na sehemu zake zote zimejazwa, (b) vipimo vya harness vimeendeshwa, (c) git commit imefanyika.",
    "CO ikirudiwa, ina maana jaribio lililopita halikutosha — tekeleza upya kwa uhakika zaidi.",
    "USIJIPE ALAMA; harness itapima. Ukikuta sheria zinazogongana (mpango dhidi ya maagizo mengine):",
    "andika '⚠️ CONFLICT' kwenye ripoti, tumia thamani ya ledger/Official Data, kisha endelea (hakuna kituo cha kuuliza CEO).",
    "=== MWISHO WA OCB-C ===",
  ].join("\n");
}

/* ============================================================================
 * WIRING HELPERS (P3 — boardRunner run()): hutengeneza OcbArgs kutoka hali ya run
 * ========================================================================== */

/** Milestone inayomiliki agenda hii (kwa OCB/roster gate). */
export function milestoneForAgenda(run: MilestonesRunState, agendaIndex: number): { milestone: Milestone; ordinal: number } | null {
  const idx = run.map.milestones.findIndex((x) => agendaIndex >= x.agendas.from && agendaIndex <= x.agendas.to);
  return idx < 0 ? null : { milestone: run.map.milestones[idx], ordinal: idx + 1 };
}

/** OCB ya mjadala wa agenda (wiring point ya boardRunner — §6.1.2: kila prompt ya owner). */
export function ocbForAgendaDiscussion(args: {
  run: MilestonesRunState;
  project: string;
  brief?: string;
  team: TeamMember[];
  agendaIndex: number;
  agendaTotal: number;
  roleId: string;
}): string {
  const link = milestoneForAgenda(args.run, args.agendaIndex);
  const m = link?.milestone;
  return buildOCB({
    project: args.project,
    brief: args.brief || args.project,
    team: args.team,
    run: args.run,
    map: args.run.map,
    roleId: args.roleId,
    step: `mjadala wa agenda ${args.agendaIndex}/${args.agendaTotal}`,
    milestoneId: m?.id,
    next: m
      ? `kuhitimisha agenda hii → ledger/mini-report ya ${m.id}; baadaye Optimus ataandika Mpango wa ${m.id} na Computer atajenga.`
      : `kuhitimisha agenda → ledger; hatua inayofuata itaamuliwa na Optimus.`,
    reader: m ? `Optimus (PM) — ataitumia kwenye Mpango wa ${m.id}, na Computer atatekeleza neno kwa neno` : "Optimus (PM)",
  });
}
