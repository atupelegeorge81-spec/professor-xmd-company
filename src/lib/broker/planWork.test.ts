// src/lib/broker/planWork.test.ts — R49 · MPANGO KAZI (agizo la Mkuu 11-10):
// Sehemu inayoandika Mpango Kazi wa Agent inatumia XKiro qwen (akaunti ZOTE 2 = keys za Optimus) kwanza;
// XKiro isipokuwa na nafasi → UnoRouter/OpenRouter (nemotron-3-ultra-550b · space-bunny-alpha).
// Gemini HAIORODHESHWI (ni haraka lakini haifanyi reasoning ya kutosha kwa mpango — inakosea); Groq pia haipo.
import { describe, expect, it, beforeAll } from "vitest";

beforeAll(() => {
  // keys za test (fingerprint pekee — hakuna request halisi inayotumwa kwenye test hizi)
  process.env.XTROUTER_API_KEY_OPTIMUS_1 = process.env.XTROUTER_API_KEY_OPTIMUS_1 || "test-xkiro-key-1";
  process.env.XTROUTER_API_KEY_OPTIMUS_2 = process.env.XTROUTER_API_KEY_OPTIMUS_2 || "test-xkiro-key-2";
  process.env.OPENROUTER_API_KEY_1 = process.env.OPENROUTER_API_KEY_1 || "test-openrouter-key-1";
  process.env.UNOROUTER_API_KEY_1 = process.env.UNOROUTER_API_KEY_1 || "test-unorouter-key-1";
  process.env.GROQ_API_KEY_OPTIMUS_1 = process.env.GROQ_API_KEY_OPTIMUS_1 || "test-groq-key-1";
  process.env.GEMINI_API_KEY_1 = process.env.GEMINI_API_KEY_1 || "test-gemini-key-1";
  process.env.GEMINI_API_KEY_2 = process.env.GEMINI_API_KEY_2 || "test-gemini-key-2";
  process.env.GEMINI_API_KEY_3 = process.env.GEMINI_API_KEY_3 || "test-gemini-key-3";
  process.env.GEMINI_API_KEY_4 = process.env.GEMINI_API_KEY_4 || "test-gemini-key-4";
});

describe("R49 · uzito wa Mpango Kazi (planWeightOf)", () => {
  it("XKiro/Uno/OpenRouter pekee wana uzito — Gemini na Groq ni sifuri", async () => {
    const { planWeightOf, PLAN_PROVIDERS } = await import("@/lib/broker/policy");
    const { allLanes } = await import("@/lib/broker/lanes");
    expect(PLAN_PROVIDERS).toEqual(["xkiro", "unorouter", "openrouter"]);
    const lanes = allLanes();
    const providers = new Set(lanes.map((l) => l.provider));
    for (const p of ["xkiro", "unorouter", "openrouter"] as const) expect(providers.has(p)).toBe(true); // lanes zipo (keys za test)
    for (const l of lanes) {
      if (PLAN_PROVIDERS.includes(l.provider)) expect(planWeightOf(l), `lane ${l.id}`).toBeGreaterThan(0);
      else expect(planWeightOf(l), `lane ${l.id}`).toBe(0);
    }
    // mpangilio: XKiro kwanza (akaunti 1·2), kisha Uno, kisha OpenRouter
    const xk = lanes.find((l) => l.provider === "xkiro")!;
    const un = lanes.find((l) => l.provider === "unorouter")!;
    const or = lanes.find((l) => l.provider === "openrouter")!;
    expect(planWeightOf(xk)).toBeGreaterThan(planWeightOf(un));
    expect(planWeightOf(un)).toBeGreaterThan(planWeightOf(or));
  });

  it("laneWeight(plan) inafunga Gemini na Groq — hata kwa darasa la kawaida", async () => {
    const { laneWeight } = await import("@/lib/broker/policy");
    const { allLanes } = await import("@/lib/broker/lanes");
    const lanes = allLanes();
    const gem = lanes.find((l) => l.provider === "gemini" && l.tier === "lite");
    const groq = lanes.find((l) => l.provider === "groq");
    expect(gem, "lane ya Gemini-Lite ipo").toBeTruthy();
    expect(groq, "lane ya Groq ipo").toBeTruthy();
    expect(laneWeight("normal", gem!, false, false)).toBeGreaterThan(0); // kawaida: Gemini inaruhusiwa
    expect(laneWeight("normal", gem!, false, true)).toBe(0); // mpango: HAIARUHUSIWI
    expect(laneWeight("normal", groq!, false, true)).toBe(0); // mpango: Groq pia haipo
  });
});

describe("R49 · brokerRun(planWork=true) — broker hatachagui Gemini/Groq kwenye mpango", () => {
  it("lease ya kwanza ni XKiro; leases zote zinatoka XKiro/Uno/OpenRouter pekee", async () => {
    const { brokerRun } = await import("@/lib/broker");
    const { PLAN_PROVIDERS } = await import("@/lib/broker/policy");
    const run = brokerRun({
      agentId: "r49-plan-test",
      purpose: "work-plan",
      maxOut: 800,
      messages: [{ role: "user", content: "Write PART 1 of the AGENT WORK PLAN." }],
      planWork: true,
      waitMs: 3000,
    });
    const first = await run.next();
    expect(first.lane.provider, "XKiro (akaunti 1·2) inajaribiwa kwanza").toBe("xkiro");
    first.done({ total_tokens: 100 });
    for (let i = 0; i < 3; i++) {
      const lease = await run.next();
      expect(PLAN_PROVIDERS, `provider ${lease.lane.provider} si ya mpango`).toContain(lease.lane.provider);
      expect(lease.lane.provider).not.toBe("gemini");
      expect(lease.lane.provider).not.toBe("groq");
      lease.done({ total_tokens: 100 });
    }
  });
});
