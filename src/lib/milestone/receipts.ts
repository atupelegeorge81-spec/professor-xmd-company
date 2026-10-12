// src/lib/milestone/receipts.ts — RISITI HALISI (5.6/7.3): Computer anaandika
// `.xmd/receipts/<CO-ID>.json` kwa kila CO anayotekeleza; harness inasoma faili hizo
// kutoka kwenye sandbox, kuzipiga validateReceipt, na kuzipitisha kwa receipt-gate ya
// orchestrate (verifikasi dhidi ya git diff + ukaguzi wa NO-OP). Hakuna risiti haipanwi.
import { validateReceipt } from "./schemas";
import type { Receipt } from "./types";

export const RECEIPT_DIR = ".xmd/receipts";

/** Andiko la mkataba linaloingizwa kwenye StartPack — Computer anaelezewa wazi format ya risiti. */
export const RECEIPT_PROTOCOL_LINES: string[] = [
  "## MKATABA WA RISITI (5.6) — LAZIMA KWA KILA CO",
  `Baada ya kutekeleza kila CO (hata ikishindikana), andika faili: ${RECEIPT_DIR}/<CO-ID>.json`,
  "yenye muundo huu (JSON safi, bila maelezo ya ziada):",
  "```json",
  "{",
  '  "orderId": "<CO-ID — lazima iendane sawa na id ya CO, mf. CO-0007>",',
  '  "status": "DONE | PARTIAL | BLOCKED | CANNOT",',
  '  "filesChanged": [',
  '    { "path": "src/lib/x.ts", "summary": "nilichobadilisha", "before": "kabla (fupi)", "after": "baada (fupi)" }',
  "  ],",
  '  "commandsRun": ["npm run build", "npm test"],',
  '  "notes": "iniamuzi muhimu",',
  '  "blockedReason": null',
  "}",
  "```",
  "• CO inayoblockiwa: status BLOCKED/CANNOT + blockedReason wazi + filesChanged inaweza kuwa tupu.",
  "• path zilizoorodheshwa zinathibitishwa dhidi ya git diff halisi — risiti inayohitilafiana",
  "  na diff itakataliwa (haitahesabiwa kama jaribio halali).",
  "• hakuna risiti / risiti batili ⇒ CO inahesabiwa NOT_ATTEMPTED (jaribio la raundi halijakamilika).",
];

/** Kata JSON kutoka kwa maandishi (huruhusu ```json fences, leading prose, whitespace). */
export function extractJsonObject(text: string): string | null {
  if (!text || typeof text !== "string") return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = (fenced ? fenced[1] : text).trim();
  const start = src.indexOf("{");
  const end = src.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return src.slice(start, end + 1);
}

/**
 * Changanua faili za risiti (jina → maudhui) na urudishe orodha ya risiti HALALI tu.
 * Faili batili (JSON-ovyo / orderId ikose / status isiyoco) hutupwa kimya — orchestrate
 * itahesabia CO husika kama NOT_ATTEMPTED kupitia receipt-gate yake kawaaida.
 */
export function parseReceiptFiles(files: Record<string, string>): Receipt[] {
  const out: Receipt[] = [];
  const seen = new Set<string>();
  for (const name of Object.keys(files).sort()) {
    const json = extractJsonObject(files[name]);
    if (!json) continue;
    let raw: unknown;
    try { raw = JSON.parse(json); } catch { continue; }
    const v = validateReceipt(raw, `receipt(${name})`);
    if (!v.ok) continue;
    // ulinzi wa duplicate: JSON ya mwisho kwa orderId hiyo ndiyo itumike (tunachukua ya kwanza kama tendo gumu)
    if (seen.has(v.value.orderId)) continue;
    seen.add(v.value.orderId);
    out.push(v.value);
  }
  return out.sort((a, b) => a.orderId.localeCompare(b.orderId));
}

/** Script moja-line ya shell inayochapisha faili zote za risiti zenye marker za kugawanya. */
export function receiptFetchShell(dir = RECEIPT_DIR): string {
  return `sh -c 'for f in "${dir}"/*.json; do [ -f "$f" ] && { printf "\\n@@@RECEIPT:%s\\n" "$(basename "$f")"; cat "$f"; }; done'`;
}
