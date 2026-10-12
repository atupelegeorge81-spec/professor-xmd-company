// P8 acceptance: uteuzi wa lane kwa kila ngazi yenye nafasi/bila nafasi; rekodi ya lane
// kila call; SIGN-OFF haipiti kwa visionDegraded (10.3.b → wait).
import { describe, expect, it } from "vitest";
import { judgeChat, stripImagesForText, VISION_TIERS, type JudgeSpec } from "./judge";
import { BrokerExhaustedError } from "./broker";

const calls: { tier: string; body: any }[] = [];

function fakeFactory(up: Set<string>, replyBy: Record<string, string>) {
  return (tier: string) => ({
    create: async (body: any) => {
      calls.push({ tier, body });
      if (!up.has(tier)) throw new BrokerExhaustedError(null, "normal");
      const text = replyBy[tier] ?? `jibu ${tier}`;
      return { choices: [{ message: { content: text } }], usage: { total: 11, prompt: 6, completion: 5 } };
    },
  }) as any;
}

const msgs = [{ role: "user", content: "kagua" }];
const spec = (over: Partial<JudgeSpec> & { messages?: Array<Record<string, unknown>> } = {}): JudgeSpec & { messages: Array<Record<string, unknown>> } => ({ agentId: "pm", call: "M1.R1.designer.verify", messages: [], ...over } as JudgeSpec & { messages: Array<Record<string, unknown>> });

describe("P8 · judge chain (10.2–10.4)", () => {
  it("flash ipo → flash pekee inatumika; rekodi inasema si-fallback, visionCapable=true", async () => {
    calls.length = 0;
    const r = await judgeChat(spec({ clientFactory: fakeFactory(new Set(["gemini-flash", "xkiro", "gemini-flash-lite"]), {}) as any, messages: msgs }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rec.lane).toBe("gemini-flash");
      expect(r.rec.fallback).toBe(false);
      expect(r.rec.visionCapable).toBe(true);
      expect(r.rec.call).toBe("M1.R1.designer.verify");
      expect(r.usage?.total).toBe(11);
    }
    expect(calls.map((c) => c.tier)).toEqual(["gemini-flash"]); // hakuna kugusa lanes nyingine
  });

  it("flash imeisha → XKiro; rekodi.fallback=true, visionCapable=false", async () => {
    calls.length = 0;
    const r = await judgeChat(spec({ clientFactory: fakeFactory(new Set(["xkiro", "gemini-flash-lite"]), {}) as any, messages: msgs }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rec.lane).toBe("xkiro");
      expect(r.rec.fallback).toBe(true);
      expect(r.rec.visionCapable).toBe(false);
    }
    expect(calls.map((c) => c.tier)).toEqual(["gemini-flash", "xkiro"]);
  });

  it("flash+xkiro zimeisha → flash-lite", async () => {
    calls.length = 0;
    const r = await judgeChat(spec({ clientFactory: fakeFactory(new Set(["gemini-flash-lite"]), {}) as any, messages: msgs }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rec.tier).toBe("gemini-flash-lite");
    expect(calls.map((c) => c.tier)).toEqual(["gemini-flash", "xkiro", "gemini-flash-lite"]);
  });

  it("zote zimeisha → error inayoeleza mlolongo mzima", async () => {
    const r = await judgeChat(spec({ clientFactory: fakeFactory(new Set(), {}) as any, messages: msgs }));
    expect(r.ok).toBe(false);
    if (!r.ok && "error" in r) expect(r.error).toMatch(/flash→xkiro→lite/);
  });

  it("requireVision: flash ikikosa → WAIT (SIGN-OFF haipiti kwa lane isiyoona, 10.3.b)", async () => {
    calls.length = 0;
    const r = await judgeChat(spec({ requireVision: true, call: "M1.K.signoff.designer", clientFactory: fakeFactory(new Set(["xkiro"]), {}) as any, messages: msgs }));
    expect(r.ok).toBe(false);
    if (!r.ok && "wait" in r) expect(r.wait.reason).toMatch(/vision/);
    expect(calls.map((c) => c.tier)).toEqual(["gemini-flash"]); // XKiro haijaguzwa kamwe
  });

  it("requireVision: flash ikifika tena baadaye → inapokelewa", async () => {
    const r = await judgeChat(spec({ requireVision: true, clientFactory: fakeFactory(new Set(["gemini-flash"]), { "gemini-flash": "PASS — nimeikagua picha yote" }) as any, messages: msgs }));
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.rec.visionCapable).toBe(true); expect(r.text).toContain("PASS"); }
  });

  it("picha ikipelekwa lane isiyoona (flash-liteshindwa fallback) → visionDegraded=true", async () => {
    const withImg: any[] = [{ role: "user", content: [{ type: "text", text: "kagua" }, { type: "image_url", image_url: { url: "file:///x.png" } }] }];
    const r = await judgeChat(spec({ clientFactory: fakeFactory(new Set(["gemini-flash-lite"]), {}) as any, messages: withImg }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.visionDegraded).toBe(true);
  });

  it("effort ya high inatumwa kwa gemini-flash pekee (thinking-on), sio lanes nyingine", async () => {
    calls.length = 0;
    await judgeChat(spec({ clientFactory: fakeFactory(new Set(["gemini-flash"]), {}) as any, messages: msgs }));
    expect(calls[0].body.effort).toBe("high");
  });

  it("VISION_TIERS sanifu: pekee gemini-flash ndio ina vision", () => {
    expect(VISION_TIERS).toEqual({ "gemini-flash": true, "xkiro": false, "gemini-flash-lite": false });
  });

  it("stripImagesForText: picha zinaondolewa, digest inaingia", () => {
    const out = stripImagesForText(
      [{ role: "user", content: [{ type: "text", text: "x" }, { type: "image_url", image_url: { url: "u" } }] }],
      "hero ina kichwa kikubwa…");
    const parts = (out[0].content as any[]);
    expect(parts.some((p) => p.type === "image_url")).toBe(false);
    expect(JSON.stringify(parts)).toContain("MAELEZO YA PICHA");
  });
});
