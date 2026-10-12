/* src/lib/milestone/finale.test.ts — P9 (maelezo.md 13): ripoti ya mwisho kutoka data. */
import { describe, expect, it } from "vitest";
import { initMilestonesRun } from "./state";
import { fallbackMilestoneMap } from "./schemas";
import type { EvidencePack, SignOff } from "./types";
import { buildMilestonesFinalReport } from "./finale";

function fill(run: ReturnType<typeof initMilestonesRun>): import("./types").MilestonesRunState {
  const now = new Date().toISOString();
  run.states.M1.status = "SIGNED_OFF";
  run.states.M1.round = 2;
  run.states.M2.status = "SIGNED_OFF_WITH_WAIVERS";
  run.states.M2.round = 4;
  run.states.M3.status = "CAP_REACHED";
  run.states.M3.round = 10;
  run.states.M4.status = "BLOCKED";
  run.defects.push(
    { id: "D-001", milestoneId: "M3", foundInRound: 3, reportedBy: ["qa"], area: "/header", severity: "major", title: "nav haifuti", expected: "nav 48px", actual: "nav 24px", evidence: ["S-002"], status: "INHERITED", attempts: 5, history: [{ round: 3, result: "FAIL", cause: "NOT_ATTEMPTED" }, { round: 4, result: "FAIL", cause: "ATTEMPTED_WRONG" }] },
    { id: "D-002", milestoneId: "M3", foundInRound: 5, reportedBy: ["designer"], area: "footer", severity: "minor", title: "padding-footer mbaya kidogo", expected: "16px", actual: "12px", evidence: [], status: "WAIVED", attempts: 2, history: [], waiveReason: "chiaro ni kidogo sana — mmiliki yaachana nayo", waiveApprovedBy: ["pm", "designer", "frontend"] },
    { id: "D-003", milestoneId: "M4", foundInRound: 1, reportedBy: ["backend"], area: "repo", severity: "blocker", title: "build inavunjika", expected: "build pass", actual: "exit 1", evidence: ["C-007"], status: "OPEN", attempts: 1, history: [] },
  );
  const so: SignOff = {
    milestoneId: "M1",
    status: "SIGNED_OFF",
    reviewers: [{ reviewer: "designer", verdict: "PASS" }, { reviewer: "frontend", verdict: "PASS" }],
    checksSummary: { passed: 5, failed: 0, skipped: 0 },
    openDefectsAtSign: [],
    waivedDefects: [],
    at: now,
  };
  run.signoffs.push(so);
  const ev: EvidencePack = {
    milestoneId: "M1", round: 0,
    screenshots: [
      { id: "S-001", route: "/", viewport: "375", state: "loaded", path: "S-001.png" },
      { id: "S-002", route: "/menu", viewport: "1280", state: "loaded", path: "S-002.png" },
    ],
    domMetrics: [],
    checks: [{ id: "C-001", type: "dom_exists", result: "PASS", detail: "ok" }, { id: "C-002", type: "console_clean", result: "FAIL", detail: "1 err" }],
    commands: [{ cmd: "npm run build", exit: 0 }],
    gitDiffSummary: { filesChanged: 12, insertions: 340, deletions: 98 },
    regression: [{ route: "/menu", viewport: "1280", changedPct: 4.2 }],
    consoleErrors: [],
  };
  run.evidence = { "M1.R0": ev };
  return run;
}

describe("P9 · ripoti ya mwisho (sehemu 13)", () => {
  it("ina sehemu zote 7 na hali halisi (IMESIMAMA kwa CAP_REACHED/BLOCKED)", () => {
    const map = fallbackMilestoneMap(16, "ses"); // 16 → k = 4 (M1..M4)
    const run = fill(initMilestonesRun("ses", map));
    const out = buildMilestonesFinalReport({
      project: "Duka la Mtandaoni", brief: "Tengeneza duka la mtandaoni lenye Checkout na lipa pamoja na admin",
      run, ledgerText: "- [A1] Msingi: LOCKED — muundo olivoana",
      githubUrl: "https://github.com/x/duka", liveUrl: "https://duka.vercel.app",
    });
    for (const n of [1, 2, 3, 4, 5, 6, 7] as const) {
      expect(out.sections[n].length).toBeGreaterThan(5);
      expect(out.markdown).toContain(`## ${n}.`);
    }
    expect(out.sections[2]).toContain("SIGNED_OFF");
    expect(out.sections[2]).toContain("CAP_REACHED");
    expect(out.sections[2]).toContain("BLOCKED");
    expect(out.sections[3]).toContain("[A1]");
    expect(out.sections[4]).toContain("D-001");
    expect(out.sections[4]).toContain("INHERITED");
    expect(out.sections[4]).toContain("chiaro");
    expect(out.sections[5]).toContain("S-001");
    expect(out.sections[5]).toContain("github.com/x/duka");
    expect(out.sections[5]).toContain("Regression");
    expect(out.statusLabel).toBe("IMESIMAMA");
    expect(out.markdown).not.toMatch(/imekamilika dhahiri/i);
  });
  it("status label: milestones zote SIGNED_OFF → KAMILI", () => {
    const map = fallbackMilestoneMap(8, "s2"); // k=2
    const run = initMilestonesRun("s2", map);
    for (const m of map.milestones) { run.states[m.id].status = "SIGNED_OFF"; }
    const out = buildMilestonesFinalReport({ project: "X", brief: "", run });
    expect(out.statusLabel).toBe("KAMILI");
    expect(out.statusDetail).toContain("zimesajiliwa");
  });
  it("SEHEMU: sehemu tu zikisainiwa — inaarifhalisha", () => {
    const map = fallbackMilestoneMap(8, "s3");
    const run = initMilestonesRun("s3", map);
    run.states.M1.status = "SIGNED_OFF";
    const out = buildMilestonesFinalReport({ project: "Y", brief: "", run });
    expect(out.statusLabel).toBe("SEHEMU");
    expect(out.markdown).toContain("zilizosainiwa: 1/");
  });
});
