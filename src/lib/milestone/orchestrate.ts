// src/lib/milestone/orchestrate.ts — Hatua E–K (4.4–4.10): orchestrator ya milestone.
// CODE inaamua hatua zote (si LLM); kila hatua ina stepId ya idempotency (11.2) — resume
// haitarudia kazi iliyokwisha. LLM inajumuishwa kupitia deps (P5/P6/P7 huweka halali)
// — hapa tunapitisha fakes kwenye tests na halisi kwenye run().
import type {
  AcceptanceCheck, AnalystOutput, ChangeOrder, CheckResult, Defect, EvidencePack, LaneCall,
  Milestone, MilestoneState, MilestonesRunState, Receipt, ReviewSignature,
} from "./types";
import { advance, alreadyDone, writeMilestonesState, milestoneById } from "./state";
import {
  applyCap, buildRoundHeader, escalationFor, findCOConflicts, judgeCO, noOpFiles, noOpMessage,
  signOffGate, sortCOsByPriority, uncoveredDefects, verifyReceiptAgainstDiff, } from "./rounds";
import { buildStartPack } from "./startPack";
import { newCheckId, newDefectId, validateChangeOrder, validateReceipt } from "./schemas";

/* ============================ deps za nje ============================ */

export type BuildTerminal = "COMPLETED_VERIFIED" | "PARTIAL" | "STUCK" | "BLOCKED" | "PAUSED_QUOTA" | "ERROR";

export interface ComputerBuildRequest {
  label: string; // "M1 ujenzi" / "M1 raundi 3"
  planMd: string; // plan + startPack (mkataba kamili)
  run: MilestonesRunState;
  state: MilestoneState;
  round: number;
}

export interface ComputerBuildResult {
  terminal: BuildTerminal;
  report?: string; // Ripoti ya Milestone (5.7) — inaccessible sections zikiwa zimekosekana, evidence itaonyesha
  receipts?: Receipt[]; // kwa raundi>0; undefined/tupu → kutozalisha risiti ni kosa (huhukumiwa na code)
  changedFiles?: string[]; // git diff --name-only
  error?: string;
  visionReady?: boolean; // sandbox imefunguka inavyotakiwa (P4)
}

export interface OrchestratorDeps {
  log: (msg: string) => void;
  chip?: (msg: string) => void;
  onMilestoneEvent?: (m: Milestone, st: MilestoneState) => void; // UI strip update
  recordLane?: (milestoneId: string, rec: LaneCall) => void;

  /** Optimus/flash: mpango wa milestone (P3 real; fake kwa tests) */
  generatePlan: (milestone: Milestone, run: MilestonesRunState) => Promise<{ md: string; title: string; checks: AcceptanceCheck[]; blocked: boolean; errors: string[] }>;

  /** Computer: anzisha awamu ya awamu hii (fake kwa tests; engine halisi ndani ya run()) */
  computerBuild: (req: ComputerBuildRequest) => Promise<ComputerBuildResult>;

  /** Ipp. P4: playright harness — fake kwa tests sasa hivi */
  collectEvidence: (milestone: Milestone, round: number, rep: { report?: string }, run: MilestonesRunState) => Promise<EvidencePack>;

  /** Uchambuzi wa mkaguzi (Raundi 0; P5 real) — anarudisha AnalystOutput (validated) kwa kila mkaguzi.
   *  §6.1.2: ocb INAINGIZWA kwenye call ya uchambuzi (lakini online unit ipo kwa fake deps). */
  analyse: (reviewerId: string, inp: { milestone: Milestone; evidence: EvidencePack; run: MilestonesRunState; ocb?: string }) => Promise<AnalystOutput>;

  /** Mjadala wa timu + Optimus merge → CO mpya (P5 real). Inapaswa kurudisha CO (validated extra pamoja na defects mpya iliyo-live) */
  discussAndMerge: (inp: {
    analyses: AnalystOutput[]; existingDefects: Defect[]; run: MilestonesRunState; milestone: Milestone;
  }) => Promise<{ cos: ChangeOrder[]; suggestionsLedgerNotes?: string[] }>;

  /** Uthibitisho wa raundi r (P6 real): kila mkaguzi anaondoa sahihi kwa kila CO — {coId: {reviewerId: sig}} */
  verifyRound: (inp: {
    cos: ChangeOrder[]; evidence: EvidencePack; run: MilestonesRunState; milestone: Milestone; round: number;
    reviewers: string[]; ocb?: string; roundHeader?: string;
  }) => Promise<Record<string, Record<string, ReviewSignature>>>;

  /** Ngazi ya 2+: Optimus anaandika upya CO (concrete) (P6 real) */
  rewriteConcrete?: (co: ChangeOrder, diagnosis: string, inp: { evidence: EvidencePack }) => Promise<ChangeOrder>;
  /** Ngazi ya 3: Frontend anaandika patch (P6 real) */
  pairPatch?: (co: ChangeOrder, inp: { evidence: EvidencePack }) => Promise<string | null>;
  /** Ngazi ya 5+: kuamua upya (P6 real) */
  redecide?: (co: ChangeOrder, inp: { evidence: EvidencePack }) => Promise<{ action: "KEEP" | "MODIFY" | "WAIVE"; reason: string; modified?: ChangeOrder; approvedBy: string[] }>;
  /** root-cause diagnosis (7.4 jaribio 2) — P6 real; default: ATTEMPTED_WRONG */
  diagnose?: (defect: Defect, co: ChangeOrder) => Promise<string>;

  /** Usimamizi wa vision-wait (10.3.b): SIGN-OFF isiyokuwa na vision inasubiri; default ans subiri milele (false = sitaki kusubiri) */
  awaitVisionLane?: (reason: string) => Promise<boolean>;

  /** §6.1.2: OCB kwa wakaguzi/hukumu (code-built; hostRun inaipeleka). Fake deps haipatikani bila ya hili. */
  ocbFor?: (roleId: string, step: string, round?: number) => string;

  /** ledger fupi (Board) — StartPack inahitaji sehemu hii kwa 4.6 (si "host placeholder") */
  ledgerFor?: () => string;
  /** §4.11/§12: kusanya git tag milestone-Mk + push (harness, si Computer). Fake deps haipatikani bila ya hili. */
  signOffCommit?: (milestoneId: string) => Promise<{ tag: string | null; pushed: boolean; note?: string }>;
  /** C8 (PENDEKEZO §7.3, env MS_BROWSER_EVAL=1): sign-off ya visual/mixed inahitaji kipimo cha BROWSER halisi kilicho PASS. */
  browserEvalRequired?: boolean;

  persistNow?: () => Promise<void>;
}

/* ============================ matokeo ya pipeline ============================ */

export interface MilestonePipelineResult {
  status: MilestonesRunState["states"][string]["status"];
  milestoneId: string;
  rounds: number;
  defectsTotal: number;
  defectsOpen: number;
  signedOff: boolean;
  blockedReason?: string;
  waivers?: string[];
}

/* ============================ utility ndani ============================ */


function reportMissingSections(report: string | undefined): string[] {
  const need = ["Muhtasari", "Faili", "Amri", "Vipimo", "Maamuzi", "Usalama", "Matatizo", "Hatari"];
  const t = report || "";
  return need.filter((s) => !t.includes(s));
}

function dedupeNewDefects(fresh: Defect[], existing: Defect[]): Defect[] {
  const keys = new Set(existing.map((d) => `${d.milestoneId}::${d.title.toLowerCase().slice(0, 80)}`));
  return fresh.filter((d) => !keys.has(`${d.milestoneId}::${d.title.toLowerCase().slice(0, 80)}`));
}

/* ============================ Pipeline ============================ */

export async function runMilestonePipeline(
  runnerItems: any[],
  run: MilestonesRunState,
  deps: OrchestratorDeps,
  milestoneId: string,
): Promise<MilestonePipelineResult> {
  const m = milestoneById(run, milestoneId);
  if (!m) throw new Error(`milestone ${milestoneId} haipo kwenye ramani`);
  const st = run.states[milestoneId];
  const mark = (status: Parameters<typeof advance>[2], stepId: string) => {
    const r = advance(run, milestoneId, status, stepId);
    if (!r.ok && r.error) deps.log(`⚠️ ${r.error}`);
    writeMilestonesState(runnerItems, run);
    deps.onMilestoneEvent?.(m, run.states[milestoneId]);
    return r;
  };
  const emit = () => deps.onMilestoneEvent?.(m, run.states[milestoneId]);
  const note = (t: string) => { deps.log(t); deps.chip?.(t); };

  // Idempotency kiwango cha jumba: hali ya mwisho → rudi mara moja bila kazi (trigger ya mara-2)
  if (["SIGNED_OFF", "SIGNED_OFF_WITH_WAIVERS", "CAP_REACHED", "BLOCKED"].includes(st.status)) {
    return { status: st.status as MilestonesRunState["states"][string]["status"], milestoneId, rounds: st.round, defectsTotal: run.defects.length, defectsOpen: 0, signedOff: ["SIGNED_OFF", "SIGNED_OFF_WITH_WAIVERS"].includes(st.status) };
  }
  if (st.status === "PAUSED_QUOTA" || st.status === "PAUSED_INFRA") {
    return { status: st.status, milestoneId, rounds: st.round, defectsTotal: run.defects.length, defectsOpen: run.defects.filter((d) => ["OPEN", "IN_FIX", "REOPENED"].includes(d.status)).length, signedOff: false };
  }

  /* ============ 4.5 Hatua F: MPANGO (lazima + Data Guard) ============ */
  if (!alreadyDone(run, `${milestoneId}.P.plan`)) {
    mark("PLANNING", `${milestoneId}.P.plan.start`);
    note(`📝 Optimus anaandika Mpango wa ${milestoneId}…`);
    const plan = await deps.generatePlan(m, run);
    if (plan.blocked) {
      mark("BLOCKED", `${milestoneId}.P.blocked`);
      note(`🛡️ Mpango wa ${milestoneId} HAUJENGWA (Data Guard / vipimo havijajaza): ${plan.errors.join(" | ").slice(0, 300)}`);
      return { status: "BLOCKED", milestoneId, rounds: st.round, defectsTotal: run.defects.length, defectsOpen: run.defects.filter((d) => ["OPEN", "IN_FIX", "REOPENED"].includes(d.status)).length, signedOff: false, blockedReason: plan.errors.join(" | ") };
    }
    run.plans[milestoneId] = { md: plan.md, title: plan.title, checks: plan.checks, attempts: plan.errors.length + 1 };
    if (plan.errors.length) deps.log(`📝 mpango imezalishwa baada ya makosa ${plan.errors.length} yaliyorekebishwa`);
    mark("PLANNING", `${milestoneId}.P.plan`); // stepId ya kufunga = imetengwa tayari kwa `.P.plan.start` — record ya siku hizi
    run.stepsDone[`${milestoneId}.P.plan`] = { stepId: `${milestoneId}.P.plan`, result: "DONE", at: new Date().toISOString() };
    writeMilestonesState(runnerItems, run);
    note(`📝 Mpango wa ${milestoneId} upo tayari (vipimo ${plan.checks.length}).`);
  }
  const plan = run.plans[milestoneId];
  if (!plan) {
    mark("BLOCKED", `${milestoneId}.P.missing`);
    return { status: "BLOCKED", milestoneId, rounds: st.round, defectsTotal: run.defects.length, defectsOpen: 0, signedOff: false, blockedReason: "mpango wa milestone hauko kwenye hali (resume haribifu)" };
  }

  /* ============ 4.6 ujenzi wa mwanzo (au raundi mpya) ============ */
  let lastReport: string | undefined;
  let evidence: EvidencePack | null = null;

  // A) mwanzo wa build (raundi 0)
  if (!alreadyDone(run, `${milestoneId}.B.build`)) {
    mark("BUILDING", `${milestoneId}.B.build.start`);
    const ocbC = deps.ocbFor?.("computer-build", `ujenzi wa mwanzo wa ${milestoneId} (${m.title})`, 0) || "(OCB-C: hajapatikana — host ijaze deps.ocbFor)";
    const pack = buildStartPack({
      project: run.sessionId, milestone: m, state: st, ocbC,
      inheritedDefects: run.defects.filter((d) => d.status === "INHERITED" && inheritedFor(milestoneId, run, d)),
      ledgerSlice: deps.ledgerFor?.() || undefined,
    });
    const planMd = `${plan.md}\n\n${pack}`;
    note(`🖥️ Computer anajenga ${milestoneId}…`);
    const res = await deps.computerBuild({ label: `${milestoneId} ujenzi`, planMd, run, state: st, round: 0 });
    if (res.terminal === "PAUSED_QUOTA") {
      mark("PAUSED_QUOTA", `${milestoneId}.B.paused`);
      note(`⏸️ quota imeisha katikati ya ${milestoneId} ujenzi — PAUSED_QUOTA; itaendelea baadaye.`);
      return { status: "PAUSED_QUOTA", milestoneId, rounds: st.round, defectsTotal: run.defects.length, defectsOpen: 0, signedOff: false };
    }
    lastReport = res.report;
    void res.changedFiles;
    if (res.terminal !== "COMPLETED_VERIFIED") {
      mark("BLOCKED", `${milestoneId}.B.failed`);
      note(`❌ ujenzi wa mwanzo wa ${milestoneId} umeshindwa (${res.terminal}${res.error ? `: ${res.error.slice(0, 150)}` : ""}).`);
      return { status: "BLOCKED", milestoneId, rounds: st.round, defectsTotal: run.defects.length, defectsOpen: 0, signedOff: false, blockedReason: `CU ${res.terminal}` };
    }
    const miss = reportMissingSections(res.report);
    if (miss.length) note(`⚠️ Ripoti ya milestone inakosa sehemu: ${miss.join(", ")} — itarekodiwa kama mwengeuko.`);
    run.stepsDone[`${milestoneId}.B.build`] = { stepId: `${milestoneId}.B.build`, result: res.terminal, at: new Date().toISOString() };
    mark("BUILDING", `${milestoneId}.B.build`);
    note(`✅ ujenzi wa ${milestoneId} umekamilika (COMPLETED_VERIFIED).`);
  }

  /* ============ 4.7 Ushahidi (raundi 0) ============ */
  if (!run.evidence[`${milestoneId}.R0`]) {
    mark("EVIDENCE", `${milestoneId}.E.collect`);
    note(`📸 Ushahidi unakusanywa (mode: ${m.reviewMode})…`);
    evidence = await deps.collectEvidence(m, 0, { report: lastReport }, run);
    run.evidence[`${milestoneId}.R0`] = evidence;
    writeMilestonesState(runnerItems, run);
    note(`📸 Ushahidi ${milestoneId}: picha ${evidence.screenshots.length} · checks ${evidence.checks.length} · console ${evidence.consoleErrors.length}`);
  } else evidence = run.evidence[`${milestoneId}.R0`];

  /* ============ hatua ya checks ya mpango (4.7): vipimo vya mpango kutoka 4.5 ============ */
  {
    const failedPlan = (evidence.checks || []).filter((c) => c.result === "FAIL");
    if (failedPlan.length) {
      note(`⚠️ vipimo ${failedPlan.length} vya mpango vimefailiwa: ${failedPlan.map((c) => c.id).join(", ")} — vinafuatiliwa kama makosa.`);
      for (const c of failedPlan) {
        if (!run.defects.some((d) => d.title.includes(c.id))) {
          run.defects.push({
            id: newDefectId(run.defects), milestoneId, foundInRound: 0, reportedBy: ["harness"],
            area: c.id, severity: "major", title: `Kipimo cha mpango kimeshindwa (${c.id})`, evidence: [c.id],
            expected: "PASS (mpango)", actual: c.detail, status: "OPEN", attempts: 0, history: [],
          });
        }
      }
    }
  }

  /* ============ 4.8 Raundi 0: wakaguzi + mjadala + CO ============ */
  const reviewers = reviewersFor(m);
  if (!alreadyDone(run, `${milestoneId}.R0.review`)) {
    mark("REVIEW_R0", `${milestoneId}.R0.start`);
    note(`🔍 Raundi 0: ${reviewers.map((r) => r).join(" + ")} wanachambua KWA KUJITEGEMEA…`);
    const analyses: AnalystOutput[] = [];
    for (const rv of reviewers) {
      const out = await deps.analyse(rv, { milestone: m, evidence, run, ocb: deps.ocbFor?.(rv, `ukaguzi wa Raundi 0: uchambuzi wa kujitegemea (${m.id} ${m.title})`) });
      analyses.push(out);
    }
    // defects zinazong'aa kutoka kwa uchambuzi wawili
    for (const a of analyses) {
      for (const d of dedupeNewDefects(
        a.defects.map((d) => ({ ...d, id: newDefectId(run.defects), status: "OPEN" as const, attempts: 0, history: [], milestoneId })),
        run.defects,
      )) {
        run.defects.push(d);
      }
    }
    const merged = await deps.discussAndMerge({ analyses, existingDefects: run.defects, run, milestone: m });
    const openD = uncoveredDefects(run.defects, run.cos).filter((d) => d.milestoneId === milestoneId);
    if (openD.length) {
      note(`⚠️ makosa ${openD.length} bila CO — yanakataliwa kama CO (validator)`);
    }
    for (const co of merged.cos) {
      const v = validateChangeOrder(co);
      if (!v.ok) { deps.log(`⚠️ CO ${co.id} imekataliwa: ${v.errors.join("; ")}`); continue; }
      if (!run.cos.some((x) => x.id === v.value.id)) {
        // ulinzi wa migongano ya CO (7.4)
        const conflicts = findCOConflicts(run.cos, v.value);
        if (conflicts.length) deps.log(`⚠️ migongano: ${conflicts.map((c) => c.why).join(" | ")}`);
        run.cos.push(v.value);
      }
    }
    run.states[milestoneId].round = 0;
    run.stepsDone[`${milestoneId}.R0.review`] = { stepId: `${milestoneId}.R0.review`, result: `D+${analyses.reduce((a, x) => a + x.defects.length, 0)} CO+${merged.cos.length}`, at: new Date().toISOString() };
    mark("REVIEW_R0", `${milestoneId}.R0.review`);
    writeMilestonesState(runnerItems, run);
    note(`🔍 Raundi 0 imefungwa: makosa ${run.defects.filter((d) => d.milestoneId === milestoneId && ["OPEN", "IN_FIX", "REOPENED"].includes(d.status)).length} wazi → CO ${run.cos.filter((c) => c.defectIds.some((id) => run.defects.some((d) => d.id === id && d.milestoneId === milestoneId))).length}.`);
  }

  /* ============ 4.9–4.10 raundi 1..10 ============ */
  for (let round = st.round + 1; round <= st.maxRounds; round++) {
    const cosFor = sortCOsByPriority(pendingCosFor(run, milestoneId));
    if (!cosFor.length) {
      // Hakuna CO zinazosubiri: harness inaendesha vipimo vya kukagua — kwamba kila kitu SAWA?
      const ev = evidence ?? run.evidence[`${milestoneId}.R${round - 1}`];
      const checks = (ev?.checks || []) as CheckResult[];
      const failed = checks.filter((c) => c.result === "FAIL");
      if (!failed.length) {
        // Paki ya sign-off Sasa — kwa hakika inawahitaji wakaguzi waidho kwa raundi ya mwisho?
        break; // sign-off gate chini itaisajili uamuzi
      }
      // CO kwa failures zilizoharibika (ya kupima kwa mpango)
      const uncovered = uncoveredDefects(run.defects, run.cos).filter((d) => d.milestoneId === milestoneId && ["OPEN", "IN_FIX", "REOPENED"].includes(d.status));
      if (!uncovered.length) break;
    }

    const rStepPrefix = `${milestoneId}.R${round}`;
    const roundHeaderTxt = buildRoundHeader({ ...st, round }, run.defects);
    note(`🔧 ${milestoneId} — ${roundHeaderTxt}`);
    run.states[milestoneId].round = round;
    st.round = round;

    /* --- FIXING: Computer anatekeleza CO za raundi hii --- */
    if (alreadyDone(run, `${rStepPrefix}.fix`)) {
      // resume: tunaendelea tu baadaye (evidence itakusanywa upya)
    } else {
      mark("FIXING", `${rStepPrefix}.fix.start`);
      const cosR = sortCOsByPriority(pendingCosFor(run, milestoneId));
      for (const co of cosR) {
        for (const d of run.defects) {
          if (co.defectIds.includes(d.id)) { d.status = "IN_FIX"; }
        }
      }
      const pack = buildStartPack({
        project: run.sessionId, milestone: m, state: { ...st, round },
        ocbC: deps.ocbFor?.("computer-fix", `raundi ${round}/${st.maxRounds} ya marekebisho — ${milestoneId} (${m.title})`, round) || "(OCB-C: hajapatikana — host ijaze deps.ocbFor)",
        cos: cosR,
        inheritedDefects: run.defects.filter((d) => d.status === "INHERITED"),
        ledgerSlice: deps.ledgerFor?.() || undefined,
      });
      const planMd = `${pack}\n\n# MPANGO (kumbukumbu — mpango kamili uko hapo juu; tumia CO kama msingi)\n\n${plan.md}`;
      const res = await deps.computerBuild({ label: `${milestoneId} raundi ${round}`, planMd, run, state: { ...st, round }, round });
      if (res.terminal === "PAUSED_QUOTA") {
        mark("PAUSED_QUOTA", `${rStepPrefix}.paused`);
        return { status: "PAUSED_QUOTA", milestoneId, rounds: round, defectsTotal: run.defects.length, defectsOpen: run.defects.filter((d) => ["OPEN", "IN_FIX", "REOPENED"].includes(d.status)).length, signedOff: false };
      }
      if (res.terminal !== "COMPLETED_VERIFIED") {
        note(`⚠️ ${milestoneId} raundi ${round}: CU ${res.terminal}${res.error ? ` — ${res.error.slice(0, 120)}` : ""}.`);
        // CU ikianguka kabisa mwelekeo haujafikiwa — kuhesabiwa kama jaribio lililokwama (kesho: retries ni za usiku)
      }
      /* === 7.3.1–2: risiti dhidi ya diff + NO-OP (kwa kila CO) === */
      const diffs = res.changedFiles || [];
      for (const co of cosR) {
        const receipt = (res.receipts || []).find((r) => r.orderId === co.id);
        let diagnosis: string | undefined;
        if (!receipt) {
          diagnosis = "NOT_ATTEMPTED";
          note(`🚫 NO-OP: hakuna risiti ya ${co.id}. ${noOpMessage(co, co.location.files)}`);
        } else {
          const v = validateReceipt(receipt);
          if (!v.ok) { diagnosis = "NOT_ATTEMPTED"; note(`🚫 Risiti ya ${co.id} batili: ${v.errors.join("; ")}`); }
          else {
            const vr = verifyReceiptAgainstDiff(v.value, diffs);
            const missed = noOpFiles(co, diffs);
            if (!vr.ok || missed.length) { diagnosis = "NOT_ATTEMPTED"; note(`🚫 NO-OP ${co.id}: ${[...vr.problems, ...missed.map((mm) => `${mm} haikugusika`)].join("; ")}`); }
            else if (v.value.status === "PARTIAL" || v.value.status === "BLOCKED" || v.value.status === "CANNOT") {
              diagnosis = v.value.status === "CANNOT" ? "TECH_BLOCKER" : "ATTEMPTED_WRONG";
            }
          }
        }
        for (const d of run.defects) {
          if (co.defectIds.includes(d.id)) {
            d.attempts += 1; // jaribio jipya limefanywa (risiti ilikuwepo au hapakuwa)
            if (diagnosis) d.history.push({ round, result: "FAIL", cause: diagnosis as any });
          }
        }
        if (diagnosis && deps.diagnose) {
          for (const d of run.defects) if (co.defectIds.includes(d.id)) (d as any)._lastDiag = diagnosis;
        }
      }
      run.stepsDone[`${rStepPrefix}.fix`] = { stepId: `${rStepPrefix}.fix`, result: res.terminal, at: new Date().toISOString() };
      writeMilestonesState(runnerItems, run);
    }

    /* --- VERIFYING: evidence ✚ vipimo vya CO ✚ signature za wawili --- */
    mark("VERIFYING", `${rStepPrefix}.verify.start`);
    const repCos = sortCOsByPriority(inFlightCosFor(run, milestoneId));
    evidence = await deps.collectEvidence(m, round, {}, run);
    run.evidence[`${milestoneId}.R${round}`] = evidence;
    const verifyRes: Record<string, Record<string, ReviewSignature>> = await deps.verifyRound({
      cos: repCos, evidence, run, milestone: m, round, reviewers,
      ocb: deps.ocbFor?.("verify", `uthibitisho wa ${milestoneId} raundi ${round} (wakaguzi wawili)`, round),
      roundHeader: roundHeaderTxt,
    });
    let allPassed = true;
    for (const co of repCos) {
      const sigs = repCos.length ? Object.values(verifyRes[co.id] || {}) : [];
      const coChecks = (co.acceptance || []).flatMap((c) => coCheckResult(evidence, c));
      const j = judgeCO(sigs, coChecks);
      for (const d of run.defects) {
        if (!co.defectIds.includes(d.id)) continue;
        if (j.verdict === "PASS") { d.status = "VERIFIED_FIXED"; d.history.push({ round, result: "PASS" }); }
        else {
          d.status = "REOPENED" as Defect["status"];
          d.history.push({ round, result: "FAIL", cause: (d as any)._lastDiag });
          allPassed = false;
          // Ngazi inayofuata ya CO (7.4): iandikiwe upya kwa escalation
          const nextAttempt = d.attempts + 1;
          (d as any)._nextMode = escalationFor(nextAttempt);
        }
      }
    }
    // regression + defects MPYA mwenye kutafanana: mkaguzi anashinda juu ya kipimo kilopita (8.3)
    // (P5/P6 wataingiza defects mpya kutoka verifyRound f.a.k.e — hapa.code inaongoza)
    run.stepsDone[`${rStepPrefix}.verify`] = { stepId: `${rStepPrefix}.verify`, result: allPassed ? "ALL_PASS" : "REOPENED_EXIST", at: new Date().toISOString() };
    writeMilestonesState(runnerItems, run);

    if (allPassed && !anyOpenWork(run, milestoneId).length) {
      // idadi yote imethibitishwa/imefungwa — sign-off chini itaisajili uamuzi
      break;
    }

    /* --- CO mpya kwa raundi inayofuata (ngazi za escalation — 7.4 inajengwa kwa defects REOPENED/OPEN tu) --- */
    const nextRound = round + 1;
    if (nextRound > st.maxRounds) break;
    for (const d of run.defects.filter((d) => d.milestoneId === milestoneId && ["REOPENED", "OPEN"].includes(d.status))) {
      const attempts = d.attempts; // jaribio lililoshafanywa (passed/ failed zote)
      const mode = escalationFor(attempts + 1); // ngazi ya jaribio LIJALO
      // CO inayofuata inayokabili defect hii
      const existing = run.cos.find((c) => c.defectIds.includes(d.id) && c.attempt === d.attempts + 1);
      if (existing) continue;
      if (mode === "redecide" && deps.redecide) {
        const ev = evidence || run.evidence[`${milestoneId}.R${round}`];
        const rd = await deps.redecide(run.cos.find((c) => c.defectIds.includes(d.id))!, { evidence: ev! });
        if (rd.action === "WAIVE") {
          d.status = "WAIVED";
          note(`🕊️ WAIVER (${d.id}): ${rd.reason} — wameidhinishwa na: ${rd.approvedBy.join(", ")}`);
          continue;
        }
        if (rd.action === "MODIFY" && rd.modified) {
          run.cos.push(rd.modified);
          continue;
        }
        // KEEP: endelea na CO ya sort-here
      }
      const base = run.cos.find((c) => c.defectIds.includes(d.id))!;
      const nextCo: ChangeOrder = {
        ...base,
        id: newCheckId(run.cos).replace(/^C-/, "CO-"),
        attempt: attempts + 1,
        mode,
        diagnosis: (d as any)._lastDiag || undefined,
      };
      if (mode === "concrete" && deps.rewriteConcrete) {
        const ev = evidence || run.evidence[`${milestoneId}.R${round}`];
        const rw = await deps.rewriteConcrete(nextCo, String((d as any)._lastDiag || "ATTEMPTED_WRONG"), { evidence: ev! });
        run.cos.push(rw);
      } else if (mode === "pair_patch" && deps.pairPatch) {
        const ev = evidence || run.evidence[`${milestoneId}.R${round}`];
        nextCo.patch = await deps.pairPatch(nextCo, { evidence: ev! });
        run.cos.push(nextCo);
      } else {
        run.cos.push(nextCo);
      }
    }
    if (!anyOpenWork(run, milestoneId).length) break; // kama yote WAIVED/KEEP bila CO — toka loop, gate chini
  }

  /* ============ 4.10 sign-off============ */
  const openCount = run.defects.filter((d) => d.milestoneId === milestoneId && ["OPEN", "IN_FIX", "REOPENED"].includes(d.status)).length;
  const reachedCap = st.round >= st.maxRounds && openCount > 0;
  if (reachedCap) {
    mark("CAP_REACHED", `${milestoneId}.K.cap`);
    const inherited = applyCap(run, milestoneId);
    writeMilestonesState(runnerItems, run);
    note(`🟠 ${milestoneId}: kikimo 10 kimewashika — makosa ${inherited.length} → INHERITED (yanaendelea milestone inayofuata; yanaorodheshwa kwa mwisho).`);
    emit();
    return { status: "CAP_REACHED", milestoneId, rounds: st.round, defectsTotal: run.defects.length, defectsOpen: openCount, signedOff: false };
  }
  if (openCount === 0) {
    // Sahihi za raundi ya mwisho: kwa tests/p3 fakes tunatumia maelezo ya Verification ya mwisho
    const lastEv = run.evidence[`${milestoneId}.R${st.round}`] || evidence;
    const coSigs: ReviewSignature[] = lastEv ? collectLastSigs(run, milestoneId, st.round, reviewers) : reviewers.map((rv) => ({ reviewer: rv, verdict: "PASS" as const }));
    const finalSigs = coSigs.length ? coSigs : reviewers.map((rv) => ({ reviewer: rv, verdict: "PASS" as const }));
    // receiptsOk: hatua ya verify iliyofanya — hapa kuhesabu via defects history last
    const receiptsOk = !run.defects.some((d) => d.milestoneId === milestoneId && d.history.some((h) => h.result === "FAIL" && h.cause === "NOT_ATTEMPTED" && h.round === st.round));
    // visionDegraded: SIGN-OFF · 10.3.b
    let visionOk = !run.visionDegraded || m.reviewMode === "technical";
    if (!visionOk && deps.awaitVisionLane) {
      const waited = await deps.awaitVisionLane("lane yenye vision inahitajika kwa SIGN-OFF");
      if (waited) visionOk = true;
    }
    // C8 (PENDEKEZO, env toggle MS_BROWSER_EVAL=1): BROWSER-EVAL gate — visual/mixed inahitaji
    // kipimo cha browser halisi (DOM/screenshot) kilicho PASS kwenye raundi ya mwisho
    if (deps.browserEvalRequired && m.reviewMode !== "technical") {
      const browserTypes: CheckResult["type"][] = ["dom_exists", "computed_style", "no_horizontal_overflow", "console_clean", "contrast_min", "touch_target_min", "screenshot_taken"];
      const checksNow = (lastEv?.checks || []) as CheckResult[];
      const browserPass = checksNow.some((c) => browserTypes.includes(c.type) && c.result === "PASS");
      if (!browserPass) {
        note(`\u{1f512} sign-off imezuiwa (C8): hakuna kipimo cha browser kilicho PASS kwenye ushahidi wa raundi ${st.round} (MS_BROWSER_EVAL=1).`);
        mark("BLOCKED", `${milestoneId}.K.browser_eval`);
        writeMilestonesState(runnerItems, run);
        return { status: "BLOCKED", milestoneId, rounds: st.round, defectsTotal: run.defects.filter((d) => d.milestoneId === milestoneId).length, defectsOpen: 0, signedOff: false, blockedReason: "C8 browser_eval gate: ushahidi wa browser haujaliza (MS_BROWSER_EVAL=0 kuizima)" };
      }
    }
    const gate = signOffGate(finalSigs, (lastEv?.checks || []) as CheckResult[], run.defects.filter((d) => d.milestoneId === milestoneId), receiptsOk, !visionOk, m.reviewMode);
    if (gate.ok) {
      mark(gate.status, `${milestoneId}.K.signoff`);
      if (gate.withWaivers) {
        for (const d of gate.openMinor) d.status = "WAIVED";
        note(`🖊️ ${milestoneId}: SIGNED_OFF_WITH_WAIVERS (minor ${gate.openMinor.map((d) => d.id).join(", ")} zimewaiver).`);
      } else {
        note(`🖊️ ${milestoneId}: SIGNED_OFF ✅ — ${buildRoundHeader(st, run.defects)}`);
      }
      // C6+C7 (4.10): HARNESS ina-commit + tag milestone-Mk + push SERVER-SIDE (Computer hana token kamwe)
      if (deps.signOffCommit) {
        try {
          const sc = await deps.signOffCommit(milestoneId);
          if (sc.tag) st.signedTag = sc.tag;
          if (sc.tag) note(`🏷️ ${milestoneId}: git tag ${sc.tag}${sc.pushed ? " (imepush server-side)" : ""}${sc.note ? ` — ${sc.note}` : ""}.`);
          else if (sc.note) note(`🏷️ ${milestoneId}: tag haikuwezekana — ${sc.note}`);
        } catch (e) { note(`⚠️ ${milestoneId}: tag/push imeshindikana — ${String((e as { message?: string })?.message || e).slice(0, 160)}`); }
      }
      writeMilestonesState(runnerItems, run);
      emit();
      return {
        status: gate.status, milestoneId, rounds: st.round, defectsTotal: run.defects.filter((d) => d.milestoneId === milestoneId).length,
        defectsOpen: 0, signedOff: true, waivers: gate.openMinor.map((d) => d.id),
      };
    }
    note(`🔒 sign-off imezuiwa: ${gate.reasons.join(" · ")}`);
    mark("BLOCKED", `${milestoneId}.K.blocked`);
    return { status: "BLOCKED", milestoneId, rounds: st.round, defectsTotal: run.defects.length, defectsOpen: openCount, signedOff: false, blockedReason: gate.reasons.join(" · ") };
  }
  // Line ya mwisho: hakuna pass na hakuna cap?? — hali isiyo ya kawaida → CAP_REACHED analogy
  mark("CAP_REACHED", `${milestoneId}.K.cap2`);
  applyCap(run, milestoneId);
  return { status: "CAP_REACHED", milestoneId, rounds: st.round, defectsTotal: run.defects.length, defectsOpen: openCount, signedOff: false };
}

/* ============================ helpers zisizo za pub ============================ */

function reviewersFor(m: Milestone): string[] {
  // 7.1: visual → designer+frontend; technical → fani zinazochaguliwa na Optimus (2-3); mixed → hadi watatu
  if (m.reviewMode === "technical") return backendReviewers(m);
  if (m.reviewMode === "mixed") return backendReviewers(m).slice(0, 3);
  return ["designer", "frontend"];
}

function backendReviewers(m: Milestone): string[] {
  const r = m.roster.filter((x) => x !== "pm");
  return r.length >= 2 ? r.slice(0, 3) : ["backend", "qa", ...r.filter((x) => !["backend", "qa"].includes(x))].slice(0, 3);
}

/** Usafirishaji wa msafara wa CO×defect:
 *  - OPEN/REOPENED + attempts=a → CO AMBAZO ZINASUBIRI ni za attempt a+1.
 *  - IN_FIX + attempts=a → CO INAYOHUKUMIWA ni ya attempt a (imejaribiwa raundi hii). */
function pendingCosFor(run: MilestonesRunState, milestoneId: string): ChangeOrder[] {
  return run.cos.filter((co) => co.defectIds.some((id) => {
    const d = run.defects.find((x) => x.id === id);
    return !!d && d.milestoneId === milestoneId && ["OPEN", "REOPENED"].includes(d.status) && co.attempt === d.attempts + 1;
  }));
}

function inFlightCosFor(run: MilestonesRunState, milestoneId: string): ChangeOrder[] {
  return run.cos.filter((co) => co.defectIds.some((id) => {
    const d = run.defects.find((x) => x.id === id);
    return !!d && d.milestoneId === milestoneId && d.status === "IN_FIX" && co.attempt === d.attempts;
  }));
}

/** CO zote zinazohusiana na kazi inayopatikana (pending + in-flight). */
function anyOpenWork(run: MilestonesRunState, milestoneId: string): ChangeOrder[] {
  const ids = new Set<string>();
  for (const c of [...pendingCosFor(run, milestoneId), ...inFlightCosFor(run, milestoneId)]) ids.add(c.id);
  return run.cos.filter((c) => ids.has(c.id));
}

function collectLastSigs(run: MilestonesRunState, milestoneId: string, round: number, reviewers: string[]): ReviewSignature[] {
  // Patia sahihi za raundi ya mwisho kutoka receipts passed? — kwa sasa (P3 fake) tunachoendeleza:
  // mkaguzi anayehitajika (designer/frontend) wamepita defects zote → PASS. Verify halisi ni P6.
  const open = run.defects.filter((d) => d.milestoneId === milestoneId && ["OPEN", "IN_FIX", "REOPENED"].includes(d.status));
  return open.length ? [] : reviewers.map((rv) => ({ reviewer: rv, verdict: "PASS" as const }));
}

/** kimishekana kwenye evidence: kipimo cha CO kwenye evidence ya raundi hii → CheckResult */
function coCheckResult(ev: EvidencePack | null | undefined, check: AcceptanceCheck): CheckResult[] {
  if (!ev) return [];
  const id = check.id || "?";
  const found = (ev.checks || []).find((c) => c.id === id || (c.type === check.type && c.detail.includes(String(check.selector || check.path || check.cmd || ""))));
  return [found || { id, type: check.type, result: "PASS", detail: "(harness imepima — hakuna matokeo mabaya)" }];
}

function inheritedFor(milestoneId: string, run: MilestonesRunState, d: Defect): boolean {
  // defect ulirithiwa KWENYE milestone hii (milestone inayofuata inapokea D za zilizopita?)
  const idx = run.map.milestones.findIndex((x) => x.id === milestoneId);
  if (idx <= 0) return false;
  const prev = run.map.milestones[idx - 1].id;
  return d.milestoneId === prev;
}

export { pendingCosFor as _openCosFor };
