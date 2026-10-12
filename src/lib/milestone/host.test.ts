// P2 (host): ramani inaingizwa/puliziwa; events; resume; plan mode inaruka.
import { describe, expect, it, beforeEach } from "vitest";
import { ensureMilestonesMap, emitMapEvents, milestonesEnabledFor, rosterForAgenda, type MsHooks } from "./host";
import { writeMilestonesState } from "./state";
import type { BoardEvent } from "@/lib/types";

function fakeHooks() {
  const calls = { bcast: [] as BoardEvent[], chips: [] as string[], blogs: [] as string[], persists: [] as string[] };
  const hooks: MsHooks = {
    bcast: (e) => calls.bcast.push(e),
    blog: (_t, m) => calls.blogs.push(m),
    addChip: (t) => calls.chips.push(t),
    persist: async () => {},
  };
  return { hooks, calls };
}

const jsonOf = (obj: unknown) => "```json\n" + JSON.stringify(obj) + "\n```";

const goodMap = (n: number) => ({
  milestones: [
    { id: "M1", title: "Msingi", agendas: { from: 1, to: Math.ceil(n / 2) }, phase: "f", reviewMode: "visual", roster: ["pm", "designer", "frontend"], rationale: "r" },
    { id: "M2", title: "Mbali", agendas: { from: Math.ceil(n / 2) + 1, to: n }, phase: "f", reviewMode: "mixed", roster: ["pm", "designer", "frontend", "backend"], rationale: "r" },
  ],
});

describe("P2 · host.ensureMilestonesMap", () => {
  beforeEach(() => { process.env.XMD_MILESTONES = undefined as any; });

  it("plan mode → skipped (haiwavuti plan sessions)", async () => {
    const { hooks } = fakeHooks();
    const r = await ensureMilestonesMap({ sessionId: "s", project: "p", agenda: [{ index: 1, item: "x" }], items: [], computerPlanned: false }, hooks);
    expect(r.run).toBeNull();
    expect(r.skipped).toMatch(/plan mode/);
  });

  it("code mode (fresh) → ramani inazalishwa; events + chip zinafika", async () => {
    const items: any[] = [];
    const { hooks, calls } = fakeHooks();
    const r = await ensureMilestonesMap({
      sessionId: "s", project: "p", agenda: Array.from({ length: 10 }, (_, i) => ({ index: i + 1, item: `x${i}` })),
      items, computerPlanned: true,
      callLLM: async () => jsonOf(goodMap(10)),
    }, hooks);
    expect(r.fresh).toBe(true);
    expect(r.run?.map.milestones.length).toBe(2);
    expect(calls.bcast.filter((e) => e.type === "milestone").length).toBe(2);
    expect(calls.chips.some((c) => c.includes("Ramani ya milestones (2)"))).toBe(true);
    // chip imeandikwa kwenye items
    const chips = items.filter((x) => x.kind === "chip" && String(x.text).startsWith("__professor_xmd_milestones__v1__"));
    expect(chips.length).toBe(1);
    // roster helpers
    expect(rosterForAgenda(r.run!, 3)).toEqual(["pm", "designer", "frontend"]);
    expect(rosterForAgenda(r.run!, 9)).toContain("backend");
  });

  it("resume: ramani ipo chipini → haitazalishi upya; events taarifa zinafika (replay)", async () => {
    const items: any[] = [];
    const { hooks: h1, calls: c1 } = fakeHooks();
    const r1 = await ensureMilestonesMap({
      sessionId: "s", project: "p", agenda: Array.from({ length: 6 }, (_, i) => ({ index: i + 1, item: `x` })),
      items, computerPlanned: true,
      callLLM: async () => jsonOf(goodMap(6)),
    }, h1);
    writeMilestonesState(items, r1.run!);
    c1.bcast.length = 0;
    // "server mpya" (items zilezile = session iko hipo)
    let llmCalled = 0;
    const { hooks: h2, calls: c2 } = fakeHooks();
    const r2 = await ensureMilestonesMap({
      sessionId: "s", project: "p", agenda: Array.from({ length: 6 }, (_, i) => ({ index: i + 1, item: `x` })),
      items, computerPlanned: true,
      callLLM: async () => { llmCalled++; return ""; },
    }, h2);
    expect(llmCalled).toBe(0);
    expect(r2.fresh).toBe(false);
    expect(r2.run?.map.milestones.length).toBe(2);
    expect(c2.bcast.filter((e) => e.type === "milestone").length).toBe(2);
    expect(c2.chips.some((c) => c.includes("imepuliziwa"))).toBe(true);
  });

  it("agenda zimebadilika idadi (N tofauti) → ramani mpya", async () => {
    const items: any[] = [];
    const { hooks } = fakeHooks();
    await ensureMilestonesMap({ sessionId: "s", project: "p", agenda: [{ index: 1, item: "a" }], items, computerPlanned: true, callLLM: async () => jsonOf({ milestones: [{ id: "M1", title: "x", agendas: { from: 1, to: 1 }, phase: "f", reviewMode: "visual", roster: ["pm"], rationale: "r" }] }) }, hooks);
    const r2 = await ensureMilestonesMap({ sessionId: "s", project: "p", agenda: Array.from({ length: 3 }, (_, i) => ({ index: i + 1, item: "a" })), items, computerPlanned: true, callLLM: async (_s: string, _u: string) => jsonOf(goodMap(3)) } as any, hooks);
    expect(r2.fresh).toBe(true);
    expect(r2.run?.map.totalAgendas).toBe(3);
  });

  it("env OFF → hakuna chochote", async () => {
    process.env.XMD_MILESTONES = "off";
    expect(milestonesEnabledFor(true)).toBe(false);
    const { hooks, calls } = fakeHooks();
    const r = await ensureMilestonesMap({ sessionId: "s", project: "p", agenda: [{ index: 1, item: "x" }], items: [], computerPlanned: true }, hooks);
    expect(r.run).toBeNull();
    expect(calls.bcast.length).toBe(0);
    delete process.env.XMD_MILESTONES;
  });

  it("emitMapEvents: status za states zinapeperushwa (HAIJA-signoff → DISCUSSING)", () => {
    const { hooks, calls } = fakeHooks();
    const run: any = {
      currentMilestoneId: "M1",
      map: { milestones: [{ id: "M1", title: "X", agendas: { from: 1, to: 2 }, phase: "f", reviewMode: "visual", roster: ["pm"], rationale: "r" }] },
      states: { M1: { status: "FIXING", round: 3, maxRounds: 10 } },
    };
    emitMapEvents(run, hooks);
    expect(calls.bcast[0]).toEqual({ type: "milestone", milestone: { id: "M1", title: "X", status: "FIXING", round: 3, maxRounds: 10, mode: "visual", active: true } });
  });
});
