// P2 acceptance: ramani halali kwa N=10/15/20; ramani batili 6 tofauti zinakataliwa;
// LLM ikishindwa mara 3 → fallback inafanya kazi.
import { describe, expect, it } from "vitest";
import { generateMilestoneMap, mapPrompt } from "./mapGen";
import { validateMilestoneMap } from "./schemas";

const agendaOf = (n: number) => Array.from({ length: n }, (_, i) => ({ index: i + 1, item: `Kipengele ${i + 1}` }));

const jsonOf = (obj: unknown) => "```json\n" + JSON.stringify(obj) + "\n```";

function goodMapFor(n: number): object {
  // gawanya n kwa sehemu 4-4-4…(ceiling)
  const k = Math.ceil(n / 4);
  const per = Math.ceil(n / k);
  const ms = [] as any[];
  for (let i = 0; i < k; i++) {
    ms.push({
      id: `M${i + 1}`, title: `Awamu ${i + 1}`,
      agendas: { from: i * per + 1, to: Math.min(n, (i + 1) * per) },
      phase: i === 0 ? "foundation" : `p${i}`,
      reviewMode: i % 3 === 1 ? "technical" : "visual",
      roster: ["optimus", "ultron", "vextron"],
      rationale: "sababu",
    });
  }
  return { milestones: ms };
}

describe("P2 · generateMilestoneMap", () => {
  it.each([[10], [15], [20]])("N=%i → ramani halali ya jaribio la kwanza", async (n) => {
    let calls = 0;
    const r = await generateMilestoneMap({
      callLLM: async () => { calls++; return jsonOf(goodMapFor(n)); },
      agenda: agendaOf(n), sessionId: "s", project: "p",
    });
    expect(r.usedFallback).toBe(false);
    expect(r.attempts).toBe(1);
    expect(calls).toBe(1);
    expect(validateMilestoneMap(r.map, n, "s").ok).toBe(true);
    expect(r.map.milestones[0].roster).toEqual(["pm", "designer", "frontend"]);
  });

  it("ramani batili → makosa yanarudishwa kwa LLM; jaribio 2 likitenganisha → inakubaliwa", async () => {
    const seen: string[] = [];
    let n = 0;
    const r = await generateMilestoneMap({
      callLLM: async (_s, u) => {
        n++; seen.push(u);
        if (n === 1) {
          // batili: pengo la agenda 5
          return jsonOf({ milestones: [
            { id: "M1", title: "a", agendas: { from: 1, to: 4 }, phase: "f", reviewMode: "visual", roster: ["pm"], rationale: "r" },
            { id: "M2", title: "b", agendas: { from: 6, to: 10 }, phase: "f", reviewMode: "visual", roster: ["pm"], rationale: "r" },
          ] });
        }
        return jsonOf(goodMapFor(10));
      },
      agenda: agendaOf(10), sessionId: "s", project: "p",
    });
    expect(n).toBe(2);
    expect(r.usedFallback).toBe(false);
    expect(seen[1]).toMatch(/pengo/); // makosa yamewasilishwa
    expect(seen[1]).toMatch(/UKOSAPI WA JARIBIO LILILOPITA/);
  });

  const badMaps: { name: string; obj: object; rx: RegExp }[] = [
    { name: "pengo", obj: { milestones: [ { id: "M1", title: "a", agendas: { from: 1, to: 4 }, phase: "f", reviewMode: "visual", roster: ["pm"], rationale: "r" }, { id: "M2", title: "b", agendas: { from: 6, to: 10 }, phase: "f", reviewMode: "visual", roster: ["pm"], rationale: "r" } ] }, rx: /pengo/ },
    { name: "overlap", obj: { milestones: [ { id: "M1", title: "a", agendas: { from: 1, to: 5 }, phase: "f", reviewMode: "visual", roster: ["pm"], rationale: "r" }, { id: "M2", title: "b", agendas: { from: 5, to: 10 }, phase: "f", reviewMode: "visual", roster: ["pm"], rationale: "r" } ] }, rx: /overlap/ },
    { name: "hazijafunikwa", obj: { milestones: [ { id: "M1", title: "a", agendas: { from: 1, to: 4 }, phase: "f", reviewMode: "visual", roster: ["pm"], rationale: "r" } ] }, rx: /hazijafunikwa/ },
    { name: "zaidi ya N", obj: { milestones: [ { id: "M1", title: "a", agendas: { from: 1, to: 11 }, phase: "f", reviewMode: "visual", roster: ["pm"], rationale: "r" } ] }, rx: /inazidi/ },
    { name: "reviewMode mbaya", obj: { milestones: [ { id: "M1", title: "a", agendas: { from: 1, to: 10 }, phase: "f", reviewMode: "pretty", roster: ["pm"], rationale: "r" } ] }, rx: /reviewMode/ },
    { name: "agent asiyejulikana", obj: { milestones: [ { id: "M1", title: "a", agendas: { from: 1, to: 10 }, phase: "f", reviewMode: "visual", roster: ["optimus", "nonezio"], rationale: "r" } ] }, rx: /nonezio/ },
  ];
  it.each(badMaps.map((b) => [b.name, b] as const))("batili #%s inakataliwa na kusema sababu", async (_n, b) => {
    const r = await generateMilestoneMap({
      callLLM: async () => jsonOf(b.obj),
      agenda: agendaOf(10), sessionId: "s", project: "p",
    });
    expect(r.usedFallback).toBe(true); // zote 3 zimeshindwa → fallback
    expect(r.lastErrors.join(" | ")).toMatch(b.rx);
    expect(validateMilestoneMap(r.map, 10, "s").ok).toBe(true); // fallback yenyewe ni halali
  });

  it("LLM ikishindwa kuitwa kabisa (marufuku) ×3 → fallback usedFallback=true", async () => {
    const r = await generateMilestoneMap({
      callLLM: async () => { throw new Error("AllLanesDead"); },
      agenda: agendaOf(7), sessionId: "s", project: "p",
    });
    expect(r.usedFallback).toBe(true);
    expect(r.map.usedFallback).toBe(true);
    expect(r.map.milestones.length).toBe(2); // ceil(7/4)=2
    expect(r.map.milestones[0].agendas).toEqual({ from: 1, to: 4 });
    expect(r.map.milestones[1].agendas).toEqual({ from: 5, to: 7 });
  });

  it("jibu lisilo na JSON kabisa → fallback baada ya 3", async () => {
    let n = 0;
    const r = await generateMilestoneMap({
      callLLM: async () => { n++; return "samahani, sijui kugawa agenda hizi"; },
      agenda: agendaOf(5), sessionId: "s", project: "p",
    });
    expect(n).toBe(3);
    expect(r.usedFallback).toBe(true);
    expect(r.lastErrors.join()).toMatch(/JSON/);
  });

  it("mapPrompt (system) inazifunza sheria zote muhimu za 4.2", () => {
    const { system, user } = mapPrompt({ project: "p", agenda: agendaOf(3), defaultMode: "visual" });
    expect(system).toMatch(/ramani/i);
    expect(system).toMatch(/1\.\.N/);
    expect(system).toContain("reviewMode");
    expect(user).toContain("1. Kipengele 1");
  });
});
