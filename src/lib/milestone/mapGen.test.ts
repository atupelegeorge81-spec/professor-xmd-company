// P2 acceptance: ramani halali kwa N=10/15/20; ramani batili 6 tofauti zinakataliwa;
// LLM ikishindwa mara 3 → fallback inafanya kazi.
import { describe, expect, it } from "vitest";
import { extendMilestoneMap, generateMilestoneMap, mapPrompt } from "./mapGen";
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

import type { MilestoneMap, MilestonesRunState } from "./types";
import { fallbackMilestoneMap } from "./schemas";

function mkMap(n: number): MilestoneMap {
  // ramani ya fallback (code-made) — ainaile ya "mid-run" ya haraka
  return fallbackMilestoneMap(n, "sess-c5", "visual");
}

function statesFor(ids: string[], statusOf: (id: string) => string): Pick<MilestonesRunState, "states"> {
  const states: Record<string, any> = {};
  for (const id of ids) states[id] = { id, status: statusOf(id), round: 0, maxRounds: 10, currentStepId: `${id}.D.1`, startedAt: "", updatedAt: "", lanesUsed: [] };
  return { states: states as MilestonesRunState["states"] };
}

describe("C5 · extendMilestoneMap (4.2.7)", () => {
  it("zilizosainiwa HAZIGUSWI; zilizobaki hukatishwa upya kufunika agenda mpya", () => {
    const old = mkMap(10); // M1(1–3) M2(4–6) M3(7–9) M4(10)
    // fallback: n=10 → k=3, per=4 → M1(1-4) M2(5-8) M3(9-10)
    const run = statesFor(old.milestones.map((m) => m.id), (id) => (id === "M1" ? "SIGNED_OFF" : "VERIFYING"));
    const r = extendMilestoneMap(old, run, 14);
    expect(r).not.toBeNull();
    const { map } = r!;
    // M1 imesalimika nako
    const m1 = map.milestones.find((m) => m.id === "M1")!;
    expect(m1.agendas).toEqual({ from: 1, to: 4 });
    // mpangilio unafunika mpaka 14 bila pengo
    let cur = 1;
    for (const m of map.milestones) { expect(m.agendas.from).toBe(cur); cur = m.agendas.to + 1; }
    expect(cur).toBe(15);
    // ids mpya hazigongani na za kale
    const ids = map.milestones.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(map.totalAgendas).toBe(14);
    // zilizoondolewa ni zile zisizosainiwa
    expect(r!.removed.sort()).toEqual(["M2", "M3"]);
    expect(r!.added.length).toBeGreaterThan(0);
  });

  it("hakuna signed → ramani mpya nzima hufunika 1..N mpya", () => {
    const old = mkMap(8);
    const run = statesFor(old.milestones.map((m) => m.id), () => "BUILDING");
    const r = extendMilestoneMap(old, run, 12);
    expect(r).not.toBeNull();
    expect(r!.map.milestones[0].agendas.from).toBe(1);
    expect(r!.map.milestones.at(-1)!.agendas.to).toBe(12);
  });

  it("newTotal <= oldMap.totalAgendas → null (hakuna cha kufanya)", () => {
    const old = mkMap(10);
    const run = statesFor(old.milestones.map((m) => m.id), () => "VERIFYING");
    expect(extendMilestoneMap(old, run, 10)).toBeNull();
    expect(extendMilestoneMap(old, run, 7)).toBeNull();
  });

  it("muunganiko halali kupitia validateMilestoneMap (startFrom > newTotal → null)", () => {
    const old = mkMap(2); // M1(1-2)
    const run = statesFor(["M1"], () => "SIGNED_OFF");
    // total mpya 3, lakini signed inafikia 2 tu → kpana? startFrom=3 <= 3 → inapaswa iandike M2(3-3)
    const r = extendMilestoneMap(old, run, 3);
    expect(r).not.toBeNull();
    expect(r!.map.milestones.at(-1)!.agendas).toEqual({ from: 3, to: 3 });
  });
});

describe("mapPrompt · uhuru wa kuchagua idadi (amri ya mmiliki)", () => {
  it("prompt inasema wazi HAKUNA kikomo — Optimus anachagua idadi mwenyewe", () => {
    const p = mapPrompt({ project: "X", agenda: agendaOf(7), defaultMode: "visual" });
    expect(p.system).toMatch(/IDADI YA MILESTONES: unachagua WEWE MWENYEWE/);
    expect(p.system).toMatch(/HAKUNA kikomo/);
    // hakuna msomi wa kufuatia (mf. "lazima iwe 3" au "ceil") katika prompt
    expect(p.system).toMatch(/2, 3, 4 au zaidi/);
  });
  it("validateMilestoneMap hairusu overlap/pengo lakini HAIPANGI idadi — 2 au 7 zinakubalika", () => {
    const m2 = goodMapFor(7);
    const v2 = validateMilestoneMap(m2 as object, 7, "sess");
    expect(v2.ok).toBe(true);
    // 7 milestones moja-moja (1 agenda kila moja) — zinapaswa kupita
    const m7 = { milestones: Array.from({ length: 7 }, (_, i) => ({ id: `M${i + 1}`, title: `t${i + 1}`, agendas: { from: i + 1, to: i + 1 }, phase: "p", reviewMode: "visual", roster: ["optimus"], rationale: "r" })) };
    const v7 = validateMilestoneMap(m7 as object, 7, "sess");
    expect(v7.ok).toBe(true);
  });
});
