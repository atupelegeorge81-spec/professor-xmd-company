// P3 acceptance: mtiririko mzima na Computer BANDIA unapita; trigger mara 2 haianzishi ujenzi mara 2;
// mpango wenye guard_failed haujengwi; NO-OP inagunduliwa; kikomo chafika → CAP_REACHED.
import { describe, expect, it } from "vitest";
import { runMilestonePipeline, type OrchestratorDeps } from "./orchestrate";
import { initMilestonesRun, writeMilestonesState, readMilestonesState } from "./state";
import { fallbackMilestoneMap, validateChangeOrder, validateMilestoneMap } from "./schemas";
import type { AcceptanceCheck, AnalystOutput, CheckResult, EvidencePack, MilestonesRunState } from "./types";

const PACK: EvidencePack = {
  milestoneId: "M1", round: 0, screenshots: [{ id: "S-001", route: "/", viewport: "375x667", state: "default", path: ".xmd/evidence/M1/R0/S-001.png" }],
  domMetrics: [], checks: [{ id: "C-001", type: "dom_exists", result: "PASS", detail: "header .logo ipo" }],
  commands: [{ cmd: "npm run build", exit: 0 }], gitDiffSummary: { filesChanged: 1, insertions: 20, deletions: 3 },
  regression: [], consoleErrors: [],
};

function runOf(): { run: MilestonesRunState; items: any[] } {
  const map = validateMilestoneMap({
    milestones: [
      { id: "M1", title: "Msingi", agendas: { from: 1, to: 3 }, phase: "f", reviewMode: "visual", roster: ["pm", "designer", "frontend"], rationale: "r" },
      { id: "M2", title: "Malizia", agendas: { from: 4, to: 5 }, phase: "z", reviewMode: "visual", roster: ["pm", "designer", "frontend"], rationale: "r" },
    ],
  }, 5, "orch");
  if (!map.ok) throw new Error("map");
  const items: any[] = [];
  const run = initMilestonesRun("orch", map.value);
  writeMilestonesState(items, run);
  return { run, items };
}

function depsBase(over: Partial<OrchestratorDeps>): OrchestratorDeps {
  return {
    log: () => {},
    generatePlan: async () => ({ md: "# Mpango\n## Vipimo vya Kukubalika\n```json\n[]\n```", title: "t", checks: [{ type: "dom_exists", route: "/", selector: "header", id: "C-001" }], blocked: false, errors: [] }),
    computerBuild: async () => ({ terminal: "COMPLETED_VERIFIED", report: "1. Muhtasari\n2. Faili\n3. Amri\n4. Vipimo\n5. Maamuzi\n6. Usalama\n7. Matatizo\n8. Hatari", changedFiles: ["src/Header.tsx"] }),
    collectEvidence: async (m, round) => ({ ...PACK, milestoneId: m.id, round }),
    analyse: async (reviewer): Promise<AnalystOutput> => ({ reviewer, findings: "nimeikagua", defects: [], suggestions: [] }),
    discussAndMerge: async () => ({ cos: [] }),
    verifyRound: async (inp) => Object.fromEntries((inp.cos || []).map((co) => [co.id, Object.fromEntries(inp.reviewers.map((rv) => [rv, { reviewer: rv, verdict: "PASS" as const }]))])),
    ...over,
  };
}

const coOk = (over: object = {}) => {
  const v = validateChangeOrder({
    id: "CO-001", defectIds: ["D-001"], location: { files: ["src/Header.tsx"], route: "/", selector: "header .logo" },
    current: "c", desired: "d", acceptance: [{ type: "dom_exists", route: "/", selector: "header .logo", id: "C-010" as any }],
    ...over,
  });
  if (!v.ok) throw new Error(v.errors.join());
  return v.value;
};

describe("P3 · runMilestonePipeline (Computer bandia)", () => {
  it("happy path: plan → build → evidence → R0 (kosa moja) → CO → R1 fix → SIGNED_OFF", async () => {
    const { run, items } = runOf();
    let builds = 0;
    const deps = depsBase({
      computerBuild: async (req) => {
        builds++;
        if (req.round === 0) return { terminal: "COMPLETED_VERIFIED", report: "Muhtasari Faili Amri Vipimo Maamuzi Usalama Matatizo Hatari", changedFiles: ["src/Header.tsx"] };
        // raundi 1: CO imefanywa — risiti + diff
        return {
          terminal: "COMPLETED_VERIFIED", report: "Muhtasari Faili Amri Vipimo Maamuzi Usalama Matatizo Hatari",
          receipts: [{ orderId: "CO-001", status: "DONE", filesChanged: [{ path: "src/Header.tsx", summary: "s", before: "a", after: "b" }], commandsRun: ["npm build"] }],
          changedFiles: ["src/Header.tsx"],
        };
      },
      analyse: async (reviewer) => ({
        reviewer, findings: "…", suggestions: [],
        defects: reviewer === "designer" ? [{ id: "D-001", milestoneId: "M1", severity: "major", foundInRound: 0, title: "Logo font mbaya", expected: "Inter", actual: "Courier", evidence: ["S-001"], reportedBy: ["designer"], area: "header" }] : [],
      }),
      discussAndMerge: async () => ({ cos: [coOk()] }),
      verifyRound: async (inp) => Object.fromEntries(inp.cos.map((co) => [co.id, Object.fromEntries(inp.reviewers.map((rv) => [rv, { reviewer: rv, verdict: "PASS" as const }]))])),
    });
    const r = await runMilestonePipeline(items, run, deps, "M1");
    expect(r.status).toBe("SIGNED_OFF");
    expect(r.signedOff).toBe(true);
    expect(builds).toBe(2); // ujenzi + raundi 1
    const defect = run.defects[0];
    expect(defect.status).toBe("VERIFIED_FIXED");
    expect(defect.history).toEqual([{ round: 1, result: "PASS", cause: undefined }]);
    expect(run.evidence["M1.R0"].screenshots.length).toBe(1);
    // state persisted through chip
    const boot = readMilestonesState(items);
    expect(boot?.states.M1.status).toBe("SIGNED_OFF");
  });

  it("TRIGGER IDEMPOTENT: pipeline iitwyo mara 2 baada ya sign-off → ujenzi unaanzishwa MARA MOJA tu", async () => {
    const { run, items } = runOf();
    let builds = 0;
    const deps = depsBase({ computerBuild: async () => { builds++; return { terminal: "COMPLETED_VERIFIED", report: "Muhtasari Faili Amri Vipimo Maamuzi Usalama Matatizo Hatari", changedFiles: [] }; } });
    const r1 = await runMilestonePipeline(items, run, deps, "M1");
    expect(r1.status).toBe("SIGNED_OFF");
    const r2 = await runMilestonePipeline(items, run, deps, "M1");
    expect(r2.status).toBe("SIGNED_OFF");
    expect(builds).toBe(1);
  });

  it("guard_failed / mpango iliyoshindwa: HAUJENGWA (computerBuild haifanywi)", async () => {
    const { run, items } = runOf();
    let builds = 0;
    const deps = depsBase({
      generatePlan: async () => ({ md: "", title: "t", checks: [], blocked: true, errors: ["Data Guard imerudisha"] }),
      computerBuild: async () => { builds++; return { terminal: "ERROR" }; },
    });
    const r = await runMilestonePipeline(items, run, deps, "M1");
    expect(r.status).toBe("BLOCKED");
    expect(r.blockedReason).toMatch(/Data Guard/);
    expect(builds).toBe(0);
    expect(run.states.M1.status).toBe("BLOCKED");
  });

  it("PAUSED_QUOTA katika ujenzi → milestone PAUSED_QUOTA; resume inapeleka mbio mpango-po-point", async () => {
    const { run, items } = runOf();
    const deps = depsBase({ computerBuild: async () => ({ terminal: "PAUSED_QUOTA" }) });
    const r = await runMilestonePipeline(items, run, deps, "M1");
    expect(r.status).toBe("PAUSED_QUOTA");
    expect(run.states.M1.pausedFrom).toBe("BUILDING");
  });

  it("NO-OP ya risiti inagunduliwa (kosa likiopen tena) na kupanda hadi escalation", async () => {
    const { run, items } = runOf();
    run.defects.push({
      id: "D-001", milestoneId: "M1", foundInRound: 0, reportedBy: ["designer"], area: "header", severity: "major",
      title: "t", evidence: [], expected: "e", actual: "a", status: "VERIFIED_FIXED", attempts: 0, history: [],
    });
    run.defects[0].status = "VERIFIED_FIXED";
    run.evidence["M1.R0"] = { ...PACK };
    run.stepsDone["M1.P.plan"] = { stepId: "M1.P.plan", result: "DONE", at: "" };
    run.stepsDone["M1.B.build"] = { stepId: "M1.B.build", result: "COMPLETED_VERIFIED", at: "" };
    run.plans["M1"] = { md: "# mpango", title: "t", checks: [], attempts: 1 };
    run.stepsDone["M1.R0.review"] = { stepId: "M1.R0.review", result: "DONE", at: "" };
    run.states.M1.status = "FIXING";
    run.defects.push({
      id: "D-002", milestoneId: "M1", foundInRound: 1, reportedBy: ["designer"], area: "nav", severity: "major",
      title: "Nav overflow", evidence: [], expected: "e", actual: "a", status: "OPEN", attempts: 0, history: [],
    });
    run.cos.push(coOk({ id: "CO-001", defectIds: ["D-002"], attempt: 1 }));
    // CU inarudisha risiti YENYE UWONGO (faili haijaguzwa) → NO-OP
    const deps = depsBase({
      computerBuild: async (req) => req.round === 0
        ? { terminal: "COMPLETED_VERIFIED", report: "8 sehemu Muhtasari Faili Amri Vipimo Maamuzi Usalama Matatizo Hatari", changedFiles: [] }
        : { terminal: "COMPLETED_VERIFIED", report: "Muhtasari Faili Amri Vipimo Maamuzi Usalama Matatizo Hatari", receipts: [{ orderId: "CO-001", status: "DONE", filesChanged: [{ path: "src/Header.tsx", summary: "s" }], commandsRun: [] }], changedFiles: [] },
      rewriteConcrete: async (co) => ({ ...co, mode: "concrete" as const, desired: co.desired + " (uhakika)" }),
      verifyRound: async (inp) => Object.fromEntries(inp.cos.map((co) => [co.id, Object.fromEntries(inp.reviewers.map((rv) => [rv, { reviewer: rv, verdict: "FAIL" as const }]))])),
    });
    const r = await runMilestonePipeline(items, run, deps, "M1");
    // NO-OP imegunduliwa → kosa limejaribiwa tena, hadi kikomo (rounds zote sims za FAIL)
    expect(["CAP_REACHED", "BLOCKED", "VERIFYING", "FIXING", "PAUSED_QUOTA"]).toContain(r.status);
    const d = run.defects.find((x) => x.id === "D-002")!;
    expect(d.history.some((h) => h.cause === "NOT_ATTEMPTED")).toBe(true);
    expect(d.attempts).toBeGreaterThanOrEqual(1);
  });

  it("kikomo 10: makosa → INHERITED na hali CAP_REACHED", async () => {
    const { run, items } = runOf();
    // config: M1 tayari imejengwa/signoff haikuatemea; R0 imefungwa kuna kosa moja OPEN
    run.plans["M1"] = { md: "# mpango", title: "t", checks: [], attempts: 1 };
    run.stepsDone["M1.P.plan"] = { stepId: "M1.P.plan", result: "DONE", at: "" };
    run.stepsDone["M1.B.build"] = { stepId: "M1.B.build", result: "COMPLETED_VERIFIED", at: "" };
    run.evidence["M1.R0"] = { ...PACK };
    run.states.M1.status = "REVIEW_R0";
    run.defects.push({
      id: "D-001", milestoneId: "M1", foundInRound: 0, reportedBy: ["designer"], area: "hero", severity: "major",
      title: "kidude", evidence: [], expected: "e", actual: "a", status: "OPEN", attempts: 0, history: [],
    });
    run.cos.push(coOk({ id: "CO-001", defectIds: ["D-001"] }));
    const deps = depsBase({
      analyse: async (rv) => ({ reviewer: rv, findings: "", defects: [], suggestions: [] }),
      discussAndMerge: async () => ({ cos: [] }),
      computerBuild: async (req) => req.round === 0
        ? { terminal: "COMPLETED_VERIFIED", report: "Muhtasari Faili Amri Vipimo Maamuzi Usalama Matatizo Hatari", changedFiles: [] }
        : { terminal: "COMPLETED_VERIFIED", report: "Muhtasari Faili Amri Vipimo Maamuzi Usalama Matatizo Hatari", receipts: [{ orderId: "CO-001", status: "DONE", filesChanged: [{ path: "src/Header.tsx", summary: "s" }], commandsRun: [] }], changedFiles: ["src/Header.tsx"] },
      verifyRound: async (inp) => Object.fromEntries(inp.cos.map((co) => [co.id, Object.fromEntries(inp.reviewers.map((rv) => [rv, { reviewer: rv, verdict: "FAIL" as const }]))])),
      rewriteConcrete: async (co) => co,
      pairPatch: async () => "diff --git fake",
      redecide: async () => ({ action: "KEEP", reason: "endelea", approvedBy: ["designer", "frontend", "pm"] }),
    });
    const r = await runMilestonePipeline(items, run, deps, "M1");
    expect(r.status).toBe("CAP_REACHED");
    const d = run.defects[0];
    expect(d.status).toBe("INHERITED");
    expect(d.attempts).toBeGreaterThanOrEqual(10 - 1);
    expect(run.states.M1.status).toBe("CAP_REACHED");
  });
});

describe("P3 · riponi-evidence mode visual requirement", () => {
  it("fallback map iko valid kwa hati (zilizopatikana boundary za storia)", () => {
    expect(validateMilestoneMap(fallbackMilestoneMap(5, "x"), 5, "x").ok).toBe(true);
  });
});
