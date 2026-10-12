// src/lib/cu/engine.terminal.test.ts — P0 kosa #1: hali za mwisho zilizo wazi (maelezo.md 12.1, 15#1).
// stuck + report = MAFANIKIO (kosa lililopo). Baada ya fix: stuck haupaswi kuwa mafanikio hata wakati
// report ipo. Hali za mwisho: COMPLETED_VERIFIED | PARTIAL | STUCK | BLOCKED | PAUSED_QUOTA | ERROR.
import { describe, expect, it } from "vitest";
import type { Runner } from "@/lib/boardRunner";
import { handleCuEvent, ensureCuState, type CuHooks } from "./engine";
import type { SessionItem } from "@/lib/reports";
import type { BoardEvent } from "@/lib/types";

function fakeRunner(items: SessionItem[] = []): Runner {
  return {
    id: "rt1", project: "Mfumo wa Duka", status: "running", items, buffer: [], subs: new Set(),
    startedAt: Date.now(), mode: "code", computerPlanned: true, finale: { planId: "plan1", reportId: "rep1", memory: true },
  } as unknown as Runner;
}

function fakeHooks() {
  const calls: { broadcasts: BoardEvent[]; persists: string[] } = { broadcasts: [], persists: [] };
  const hooks: CuHooks = {
    persist: async (st?: string) => { calls.persists.push(String(st)); },
    bcast: (e) => calls.broadcasts.push(e),
    blog: () => {},
    addChip: () => {},
    recordUsage: () => {},
    usage: {},
    byProvider: {},
    title: "Mfumo wa Duka",
  };
  return { hooks, calls };
}

// status za run_end kutoka kwenye swap-brain / oh_bridge: done | partial | stuck | error | paused_quota | blocked | report
describe("P0 · Terminal states za Computer (kosa #1)", () => {
  it("run_end 'done' + report → done=true na terminal 'COMPLETED_VERIFIED'", () => {
    const runner = fakeRunner();
    ensureCuState(runner);
    const { hooks } = fakeHooks();
    handleCuEvent(runner, hooks, { i: 1, type: "finish", report: "Kazi imekamilika." });
    handleCuEvent(runner, hooks, { i: 2, type: "run_end", status: "done", steps: 4, ms: 1000 });
    const cu = runner.cu!;
    expect(cu.done).toBe(true);
    expect(cu.terminal).toBe("COMPLETED_VERIFIED");
  });

  it("run_end 'stuck' hata report ikifika kwanza → HAIKAMILIKI (done=false, terminal STUCK)", () => {
    const runner = fakeRunner();
    ensureCuState(runner);
    const { hooks } = fakeHooks();
    handleCuEvent(runner, hooks, { i: 1, type: "finish", report: "Nilijenga sehemu tu." });
    handleCuEvent(runner, hooks, { i: 2, type: "run_end", status: "stuck", steps: 2, ms: 500 });
    const cu = runner.cu!;
    expect(cu?.done).toBeFalsy();
    expect(cu?.terminal).toBe("STUCK");
  });

  it("run_end 'error' → terminal ERROR (si mafanikio)", () => {
    const runner = fakeRunner();
    ensureCuState(runner);
    const { hooks } = fakeHooks();
    handleCuEvent(runner, hooks, { i: 1, type: "run_end", status: "error", fatal: "crash" });
    const cu = runner.cu!;
    expect(cu?.done).toBeFalsy();
    expect(cu?.terminal).toBe("ERROR");
  });

  it("run_end 'partial' → terminal PARTIAL: si mafanikio, lakini si kuanguka kubwa", () => {
    const runner = fakeRunner();
    ensureCuState(runner);
    const { hooks } = fakeHooks();
    handleCuEvent(runner, hooks, { i: 1, type: "run_end", status: "partial", steps: 3, ms: 700 });
    const cu = runner.cu!;
    expect(cu?.done).toBeFalsy();
    expect(cu?.terminal).toBe("PARTIAL");
  });

  it("run_end 'paused_quota' → terminal PAUSED_QUOTA unabaki kama siku hizi (resume inategemea)", () => {
    const runner = fakeRunner();
    ensureCuState(runner);
    const { hooks } = fakeHooks();
    handleCuEvent(runner, hooks, { i: 1, type: "run_end", status: "paused_quota", resume_at: Date.now() + 60_000, steps: 5, ms: 900 });
    const cu = runner.cu!;
    expect(cu?.done).toBeFalsy();
    expect(cu?.terminal).toBe("PAUSED_QUOTA");
  });

  it("run_end 'blocked' → terminal BLOCKED", () => {
    const runner = fakeRunner();
    ensureCuState(runner);
    const { hooks } = fakeHooks();
    handleCuEvent(runner, hooks, { i: 1, type: "run_end", status: "blocked", fatal: "Hakuna ruhusa ya kutekeleza mpango" });
    const cu = runner.cu!;
    expect(cu?.done).toBeFalsy();
    expect(cu?.terminal).toBe("BLOCKED");
  });
});
