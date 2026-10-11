/**
 * R50 · Awamu 1 — `feature_list.json`: mpango (hatua) → features zinazopimika (harness ya kudumu).
 *
 * Msingi wa utafiti (ona MPANGO-KAZI-R50-harness.md §0.0 — si ubuni):
 *  • Anthropic, "Effective harnesses for long-running agents" (Nov 26 2025):
 *      - `feature_list.json` (JSON, SIni Markdown): model haziharibu JSON kimakusudi; katika
 *        Markdown ana-overwrite. Features ZOTE zinaanza kufeli (default-FAIL); agent anagusa
 *        shamba la hali PEKEE; hatua MOJA kwa wakati.
 *  • anthropics/cwc-long-running-agents (Code with Claude 2026): "Default-FAIL contract" —
 *      hakuna feature inayoweza kuitwa `passed` bila ushahidi uliofunguliwa kwanza; harness
 *      ndiye mamlaka ya hali, si kauli ya agent.
 *  • Anthropic, "Harness design for long-running application development" (Mar 24 2026):
 *      "sprint contract" — "done" hukubaliwa KABLA ya code: hapa `**Verification:**` ya kila
 *      hatua + §7 QA Checklist ndiyo mkataba huo; check za §7 zinakuwa checks zinazopimika.
 *
 * KANUNI: kila feature inaanza `pending` + kila check `not_run`. Hakuna kinachorithi "passed".
 */

/** Faili ndani ya sandbox (workspace ya bridge — cwd ya agent). */
export const FEATURE_LIST_SANDBOX_PATH = "/home/user/ws/feature_list.json";

export type CheckKind = "command" | "assertion";
export type CheckState = "not_run" | "passed" | "failed" | "skipped";
/** pending → in_progress → passed/failed. `passed` inathibitishwa na harness (Awamu 2), si agent. */
export type FeatureState = "pending" | "in_progress" | "passed" | "failed";

export interface FeatureCheck {
  id: string;
  kind: CheckKind;
  required: boolean;
  /** kind="command": amri inayoendeshwa (bila shell operators — salama ku-run kama ilivyo). */
  command?: string;
  /** kind="assertion": kile kinachotakiwa kuwa KWELI (kutoka `**Verification:**` / QA bullet). */
  expect?: string;
  state: CheckState;
  exit_code: number | null;
  artifact: string | null;
}

/** Ushahidi hurekodiwa na harness (Awamu 2/6) — si maandishi ya agent. */
export interface FeatureEvidence {
  kind: "command" | "browser" | "file";
  ref: string;
  exit_code?: number | null;
  artifact?: string | null;
  /** browser evidence LAZIMA iwe na "Nimeona: …" (Awamu 5) */
  note?: string;
  at?: string;
}

export interface PlanFeature {
  id: string;             // "step-01" … ; QA ya mwisho: "qa-final"
  title: string;
  required: boolean;
  qa: boolean;            // §7 QA / step ya mwisho ya QA
  state: FeatureState;    // ⚠ inaanza "pending" — default-FAIL
  attempts: number;
  checks: FeatureCheck[];
  evidence: FeatureEvidence[];
  last_failure: string | null;
}

export interface FeatureList {
  schema_version: 1;
  run_id: string;
  plan_id: string;
  generated_at: string;
  features: PlanFeature[];
}

export interface FeatureListOpts {
  runId?: string;
  planId?: string;
  now?: string;
}

/* ============================ parsing (inalingana na workPlan.ts) ============================ */

/** Sawa na `parsePlanSteps` (board/workPlan.ts): "### Step N — Title". */
const STEP_LINE_RX = /^###\s*Step\s+(\d+)\s*[—–-]+\s*(.+)$/gm;
const VERIFICATION_RX = /^[-*]\s*\*\*Verification:\*\*\s*(.+?)\s*$/m;
const QA_HEADING_RX = /^##\s*(?:\d+[.)]?\s*)?QA Checklist[^\n]*$/im;
const BULLET_RX = /^[-*]\s+(?:\[[ xX]\]\s*)?(.+?)\s*$/gm;

/** Command salama: binary inayojulikana, hakuna shell metachars (;&|$<>`) — inaendeshwa kama ilivyo. */
const SAFE_CMD_RX =
  /^(?:npm|npx|pnpm|yarn|bun|node|python3?|pip3?|pytest|vitest|tsc|playwright|git|curl)\b[^\n;&|`$<>]*$/i;

function backtickedCommand(text: string): string | null {
  for (const m of String(text || "").matchAll(/`([^`\n]+)`/g)) {
    const c = m[1].trim();
    if (SAFE_CMD_RX.test(c)) return c;
  }
  return null;
}

function checkFromText(id: string, text: string): FeatureCheck {
  const cmd = backtickedCommand(text);
  if (cmd) {
    return { id, kind: "command", required: true, command: cmd, state: "not_run", exit_code: null, artifact: null };
  }
  return { id, kind: "assertion", required: true, expect: text, state: "not_run", exit_code: null, artifact: null };
}

function stepBodies(md: string): { n: number; title: string; body: string }[] {
  const marks: { n: number; title: string; at: number }[] = [];
  for (const m of md.matchAll(STEP_LINE_RX)) {
    marks.push({ n: Number(m[1]), title: String(m[2]).trim().slice(0, 160), at: m.index ?? 0 });
  }
  return marks.map((mk) => {
    const rest = md
      .slice(mk.at)
      .replace(/^###\s*Step\s+\d+\s*[—–-]+[^\n]*\n/, "");
    const next = rest.search(/^###\s*Step\s+\d+\s*[—–-]|^##\s/m);
    return { n: mk.n, title: mk.title, body: (next < 0 ? rest : rest.slice(0, next)).trim() };
  });
}

function qaBullets(md: string): string[] {
  const m = md.match(QA_HEADING_RX);
  if (!m || m.index == null) return [];
  const rest = md.slice(m.index + m[0].length);
  const next = rest.search(/^##\s/m);
  const section = next < 0 ? rest : rest.slice(0, next);
  const out: string[] = [];
  for (const b of section.matchAll(BULLET_RX)) {
    const t = String(b[1]).trim();
    if (t && !/^_?\s*\(?none/i.test(t)) out.push(t);
  }
  return out;
}

const QA_LIKE_RX = /\bQA\b|final\s+(?:qa|check|verification|testing)|ukaguzi/i;

/* ============================ tengeneza feature list ============================ */

function blank(id: string, title: string, checks: FeatureCheck[], qa: boolean): PlanFeature {
  return {
    id,
    title,
    required: true,
    qa,
    state: "pending",       // default-FAIL — ndiyo hoja ya msingi (utafiti)
    attempts: 0,
    checks,
    evidence: [],
    last_failure: null,
  };
}

/**
 * `featuresFromPlan` — harness (engine) inaitengeneza KABLA agent kuanza.
 *
 * Kanuni:
 *  1. Kila `### Step N — Title` → feature moja (`step-01`…); `**Verification:**` → check.
 *  2. Verification isiyo na command salama → `assertion` (inapimwa kwa ushahidi wa browser/file).
 *  3. Step ya mwisho yenye jina la QA → ndiyo QA feature; la sivyo §7 QA Checklist inaongezwa
 *     kama `qa-final` (checks kutoka kila bullet — mkataba wa "done" kutoka mpango wenyewe).
 *  4. Step bila Verification → check ya `assertion` inayoeleza kasoro (haitaweza kupita:
 *     mpango usio na kipimo hauwezi kukubaliwa — Awamu 3 inazuia kuanza kabisa).
 */
export function featuresFromPlan(planMarkdown: string, opts: FeatureListOpts = {}): FeatureList {
  const md = String(planMarkdown || "");
  const steps = stepBodies(md);
  const features: PlanFeature[] = steps.map((s, i) => {
    const isLast = i === steps.length - 1;
    const vm = s.body.match(VERIFICATION_RX);
    const verification = (vm?.[1] || "").trim();
    const checks: FeatureCheck[] = verification
      ? [checkFromText("verify", verification)]
      : [{
          id: "verify",
          kind: "assertion",
          required: true,
          expect: "(PLAN INVALID: hatua hii haina **Verification:** — haiwezi kupimika)",
          state: "not_run",
          exit_code: null,
          artifact: null,
        }];
    const qa = isLast && QA_LIKE_RX.test(s.title);
    return blank(`step-${String(s.n).padStart(2, "0")}`, s.title, checks, qa);
  });

  const lastIsQa = features.length > 0 && features[features.length - 1].qa;
  if (!lastIsQa) {
    const bullets = qaBullets(md);
    if (bullets.length) {
      const checks = bullets.map((b, i) => checkFromText(`qa-${i + 1}`, b));
      features.push(blank("qa-final", "Final QA & Verification (§7 QA Checklist)", checks, true));
    }
  }

  return {
    schema_version: 1,
    run_id: String(opts.runId || ""),
    plan_id: String(opts.planId || ""),
    generated_at: opts.now || new Date().toISOString(),
    features,
  };
}

/** JSON ya kuandika kwenye sandbox (deterministic formatting — 2 spaces, order ya uundaji). */
export function featureListJson(fl: FeatureList): string {
  return JSON.stringify(fl, null, 2) + "\n";
}

/** Muhtasari mfupi kwa prompt/recitation: "step-01 pending · … · qa-final pending". */
export function featureListSummary(fl: FeatureList, max = 12): string {
  const parts = fl.features.slice(0, max).map((f) => `${f.id} ${f.state}`);
  if (fl.features.length > max) parts.push(`… (+${fl.features.length - max})`);
  return parts.join(" · ");
}
