// src/lib/milestone/rounds.ts — kanuni za raundi/escalation/NO-OP/migongano/sign-off (maelezo.md 7, 5.9).
// Hii ndiyo "hukumu ya code": hakuna LLM inayobadilisha hizi kanuni; LLM hutoa ushahidi tu.
import type {
  AcceptanceCheck, ChangeOrder, CheckResult, Defect, MilestoneState,
  MilestonesRunState, Receipt, ReviewSignature, VerdictLetter,
} from "./types";
import type { COMode } from "./types";

/* ========================= 5.9 RoundHeader (code-built) ========================= */

export function buildRoundHeader(state: MilestoneState, defects: Defect[]): string {
  const mine = defects.filter((d) => d.milestoneId === state.id);
  const closed = mine.filter((d) => d.status === "VERIFIED_FIXED").length;
  const waivers = mine.filter((d) => d.status === "WAIVED").length;
  const open = mine.filter((d) => ["OPEN", "IN_FIX", "REOPENED"].includes(d.status));
  const openTxt = open.length
    ? `${open.length} (${open.map((d) => `${d.id}: jaribio la ${d.attempts}`).join(", ")})`
    : "0";
  const left = Math.max(0, state.maxRounds - state.round);
  return `RAUNDI ${state.round}/${state.maxRounds} (milestone ${state.id}) — Makosa yaliyofungwa: ${closed} · Yaliyo wazi: ${openTxt} · Waivers: ${waivers} · Raundi zilizobaki: ${left}`;
}

/* ========================= 7.4 escalation tiers ========================= */

export function escalationFor(attempts: number): COMode {
  if (attempts <= 1) return "standard";
  if (attempts === 2) return "concrete";
  if (attempts === 3) return "pair_patch";
  if (attempts === 4) return "split";
  return "redecide"; // 5+
}

export const ESCALATION_LABEL: Record<COMode, string> = {
  standard: "CO ya kawaida (risiti + git diff)",
  concrete: "CO ya uhakika (faili/selector/thamani kamili, kabla/baada)",
  pair_patch: "Pair-patch: Frontend anaandika patch kamili; harness inajaribu git apply; Computer neno kwa neno ikishindikana",
  split: "Gawanya CO vende vidogo +/au badilisha lane; Computer aeleze alichoona (reproduce) kwanza",
  redecide: "Mjadala wa kuamua upya: KEEP / MODIFY / WAIVE (wawili + Optimus; WAIVE kamwe si kimya)",
};

/* ========================= 7.3.1 NO-OP detection (code, si mkaguzi) ========================= */

/** Orodha ya faili zilizoguswa kutoka `git diff --name-only`. */
export function parseDiffNameOnly(diffOut: string): string[] {
  return String(diffOut || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** NO-OP: faili YOYOTE ya CO haijabadilika kwenye diff → agizo halikutekelezwa (faili-kwa-faili).
 *  Rudisha faili za CO zisizogusika; tupu = kazi ilifanyika kwenye faili zote zilizotajwa. */
export function noOpFiles(co: ChangeOrder, changedFiles: string[]): string[] {
  const changed = new Set(changedFiles);
  const coFiles = co.location.files || [];
  return coFiles.filter((f) => !changed.has(f));
}

export interface ReceiptCheck {
  ok: boolean;
  problems: string[];
}

/**
 * 5.6: risiti inalinganishwa na git diff. (a) faili iliyodaiwa haijabadilika → risiti inakataliwa;
 * (b) mabadiliko yasiyotajwa kwenye risiti → risiti inakataliwa (anaficha kazi)? Hati:
 * 'Tofauti (faili iliyodaiwa haijabadilika, au mabadiliko yasiyotajwa) inamaanisha risiti inakataliwa.'
 */
export function verifyReceiptAgainstDiff(receipt: Receipt, changedFiles: string[]): ReceiptCheck {
  const problems: string[] = [];
  const changed = new Set(changedFiles);
  const claimed = new Set((receipt.filesChanged || []).map((f) => f.path));
  for (const f of claimed) {
    if (!changed.has(f)) problems.push(`risiti inadaiya '${f}' ilibadilika lakini git diff haikaigusi`);
  }
  for (const f of changed) {
    if (!claimed.has(f)) problems.push(`git diff inaonyesha '${f}' ilibadilika lakini risiti haikuitaja`);
  }
  return { ok: problems.length === 0, problems };
}

/** Ujumbe mkali wa NO-OP kwa Computer (7.4) — code inauandika, si mkaguzi. */
export function noOpMessage(co: ChangeOrder, untouched: string[]): string {
  return `Agizo ${co.id} halikutekelezwa: \`git diff\` haigusi ${untouched.map((f) => `\`${f}\``).join(", ")}. Tekeleza sasa na urudishe risiti.`;
}

/* ========================= ulinzi dhidi ya migongano ya CO (7.4) ========================= */

export interface COConflict { coId: string; withId: string; why: string }

/** CO mpya inagongana na CO iliyopitishwa awali kama zinagusa selector/mali/file zilezile kwa thamani tofauti. */
export function findCOConflicts(existing: ChangeOrder[], candidate: ChangeOrder): COConflict[] {
  const out: COConflict[] = [];
  for (const e of existing) {
    if (e.id === candidate.id) continue;
    const sameSelector = e.location.selector && candidate.location.selector && e.location.selector === candidate.location.selector;
    const sameRoute = e.location.route && candidate.location.route && e.location.route === candidate.location.route;
    const sharedFiles = e.location.files.filter((f) => candidate.location.files.includes(f));
    if (!sameSelector && sharedFiles.length === 0) continue;
    // computed_style checks kwa mali ileile na thamani tofauti = mgongano halisi
    for (const ca of candidate.acceptance) {
      for (const ea of e.acceptance) {
        if (ca.type === "computed_style" && ea.type === "computed_style"
          && ca.property && ea.property && ca.property === ea.property
          && ca.expected && ea.expected && ca.expected !== ea.expected) {
          out.push({
            coId: candidate.id, withId: e.id,
            why: `mali '${ca.property}' inatakiwa '${ca.expected}' lakini ${e.id} ilishaweka '${ea.expected}' (${[...sharedFiles, sameRoute ? `route:${ca.route}` : ""].filter(Boolean).join(", ") || sameSelector})`,
          });
        }
      }
    }
  }
  return out;
}

/* ========================= 7.3.5 hukumu ya CO ========================= */

/**
 * CO ni PASS TU ikiwa: wakaguzi WOTE WAWILI wamesema PASS NA vipimo vya code vya CO hiyo vimepita.
 * Sheria ya dhahabu (8.3): mkaguzi hawezi kusema PASS kwa CO ambayo kipimo chake cha code kimeshindwa.
 * Mgongano (PASS+FAIL) → FAIL (wakaguzi wapewe zamu moja ya kuelewana kabla ya hukumu hii kuitwa).
 */
export function judgeCO(signatures: ReviewSignature[], checks: CheckResult[]): { verdict: VerdictLetter; reasons: string[] } {
  const reasons: string[] = [];
  const failedChecks = checks.filter((c) => c.result === "FAIL");
  if (failedChecks.length) {
    reasons.push(`vipimo vya code vimeshindwa: ${failedChecks.map((c) => `${c.id} (${c.type}: ${c.detail})`).join("; ")}`);
  }
  const letters = signatures.map((s) => s.verdict);
  const passAll = signatures.length >= 2 && letters.every((v) => v === "PASS");
  const anyFail = letters.includes("FAIL");
  const anyPartial = letters.includes("PARTIAL");
  if (!passAll) {
    if (letters.length < 2) reasons.push("sahihi za wakaguzi wawili zinahitajika");
    else if (anyFail && letters.includes("PASS")) reasons.push("mgongano wa wakaguzi (PASS dhidi ya FAIL) — inahesabiwa FAIL");
    else if (anyFail) reasons.push("wakaguzi wameshindwa kupitisha (FAIL)");
    else if (anyPartial) reasons.push("wakaguzi wamesema PARTIAL");
  }
  if (failedChecks.length && passAll) {
    reasons.push("sheria ya dhahabu: PASS ya mkaguzi haitegemezwi kipimo cha code kilichoshindwa");
  }
  const verdict: VerdictLetter = reasons.length === 0 ? "PASS" : (anyPartial && !anyFail ? "PARTIAL" : "FAIL");
  return { verdict, reasons };
}

/* ========================= sign-off gate (4.10) ========================= */

export interface SignOffGate {
  ok: boolean;
  withWaivers: boolean;
  status: "SIGNED_OFF" | "SIGNED_OFF_WITH_WAIVERS" | "BLOCKED";
  reasons: string[];
  /** defects zinazostahili ku-defekt waivers kwa sign-off hii (minor zilizo wazi) */
  openMinor: Defect[];
}

export function signOffGate(
  signatures: ReviewSignature[],
  allChecks: CheckResult[],
  defects: Defect[],
  receiptsOk: boolean,
  visionDegraded: boolean,
  reviewMode: "visual" | "technical" | "mixed",
): SignOffGate {
  const reasons: string[] = [];
  const open = defects.filter((d) => ["OPEN", "IN_FIX", "REOPENED"].includes(d.status));
  // 10.3(b): SIGN-OFF ya visual/mixed haiwezi kufanyika kwa lane isiyoona — subiri.
  if (visionDegraded && reviewMode !== "technical") {
    reasons.push("visionDegraded: hukumu ya mwisho ya SIGN-OFF lazima ifanywe na lane yenye vision — subiri nafasi ijitokeze");
  }
  const twoPass = signatures.length >= 2 && signatures.every((s) => s.verdict === "PASS");
  if (!twoPass) reasons.push("wakaguzi wote wawili hawakusema PASS");
  const failed = allChecks.filter((c) => c.result === "FAIL");
  if (failed.length) reasons.push(`vipimo ${failed.length} vimeshindwa (${failed.map((c) => c.id).join(", ")})`);
  const mediumPlus = open.filter((d) => d.severity !== "minor");
  if (mediumPlus.length) reasons.push(`makosa ${mediumPlus.length} ya ukali medium+ yaliyo wazi (${mediumPlus.map((d) => d.id).join(", ")})`);
  if (!receiptsOk) reasons.push("risiti hazilingani na git diff");
  const openMinor = open.filter((d) => d.severity === "minor");
  const ok = reasons.length === 0;
  return {
    ok,
    withWaivers: ok && openMinor.length > 0,
    status: ok ? (openMinor.length ? "SIGNED_OFF_WITH_WAIVERS" : "SIGNED_OFF") : "BLOCKED",
    reasons,
    openMinor,
  };
}

/* ========================= cap (4.9.8 / 7.5) ========================= */

/** Ikifika kikomo: makosa yote yaliyo wazi yanakuwa INHERITED (yanaendelea kwenye milestone inayofuata). */
export function applyCap(run: MilestonesRunState, milestoneId: string): Defect[] {
  const out: Defect[] = [];
  for (const d of run.defects) {
    if (d.milestoneId !== milestoneId) continue;
    if (["OPEN", "IN_FIX", "REOPENED"].includes(d.status)) {
      d.status = "INHERITED";
      out.push(d);
    }
  }
  return out;
}

/** Makosa yaliyorithiwa ya kuingizwa kwenye context pack ya milestone inayofuata. */
export function inheritedForNext(run: MilestonesRunState, milestoneId: string): Defect[] {
  const idx = run.map.milestones.findIndex((m) => m.id === milestoneId);
  if (idx < 0 || idx >= run.map.milestones.length - 1) return [];
  return run.defects.filter((d) => d.milestoneId === milestoneId && d.status === "INHERITED");
}

/* ========================= CO ipangwe kuanzia D-ids (kwa tests/orchestrator) ========================= */

export function sortCOsByPriority(cos: ChangeOrder[]): ChangeOrder[] {
  return [...cos].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

/** Kila kosa lazima liwe na CO; kosa lisilo na CO linakataliwa (validator iko schemas.ts — hapa ni mkaguzi wa seti). */
export function uncoveredDefects(defects: Defect[], cos: ChangeOrder[]): Defect[] {
  const covered = new Set(cos.flatMap((c) => c.defectIds));
  return defects.filter((d) => ["OPEN", "IN_FIX", "REOPENED"].includes(d.status) && !covered.has(d.id));
}

/* mini utils kwa acceptance ya checks ids */

export function withCheckIds(checks: AcceptanceCheck[], startAfter: { id?: string }[]): AcceptanceCheck[] {
  let n = 0;
  for (const d of startAfter) { const m = /^C-(\d+)$/.exec(d.id || ""); if (m) n = Math.max(n, parseInt(m[1], 10)); }
  return checks.map((c) => (c.id ? c : { ...c, id: `C-${String(++n).padStart(3, "0")}` }));
}
