// src/lib/milestone/startPack.ts — MilestoneStartPack (4.6): muktadha MPYA wa Computer
// kila milestone/raundi. Computer HAPATI mini-reports kamili (9) — anapata pack fupi hii.
import type { ChangeOrder, Defect, Milestone } from "./types";
import { buildRoundHeader } from "./rounds";
import { RECEIPT_PROTOCOL_LINES } from "./receipts";
import type { MilestoneState } from "./types";

export interface StartPackInput {
  project: string;
  milestone: Milestone;
  state: MilestoneState;
  /** mpango wa awamu (md kamili bado seinakomo kwenye plan.md — hapa ni LAZIMA-ZA-JUU tu) */
  ledgerSlice?: string; // sehemu za muhimu za ledger (si zote)
  repoSummary?: string; // muhtasari mfupi wa hali ya repo (branch, commits hivi karibuni, mbinu)
  priorReports?: { milestoneId: string; summary: string }[];
  inheritedDefects?: Defect[];
  cos?: ChangeOrder[]; // raundi>0: maagizo ya mabadiliko ya raundi hii
  ocbC: string; // OCB-C (code-built, ocb.ts)
  buildInstructions?: string; // maagizo mahsusi ya raundi (mf. NO-OP reprimand, pair_patch note)
}

/** Andika pack ya maandishi (markdown) inayoambatishwa na plan.md: UWAZI wa unachotarajiwa. */
export function buildStartPack(i: StartPackInput): string {
  const round = i.state.round;
  const isFix = round > 0;
  const L: string[] = [];
  L.push("", "═══════════════════════════════════════");
  L.push(`MILESTONE START PACK — ${i.milestone.id}: ${i.milestone.title}`);
  L.push("═══════════════════════════════════════");
  L.push(`⚙️ Hati hirio: ${isFix ? `RAUNDI ${round}/${i.state.maxRounds} ya marekebisho` : "UJENZI WA MWANZO"}`);
  L.push(buildRoundHeader(i.state, i.inheritedDefects || []));
  L.push("");
  if (isFix && i.cos?.length) {
    L.push("## MAAGIZO YA MABADILIKO (CO) YA RAUNDI HII — tekeleza zote, moja baada ya nyingine");
    for (const co of [...i.cos].sort((a, b) => a.priority - b.priority)) {
      L.push("");
      L.push(`### ${co.id} (jaribio ${co.attempt}/${i.state.maxRounds} · kipaumbele ${co.priority} · ${co.mode})`);
      L.push(`- Mahali: ${co.location.files.join(", ")}${co.location.route ? ` @ ${co.location.route}` : ""}${co.location.selector ? ` (${co.location.selector})` : ""}`);
      L.push(`- Hali ya sasa: ${co.current}`);
      L.push(`- Hali inayotakiwa: ${co.desired}`);
      if (co.visionNote) L.push(`- Maelezo ya kuona: ${co.visionNote}`);
      if (co.diagnosis) L.push(`- Utambuzi wa chanzo: ${co.diagnosis}`);
      if (co.patch) { L.push("- PATCH KAMILI (pair-patch — tumia hii neno kwa neno):"); L.push("```"); L.push(co.patch); L.push("```"); }
      L.push("- Vipimo vya kukubalika (harness itavipima):");
      for (const c of co.acceptance) {
        L.push(`  • ${c.type}${c.selector ? ` ${c.selector}` : ""}${c.route ? ` @ ${c.route}` : ""}${c.property ? `: ${c.property}` : ""}${c.expected ? ` = ${c.expected}` : ""}${c.cmd ? `: ${c.cmd}` : ""}`);
      }
    }
    L.push("");
    L.push(...RECEIPT_PROTOCOL_LINES);
  }
  if (i.inheritedDefects?.length) {
    L.push("");
    L.push("## MAKOSA YALIYORITHIWA kutoka milestones zilizopita (lazima yashughulikiwe hapa au kurekodiwa):");
    for (const d of i.inheritedDefects) L.push(`- ${d.id} [${d.severity}·jaribio-${d.attempts}] ${d.title} — inatarajiwa: ${d.expected} | hali: ${d.actual}`);
  }
  if (i.ledgerSlice) { L.push(""); L.push("## LEDGER (sehemu za muhimu — mwamuzi wa mwisho kwa swali lolote):"); L.push(i.ledgerSlice); }
  if (i.repoSummary) { L.push(""); L.push("## HALI YA REPO:"); L.push(i.repoSummary); }
  if (i.priorReports?.length) {
    L.push("");
    L.push("## RIPOTI ZA MILESTONES ZILIZOPITA (muhtasari):");
    for (const r of i.priorReports) L.push(`- ${r.milestoneId}: ${r.summary}`);
  }
  if (i.buildInstructions) { L.push(""); L.push("## MAAGIZO MAHSUSI YA RAUNDI HII:"); L.push(i.buildInstructions); }
  L.push("");
  L.push(i.ocbC);
  return L.join("\n");
}
