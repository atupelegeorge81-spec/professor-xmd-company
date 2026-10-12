// src/lib/cu/engine.planGuard.test.ts — P0 kosa #3: guard_failed / status kusomwa (maelezo.md 15#3).
// planMarkdown haipaswi kurudisha mpango aliyofeli Data Guard kama unaotekelezeka;
// startComputerPhase haipaswi kuanza.
import { describe, expect, it, vi } from "vitest";
import type { Runner } from "@/lib/boardRunner";
import type { SessionItem } from "@/lib/reports";

vi.mock("@/lib/server/plans", () => {
  const docs: Record<string, any> = {};
  return {
    getPlanBySession: vi.fn(async () => docs.session),
    __setDocs: (d: Record<string, any>) => { Object.assign(docs, d); },
  };
});
vi.mock("@/lib/server/appwrite", () => ({ appwriteConfigured: false, databases: {}, DB: "", PROJECT_PLANS_COL: "x", SCREENSHOTS_BUCKET: "sb" }));

import { planMarkdown } from "./engine";
// @ts-expect-error helper ya mock
import { __setDocs } from "@/lib/server/plans";

function fakeRunner(items: SessionItem[] = []): Runner {
  return {
    id: "rp1", project: "Duka la Temeke", status: "running", items, buffer: [], subs: new Set(),
    startedAt: Date.now(), mode: "code", computerPlanned: true,
    finale: { planId: undefined, reportId: "rep", memory: true }, sessionId: "sess1",
  } as unknown as Runner;
}

describe("P0 · planMarkdown lazima iheshimu status ya guard (kosa #3)", () => {
  it("status=active → mpango unarudi (kama zamani)", async () => {
    __setDocs({ session: { title: "T", plan_content: "# Mpango\n1. Hatua", object_extension: undefined, total_steps: 1, objective: "O", status: "active" } });
    const out = await planMarkdown(fakeRunner());
    expect(out).not.toBeNull();
    expect(out!.blocked).toBeFalsy();
    expect(out!.md).toContain("Mpango");
  });

  it("status=guard_failed → blocked=true (HAIKUPASWI kutekelezwa)", async () => {
    __setDocs({ session: { title: "T", plan_content: "# Mpango", object_extension: undefined, total_steps: 1, objective: "O", status: "guard_failed" } });
    const out = await planMarkdown(fakeRunner());
    expect(out).not.toBeNull();
    expect(out!.blocked).toBe(true);
    expect(String(out!.blockReason || "")).toContain("guard");
  });

  it("status=guard_failed + steps katikati → bado blocked (hata plan_content iko)", async () => {
    __setDocs({ session: { title: "T", plan_content: "# Mpango mrefu na hatua nyingi", object_extension: undefined, total_steps: 12, objective: "O", status: "guard_failed" } });
    const out = await planMarkdown(fakeRunner());
    expect(out!.blocked).toBe(true);
  });
});
