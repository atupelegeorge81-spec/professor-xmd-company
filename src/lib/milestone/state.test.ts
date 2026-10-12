// P1 — mashine ya hali: halali/haramu, idempotency ya stepId, chip round-trip.
import { describe, expect, it } from "vitest";
import {
  advance, allMilestonesTerminal, alreadyDone, canTransition, currentMilestone, initMilestonesRun,
  isLastAgendaOfMilestone, milestoneOfAgenda, readMilestonesState, resumeFromPause, writeMilestonesState,
} from "./state";
import { fallbackMilestoneMap, validateMilestoneMap } from "./schemas";

const SESSION = "sessT";
function runOf(total = 10, mode: "visual" | "technical" | "mixed" = "visual") {
  const map = validateMilestoneMap({
    milestones: [
      { id: "M1", title: "Msingi", agendas: { from: 1, to: 4 }, phase: "f", reviewMode: mode, roster: ["pm", "designer", "frontend"], rationale: "r" },
      { id: "M2", title: "Backend", agendas: { from: 5, to: 7 }, phase: "b", reviewMode: "technical", roster: ["pm", "backend", "qa"], rationale: "r" },
      { id: "M3", title: "Malizia", agendas: { from: 8, to: 10 }, phase: "z", reviewMode: "visual", roster: ["pm", "designer", "frontend"], rationale: "r" },
    ],
  }, total, SESSION);
  if (!map.ok) throw new Error(map.errors.join());
  return initMilestonesRun(SESSION, map.value);
}

describe("P1·milestones · mashine ya hali — mabadiliko", () => {
  it("njia ya kawaida inaruhusiwa; kuruka hata hatua moja inapigwa marufuku", () => {
    const run = runOf();
    // DISCUSSING→PLANNING→BUILDING→...→SIGNED_OFF
    for (const [to, sid] of [["PLANNING", "M1.P.plan"], ["BUILDING", "M1.B.build"], ["EVIDENCE", "M1.E.collect"], ["REVIEW_R0", "M1.R0.review"], ["FIXING", "M1.R1.fix"], ["VERIFYING", "M1.R1.verify"]] as const) {
      const r = advance(run, "M1", to, sid);
      expect(r.ok).toBe(true);
    }
    const bad = advance(run, "M1", "EVIDENCE", "M1.R1.verify"); // VERIFYING → EVIDENCE haramu
    expect(bad.ok).toBe(false);
    expect(bad.error).toMatch(/marufuku/);
  });

  it("stepId iliyokwisha → no-op (trigger idempotent ya 4.4: haitaanza ujenzi mara 2)", () => {
    const run = runOf();
    expect(advance(run, "M1", "PLANNING", "M1.P.plan").ok).toBe(true);
    expect(advance(run, "M1", "BUILDING", "M1.B.build").ok).toBe(true);
    // rudi trigger ya build kwa stepId ileile → no-op
    const again = advance(run, "M1", "BUILDING", "M1.B.build");
    expect(again.ok).toBe(true);
    expect(again.changed).toBe(false);
    expect(run.states.M1.status).toBe("BUILDING");
    expect(alreadyDone(run, "M1.B.build")).toBe(true);
  });

  it("hali terminal haitabadilika tena", () => {
    const run = runOf();
    advance(run, "M1", "PLANNING", "s1"); advance(run, "M1", "BUILDING", "s2");
    advance(run, "M1", "EVIDENCE", "s3"); advance(run, "M1", "REVIEW_R0", "s4"); advance(run, "M1", "SIGNED_OFF", "s5");
    expect(advance(run, "M1", "FIXING", "s6").ok).toBe(false);
  });

  it("PAUSED_* inakumbuka pausedFrom; resumeFromPause inarudisha hali", () => {
    const run = runOf();
    advance(run, "M1", "PLANNING", "s1");
    expect(advance(run, "M1", "PAUSED_QUOTA", "s2").ok).toBe(true);
    expect(run.states.M1.pausedFrom).toBe("PLANNING");
    const back = resumeFromPause(run, "M1", "s3");
    expect(back.ok).toBe(true);
    expect(run.states.M1.status).toBe("PLANNING");
  });

  it("canTransition: VERIFYING → SIGNED_OFF/SIGNED_OFF_WITH_WAIVERS/CAP_REACHED yes; VERIFYING→REVIEW_R0 no", () => {
    expect(canTransition("VERIFYING", "SIGNED_OFF")).toBe(true);
    expect(canTransition("VERIFYING", "SIGNED_OFF_WITH_WAIVERS")).toBe(true);
    expect(canTransition("VERIFYING", "CAP_REACHED")).toBe(true);
    expect(canTransition("VERIFYING", "REVIEW_R0")).toBe(false);
  });
});

describe("P1·milestones · chip persistence (11)", () => {
  it("write → read round-trip kwenye items za runner", () => {
    const run = runOf();
    advance(run, "M1", "PLANNING", "M1.P.plan");
    const items: any[] = [{ kind: "msg", id: "x" }];
    writeMilestonesState(items, run);
    expect(items.length).toBe(2);
    const back = readMilestonesState(items);
    expect(back?.states.M1.status).toBe("PLANNING");
    expect(back?.stepsDone["M1.P.plan"]).toBeTruthy();
    // kusasisha (badilisha chip ile ile — hakuna duplicate)
    advance(run, "M1", "BUILDING", "M1.B.build");
    writeMilestonesState(items, run);
    expect(items.filter((x) => x.kind === "chip" && String(x.text).startsWith("__professor")).length).toBe(1);
    expect(readMilestonesState(items)?.states.M1.status).toBe("BUILDING");
  });

  it("chip chafu → null salama", () => {
    const items = [{ kind: "chip", id: "xmd_milestones_state", text: "__professor_xmd_milestones__v1__{HARIBIKA" }];
    expect(readMilestonesState(items)).toBeNull();
  });
});

describe("P1·milestones · uratibu wa map/agenda", () => {
  it("milestoneOfAgenda + isLastAgendaOfMilestone + currentMilestone", () => {
    const run = runOf();
    expect(milestoneOfAgenda(run, 4)?.id).toBe("M1");
    expect(milestoneOfAgenda(run, 7)?.id).toBe("M2");
    expect(milestoneOfAgenda(run, 99)).toBeNull();
    expect(isLastAgendaOfMilestone(run, "M1", 3)).toBe(false);
    expect(isLastAgendaOfMilestone(run, "M1", 4)).toBe(true);
    expect(currentMilestone(run)?.id).toBe("M1");
    expect(allMilestonesTerminal(run)).toBe(false);
  });
});

describe("P1·milestones · fallback ramani", () => {
  it("fallback iko halali na inafanya kazi kwenye initMilestonesRun", () => {
    const map = fallbackMilestoneMap(3, SESSION);
    expect(validateMilestoneMap(map, 3, SESSION).ok).toBe(true);
    const run = initMilestonesRun(SESSION, map);
    expect(advance(run, "M1", "PLANNING", "s").ok).toBe(true);
  });
});
