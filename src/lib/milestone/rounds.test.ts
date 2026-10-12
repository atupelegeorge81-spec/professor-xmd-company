// P1 — rounds.ts: RoundHeader (5.9), escalation (7.4), NO-OP (7.3.1), migongano, hukumu, sign-off gate, cap.
import { describe, expect, it } from "vitest";
import {
  applyCap, buildRoundHeader, escalationFor, findCOConflicts, inheritedForNext, judgeCO,
  noOpFiles, noOpMessage, parseDiffNameOnly, signOffGate, sortCOsByPriority, uncoveredDefects,
  verifyReceiptAgainstDiff,
} from "./rounds";
import { initMilestonesRun } from "./state";
import { fallbackMilestoneMap, validateChangeOrder, validateReceipt } from "./schemas";
import type { ChangeOrder, Defect, MilestoneState, Receipt, ReviewSignature } from "./types";

const st = (over: Partial<MilestoneState> = {}): MilestoneState => ({
  id: "M1", status: "VERIFYING", round: 3, maxRounds: 10, currentStepId: "M1.R3.verify",
  startedAt: "2026-10-12T00:00:00Z", updatedAt: "2026-10-12T00:00:00Z", lanesUsed: [], ...over,
});

const defect = (over: Partial<Defect> = {}): Defect => ({
  id: "D-001", milestoneId: "M1", foundInRound: 0, reportedBy: ["designer"], area: "header",
  severity: "major", title: "t", evidence: [], expected: "e", actual: "a",
  status: "OPEN", attempts: 1, history: [], ...over,
});

const coOf = (over: Partial<ChangeOrder> = {}): ChangeOrder => {
  const v = validateChangeOrder({
    id: "CO-001", defectIds: ["D-001"], location: { files: ["src/Header.tsx"], route: "/", selector: "header .logo" },
    current: "c", desired: "d", acceptance: [{ type: "computed_style", route: "/", selector: "header .logo", property: "color", expected: "#F2F0EB" }],
  });
  if (!v.ok) throw new Error(v.errors.join());
  return { ...v.value, ...over };
};

const sig = (reviewer: string, verdict: "PASS" | "FAIL" | "PARTIAL"): ReviewSignature => ({ reviewer, verdict });
const chk = (id: string, result: "PASS" | "FAIL" | "SKIP" | "ERROR", detail = "") => ({ id, type: "dom_exists" as const, result, detail });

describe("P1·milestones · RoundHeader (5.9)", () => {
  it("muundo halisi: kufungwa/wazi(jaribio)/waivers/zilizobaki", () => {
    const ds = [
      defect({ id: "D-001", status: "VERIFIED_FIXED" }),
      defect({ id: "D-004", status: "OPEN", attempts: 3 }),
      defect({ id: "D-009", status: "IN_FIX", attempts: 1 }),
      defect({ id: "D-010", status: "WAIVED" }),
      defect({ id: "D-020", milestoneId: "M9", status: "OPEN" }), // si ya M1 — haionyeshwi
    ];
    expect(buildRoundHeader(st(), ds)).toBe(
      "RAUNDI 3/10 (milestone M1) — Makosa yaliyofungwa: 1 · Yaliyo wazi: 2 (D-004: jaribio la 3, D-009: jaribio la 1) · Waivers: 1 · Raundi zilizobaki: 7");
  });
});

describe("P1·milestones · escalation tiers (7.4)", () => {
  it("attempts 1..5+ → standard/concrete/pair_patch/split/redecide", () => {
    expect([1, 2, 3, 4, 5, 8].map(escalationFor)).toEqual(["standard", "concrete", "pair_patch", "split", "redecide", "redecide"]);
  });
});

describe("P1·milestones · NO-OP + risiti (7.3.1/5.6)", () => {
  it("parseDiffNameOnly", () => {
    expect(parseDiffNameOnly("src/a.ts\n src/b.ts \n\nREADME.md")).toEqual(["src/a.ts", "src/b.ts", "README.md"]);
  });
  it("NO-OP: faili za CO zisizogusika → zinarudishwa", () => {
    const co = coOf({ location: { files: ["src/Header.tsx", "src/Nav.tsx"], route: "/" } });
    expect(noOpFiles(co, ["src/Header.tsx"])).toEqual(["src/Nav.tsx"]);
    expect(noOpFiles(co, ["src/Header.tsx", "src/Nav.tsx"])).toEqual([]);
    expect(noOpMessage(co, ["src/Nav.tsx"])).toContain("CO-001");
  });
  it("risiti ikilingana na diff: dai zisizo kwenye diff → anakatiliwa", () => {
    const r = validateReceipt({ orderId: "CO-001", status: "DONE", filesChanged: [{ path: "src/Header.tsx", summary: "s" }], commandsRun: ["npm test"] });
    if (!r.ok) throw new Error("x");
    expect(verifyReceiptAgainstDiff(r.value, ["src/Header.tsx"]).ok).toBe(true);
    expect(verifyReceiptAgainstDiff(r.value, []).ok).toBe(false); // dai + hakuna diff
    expect(verifyReceiptAgainstDiff(r.value, ["src/Header.tsx", "src/Extra.ts"]).ok).toBe(false); // diff zaidi ya risiti (siri)
  });
});

describe("P1·milestones · migongano wa CO (7.4)", () => {
  it("faili ileile + mali ileile + thamani tofauti → conflict", () => {
    const a = coOf({ id: "CO-001" });
    const b = coOf({ id: "CO-002", acceptance: [{ type: "computed_style", route: "/", selector: "header .logo", property: "color", expected: "#FF0000" }] });
    const hits = findCOConflicts([a], b);
    expect(hits.length).toBe(1);
    expect(hits[0].why).toContain("color");
  });
  it("mali tofauti → hakuna mgongano", () => {
    const a = coOf({ id: "CO-001" });
    const b = coOf({ id: "CO-002", acceptance: [{ type: "computed_style", route: "/", selector: "header .logo", property: "font-weight", expected: "600" }] });
    expect(findCOConflicts([a], b)).toEqual([]);
  });
});

describe("P1·milestones · hukumu ya CO (7.3.5/8.3 dhahabu)", () => {
  it("2×PASS + checks PASS → PASS", () => {
    const j = judgeCO([sig("designer", "PASS"), sig("frontend", "PASS")], [chk("C-001", "PASS")]);
    expect(j.verdict).toBe("PASS");
  });
  it("PASS ya mkaguzi + kipimo FAIL → FAIL (sheria ya dhahabu)", () => {
    const j = judgeCO([sig("designer", "PASS"), sig("frontend", "PASS")], [chk("C-001", "FAIL", "font=Courier")]);
    expect(j.verdict).toBe("FAIL");
    expect(j.reasons.join()).toMatch(/dhahabu/);
  });
  it("mgongano PASS dhidi ya FAIL → FAIL", () => {
    expect(judgeCO([sig("designer", "PASS"), sig("frontend", "FAIL")], []).verdict).toBe("FAIL");
  });
  it("PARTIAL+PARTIAL → PARTIAL; sahihi <2 → FAIL", () => {
    expect(judgeCO([sig("designer", "PARTIAL"), sig("frontend", "PARTIAL")], []).verdict).toBe("PARTIAL");
    expect(judgeCO([sig("designer", "PASS")], []).verdict).toBe("FAIL");
  });
});

describe("P1·milestones · sign-off gate (4.10/10.3)", () => {
  it("yote PASS → SIGNED_OFF", () => {
    const g = signOffGate([sig("designer", "PASS"), sig("frontend", "PASS")], [chk("C-1", "PASS")], [defect({ status: "VERIFIED_FIXED" })], true, false, "visual");
    expect(g.ok).toBe(true);
    expect(g.status).toBe("SIGNED_OFF");
  });
  it("minor wazi + yote PASS → SIGNED_OFF_WITH_WAIVERS", () => {
    const g = signOffGate([sig("designer", "PASS"), sig("frontend", "PASS")], [], [defect({ severity: "minor", status: "OPEN" })], true, false, "visual");
    expect(g.status).toBe("SIGNED_OFF_WITH_WAIVERS");
    expect(g.openMinor.length).toBe(1);
  });
  it("medium wazi → BLOCKED", () => {
    const g = signOffGate([sig("designer", "PASS"), sig("frontend", "PASS")], [], [defect({ severity: "medium", status: "OPEN" })], true, false, "visual");
    expect(g.ok).toBe(false);
    expect(g.reasons.join()).toMatch(/medium/);
  });
  it("visionDegraded: visual/mixed zinasimama; technical inaruhusiwa", () => {
    const vis = signOffGate([sig("designer", "PASS"), sig("frontend", "PASS")], [], [], true, true, "visual");
    expect(vis.ok).toBe(false);
    expect(signOffGate([sig("backend", "PASS"), sig("qa", "PASS")], [], [], true, true, "technical").ok).toBe(true);
  });
  it("risiti×diff zikigongana → BLOCKED", () => {
    expect(signOffGate([sig("designer", "PASS"), sig("frontend", "PASS")], [], [], false, false, "visual").ok).toBe(false);
  });
});

describe("P1·milestones · cap → INHERITED (7.5) + uncoveredDefects", () => {
  it("applyCap: makosa yote yaliyo wazi kwenye M yanakuwa INHERITED; yanaonekana kwa Milestone inayofuata", () => {
    const map = fallbackMilestoneMap(8, "s");
    const run = initMilestonesRun("s", map);
    run.defects.push(defect({ id: "D-001" }), defect({ id: "D-002", status: "VERIFIED_FIXED" }), defect({ id: "D-003", severity: "blocker", attempts: 5 }));
    const inh = applyCap(run, "M1");
    expect(inh.map((d) => d.id)).toEqual(["D-001", "D-003"]);
    expect(inheritedForNext(run, "M1").length).toBe(2);
    expect(inheritedForNext(run, "M2").length).toBe(0); // M2 ni ya mwisho → haina "inayofuata"
  });
  it("uncoveredDefects: kosa lisilo na CO linakataliwa", () => {
    const ds = [defect({ id: "D-001" }), defect({ id: "D-002" })];
    expect(uncoveredDefects(ds, [coOf({ defectIds: ["D-001"] })]).map((d) => d.id)).toEqual(["D-002"]);
    expect(uncoveredDefects(ds, [coOf({ defectIds: ["D-001", "D-002"] })])).toEqual([]);
  });
  it("sortCOsByPriority: 1 kwanza", () => {
    expect(sortCOsByPriority([coOf({ id: "CO-009", priority: 2 }), coOf({ id: "CO-001", priority: 1 })]).map((c) => c.id)).toEqual(["CO-001", "CO-009"]);
  });
});
