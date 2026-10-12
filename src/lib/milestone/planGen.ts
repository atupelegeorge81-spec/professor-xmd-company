// src/lib/milestone/planGen.ts — Hatua F (4.5): Optimus anaandika MPANGO WA MILESTONE.
// Sheria: (a) mpango lazima uwe na "Vipimo vya Kukubalika" kwa muundo wa mashine (8.3);
// (b) Data Guard ikiugundua kupotosha data rasmi → guard_failed → HAUKUJENGWA kamwe (4.5/15#3).
import type { AcceptanceCheck, Defect, Milestone } from "./types";
import { extractChecksFromPlan, planHasVerification } from "./checks";
import { fallbackMilestoneMap } from "./schemas"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { guardText, type GuardHit } from "../board/dataGuard";
import type { FactSheet } from "../board/factSheet";

export interface MilestonePlanInput {
  project: string;
  brief?: string;
  milestone: Milestone;
  /** ledger maamuzi yaliyofungwa (umbizo fupi), si mini-reports kamili (9: context pack kwa Computer ni MilestoneStartPack) */
  ledgerShort: string;
  /** mini-reports za agenda za milestone (kama zinamoshi — Optimus azimishe) */
  miniReports?: string[];
  inheritedDefects?: Defect[];
  priorMilestoneReports?: { milestoneId: string; summary: string }[];
  facts?: FactSheet | null;
}

export interface MilestonePlan {
  md: string;
  title: string;
  checks: AcceptanceCheck[];
  guard: { ok: true } | { ok: false; hits: GuardHit[] };
  blocked: boolean;
  attempts: number;
  errors: string[];
}

export function milestonePlanPrompt(i: MilestonePlanInput, retryErrors?: string[]): { system: string; user: string } {
  const system = [
    "Wewe ni Optimus (Project Manager). Unaandika MPANGO WA MILESTONE kwa XMD Computer.",
    "Computer HAKUONI mjadala wa timu; atatekeleza mpango wako NENO KWA NENO. Hakuna kituo cha kuuliza maswali.",
    "JIBU: Markdown pekee (hakuna JSON hangaruka). Miti ya sehemu IFUATAZO (si zaidi):",
    "",
    "# Mpango wa Milestone <id>: <title>",
    "## Lengo", "(sentensi 1-2: mradi/milestone hii ifikae wapi)",
    "## Muktadha muhimu", "(maamuzi yaliyofungwa ya ledger yanayopaswa kutazamwa; inherited defects kama zipo)",
    "## Hatua", "(orodha ya hatua: kila hatua iko wazi, yenye faili zinazolengwa kama zinajulikana)",
    "## Vipimo vya Kukubalika", "(LAZIMA — block ya ```json yenye orodha ya vipimo vya mashine, fomati 8.3:",
    "aina: command|grep|dom_exists|computed_style|no_horizontal_overflow|console_clean|contrast_min|touch_target_min|http|file_exists|file_contains|screenshot_taken)",
    "## Taarifa za mteja (rasmi)", "(thamani za DATA RASMI KWENYE FACT SHEET zikiwa — nakala neno kwa neno, bila kubadilisha)",
    "",
    "KANUNI:",
    "- Data rasmi haibadiliki kabisa (bei, namba, anwani): andika kama ilivyo.",
    "- Kila kipimo vina \"type\"; kipimo bila \"type\" hakikubaliki (CODE itakataza).",
    "- Mpango usiotimiza mipimo KE haruni kujenga — CO ya marekebisho itarudi.",
  ].join("\n");
  const user = [
    `MRADI: ${i.project}`,
    i.brief ? `BRIEF: ${i.brief}` : null,
    `MILESTONE: ${i.milestone.id} — ${i.milestone.title} (agenda ${i.milestone.agendas.from}–${i.milestone.agendas.to}) · mode: ${i.milestone.reviewMode}`,
    i.milestone.rationale ? `Sababu ya milestone: ${i.milestone.rationale}` : null,
    i.ledgerShort ? `LEDGER (maamuzi yaliyofungwa):\n${i.ledgerShort}` : "LEDGER: (hakuna bado maamuzi yenye umuhimu wa kujumlisha)",
    i.miniReports?.length ? `MINI-REPORTS za agenda:\n${i.miniReports.join("\n---\n")}` : null,
    i.inheritedDefects?.length ? `MAKOSA YALIYORITHIWA (lazima yashughulikiwe):\n${i.inheritedDefects.map((d) => `- ${d.id} [${d.severity}] ${d.title} — inayotarajiwa: ${d.expected} | hali: ${d.actual}`).join("\n")}` : null,
    i.priorMilestoneReports?.length ? `RIPOTI za milestones zilizopita:\n${i.priorMilestoneReports.map((r) => `- ${r.milestoneId}: ${r.summary}`).join("\n")}` : null,
    i.facts ? `FACT SHEET (Data rasmi — nakala nena kwa neno sehemu ya Taarifa za mteja):\n${JSON.stringify(i.facts)}` : null,
    retryErrors?.length ? `\nMAKOSA YA JARIBIO LILILOPITA (rekebisha mpango mzima upya):\n${retryErrors.map((e) => `- ${e}`).join("\n")}` : null,
  ].filter(Boolean).join("\n");
  return { system, user };
}

/**
 * Zalisha mpango: kupita Data Guard + validator ya vipimo; hadi majaribio 3.
 * Ikiagunduliwa guard_failed MARAKUU: HAUKUJENGWA (blocked) hata baada ya jaribio 3 —
 * orchestrator inaweka milestone BLOCKED, si kujenga kwa plan yenye hatia.
 */
export async function generateMilestonePlan(
  i: MilestonePlanInput & { callLLM: (system: string, user: string, o?: { effort?: "low" | "medium" | "high" }) => Promise<string> },
): Promise<MilestonePlan> {
  const errors: string[] = [];
  let attempts = 0;
  const guardCheck = (md: string): GuardHit[] => (i.facts ? guardText(md, i.facts, {}) : []);
  for (attempts = 1; attempts <= 3; attempts++) {
    const { system, user } = milestonePlanPrompt(i, errors.length ? errors : undefined);
    let md = "";
    try {
      md = await i.callLLM(system, user, { effort: "high" });
    } catch (e) {
      errors.push(`LLM imeshindwa: ${String((e as Error)?.message || e).slice(0, 160)}`);
      continue;
    }
    if (!md || md.trim().length < 80) { errors.push("mpango umejibu fupi mno/utupu"); continue; }
    const got = extractChecksFromPlan(md, "mpango");
    if (got.errors.length) { errors.push(...got.errors); continue; }
    if (!got.checks.length || !planHasVerification(got.checks)) { errors.push("Vipimo vya Kukubalika havijalisha (hakuna kipimo cha thibitisho cha ujenzi)"); continue; }
    const hits = guardCheck(md);
    if (hits.length) {
      // 4.5: Data Guard ikishindwa → mpango haujengwi; jaribio inayofuata ifke upya kwa onyo
      errors.push(`Data Guard imerudisha: ${hits.slice(0, 3).map((h) => `${h.kind}: "${String(h.found).slice(0, 60)}" (inatarajiwa "${String(h.expected).slice(0, 60)}")`).join(" · ")}`);
      if (attempts === 3) {
        return { md, title: `${i.milestone.id} — ${i.milestone.title}`, checks: [], guard: { ok: false, hits }, blocked: true, attempts, errors };
      }
      continue;
    }
    return { md, title: `${i.milestone.id} — ${i.milestone.title}`, checks: got.checks, guard: { ok: true }, blocked: false, attempts, errors };
  }
  return { md: "", title: `${i.milestone.id} — ${i.milestone.title}`, checks: [], guard: { ok: true }, blocked: true, attempts: 3, errors };
}
