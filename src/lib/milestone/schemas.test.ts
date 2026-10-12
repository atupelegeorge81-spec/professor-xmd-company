// P1 — validators: kila schema halali/batili (kigezo cha kukubaliwa).
import { describe, expect, it } from "vitest";
import {
  fallbackMilestoneMap, parseJsonFromLLM, validateAcceptanceCheck, validateAnalystOutput,
  validateChangeOrder, validateDefect, validateEvidencePack, validateMilestoneMap, validateReceipt,
} from "./schemas";

describe("P1·milestones · parseJsonFromLLM", () => {
  it("JSON ndani ya fence", () => {
    expect(parseJsonFromLLM('hapa maelezo\n```json\n{"a":1}\n```\nzaidi')).toEqual({ a: 1 });
  });
  it("JSON ghafi bila fence", () => {
    expect(parseJsonFromLLM('kabla {"x": [1,2]} baada')).toEqual({ x: [1, 2] });
  });
  it("hakuna JSON → null", () => {
    expect(parseJsonFromLLM("habari zote njema")).toBeNull();
  });
});

describe("P1·milestones · 8.3 AcceptanceCheck", () => {
  it("command halali", () => {
    const v = validateAcceptanceCheck({ type: "command", cmd: "npm test", exitCode: 0 });
    expect(v.ok).toBe(true);
  });
  it("command bila cmd → batili", () => {
    expect(validateAcceptanceCheck({ type: "command" }).ok).toBe(false);
  });
  it("computed_style kanipe expected AU forbidden (mojawapo)", () => {
    expect(validateAcceptanceCheck({ type: "computed_style", route: "/", selector: "a", property: "color", expected: "#fff" }).ok).toBe(true);
    expect(validateAcceptanceCheck({ type: "computed_style", route: "/", selector: "a", property: "color", forbidden: ["red"] }).ok).toBe(true);
    expect(validateAcceptanceCheck({ type: "computed_style", route: "/", selector: "a", property: "color" }).ok).toBe(false);
  });
  it("aina isiyojulikana → batili", () => {
    expect(validateAcceptanceCheck({ type: "magic_check" }).ok).toBe(false);
  });
  it("contrast_min inahitaji selector+min(namba)", () => {
    expect(validateAcceptanceCheck({ type: "contrast_min", selector: "p", min: 4.5 }).ok).toBe(true);
    expect(validateAcceptanceCheck({ type: "contrast_min", selector: "p", min: "4.5" }).ok).toBe(false);
  });
  it("grep bila paths → batili", () => {
    expect(validateAcceptanceCheck({ type: "grep", pattern: "uppercase" }).ok).toBe(false);
  });
  it("http inahitaji method+url+status", () => {
    expect(validateAcceptanceCheck({ type: "http", method: "get", url: "/api/health", status: 200 }).ok).toBe(true);
    expect(validateAcceptanceCheck({ type: "http", url: "/api/health", status: 200 }).ok).toBe(false);
  });
});

describe("P1·milestones · 5.1 MilestoneMap", () => {
  const good = {
    milestones: [
      { id: "M1", title: "Msingi", agendas: { from: 1, to: 4 }, phase: "foundation", reviewMode: "visual", roster: ["optimus", "ultron", "vextron"], rationale: "r" },
      { id: "M2", title: "Vipengele", agendas: { from: 5, to: 10 }, phase: "features", reviewMode: "mixed", roster: ["pm", "designer", "frontend", "backend"], rationale: "r" },
    ],
  };
  it("halali N=10 (roster kwa majina hu-normalized)", () => {
    const v = validateMilestoneMap(good, 10, "sess");
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.milestones[0].roster).toEqual(["pm", "designer", "frontend"]);
      expect(v.value.milestones[1].roster).toContain("backend");
    }
  });
  it("batili: pengo (agenda 5 haiko popote)", () => {
    const m = { milestones: [ { ...good.milestones[0], agendas: { from: 1, to: 4 } }, { ...good.milestones[1], agendas: { from: 6, to: 10 } } ] };
    const v = validateMilestoneMap(m, 10);
    expect(v.ok).toBe(false); if (!v.ok) expect(v.errors.join()).toMatch(/pengo/);
  });
  it("batili: overlap", () => {
    const m = { milestones: [ good.milestones[0], { ...good.milestones[1], agendas: { from: 4, to: 10 } } ] };
    const v = validateMilestoneMap(m, 10);
    expect(v.ok).toBe(false); if (!v.ok) expect(v.errors.join()).toMatch(/overlap/);
  });
  it("batili: hazijafunika mwisho (1..7 tu kwa N=10)", () => {
    const m = { milestones: [ good.milestones[0], { ...good.milestones[1], agendas: { from: 5, to: 7 } } ] };
    const v = validateMilestoneMap(m, 10);
    expect(v.ok).toBe(false); if (!v.ok) expect(v.errors.join()).toMatch(/hazijafunikwa/);
  });
  it("batili: zaidi ya N", () => {
    const m = { milestones: [ { ...good.milestones[0], agendas: { from: 1, to: 12 } } ] };
    expect(validateMilestoneMap(m, 10).ok).toBe(false);
  });
  it("batili: reviewMode mbaya + agent asiyejulikana", () => {
    const m = { milestones: [ { ...good.milestones[0], reviewMode: "pretty", roster: ["optimus", "tarzan"] } ] };
    const v = validateMilestoneMap(m, 10);
    expect(v.ok).toBe(false);
    if (!v.ok) { expect(v.errors.join()).toMatch(/reviewMode/); expect(v.errors.join()).toMatch(/tarzan/); }
  });
  it("fallback ceil(N/4): N=15 → 4 milestones zinazofunika yote", () => {
    const f = fallbackMilestoneMap(15, "s");
    expect(f.milestones.length).toBe(4);
    expect(f.milestones[0].agendas.from).toBe(1);
    expect(f.milestones[3].agendas.to).toBe(15);
    const v = validateMilestoneMap(f, 15, "s");
    expect(v.ok).toBe(true);
    expect(f.usedFallback).toBe(true);
  });
});

describe("P1·milestones · 5.4 Defect / 5.5 ChangeOrder / 5.6 Receipt", () => {
  const defect = { id: "D-001", milestoneId: "M1", severity: "major", title: "Header bovu", expected: "X", actual: "Y", reportedBy: ["designer"], evidence: ["S-001"] };
  it("defect halali hunormalizwa (status=OPEN, attempts=0)", () => {
    const v = validateDefect(defect);
    expect(v.ok).toBe(true); if (v.ok) expect(v.value.status).toBe("OPEN");
  });
  it("defect severity mbaya → batili", () => {
    expect(validateDefect({ ...defect, severity: "huge" }).ok).toBe(false);
  });
  const co = {
    id: "CO-001", defectIds: ["D-001"], attempt: 2, priority: 1,
    location: { files: ["src/Header.tsx"], route: "/", selector: "header" },
    current: "hivi sasa", desired: "hivi punde", visionNote: "umboo",
    acceptance: [ { type: "dom_exists", route: "/", selector: "header .logo" } ],
    mode: "concrete", diagnosis: "NOT_ATTEMPTED",
  };
  it("CO halali", () => {
    const v = validateChangeOrder(co);
    expect(v.ok).toBe(true); if (v.ok) expect(v.value.mode).toBe("concrete");
  });
  it("CO bila acceptance → batili", () => {
    expect(validateChangeOrder({ ...co, acceptance: [] }).ok).toBe(false);
  });
  it("CO bila defectIds → batili (kosa lisilo na CO halikubaliki, kinyume chake pia)", () => {
    expect(validateChangeOrder({ ...co, defectIds: [] }).ok).toBe(false);
  });
  it("CO mode mbaya → batili", () => {
    expect(validateChangeOrder({ ...co, mode: "ninja" }).ok).toBe(false);
  });
  it("receipt halali + status zote", () => {
    for (const status of ["DONE", "PARTIAL", "BLOCKED", "CANNOT"]) {
      expect(validateReceipt({ orderId: "CO-001", status, filesChanged: [], commandsRun: [] }).ok).toBe(true);
    }
    expect(validateReceipt({ orderId: "CO-001", status: "MAYBE", filesChanged: [] }).ok).toBe(false);
  });
});

describe("P1·milestones · AnalystOutput / EvidencePack", () => {
  it("analyst: defects nazo zinathibitishwa, suggestions zinazopitishwa", () => {
    const v = validateAnalystOutput({
      reviewer: "designer", findings: "refu sana…",
      defects: [ { id: "D-009", milestoneId: "M1", severity: "minor", title: "k", expected: "e", actual: "a" } ],
      suggestions: [ { title: "Badilisha paleti", detail: "…" } ],
    });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.value.suggestions.length).toBe(1);
  });
  it("evidencePack ghafi hugawanywa salama", () => {
    const v = validateEvidencePack({ milestoneId: "M1", round: 0 });
    expect(v.ok).toBe(true);
    if (v.ok) { expect(v.value.consoleErrors).toEqual([]); expect(v.value.gitDiffSummary.filesChanged).toBe(0); }
  });
});
