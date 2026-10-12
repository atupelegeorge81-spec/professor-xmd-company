// src/lib/milestone/checks.ts — aina za vipimo + maelezo kwa wakaguzi + kutoa vipimo kwenye
// mpango ("Vipimo vya Kukubalika" kwa muundo wa mashine — maelezo.md 4.5, 8.3).
import type { AcceptanceCheck } from "./types";
import { validateAcceptanceCheck } from "./schemas";

/** Maelezo ya kuvutia ya kipimo (kwa ripoti uchambuzi wa wakaguzi). */
export function describeCheck(c: AcceptanceCheck): string {
  switch (c.type) {
    case "command": return `endesha \`${c.cmd}\` (exit≈${c.exitCode ?? 0})`;
    case "grep": return `\`${c.pattern}\` kwenye ${(c.paths || []).join(",")} idadi=${c.count ?? 0}`;
    case "dom_exists": return `selector \`${c.selector}\` ipo kwenye ${c.route}`;
    case "computed_style": return c.expected !== undefined
      ? `\`${c.selector}\`.${c.property} = ${c.expected} @ ${c.route}`
      : `\`${c.selector}\`.${c.property} haiko (forbidden: ${(c.forbidden || []).join(",")}) @ ${c.route}`;
    case "no_horizontal_overflow": return `hakuna overflow @ ${(c.routes || []).join(",")} (${(c.viewports || ["375x667"]).join(",")})`;
    case "console_clean": return `hakuna console errors @ ${(c.routes || []).join(",")}`;
    case "contrast_min": return `contrast( ${c.selector} ) ≥ ${c.min}`;
    case "touch_target_min": return `ukubwa( ${c.selector} ) ≥ ${c.px}px`;
    case "http": return `${(c.method || "GET").toUpperCase()} ${c.url} → ${c.status}${c.bodyContains ? ` & mwili una "${c.bodyContains}"` : ""}`;
    case "file_exists": return `faili \`${c.path}\` ipo`;
    case "file_contains": return `faili \`${c.path}\` ina "${(c.text || "").slice(0, 60)}"`;
    case "screenshot_taken": return `screenshot ya ${c.route} (${c.state || "default"}) imechukuliwa`;
    default: return JSON.stringify(c);
  }
}

/* ========================= Mpango wa Milestone — sehemu ya vipimo ========================= */

const SECTION_RE = /^#{1,6}\s*(?:vipimo vya kukubalika|acceptance checks)\b/im;

/**
 * Mpango wa Milestone lazima uwe na sehemu "Vipimo vya Kukubalika" yenye vipimo kwa muundo wa mashine.
 * Muundo unaokubaliwa (block ya JSON ndani ya fence au mistari `- [ ] {json}`):
 * ```json
 * [{"type":"command","cmd":"npm test"}]
 * ```
 */
export function extractChecksFromPlan(md: string, where = "mpango"): { checks: AcceptanceCheck[]; errors: string[] } {
  const text = String(md || "");
  const lines = text.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (SECTION_RE.test(lines[i])) { start = i + 1; break; }
  }
  if (start < 0) return { checks: [], errors: [`${where}: sehemu ya "Vipimo vya Kukubalika" haipo — mpango unakataliwa`] };
  // kukusanya hadi kichwa kinachofuata
  const body: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) break;
    body.push(lines[i]);
  }
  const raw = body.join("\n");
  const checks: AcceptanceCheck[] = [];
  const errors: string[] = [];
  // (1) fence ya JSON yenye orodha
  const fence = raw.match(/```json\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      const parsed = JSON.parse(fence[1]);
      const arr = Array.isArray(parsed) ? parsed : Array.isArray((parsed as any)?.checks) ? (parsed as any).checks : null;
      if (arr) {
        arr.forEach((c: unknown, i: number) => {
          const v = validateAcceptanceCheck(c, `vipimo[${i}]`);
          if (v.ok) checks.push(v.value); else errors.push(...v.errors);
        });
      } else errors.push(`${where}: fence ya JSON haijazalisha orodha ya vipimo`);
    } catch (e) {
      errors.push(`${where}: JSON ya vipimo haisomeki (${String((e as Error).message).slice(0, 120)})`);
    }
    return { checks, errors };
  }
  // (2) mistari ya `- [ ] {json}` / `- {json}`
  let found = false;
  body.forEach((line, i) => {
    const s = line.trim();
    const m = s.match(/^[-*]\s+(?:\[[ x]\]\s*)?(\{.*\})\s*$/);
    if (!m) return;
    found = true;
    try {
      const v = validateAcceptanceCheck(JSON.parse(m[1]), `vipimo-laini-${i + 1}`);
      if (v.ok) checks.push(v.value); else errors.push(...v.errors);
    } catch {
      errors.push(`vipimo mstari ${i + 1}: JSON haisomeki`);
    }
  });
  if (!found) errors.push(`${where}: sehemu ya vipimo ipo lakini haina kipimo chochote kwa muundo wa mashine (JSON)`);
  return { checks, errors };
}

/** Kigezo cha 4.5 / 12.3: kila mpango unahitaji kuwa na vipimo vina'tosha' — checks zinapaswa kuwa\n *  angalau moja, na kukiwa na hatua za kujenga (`impl`), kuwe na kipimo cha thibitisho (command/tests/http/dom). */
export function planHasVerification(checks: AcceptanceCheck[]): boolean {
  return checks.some((c) =>
    c.type === "command" || c.type === "http" || c.type === "dom_exists" || c.type === "contrast_min"
    || c.type === "no_horizontal_overflow" || c.type === "console_clean" || c.type === "file_exists" || c.type === "file_contains");
}
