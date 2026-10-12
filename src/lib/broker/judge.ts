// src/lib/broker/judge.ts — P8 (maelezo.md 10.2–10.4): darasa JIPYA la lane "judge".
// Mlolongo: Gemini Flash (models zote za Flash × keys, thinking imewashwa) → XKiro →
// Gemini Flash-lite. Madarasa mengine HAYABADILIKI: hapa tuna tumia brokerClient pekee
// (acquire zinapita policy ileile); tofauti ni MPANGILIO halisi wa majaribio + rekodi.
//
// 10.3(b): SIGN-OFF ya visual/mixed HAITAFANYWA kwa lane isiyoona — inarudisha wait
// badala. Mmiliki: muda si tatizo; kusubiri ni salama kuliko kupitisha kwa kipofu.
import { brokerClient, isBrokerExhausted } from "./broker";
import type { AcquireSpec, Lane } from "./broker";

export type JudgeTier = "gemini-flash" | "xkiro" | "gemini-flash-lite";

/** Uwezo wa vision kwa kila ngazi — 10.3: Gemini Flash ina vision (kwa openai-compat
 *  image_url). XKiro na Flash-lite: HAZIJATHIBITISHWA → tunahesabu kama HAZINA (salama). */
export const VISION_TIERS: Record<JudgeTier, boolean> = {
  "gemini-flash": true,
  "xkiro": false,
  "gemini-flash-lite": false,
};

export interface JudgeLaneRec {
  call: string; // "M1.R2.designer.verify" (10.4)
  lane: string; // "gemini-flash" | "xkiro" | "gemini-flash-lite" (tier label; model halisi: usage kwa broker)
  tier: JudgeTier;
  visionCapable: boolean;
  fallback: boolean; // si ngazi ya kwanza iliyotumika
}

export interface JudgeClient {
  create: (body: any, opts?: { signal?: AbortSignal }) => Promise<any>;
  rec: JudgeLaneRec;
}

export interface JudgeSpec {
  agentId: string;
  call: string;
  priority?: AcquireSpec["priority"];
  signal?: AbortSignal;
  onWait?: AcquireSpec["onWait"];
  /** kweli → zingatia lane zenye vision pekee; zikikombamara → subiri (SIGN-OFF visual/mixed, 10.3.b) */
  requireVision?: boolean;
  waitMs?: { flash?: number; xkiro?: number; lite?: number };
  /** tests: kina client bandia kwa kila tier */
  clientFactory?: (tier: JudgeTier, ts: AcquireSpec) => { create: (body: any, opts?: { signal?: AbortSignal }) => Promise<any> };
}

function tierSpec(t: JudgeTier, base: JudgeSpec): AcquireSpec {
  const wait = base.waitMs || {};
  const common = {
    agentId: base.agentId,
    purpose: base.call,
    priority: base.priority || ("live" as const),
    maxOut: 2000,
    signal: base.signal,
    onWait: base.onWait,
  };
  if (t === "gemini-flash") {
    return {
      ...common, cls: "heavy", allow: ["gemini"],
      laneFilter: (l: Lane) => l.provider === "gemini" && l.tier === "flash",
      waitMs: wait.flash ?? 120_000, // Flash imesika: subiri kidumu (mmiliki: muda si tatizo)
      effort: "high", // 10.2: thinking imewashwa kwa models zenye thinking
    };
  }
  if (t === "xkiro") {
    return { ...common, cls: "normal", allow: ["xkiro"], waitMs: wait.xkiro ?? 60_000 };
  }
  return {
    ...common, cls: "normal", allow: ["gemini"],
    laneFilter: (l: Lane) => l.provider === "gemini" && l.tier === "lite",
    waitMs: wait.lite ?? 60_000,
  };
}

/** Client ya tier moja (haimjaribu kupiga call — fake ya nafasi yake inafanywa na kupiga create). */
export function judgeClientFor(tier: JudgeTier, spec: JudgeSpec, fallback: boolean, log?: (msg: string) => void): JudgeClient {
  const ts = tierSpec(tier, spec);
  const create = spec.clientFactory
    ? spec.clientFactory(tier, ts).create
    : (body: any, opts?: { signal?: AbortSignal }) => brokerClient(ts, undefined).chat.completions.create(body, opts) as Promise<any>;
  return {
    create: async (body: any, opts?: { signal?: AbortSignal }) => {
      log?.(`judge› ${spec.call} → ${tier}${fallback ? " (fallback)" : ""}`);
      return create(body, opts);
    },
    rec: { call: spec.call, lane: tier, tier, visionCapable: VISION_TIERS[tier], fallback },
  };
}

export type JudgeChatResult =
  | { ok: true; text: string; rec: JudgeLaneRec; usage?: { total?: number; prompt?: number; completion?: number }; visionDegraded?: boolean }
  | { ok: false; wait: { until: number | null; reason: string } }
  | { ok: false; error: string };

const JSON_LIKE_MSG_PREFIX = /^\s*[{[]/;

/**
 * Piga call ya maandishi kupitia mlolongo: flash → xkiro → lite (au flash pekee kwa requireVision).
 * Judging visionDegraded: call yenye picha ikigonga tier isiyoona → visionDegraded=true (maelezo
 * ya picha/data za DOM zinaweza kupelekwa badala) — 10.3(a). requireVision: badala ya fallback isiyoona,
 * inarudisha wait (10.3.b).
 */
export async function judgeChat(spec: JudgeSpec & { messages: Array<Record<string, unknown>>; maxTokens?: number; effort?: "low" | "medium" | "high" }): Promise<JudgeChatResult> {
  const tiers: JudgeTier[] = spec.requireVision ? ["gemini-flash"] : ["gemini-flash", "xkiro", "gemini-flash-lite"];
  let triedAny = false;
  let lastErr = "";
  const hasImages = spec.messages.some((m) => Array.isArray(m.content) && (m.content as any[]).some((p) => p?.type === "image_url" || p?.type === "image"));
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const jc = judgeClientFor(tier, spec, triedAny);
    // 10.3(a): lane isiyoona + picha → tuma image digest badala (caller ameisha tandika)
    // Hapa: ikiwa picha zipo lakini tier haina vision na SI requireVision, tunaendelea (caller anajua visionDegraded)
    const body: any = {
      messages: spec.messages,
      max_tokens: spec.maxTokens ?? 4096,
    };
    if (tier === "gemini-flash") body.effort = spec.effort || "high"; // thinking-on (10.2)
    try {
      const r = await jc.create(body, { signal: spec.signal });
      const text = String(r?.choices?.[0]?.message?.content || "");
      if (!text.trim() && JSON_LIKE_MSG_PREFIX.test(String(spec.messages.at(-1)?.content || ""))) {
        lastErr = "jibu tupu la lane"; triedAny = true; continue;
      }
      return {
        ok: true, text, rec: jc.rec, usage: r?.usage,
        visionDegraded: hasImages && !jc.rec.visionCapable || undefined,
      };
    } catch (e) {
      lastErr = `${tier}: ${String((e as Error)?.message || e).slice(0, 160)}`;
      triedAny = true;
      if (spec.requireVision) {
        if (isBrokerExhausted(e)) {
          return { ok: false, wait: { until: (e as any).nextReadyAt ?? null, reason: "hakuna lane yenye vision ya sign-off sasa hivi — tunasubiri (10.3.b)" } };
        }
        return { ok: false, wait: { until: null, reason: `kosa la lane yenye vision (${lastErr}) — tunasubiri tujaribu tena` } };
      }
      continue; // ngazi inayofuata
    }
  }
  return { ok: false, error: `mlolongo wa hukumu umeisha (flash→xkiro→lite). Mwishoni: ${lastErr}` };
}

/** Uzalishaji wa digest ya picha kwa lanes zisizoona (10.3.a): caller inachambua kwanza\n *  kwa lane yenye vision, kisha hii huweka maelezo yake kwenye call zinazofuata. */
export function stripImagesForText(messages: Array<Record<string, unknown>>, digestText: string): Array<Record<string, unknown>> {
  return messages.map((m) => {
    if (!Array.isArray(m.content)) return m;
    const parts = (m.content as any[]).filter((p) => p?.type !== "image_url" && p?.type !== "image");
    if (digestText) parts.push({ type: "text", text: `[MAELEZO YA PICHA (lane ya Flash iliyochambua — hukumu ipo tayari)]\n${digestText}` });
    return { ...m, content: parts };
  });
}
