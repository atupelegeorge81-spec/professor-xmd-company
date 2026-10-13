// src/lib/milestone/reviewLLM.ts — deps HALISI za OrchestratorDeps zinazopiga LLM kwa judge chain.
// P5–P7 zitaziboresha kwa context packs kamili (9) na mjadala wa timu ×itifaki — hapa ni
// skeleton "kufanya kazi" yenye validators (LLM output lazima ipite schema; kikosa → retry 3).
import { judgeChat, type JudgeLaneRec } from "@/lib/broker/judge";
import { parseJsonFromLLM, validateAnalystOutput, newDefectId } from "./schemas";
import type {
  AnalystOutput, ChangeOrder, EvidencePack, Milestone, MilestonesRunState, ReviewSignature,
} from "./types";

/* ============ digest ya evidence kwa prompt (muhtasari — sio pack nzima) ============ */

export function evidenceDigest(ev: EvidencePack): string {
  const L: string[] = [];
  L.push(`Picha: ${ev.screenshots.length}${ev.screenshots.length ? ` — ${ev.screenshots.map((s) => `${s.id} (${s.route}@${s.viewport}${s.state !== "default" ? "/" + s.state : ""})`).join(", ")}` : ""}`);
  if (ev.domMetrics.length) L.push(`Vipimo vya DOM: ${ev.domMetrics.length} rundo za JSON`);
  const fails = ev.checks.filter((c) => c.result === "FAIL");
  L.push(`Checks: ${ev.checks.length} (${fails.length} FAIL${fails.length ? `: ${fails.map((c) => `${c.id}[${c.type}: ${c.detail.slice(0, 90)}]`).join("; ")}` : ""})`);
  if (ev.commands.length) L.push(`Amri: ${ev.commands.map((c) => `${c.cmd} → exit ${c.exit}`).join("; ")}`);
  L.push(`Git diff: faili ${ev.gitDiffSummary.filesChanged}, +${ev.gitDiffSummary.insertions}/-${ev.gitDiffSummary.deletions}`);
  if (ev.regression.length) L.push(`Regression: ${ev.regression.map((r) => `${r.route}@${r.viewport} ${r.changedPct}%`).join("; ")}`);
  if (ev.consoleErrors.length) L.push(`Console errors: ${ev.consoleErrors.slice(0, 6).join(" | ")}`);
  return L.join("\n");
}

/* ============ dependencies adapters kwa orchestrator ============ */

export interface JudgeCallOpts {
  onLane?: (rec: JudgeLaneRec) => void;
  vision?: boolean;
  signal?: AbortSignal;
  waitNote?: (msg: string) => void;  // sign-off-wait maelezo
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  /** C4 (7.6): mkaguzi anaweza kutafuta ukweli wa nje (web) MARA MOJA kabla ya hukumu. */
  search?: (q: string) => Promise<string>;
}

/** C4 (7.6): pass ya kwanza ikirudisha "__sq" (searchQuery ya LLM) na utafutaji ukopo (o.search) —
 *  tafuta MARA MOJA kisha uliza tena na matokeo (pass ya mwisho). Utafutaji ukishindwa → jibu la awali. */
async function secondPassWithSearch<T>(callTag: string, agentId: string, system: string, user: string, first: (T & { __sq?: string | null }) | null, parse: (x: unknown) => { ok: boolean; value?: T; errors?: string[] }, o?: JudgeCallOpts): Promise<T | null> {
  if (!first) return null;
  const sq = (first as { __sq?: string | null }).__sq;
  delete (first as { __sq?: string | null }).__sq;
  if (!sq || !o?.search) return first;
  try {
    const results = (await o.search(sq)).slice(0, 2500);
    const again = await llmJson<T>(`${callTag}.search2`, agentId, system,
      user + `\n\nMATOKEO YA UTAFUTAJI WA WEB kwa "${sq}":\n${results}\n\nSasa toa jibu LA MWISHO kwa JSON (HUTOWEKA searchQuery tena).`, parse, o);
    return again || first;
  } catch { return first; }
}


export async function judgeText(callName: string, agentId: string, system: string, user: string, o?: JudgeCallOpts & { maxTokens?: number; effort?: "low" | "medium" | "high" }): Promise<string | null> {
  for (let t = 0; t < 4; t++) {
    const r = await judgeChat({
      agentId, call: callName,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      maxTokens: o?.maxTokens ?? 3000,
      requireVision: o?.vision,
      signal: o?.signal,
      effort: o?.effort,
    });
    if (r.ok) { o?.onLane?.(r.rec); return r.text; }
    if ("wait" in r) {
      o?.waitNote?.(`⏳ ${r.wait.reason}${r.wait.until ? ` (hadi ${new Date(r.wait.until).toLocaleTimeString("en-GB", { timeZone: "Africa/Dar_es_Salaam" })})` : ""} — subiri…`);
      await new Promise((res) => setTimeout(res, 45_000));
      continue;
    }
      o?.waitNote?.(`⚠️ ${r.error} — kujaribu tena (${t + 1}/4)`);
  }
  o?.waitNote?.(`❌ judgeChat wote wamekata baada ya majaribio 4 kwa call "${callName}"`);
  return null;
}

/** Retry logic: jibu batili (JSON k. parse) → onyo lililoboreshwa; baada ya 3, hapana. */
async function llmJson<T>(callName: string, agentId: string, system: string, user: string, parse: (x: unknown) => { ok: boolean; value?: T; errors?: string[] }, o?: JudgeCallOpts): Promise<T | null> {
  let extra = "";
  for (let t = 0; t < 3; t++) {
    const text = await judgeText(callName, agentId, system, user + extra, o);
    if (text == null) return null;
    const raw = parseJsonFromLLM(text);
    if (!raw) { extra = `\n\n\(JIBU LILILOTANGULIA HALIKUWA NA JSON INAYOSOMEKA. Andika JSON pekee.\)`; continue; }
    const v = parse(raw);
    if (v.ok) return v.value as T;
    extra = `\n\n\(MAKOSA YA JIBU LILILOTANGULIA (rekebisha):\n${(v.errors || []).map((e) => `- ${e}`).join("\n")}\nAndika tena JSON pekee.\)`;
  }
  return null;
}

/* ============ Uchambuzi wa mkaguzi (Raundi 0) ============ */

export function llmAnalyse(o?: JudgeCallOpts) {
  return async (reviewerId: string, inp: { milestone: Milestone; evidence: EvidencePack; run: MilestonesRunState; ocb?: string }): Promise<AnalystOutput> => {
    const system = [
      `Wewe ni mkaguzi ${reviewerId} wa timu (kama Ultron kwa muundo/UX, Vextron kwa frontend, Megatron kwa backend, Cybertron kwa QA).`,
      "Kagua ushahidi uliotolewa. Andika uchambuzi kwa ufupi na DEFECTS KAMA JSON.",
      "Muundo: { reviewer, findings, defects: [{id na D khali, milestoneId, severity, title, expected, actual, evidence:[], area, foundInRound, reportedBy:[wewe]}], suggestions: [{title, detail}] }",
      "Kila defect: severity blocker|major|medium|minor. Usisode ange dalili bila ushahidi (picha S-###, kipimo C-###, amri au DOM). Usitapatie alama PASS shangwe — wewe ni mkaguzi.",
      'C4 UTAFUTAJI: ukihitaji kuthibitisha ukweli wa nje (kanuni ya framework/library/version, n.k.) kabla ya hukumu, weka "searchQuery": "swali moja" katika JSON — utafutaji utafanywa mara moja kisha utaulizwa tena.',
    ].join("\n");
    const user = [
      ...(inp.ocb ? [inp.ocb, ""] : []),
      `MILESTONE: ${inp.milestone.id} — ${inp.milestone.title} (mode ${inp.milestone.reviewMode})`,
      "",
      "USHAHIDI:",
      evidenceDigest(inp.evidence),
    ].join("\n");
    const out = await llmJson<AnalystOutput>(`${inp.milestone.id}.R0.${reviewerId}.analyse`, reviewerId, system, user, (x) => {
      const v = validateAnalystOutput(x);
      if (v.ok) (v.value as unknown as Record<string, unknown>).__sq = typeof (x as Record<string, unknown>)?.searchQuery === "string" ? String((x as Record<string, unknown>).searchQuery) : null;
      return v;
    }, { ...o, effort: "high" });
    const final = await secondPassWithSearch<AnalystOutput>(`${inp.milestone.id}.R0.${reviewerId}.analyse`, reviewerId, system, user, out as (AnalystOutput & { __sq?: string | null }) | null, (x) => validateAnalystOutput(x), o);
    return final || { reviewer: reviewerId, findings: "(uchambuzi ulishindwa baada ya majaribio — makosa yatarejewa)", defects: [], suggestions: [] };
  };
}

/* ============ Mjadala wa timu + merge (Raundi 0) — Optimus anaunganisha ============ */

export function llmDiscussAndMerge(o?: JudgeCallOpts) {
  return async (inp: {
    analyses: AnalystOutput[]; existingDefects: import("./types").Defect[]; run: import("./types").MilestonesRunState; milestone: Milestone;
  }): Promise<{ cos: ChangeOrder[]; suggestionsLedgerNotes?: string[] }> => {
    // §6.3 (peak): timu inazungumza kisha code huunganisha CO kutoka defects zilizopo —
    // LLM anafanya merge + utangazo KWA kusikiliza sauti za wakaguzi waliokigundua kosa.
    const open = inp.existingDefects.filter((d) => d.milestoneId === inp.milestone.id && ["OPEN", "IN_FIX", "REOPENED"].includes(d.status));
    const cos: ChangeOrder[] = [];
    // §6.3: MJADALA WA TIMU — kwa kila kosa wazi, wakaguzi waliokigundua huanza kwa kuzungumza
    // (chanzo, mbinu, faili) kisha Optimus anaunganisha CO akiwa amesikiliza sauti zote.
    const discussants = [...new Set(inp.analyses.map((a) => a.reviewer))].slice(0, 3);
    for (const d of open) {
      if (inp.run.cos.some((c) => c.defectIds.includes(d.id) && c.attempt === d.attempts + 1)) continue;
      const coId = `CO-${String(inp.run.cos.length + cos.length + 1).padStart(3, "0")}`;
      const teamViews: string[] = [];
      for (const rv of discussants) {
        const t = await judgeText(
          `${inp.milestone.id}.R0.discuss.${d.id}.${rv}`, rv,
          `Wewe ni ${rv} wa timu. Kosa hili lilionekana wakati wa ukaguzi. Toa maoni MFUPI (2-4 sentensi): chanzo uwezekano (root cause), mbinu sahihi ya kurekebisha, na faili/routes zinazoguswa. Andika plain text bila JSON.`,
          `Kosa: ${JSON.stringify({ id: d.id, title: d.title, expected: d.expected, actual: d.actual, evidence: d.evidence, area: d.area })}\nMilestone: ${inp.milestone.id} — ${inp.milestone.title}`,
          { ...o, effort: "low", maxTokens: 700 },
        );
        if (t) teamViews.push(`${rv}: ${t.replace(/\s+/g, " ").trim().slice(0, 400)}`);
      }
      const system = [
        "Wewe ni Optimus. Kwa kosa iliotajwa, andika ChangeOrder (CO) ya kitaalamu: faili/route/selector, hali ya sasa → inayotakiwa, na 2-4 vipimo vya kukubalika (aina za 8.3: command, grep, dom_exists, computed_style, no_horizontal_overflow, console_clean, contrast_min, touch_target_min, http, file_exists, file_contains, screenshot_taken).",
        "JIBU: JSON ya CO pekee: { id, defectIds:[id], attempt:1, priority:1, location:{files:[...], route?, selector?}, current, desired, visionNote?, acceptance: [ {...check} ], mode: 'standard' }",
      ].join("\n");
      const user = `Kosa: ${JSON.stringify({ id: d.id, title: d.title, expected: d.expected, actual: d.actual, evidence: d.evidence, area: d.area })}\nCO id: ${coId}${teamViews.length ? `\n\nMAONI YA TIMU (mjadala wa Raundi 0 — zingatia sauti hizi bila kupoteza vipimo vya kukubalika):\n${teamViews.join("\n")}` : ""}`;
      const co = await llmJson<ChangeOrder>(`${inp.milestone.id}.R0.merge.${d.id}`, "pm", system, user, (x) => {
        const raw = x as any;
        if (!raw || typeof raw !== "object") return { ok: false, errors: ["si object"] };
        // validate baadaye kwa validateChangeOrder kwenye orchestrate; hapa rudisha ghafi
        raw.id = raw.id || coId; raw.defectIds = raw.defectIds || [d.id]; raw.attempt = 1; raw.priority = raw.priority || 1; raw.mode = raw.mode || "standard";
        return { ok: true, value: raw as ChangeOrder };
      }, o);
      if (co) cos.push(co);
    }
    return { cos };
  };
}

/* ============ Uthibitisho wa raundi (mkaguzi × CO verdict) ============ */

export function llmVerifyRound(o?: JudgeCallOpts) {
  return async (inp: {
    cos: ChangeOrder[]; evidence: EvidencePack; run: MilestonesRunState; milestone: Milestone; round: number; reviewers: string[];
    ocb?: string; roundHeader?: string;
  }): Promise<Record<string, Record<string, ReviewSignature>>> => {
    const out: Record<string, Record<string, ReviewSignature>> = {};
    for (const co of inp.cos) {
      out[co.id] = {};
      for (const rv of inp.reviewers) {
        const system = [
          `Wewe ni mkaguzi ${rv}. Mwangaza ya mushahara raundi ${inp.round}/10. Evalue CO: imetekelezwa kikamilifu? JIBU: JSON pekee { "verdict": "PASS"|"FAIL"|"PARTIAL", "note": "…" }. C4: ukihitaji kuthibitisha ukweli wa nje kabla ya FAIL, weka "searchQuery": "swali" — utafutaji utafanywa mara moja.`,
        ].join("\n");
        const user = [
          ...(inp.ocb ? [inp.ocb, ""] : []),
          ...(inp.roundHeader ? [`${inp.roundHeader}`, ""] : []),
          `CO: ${JSON.stringify({ id: co.id, current: co.current, desired: co.desired, visionNote: co.visionNote, acceptance: co.acceptance })}`,
          "",
          "USHAHIDI mpya (baada ya marekebisho):",
          evidenceDigest(inp.evidence),
        ].join("\n");
        type VerdictOut = { verdict: "PASS" | "FAIL" | "PARTIAL"; note?: string };
        type VerdictRaw = VerdictOut & Record<string, unknown>;
        const parseV = (x: unknown): { ok: boolean; value?: VerdictRaw; errors?: string[] } => {
          const v = String((x as Record<string, unknown>)?.verdict || "").toUpperCase();
          if (!["PASS", "FAIL", "PARTIAL"].includes(v)) return { ok: false, errors: ["verdict inahitajika (PASS/FAIL/PARTIAL)"] };
          const val: VerdictRaw = { verdict: v as VerdictRaw["verdict"], note: String((x as Record<string, unknown>)?.note || "") };
          val.__sq = typeof (x as Record<string, unknown>)?.searchQuery === "string" ? String((x as Record<string, unknown>).searchQuery) : null;
          return { ok: true, value: val };
        };
        const res = await llmJson<VerdictRaw>(`${inp.milestone.id}.R${inp.round}.${rv}.verify.${co.id}`, rv, system, user, parseV, { ...o, effort: "high" });
        // C4: search kwa FAIL pekee (PASS/PARTIAL hazitafutiwi maneno ya ziada)
        const fin = (res && res.verdict === "FAIL")
          ? (await secondPassWithSearch<VerdictRaw>(`${inp.milestone.id}.R${inp.round}.${rv}.verify.${co.id}`, rv, system, user, res, parseV, o)) || res
          : res ? (() => { delete (res as { __sq?: string | null }).__sq; return res; })() : null;
        out[co.id][rv] = fin ? { reviewer: rv, verdict: fin.verdict, note: fin.note } : { reviewer: rv, verdict: "FAIL", note: "uthibitisho ulishindwa kupata majibu" };
      }
    }
    return out;
  };
}

/* ============ Ngazi 2: rewriteConcrete, Ngazi 3: pairPatch, Ngazi 5+: redecide ============ */

export function llmRewriteConcrete(o?: JudgeCallOpts) {
  return async (co: ChangeOrder, diagnosis: string): Promise<ChangeOrder> => {
    const system = [
      "Wewe ni Optimus. Jaribio la CO limekosea. Tenga CO mpya ya UHAKIKA zaidi: faili MAELEZO kamili, selector, mali (property), thamani kamili, kabla/baada, kipimo wazi.",
      `Utambuzi wa chanzo: ${diagnosis}. JIBU: JSON ya CO (mode: 'concrete', diagnosis).`,
    ].join("\n");
    const user = `CO iliyoshindwa: ${JSON.stringify(co)}`;
    const out = await llmJson<ChangeOrder>(`${co.id}.R.concrete`, "pm", system, user, (x) => {
      const raw = x as any;
      raw.id = `${co.id}b`; raw.attempt = (co.attempt || 1) + 1; raw.mode = "concrete"; raw.diagnosis = (diagnosis as ChangeOrder["diagnosis"]) || "ATTEMPTED_WRONG";
      return { ok: true, value: raw as ChangeOrder };
    }, { ...o, effort: "high" });
    return out || { ...co, id: `${co.id}b`, attempt: (co.attempt || 1) + 1, mode: "concrete", diagnosis: (diagnosis as ChangeOrder["diagnosis"]) || "ATTEMPTED_WRONG" };
  };
}

export function llmPairPatch(o?: JudgeCallOpts) {
  return async (co: ChangeOrder): Promise<string | null> => {
    const system = [
      "Wewe ni Vextron (Frontend Engineer). Andika PATCH KAMILI (unified diff au code kamili) inayotekeleza CO bila makosa.",
      "JIBU: code/diff pekee ndani ya ``` fences.",
    ].join("\n");
    const r = await judgeText(`${co.id}.R.patch`, "frontend", system, `CO: ${JSON.stringify(co)}`, { ...o, effort: "high", maxTokens: 6000 });
    if (!r) return null;
    const m = r.match(/```(?:diff|typescript|tsx|javascript|js|jsx|css|json|html)?\s*([\s\S]*?)```/);
    return (m ? m[1] : r).trim() || null;
  };
}

export function llmRedecide(o?: JudgeCallOpts) {
  return async (co: ChangeOrder): Promise<{ action: "KEEP" | "MODIFY" | "WAIVE"; reason: string; modified?: ChangeOrder; approvedBy: string[] }> => {
    const system = [
      "Wewe ni mwenyekiti wa wawakilishi watatu — wakaguzi wawili na Optimus. Kosa limekata mara 5+. CHAGUA moja:",
      "KEEP (jaribu tena), MODIFY (badilisha sharti — uamuzi mpya), WAIVE (kubali mkengeuko; ni nadra na LAZIMA iandikwe sababu).",
      'JIBU: JSON { "action": "KEEP|MODIFY|WAIVE", "reason": "…" }',
      "Haki: WAIVE kamwe si kimya — iwe na sababu ya kikristal.",
    ].join("\n");
    const out = await llmJson<{ action: "KEEP" | "MODIFY" | "WAIVE"; reason: string }>(`${co.id}.R.redecide`, "pm", system, `CO: ${JSON.stringify(co)}`, (x) => {
      const a = String((x as any)?.action || "").toUpperCase();
      if (!["KEEP", "MODIFY", "WAIVE"].includes(a)) return { ok: false, errors: ["action inahitajika"] };
      return { ok: true, value: { action: a as any, reason: String((x as any)?.reason || "") } };
    }, { ...o, effort: "high" });
    const res = out || { action: "KEEP" as const, reason: "(default — LLM haikupatikana)" };
    return { ...res, approvedBy: ["designer", "frontend", "pm"] };
  };
}
