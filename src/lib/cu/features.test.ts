// features.test.ts — R50-Awamu 1: mpango → feature_list.json (default-FAIL, checks zinazopimika).
import { describe, expect, it } from "vitest";
import { featuresFromPlan, featureListJson, featureListSummary } from "./features";

const PLAN_FULL = `# MPANGO KAZI — Kilimo Smart

## 2. Official Data
- Business name: Kilimo Smart
- Address: Kariakoo, Dar es Salaam

## 6. Work Steps

### Step 1 — Create the data files from Official Data
- **Goal:** data files for the site
- **Official Data (verbatim):** Business name: Kilimo Smart
- **Verification:** \`npm run build\` exits 0 and src/data.ts contains the business name

### Step 2 — Build the homepage
- **Goal:** homepage
- **Verification:** Homepage shows the business name and every nav link opens a real page

### Step 3 — Final QA & Verification
- **Verification:** \`npm test\` passes and the homepage renders without console errors

## 7. QA Checklist
- [ ] The full test suite passes: \`npm test\`
- [ ] Every page returns HTTP 200 (\`curl -I http://localhost:5173\`)
- [ ] No page shows default browser fonts (Times New Roman)
`;

const PLAN_BILA_STEP_QA = `## 6. Work Steps

### Step 1 — Create the data files
- **Verification:** \`npm run build\` exits 0

### Step 2 — Build the homepage
- **Verification:** Homepage shows the business name

## 7. QA Checklist
- [ ] Suite nzima inapita: \`npm test\`
- [ ] Kila page inarudi 200: \`curl -I http://localhost:5173\`
- [ ] Hakuna fonts za default
`;

describe("featuresFromPlan — msingi", () => {
  const fl = featuresFromPlan(PLAN_FULL, { runId: "r1", planId: "p1", now: "2026-10-11T00:00:00Z" });

  it("hatua zote zinaonekana (step-01…) na ZOTE zinaanza pending (default-FAIL)", () => {
    expect(fl.schema_version).toBe(1);
    expect(fl.run_id).toBe("r1");
    expect(fl.features.map((f) => f.id)).toEqual(["step-01", "step-02", "step-03"]);
    for (const f of fl.features) {
      expect(f.state).toBe("pending");
      expect(f.attempts).toBe(0);
      expect(f.evidence).toEqual([]);
      expect(f.required).toBe(true);
      for (const c of f.checks) {
        expect(c.state).toBe("not_run");
        expect(c.exit_code).toBeNull();
      }
    }
  });

  it("Verification yenye backtick-command salama → check ya `command`", () => {
    const c = fl.features[0].checks[0];
    expect(c.kind).toBe("command");
    expect(c.command).toBe("npm run build");
  });

  it("Verification ya maandishi (bila command) → check ya `assertion`", () => {
    const c = fl.features[1].checks[0];
    expect(c.kind).toBe("assertion");
    expect(c.expect).toContain("Homepage shows the business name");
  });

  it("step ya mwisho yenye jina la QA inakuwa qa:true — HAKUNA qa-final ya ziada", () => {
    expect(fl.features[2].qa).toBe(true);
    expect(fl.features.filter((f) => f.id === "qa-final")).toHaveLength(0);
  });

  it("backticked filename SI command (haiwi check ya command)", () => {
    const f = featuresFromPlan(`### Step 1 — Data\n- **Verification:** \`src/data.ts\` must exist with the name`);
    expect(f.features[0].checks[0].kind).toBe("assertion");
  });
});

describe("featuresFromPlan — §7 QA Checklist inakuwa qa-final", () => {
  const fl = featuresFromPlan(PLAN_BILA_STEP_QA);

  it("bila step ya QA, qa-final inaongezwa kutoka bullets za §7", () => {
    expect(fl.features.map((f) => f.id)).toEqual(["step-01", "step-02", "qa-final"]);
    const qa = fl.features[2];
    expect(qa.qa).toBe(true);
    expect(qa.checks).toHaveLength(3);
  });

  it("bullet yenye command → command; bullet ya maandishi → assertion", () => {
    const [c1, c2, c3] = fl.features[2].checks;
    expect(c1.kind).toBe("command");
    expect(c1.command).toBe("npm test");
    expect(c2.kind).toBe("command");
    expect(c2.command).toContain("curl -I http://localhost:5173");
    expect(c3.kind).toBe("assertion");
    expect(c3.expect).toContain("fonts");
  });
});

describe("featuresFromPlan — mipaka", () => {
  it("plan isiyo na steps → features tupu", () => {
    expect(featuresFromPlan("hakuna kitu hapa").features).toEqual([]);
  });

  it("step bila **Verification:** → check ya kukataa (haiwezi kupita)", () => {
    const fl = featuresFromPlan("### Step 1 — Kitu\n- **Goal:** x");
    expect(fl.features[0].checks[0].kind).toBe("assertion");
    expect(fl.features[0].checks[0].expect).toContain("PLAN INVALID");
    expect(fl.features[0].checks[0].required).toBe(true);
  });

  it("JSON: schema + hali zote zinaanza 'pending'/'not_run' (default-FAIL)", () => {
    const json = featureListJson(featuresFromPlan(PLAN_FULL, { now: "2026-10-11T00:00:00Z" }));
    const parsed = JSON.parse(json);
    expect(parsed.schema_version).toBe(1);
    expect(json).toContain('"state": "pending"');
    expect(json).not.toContain('"state": "passed"');
  });

  it("featureListSummary ni fupi na inaonyesha hali", () => {
    const s = featureListSummary(featuresFromPlan(PLAN_BILA_STEP_QA));
    expect(s).toContain("step-01 pending");
    expect(s).toContain("qa-final pending");
  });
});
