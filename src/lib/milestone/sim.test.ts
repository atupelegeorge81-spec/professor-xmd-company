// P1 — SIMULATION kamili na LLM bandia (fake) ya mtiririko: ramani → agenda → trigger → mpango
// → ujenzi (Computer bandia) → ushahidi → Raundi 0 → raundi 1.. → sign-off → milestone 2 → cap.
// Hakuna LLM halisi: hii ndiyo "simulation moja kamili" ya kigezo cha kukubaliwa cha P1.
import { describe, expect, it } from "vitest";
import {
  advance, allMilestonesTerminal, currentMilestone, initMilestonesRun, isLastAgendaOfMilestone,
  milestoneOfAgenda, writeMilestonesState, readMilestonesState, alreadyDone,
} from "./state";
import { fallbackMilestoneMap, newCheckId, newDefectId, parseJsonFromLLM, validateChangeOrder, validateMilestoneMap, validateReceipt } from "./schemas";
import { buildOCB, buildOCBC } from "./ocb";
import { applyCap, buildRoundHeader, escalationFor, judgeCO, noOpFiles, signOffGate, sortCOsByPriority, uncoveredDefects, verifyReceiptAgainstDiff, withCheckIds } from "./rounds";
import { extractChecksFromPlan, planHasVerification } from "./checks";
import type { AcceptanceCheck, ChangeOrder, CheckResult, MilestonesRunState, Receipt, ReviewSignature } from "./types";

/* ========================= LLM BANDIA ========================= */

interface FakeLLM {
  agendaMap(agendaCount: number): unknown;
  milestonePlan(mdTitle: string): string;
  computerBuild(planMd: string, cos: ChangeOrder[]): { report: string; receipts: Receipt[]; changedFiles: string[] };
  analyse(reviewer: string, round: number): { defects: unknown[]; suggestions: unknown[]; findings: string };
  verify(reviewer: string, co: ChangeOrder, round: number): ReviewSignature;
}

const TEAM = [
  { id: "pm", name: "Optimus", role: "Project Manager" },
  { id: "designer", name: "Ultron", role: "UI/UX Designer" },
  { id: "frontend", name: "Vextron", role: "Frontend Engineer" },
  { id: "backend", name: "Megatron", role: "Backend & DB Engineer" },
  { id: "qa", name: "Cybertron", role: "QA & DevOps Engineer" },
];

/** LLM bandia: ifanye kosa moja la major kwenye M1 R0, kisha liweke sawa raundi inayofuata. */
const happyLLM: FakeLLM = {
  agendaMap() {
    return {
      sessionId: "sim1", generatedBy: "optimus@gemini-flash", usedFallback: false,
      milestones: [
        { id: "M1", title: "Msingi & muonekano", agendas: { from: 1, to: 3 }, phase: "foundation", reviewMode: "visual", roster: ["pm", "designer", "frontend"], rationale: "muonekano kwanza" },
        { id: "M2", title: "Backend & API", agendas: { from: 4, to: 6 }, phase: "backend", reviewMode: "technical", roster: ["pm", "backend", "qa"], rationale: "api kisha" },
        { id: "M3", title: "Malizia", agendas: { from: 7, to: 8 }, phase: "final", reviewMode: "visual", roster: ["pm", "designer", "frontend"], rationale: "mwisho" },
      ],
    };
  },
  milestonePlan() {
    return [
      "# Mpango wa Milestone", "## Hatua", "- Hatua 1: jenga header", "- Hatua 2: jenga hero",
      "## Vipimo vya Kukubalika", "```json",
      JSON.stringify([
        { type: "dom_exists", route: "/", selector: "header .logo" },
        { type: "console_clean", routes: ["/"] },
        { type: "computed_style", route: "/", selector: "header .logo", property: "font-family", expected: "Inter" },
      ]),
      "```",
    ].join("\n");
  },
  computerBuild(_plan, cos) {
    const receipts: Receipt[] = cos.map((co) => ({
      orderId: co.id, status: "DONE",
      filesChanged: co.location.files.map((f) => ({ path: f, summary: "s", before: "kabla", after: "baada" })),
      commandsRun: ["npm run build"], notes: "ok",
    }));
    return {
      report: ["1. Muhtasari", "2. Faili", "3. Amri", "4. Vipimo", "5. Maamuzi", "6. Usalama", "7. Matatizo", "8. Hatari zinazofuata"].join("\n"),
      receipts,
      changedFiles: cos.flatMap((c) => c.location.files),
    };
  },
  analyse(reviewer, _round) {
    return {
      reviewer,
      findings: "nimeikagua kila picha… header yote, hero, kadi…",
      defects: [{
        id: "D-001", milestoneId: "M1", severity: "major", foundInRound: 0,
        title: "Font ya logo si Inter", expected: "font-family=Inter (ledger A1)", actual: "font-family=Courier", evidence: ["S-001", "C-001"],
        reportedBy: [reviewer], area: "header",
      }],
      suggestions: [{ title: "Ongeza spacer kubwa", detail: "…" }],
    };
  },
  verify(reviewer, _co, _round) {
    return { reviewer, verdict: "PASS" };
  },
};

/* ========================= orchestrator bandia (mfano wa P3) ========================= */

function runCheckFake(c: AcceptanceCheck, passAll: boolean): CheckResult {
  return { id: c.id || "C-000", type: c.type, result: passAll ? "PASS" : "FAIL", detail: passAll ? "ok" : "alishindwa (bandia)" };
}

describe("P1·milestones · SIMULATION kamili na LLM bandia", () => {
  it("ramani → 3 milestones → sign-off zote kwa hatua za code (trigger idempotent)", () => {
    const sessionId = "sim1";
    const N = 8; // agenda 1..8
    /* === Hatua B+C: map === */
    const raw = parseJsonFromLLM("```json\n" + JSON.stringify(happyLLM.agendaMap(N)) + "\n```");
    const mapV = validateMilestoneMap(raw, N, sessionId);
    expect(mapV.ok).toBe(true);
    let run: MilestonesRunState = initMilestonesRun(sessionId, mapV.ok ? mapV.value : fallbackMilestoneMap(N, sessionId));
    const items: any[] = [];
    writeMilestonesState(items, run);
    /* === agenda zote (D) — code inaamua trigger, si LLM === */
    let builds = 0;
    for (let a = 1; a <= N; a++) {
      const m = milestoneOfAgenda(run, a)!;
      expect(m).not.toBeNull();
      // mjadala wa agenda a (bandia) hufanyika hapa…
      const ocb = buildOCB({ project: "Sim", team: TEAM, run, map: run.map, roleId: "pm", step: `mjadala wa agenda ${a}`, milestoneId: m.id, next: "ledger" });
      expect(ocb).toContain("Milestone");
      if (isLastAgendaOfMilestone(run, m.id, a)) {
        /* E: trigger — idempotent */
        for (let t = 0; t < 2; t++) {
          const sidP = `${m.id}.P.plan`;
          if (!alreadyDone(run, sidP)) {
            const st = advance(run, m.id, "PLANNING", sidP);
            expect(st.ok).toBe(true);
            expect(st.changed).toBe(t === 0);
            /* F: mpango wa milestone + vipimo */
            const md = happyLLM.milestonePlan(`${m.id} plan`);
            const got = extractChecksFromPlan(md, "mpango");
            expect(got.errors).toEqual([]);
            expect(got.checks.length).toBe(3); // 8.3 checks kutoka fence ya JSON
            expect(planHasVerification(got.checks)).toBe(true);
            let checks = withCheckIds(got.checks, []);
            /* BUILDING: Computer bandia */
            const obc = buildOCBC({ project: "Sim", team: TEAM, run, map: run.map, roleId: "pm", step: "ujenzi", milestoneId: m.id, next: "ushahidi" });
            expect(obc).toContain("OCB-C");
            const built = happyLLM.computerBuild(md, []);
            expect(built.report).toContain("Muhtasari");
            const bid = `${m.id}.B.build`;
            const bs = advance(run, m.id, "BUILDING", bid);
            expect(bs.changed).toBe(t === 0);
            builds += t === 0 ? 1 : 0;
            /* EVIDENCE: checks bandia zote PASS */
            const results = checks.map((c) => runCheckFake(c, true));
            const es = advance(run, m.id, "EVIDENCE", `${m.id}.E.collect`);
            expect(es.changed).toBe(t === 0);
            results.forEach((r) => expect(r.result).toBe("PASS"));
            /* Raundi 0 */
            const r0 = advance(run, m.id, "REVIEW_R0", `${m.id}.R0.review`);
            expect(r0.changed).toBe(t === 0);
            run.states[m.id].round = 0;
            run.states[m.id].lanesUsed.push({ call: `${m.id}.R0.designer.analyse`, lane: "gemini-flash@key1", visionCapable: true });
            /* uchambuzi bandia: M1 ina kosa moja; M2/M3 hazina */
            const analyses = ["designer", "frontend"].map((rv) => happyLLM.analyse(rv, 0));
            if (m.id === "M1") {
              /* DEFECT D-001 inaingia ledger → CO */
              const d0 = analyses[0].defects[0] as any;
              run.defects.push({ ...d0, id: newDefectId(run.defects), status: "OPEN", attempts: 0, history: [] });
              const uncovered = uncoveredDefects(run.defects, run.cos);
              expect(uncovered.length).toBe(1);
              const coV = validateChangeOrder({
                id: newCheckId(run.cos).replace("C-", "CO-"),
                defectIds: [uncovered[0].id], attempt: 1, priority: 1,
                location: { files: ["src/Header.tsx"], route: "/", selector: "header .logo" },
                current: "font-family=Courier", desired: "font-family=Inter",
                acceptance: [{ type: "computed_style", route: "/", selector: "header .logo", property: "font-family", expected: "Inter" }],
                mode: escalationFor(1),
              });
              expect(coV.ok).toBe(true);
              run.cos.push(coV.ok ? coV.value : (() => { throw new Error("CO batili"); })());
              /* FIXING + VERIFYING (raundi 1) */
              advance(run, m.id, "FIXING", `${m.id}.R1.fix`);
              run.states[m.id].round = 1;
              run.defects[0].status = "IN_FIX";
              run.defects[0].attempts = 1;
              const built2 = happyLLM.computerBuild(md, sortCOsByPriority(run.cos));
              /* risiti × git diff (7.3.1) */
              built2.receipts.forEach((r) => {
                const rv = validateReceipt(r);
                expect(rv.ok).toBe(true);
                const vr = verifyReceiptAgainstDiff(rv.ok ? rv.value : r, built2.changedFiles);
                expect(vr.ok).toBe(true);
                expect(noOpFiles(run.cos.find((c) => c.id === r.orderId)!, built2.changedFiles)).toEqual([]);
              });
              advance(run, m.id, "VERIFYING", `${m.id}.R1.verify`);
              const sigs: ReviewSignature[] = ["designer", "frontend"].map((rv) => happyLLM.verify(rv, run.cos[0], 1));
              /* vipimo vya CO vya raundi 1 PASS */
              const coChecks = sortCOsByPriority(run.cos).flatMap((c) => c.acceptance).map((c) => runCheckFake(c, true));
              const verdicts = run.cos.map((co) => judgeCO(sigs, coChecks));
              expect(verdicts.every((v) => v.verdict === "PASS")).toBe(true);
              run.defects[0].status = "VERIFIED_FIXED";
              run.defects[0].history.push({ round: 1, result: "PASS" });
              /* sign-off gate */
              expect(buildRoundHeader(run.states[m.id], run.defects)).toContain("Yaliyo wazi: 0");
              const gate = signOffGate(sigs, [...results, ...coChecks], run.defects.filter((d) => d.milestoneId === m.id), true, !!run.visionDegraded, m.reviewMode);
              expect(gate.ok).toBe(true);
              const so = advance(run, m.id, gate.status, `${m.id}.K.signoff`);
              expect(so.ok).toBe(t === 0 || so.changed === false);
            } else {
              /* 2×PASS bila makosa + checks PASS → sign-off moja kwa moja (technical pia) */
              const sigs: ReviewSignature[] = ["designer", "frontend"].map((rv) => happyLLM.verify(rv, run.cos[0] || ({} as ChangeOrder), 0));
              const gate = signOffGate(sigs, results, run.defects.filter((d) => d.milestoneId === m.id), true, false, m.reviewMode);
              expect(gate.ok).toBe(true);
              const so = advance(run, m.id, gate.status, `${m.id}.K.signoff`);
              expect(so.ok).toBe(t === 0 || so.changed === false);
            }
          }
        }
      }
    }
    expect(builds).toBe(3); // milestones 3 → builds 3 (si 6 — trigger idempotent)
    expect(allMilestonesTerminal(run)).toBe(true);
    expect(run.states.M1.status).toBe("SIGNED_OFF");
    expect(currentMilestone(run)).toBeNull();
    /* persistence round-trip (resume) */
    const revived = readMilestonesState(items);
    expect(revived).not.toBeNull(); // chip iliyopo = hali ya KUANZA (iliyoandikwa mwanzoni)
    expect(revived?.states.M1.status).toBe("DISCUSSING"); // inaendelea tena salama — idempotent
    writeMilestonesState(items, run);
    const revived2 = readMilestonesState(items);
    expect(revived2?.states.M1.status).toBe("SIGNED_OFF");
    expect(revived2?.defects.length).toBe(1);
    expect(revived2?.defects[0].status).toBe("VERIFIED_FIXED");
  });

  it("kikomo 10: CAP_REACHED + makosa INHERITED", () => {
    const run: MilestonesRunState = initMilestonesRun("simCap", fallbackMilestoneMap(8, "simCap"));
    advance(run, "M1", "PLANNING", "M1.P");
    advance(run, "M1", "BUILDING", "M1.B");
    advance(run, "M1", "EVIDENCE", "M1.E");
    advance(run, "M1", "REVIEW_R0", "M1.R0");
    run.defects.push({
      id: "D-001", milestoneId: "M1", foundInRound: 0, reportedBy: ["designer"], area: "hero",
      severity: "major", title: "kitu", evidence: [], expected: "e", actual: "a", status: "OPEN", attempts: 10, history: [],
    });
    for (let r = 1; r <= 10; r++) {
      advance(run, "M1", "FIXING", `M1.R${r}.fix`);
      advance(run, "M1", "VERIFYING", `M1.R${r}.verify`);
      run.states.M1.round = r;
      run.defects[0].history.push({ round: r, result: "FAIL", cause: "ATTEMPTED_WRONG" });
    }
    /* raundi 10 imefika: gate inafanya kazi? — mojawapo wawili wameshindwa → FAIL + cap */
    const gate = signOffGate([{ reviewer: "designer", verdict: "FAIL" }, { reviewer: "frontend", verdict: "FAIL" }], [], run.defects, true, false, "visual");
    expect(gate.ok).toBe(false);
    const inh = applyCap(run, "M1");
    expect(inh.length).toBe(1);
    expect(inh[0].status).toBe("INHERITED");
    const cap = advance(run, "M1", "CAP_REACHED", "M1.K.cap");
    expect(cap.ok).toBe(true);
    expect(run.states.M1.status).toBe("CAP_REACHED");
    expect(currentMilestone(run)?.id).toBe("M2");
  });

  it("sign-off ya visual ikizuiliwa visionDegraded (10.3) — technical hairuhusiwi kuzuia", () => {
    const run = initMilestonesRun("simV", fallbackMilestoneMap(4, "simV", "visual"));
    run.visionDegraded = true;
    const gate = signOffGate(
      [{ reviewer: "designer", verdict: "PASS" }, { reviewer: "frontend", verdict: "PASS" }], [], [],
      true, run.visionDegraded, "visual");
    expect(gate.ok).toBe(false);
    expect(gate.reasons.join()).toMatch(/visionDegraded/);
    run.visionDegraded = false;
    const gate2 = signOffGate(
      [{ reviewer: "designer", verdict: "PASS" }, { reviewer: "frontend", verdict: "PASS" }], [], [],
      true, run.visionDegraded, "visual");
    expect(gate2.ok).toBe(true);
  });
});
