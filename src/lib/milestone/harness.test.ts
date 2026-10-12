// P4 — harness ya ushahidi: acceptance (14.P4) — kwa fixture ndogo ya HTML:
// kila aina ya kipimo ina PASS + FAIL case; overflow 375px inagunduliwa; contrast ndogo inagunduliwa.
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { analyzeDom, domMetricsScript, consoleHookScript, type DomMetricsJson } from "./harness/domScript";
import { contrastPasses, parseColor, contrastRatio } from "./harness/contrast";
import { pixelDiffPct, decodePng, isPng, type PngImage } from "./harness/baselines";
import { runAcceptanceCheck, runAcceptanceChecks, type HarnessIO, type RunCheckContext } from "./harness/checkRunners";
import { manifestToEvidence, regressionAgainst } from "./harness/collect";
import type { AcceptanceCheck } from "./types";

/* ---------- fixture helpers ---------- */

function pxPng(width: number, height: number, r: number, g: number, b: number): Uint8Array {
  // tengeneza PNG halisi (1 color) kwa kuchekesha ZIP + PNG structure inline
  const stride = width * 4;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter 0
    for (let x = 0; x < width; x++) {
      const i = y * (stride + 1) + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255;
    }
  }
  const idat = deflateSync(raw);
  function chunk(type: string, data: Uint8Array): Uint8Array {
    const t = new TextEncoder().encode(type);
    const len = data.length;
    const out = new Uint8Array(12 + len);
    out[0] = (len >>> 24) & 255; out[1] = (len >>> 16) & 255; out[2] = (len >>> 8) & 255; out[3] = len & 255;
    out.set(t, 4); out.set(data, 8);
    // CRC32 ya type+data
    let crc = 0xffffffff;
    const td = new Uint8Array(4 + len); td.set(t); td.set(data, 4);
    for (const byte of td) {
      crc ^= byte;
      for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    crc = ~crc >>> 0;
    const co = 8 + len;
    out[co] = (crc >>> 24) & 255; out[co + 1] = (crc >>> 16) & 255; out[co + 2] = (crc >>> 8) & 255; out[co + 3] = crc & 255;
    return out;
  }
  const ihdr = new Uint8Array(13);
  ihdr[0] = (width >>> 24) & 255; ihdr[1] = (width >>> 16) & 255; ihdr[2] = (width >>> 8) & 255; ihdr[3] = width & 255;
  ihdr[4] = (height >>> 24) & 255; ihdr[5] = (height >>> 16) & 255; ihdr[6] = (height >>> 8) & 255; ihdr[7] = height & 255;
  ihdr[8] = 8; ihdr[9] = 6; // bitDepth 8, colorType 6 (RGBA)
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function domJson(over: Partial<DomMetricsJson> = {}): DomMetricsJson {
  return {
    viewport: { w: 375, h: 667 },
    page: { scrollWidth: 375, scrollHeight: 800 },
    console: { errors: [], warnings: [] },
    failedRequests: [],
    fontsLoaded: ["Inter"],
    elements: [
      { sel: "header", tag: "header", text: "Kahawa House", box: { x: 0, y: 0, w: 375, h: 64 },
        style: { fontFamily: "Inter", fontSize: "16px", fontWeight: "600", letterSpacing: "0px", textTransform: "none", color: "#000000", background: "#ffffff" },
        contrast: 21, interactive: false, smallTouch: false },
      { sel: "a.order", tag: "a", text: "Oda", box: { x: 20, y: 70, w: 80, h: 48 },
        style: { fontFamily: "Inter", fontSize: "16px", fontWeight: "500", letterSpacing: "0px", textTransform: "none", color: "#333333", background: "rgba(0,0,0,0)" },
        contrast: 12.6, interactive: true, smallTouch: false },
    ],
    imagesNoAlt: [],
    ...over,
  };
}

function ioMock(over: Partial<HarnessIO> = {}): HarnessIO {
  return {
    runCmd: async () => ({ code: 0, stdout: "0", stderr: "" }),
    fileRead: async () => null,
    domFor: async () => null,
    http: async () => ({ status: 200, body: "" }),
    ...over,
  };
}

function ctxMock(over: Partial<RunCheckContext> = {}): RunCheckContext {
  return {
    milestoneId: "M1", round: 0,
    screenshots: [{ id: "S-001", route: "/", viewport: "375", state: "default" }],
    io: ioMock(),
    ...over,
  };
}

/* ============ contrast ============ */

describe("P4·contrast (WCAG)", () => {
  it("black/white = 21:1 (PASS contrast_min 4.5)", () => {
    const p = contrastPasses("#000000", "#ffffff", 4.5);
    expect(p.pass).toBe(true);
    expect(p.ratio).toBe(21);
  });
  it("contrast ndogo (#888/#fff ≈ 3.54) inagundulika (FAIL)", () => {
    const p = contrastPasses("#888888", "#ffffff", 4.5);
    expect(p.pass).toBe(false);
    expect(p.ratio).toBeLessThan(4.5);
  });
  it("parseColor rgba() + composite", () => {
    const c = parseColor("rgba(0, 0, 0, 0.5)")!;
    expect(c.a).toBe(0.5);
    const r = contrastRatio({ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 });
    expect(r).toBeCloseTo(21, 1);
  });
});

/* ============ analyzeDom ============ */

describe("P4·analyzeDom (vipimo vya DOM — 8.2.2)", () => {
  it("overflow ya 375px (scrollWidth 1200 > innerWidth 375) inagunduliwa", () => {
    const a = analyzeDom(domJson({ page: { scrollWidth: 1200, scrollHeight: 800 } }));
    expect(a.horizontalOverflow).toBe(true);
    expect(a.overflowAmount).toBe(825);
  });
  it("no overflow 375 fit", () => {
    const a = analyzeDom(domJson());
    expect(a.horizontalOverflow).toBe(false);
  });
  it("touch target 30px inaonywa", () => {
    const d = domJson();
    d.elements[1].box = { x: 0, y: 0, w: 30, h: 30 };
    const a = analyzeDom(d);
    expect(a.smallTouchTargets.length).toBe(1);
    expect(a.smallTouchTargets[0].value).toBe(30);
  });
  it("contrast ndogo inaorodheshwa", () => {
    const d = domJson();
    d.elements[0].contrast = 2.1;
    const a = analyzeDom(d);
    expect(a.lowContrast.length).toBe(1);
    expect(a.lowContrast[0].selector).toBe("header");
  });
  it("DOM script ni string halali inayoweza kufanyiwa evaluate (ina .xmd DOM fields)", () => {
    expect(domMetricsScript()).toContain("__msConsoleErrors");
    expect(consoleHookScript()).toContain("window.fetch");
  });
});

/* ============ pixel-diff / baselines ============ */

describe("P4·baselines (pixel-diff %)", () => {
  it("PNG fixture ina-decode (isPng → dims sahihi)", () => {
    const buf = pxPng(10, 10, 255, 0, 0);
    expect(isPng(buf)).toBe(true);
    const img = decodePng(buf);
    expect(img.width).toBe(10);
    expect(img.height).toBe(10);
    expect(img.rgba[0]).toBe(255);
  });
  it("identical PNG → 0% change", () => {
    const a = pxPng(10, 10, 0, 0, 255);
    expect(pixelDiffPct(a, a)).toBe(0);
  });
  it("rangi tofauti kabisa → 100% change", () => {
    const a = pxPng(10, 10, 0, 0, 0);
    const b = pxPng(10, 10, 255, 255, 255);
    expect(pixelDiffPct(a, b)).toBe(100);
  });
  it("1% ya pixels → 1% diff", () => {
    const a = pxPng(10, 10, 0, 0, 0);
    const b = pxPng(10, 10, 0, 0, 0);
    const img = decodePng(b);
    img.rgba[0] = 255; // pixel 1 ya kwanza
    img.rgba[1] = 255;
    img.rgba[2] = 255;
    const pct = pixelDiffPct(a, img);
    expect(pct).toBeCloseTo(1, 0.5);
  });
  it("size change inahesabiwa change", () => {
    const a = pxPng(10, 10, 0, 0, 0);
    const b = pxPng(12, 10, 0, 0, 0);
    const pct = pixelDiffPct(a, b);
    expect(pct).toBeGreaterThan(0);
  });
});

/* ============ checkRunners — kila aina: PASS + FAIL ============ */

describe("P4·checkRunners — 12 aina za vipimo (8.3)", () => {
  const ck = (t: AcceptanceCheck["type"], extra: Partial<AcceptanceCheck> = {}): AcceptanceCheck => ({ id: "C-001", type: t, ...extra });

  it("command: PASS exit 0; FAIL exit ≠", async () => {
    const p = await runAcceptanceCheck(ck("command", { cmd: "npm run build", exitCode: 0 }), ctxMock({ io: ioMock({ runCmd: async () => ({ code: 0, stdout: "", stderr: "" }) }) }));
    expect(p.result).toBe("PASS");
    const f = await runAcceptanceCheck(ck("command", { cmd: "false", exitCode: 0 }), ctxMock({ io: ioMock({ runCmd: async () => ({ code: 1, stdout: "", stderr: "boom" }) }) }));
    expect(f.result).toBe("FAIL");
    expect(f.detail).toContain("boom");
  });

  it("grep: PASS count 0 (marufuku); FAIL count ≠ 0", async () => {
    const p = await runAcceptanceCheck(ck("grep", { pattern: "uppercase", paths: ["src/"], count: 0 }), ctxMock({ io: ioMock({ runCmd: async () => ({ code: 0, stdout: "0", stderr: "" }) }) }));
    expect(p.result).toBe("PASS");
    const f = await runAcceptanceCheck(ck("grep", { pattern: "uppercase", count: 0 }), ctxMock({ io: ioMock({ runCmd: async () => ({ code: 0, stdout: "4", stderr: "" }) }) }));
    expect(f.result).toBe("FAIL");
  });

  it("dom_exists: PASS selector ipo; FAIL haipo", async () => {
    const p = await runAcceptanceCheck(ck("dom_exists", { route: "/", selector: "header" }), ctxMock({ io: ioMock({ domFor: async () => domJson() }) }));
    expect(p.result).toBe("PASS");
    const f = await runAcceptanceCheck(ck("dom_exists", { route: "/", selector: ".nope" }), ctxMock({ io: ioMock({ domFor: async () => domJson() }) }));
    expect(f.result).toBe("FAIL");
    expect(f.detail).toContain(".nope");
  });

  it("computed_style: PASS expected; FAIL expected≠; FAIL forbidden", async () => {
    const p = await runAcceptanceCheck(ck("computed_style", { route: "/", selector: "a.order", property: "textTransform", expected: "none" }), ctxMock({ io: ioMock({ domFor: async () => domJson() }) }));
    expect(p.result).toBe("PASS");
    const f = await runAcceptanceCheck(ck("computed_style", { route: "/", selector: "a.order", property: "textTransform", expected: "uppercase" }), ctxMock({ io: ioMock({ domFor: async () => domJson() }) }));
    expect(f.result).toBe("FAIL");
    const f2 = await runAcceptanceCheck(ck("computed_style", { route: "/", selector: "a.order", property: "textTransform", forbidden: ["none", "inherit"] }), ctxMock({ io: ioMock({ domFor: async () => domJson() }) }));
    expect(f2.result).toBe("FAIL");
  });

  it("no_horizontal_overflow: FAIL @375 scrollWidth 1200; PASS fit", async () => {
    const bad = await runAcceptanceCheck(ck("no_horizontal_overflow", { routes: ["/"], viewports: ["375"] }), ctxMock({ io: ioMock({ domFor: async () => domJson({ page: { scrollWidth: 1200, scrollHeight: 800 } }) }) }));
    expect(bad.result).toBe("FAIL");
    expect(bad.detail).toContain("overflow");
    const ok = await runAcceptanceCheck(ck("no_horizontal_overflow", { routes: ["/"] }), ctxMock({ io: ioMock({ domFor: async () => domJson() }) }));
    expect(ok.result).toBe("PASS");
  });

  it("console_clean: FAIL errors zimo; PASS safi", async () => {
    const f = await runAcceptanceCheck(ck("console_clean", { route: "/" }), ctxMock({ io: ioMock({ domFor: async () => domJson({ console: { errors: ["TypeError x"], warnings: [] } }) }) }));
    expect(f.result).toBe("FAIL");
    const p = await runAcceptanceCheck(ck("console_clean", { route: "/" }), ctxMock({ io: ioMock({ domFor: async () => domJson() }) }));
    expect(p.result).toBe("PASS");
  });

  it("contrast_min: FAIL low contrast; PASS high", async () => {
    const f = await runAcceptanceCheck(ck("contrast_min", { route: "/", selector: "a.order", min: 4.5 }), ctxMock({
      io: ioMock({
        domFor: async () => {
          const d = domJson();
          d.elements[1].contrast = 3.1; // low
          return d;
        },
      }),
    }));
    expect(f.result).toBe("FAIL");
    const p = await runAcceptanceCheck(ck("contrast_min", { route: "/", selector: "a.order", min: 4.5 }), ctxMock({ io: ioMock({ domFor: async () => domJson() }) }));
    expect(p.result).toBe("PASS");
  });

  it("touch_target_min: FAIL <44px; PASS ≥44px", async () => {
    const f = await runAcceptanceCheck(ck("touch_target_min", { route: "/", px: 44 }), ctxMock({
      io: ioMock({
        domFor: async () => {
          const d = domJson();
          d.elements[1].box = { x: 0, y: 0, w: 20, h: 20 };
          return d;
        },
      }),
    }));
    expect(f.result).toBe("FAIL");
    const p2 = await runAcceptanceCheck(ck("touch_target_min", { route: "/", px: 44 }), ctxMock({ io: ioMock({ domFor: async () => domJson() }) }));
    expect(p2.result).toBe("PASS");
  });

  it("http: PASS status+body; FAIL status≠", async () => {
    const p = await runAcceptanceCheck(ck("http", { method: "GET", url: "/api/menu", status: 200, bodyContains: "espresso" }), ctxMock({ io: ioMock({ http: async () => ({ status: 200, body: "[espresso,latte]" }) }) }));
    expect(p.result).toBe("PASS");
    const f = await runAcceptanceCheck(ck("http", { url: "/api/x", status: 200 }), ctxMock({ io: ioMock({ http: async () => ({ status: 500, body: "" }) }) }));
    expect(f.result).toBe("FAIL");
  });

  it("file_exists / file_contains / screenshot_taken", async () => {
    const p1 = await runAcceptanceCheck(ck("file_exists", { path: "src/app/page.tsx" }), ctxMock({ io: ioMock({ fileRead: async () => "export default" }) }));
    expect(p1.result).toBe("PASS");
    const f1 = await runAcceptanceCheck(ck("file_exists", { path: "missing.ts" }), ctxMock({ io: ioMock({ fileRead: async (_p: string) => null }) }));
    expect(f1.result).toBe("FAIL");
    const p2 = await runAcceptanceCheck(ck("file_contains", { path: "x.txt", text: "karibu" }), ctxMock({ io: ioMock({ fileRead: async () => "habari karibu tena" }) }));
    expect(p2.result).toBe("PASS");
    const f2 = await runAcceptanceCheck(ck("file_contains", { path: "x.txt", text: "hakuna" }), ctxMock({ io: ioMock({ fileRead: async () => "habari karibu" }) }));
    expect(f2.result).toBe("FAIL");
    const p3 = await runAcceptanceCheck(ck("screenshot_taken", { route: "/", state: "default" }), ctxMock());
    expect(p3.result).toBe("PASS");
    const f3 = await runAcceptanceCheck(ck("screenshot_taken", { route: "/admin", state: "default" }), ctxMock());
    expect(f3.result).toBe("FAIL");
  });
});

/* ============ EvidencePack helpers ============ */

describe("P4·collect helpers", () => {
  it("manifestToEvidence inapanga structure ya EvidencePack", async () => {
    const ms = { id: "M1", title: "Msingi", agendas: { from: 1, to: 3 }, phase: "f", reviewMode: "visual" as const, roster: ["pm"], rationale: "r" };
    const checks = await runAcceptanceChecks([{ id: "C-1", type: "dom_exists", route: "/", selector: "header" }], ctxMock({ io: ioMock({ domFor: async () => domJson() }) }));
    const ev = manifestToEvidence(ms, 2, { shots: [{ id: "S-001", route: "/", viewport: "375", state: "default", path: ".xmd/evidence/M1/R2/S-001.png" }], domMetrics: [{ screenshotId: "S-001", path: ".xmd/evidence/M1/R2/S-001.dom.json" }], consoleErrors: [] }, checks, [{ cmd: "git", exit: 0 }], { filesChanged: 2, insertions: 10, deletions: 3 }, []);
    expect(ev.milestoneId).toBe("M1");
    expect(ev.round).toBe(2);
    expect(ev.checks.length).toBe(1);
    expect(ev.checks[0].result).toBe("PASS");
    expect(ev.gitDiffSummary.filesChanged).toBe(2);
  });
  it("regressionAgainst: >2% inaorodheshwa", () => {
    const a = pxPng(10, 10, 0, 0, 0);
    const b = pxPng(10, 10, 255, 255, 255);
    const out = regressionAgainst({ "/@375": b }, { "/@375": a }, 2);
    expect(out.length).toBe(1);
    expect(out[0].route).toBe("/");
    expect(out[0].changedPct).toBeGreaterThan(2);
  });
});
