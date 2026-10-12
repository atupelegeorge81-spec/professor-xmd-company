// src/lib/milestone/harness/domScript.ts — script inayotekelezwa ndani ya ukurasa (page.evaluate)
// ili kuchukua vipimo vya DOM (8.2.2) + chambuzi pure ya matokeo (JSON). Vipimo ni vya code.

/* ============ script ya sandbox (hutolewa kama string — page.evaluate) ============ */

const SCRIPT_BODY = String.raw`
(() => {
  const out = { viewport: { w: window.innerWidth, h: window.innerHeight },
    page: { scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight },
    console: { errors: window.__msConsoleErrors || [], warnings: window.__msConsoleWarnings || [] },
    failedRequests: window.__msFailedRequests || [], fontsLoaded: [], elements: [], imagesNoAlt: [] };

  try { out.fontsLoaded = Array.from(document.fonts || []).map((f) => String((f && f.family) || f)).slice(0, 40); } catch (e) {}

  const KEY = ["header","nav","main","footer","[role=banner]","[role=navigation]","[role=main]","[role=contentinfo]","h1","h2","h3","form","button","a","img","input","select","textarea","[data-testid]","article","section"];
  const seen = new Set();
  function rgb2(str) { const m = String(str||"").match(/rgba?\(([^)]*)\)/); if (!m) return null; const p = m[1].split(",").map((x) => parseFloat(x)); return { r:p[0]||0, g:p[1]||0, b:p[2]||0, a:(p[3]===undefined?1:p[3]) }; }
  function L(c) { const f = (v) => { const x = v/255; return x<=0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055, 2.4); }; return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); }
  function comp(fg, bg) { if (!fg) return {r:0,g:0,b:0}; if (fg.a >= 1) return {r:fg.r,g:fg.g,b:fg.b}; const k = 1-fg.a; return { r:fg.a*fg.r+k*bg.r, g:fg.a*fg.g+k*bg.g, b:fg.a*fg.b+k*bg.b }; }
  function effBg(el) {
    let n = el;
    while (n) {
      const c = getComputedStyle(n).backgroundColor;
      const r = rgb2(c);
      if (r && r.a > 0) return { r: comp(r,{r:255,g:255,b:255}).r, g: comp(r,{r:255,g:255,b:255}).g, b: comp(r,{r:255,g:255,b:255}).b };
      n = n.parentElement;
    }
    return { r:255,g:255,b:255 };
  }
  function cr(f, b) { const l1 = L(f), l2 = L(b); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); }
  function path(el) {
    const seg = [];
    while (el && el.nodeType === 1 && seg.length < 5) {
      let s = el.tagName.toLowerCase();
      if (el.id) { s += "#" + el.id; seg.unshift(s); break; }
      if (el.className && typeof el.className === "string" && el.className.trim()) s += "." + el.className.trim().split(/\s+/).slice(0,2).join(".");
      const parent = el.parentElement;
      if (parent) { const kids = Array.from(parent.children).filter((k) => k.tagName === el.tagName); if (kids.length > 1) s += ":nth(" + (kids.indexOf(el)+1) + ")"; }
      seg.unshift(s); el = parent;
    }
    return seg.join(" > ");
  }

  const nodes = Array.from(document.querySelectorAll(KEY.join(",")));
  for (let i = 0; i < nodes.length && out.elements.length < 220; i++) {
    const el = nodes[i];
    const r = el.getBoundingClientRect();
    if (!r || (r.width === 0 && r.height === 0)) continue;
    const sel = path(el);
    if (seen.has(sel + "|" + Math.round(r.x) + "|" + Math.round(r.y)) && out.elements.length < 60) continue;
    seen.add(sel + "|" + Math.round(r.x) + "|" + Math.round(r.y));
    const cs = getComputedStyle(el);
    const text = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("value") || "").trim().slice(0, 60);
    const bg = effBg(el);
    const fgC = rgb2(cs.color);
    const fg = fgC ? comp(fgC, bg) : null;
    const ratio = fg ? Math.round(cr(fg, bg)*100)/100 : null;
    const interactive = /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.getAttribute("role") === "button" || el.onclick;
    out.elements.push({
      sel, tag: el.tagName.toLowerCase(), text,
      box: { x: Math.round(r.x*10)/10, y: Math.round(r.y*10)/10, w: Math.round(r.width*10)/10, h: Math.round(r.height*10)/10 },
      style: { fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, letterSpacing: cs.letterSpacing,
        textTransform: cs.textTransform, color: cs.color, background: cs.backgroundColor },
      contrast: ratio, interactive: !!interactive,
      smallTouch: !!interactive && (Math.min(r.width, r.height) < 44),
    });
  }
  out.imagesNoAlt = Array.from(document.querySelectorAll("img")).filter((im) => !(im.getAttribute("alt") || "").trim()).map((im) => (im.getAttribute("src") || "").split("/").pop() || "img").slice(0, 30);
  return out;
})();
`;

/** Script kamili ya kufanya page.evaluate — inajirudishia content (serious, no network). */
export function domMetricsScript(): string {
  return SCRIPT_BODY;
}

/** Hook ya console errors/failed requests — ingiza mwanzoni (addInitScript au context). */
export function consoleHookScript(): string {
  return String.raw`
(() => {
  window.__msConsoleErrors = []; window.__msConsoleWarnings = []; window.__msFailedRequests = [];
  const e = console.error.bind(console); const w = console.warn.bind(console);
  console.error = (...a) => { window.__msConsoleErrors.push(a.map(String).join(" ").slice(0,500)); e(...a); };
  console.warn  = (...a) => { window.__msConsoleWarnings.push(a.map(String).join(" ").slice(0,500)); w(...a); };
  window.addEventListener("error", (ev) => window.__msConsoleErrors.push(String(ev.message || ev.error).slice(0,500)));
  window.addEventListener("unhandledrejection", (ev) => window.__msConsoleErrors.push("unhandledrejection: " + String(ev.reason).slice(0,300)));
  try {
    const f = window.fetch.bind(window);
    window.fetch = async (...a) => { const r = await f(...a); if (!r.ok) window.__msFailedRequests.push(String(a[0] && a[0].url ? a[0].url : a[0]) + " → " + r.status); return r; };
    const o = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, u) { this.addEventListener("loadend", () => { if (this.status >= 400) window.__msFailedRequests.push(String(u) + " → " + this.status); }); return o.call(this, m, u); };
  } catch (e) {}
})();
`;
}

/* ============ matokeo ya script (muundo) ============ */

export interface DomMetricBox { x: number; y: number; w: number; h: number; }
export interface DomElementMetric {
  sel: string; tag: string; text: string;
  box: DomMetricBox;
  style: { fontFamily: string; fontSize: string; fontWeight: string; letterSpacing: string; textTransform: string; color: string; background: string };
  contrast: number | null;
  interactive: boolean;
  smallTouch: boolean;
}
export interface DomMetricsJson {
  viewport: { w: number; h: number };
  page: { scrollWidth: number; scrollHeight: number };
  console: { errors: string[]; warnings: string[] };
  failedRequests: string[];
  fontsLoaded: string[];
  elements: DomElementMetric[];
  imagesNoAlt: string[];
}

/* ============ chambuzi (pure — inapatikana kwa tests) ============ */

export interface DomAnalysisIssue { kind: string; detail: string; severity: "info" | "warn" | "fail"; selector?: string; value?: number; }
export interface DomAnalysis {
  horizontalOverflow: boolean;
  overflowAmount: number;
  lowContrast: DomAnalysisIssue[];
  smallTouchTargets: DomAnalysisIssue[];
  consoleErrors: string[];
  failedRequests: string[];
  imagesNoAlt: string[];
  fontsLoaded: string[];
  minContrast: number | null;
}

/** Pima matokeo ya DOM — kila issue imeeleza (kama pareto ya amri). I/O: hakuna. */
export function analyzeDom(m: DomMetricsJson, opts?: { touchMinPx?: number; contrastMin?: number }): DomAnalysis {
  const touchMin = opts?.touchMinPx ?? 44;
  const contrastMin = opts?.contrastMin ?? 4.5;
  const overflowAmount = Math.max(0, (m.page?.scrollWidth || 0) - (m.viewport?.w || 0));
  const issues: DomAnalysisIssue[] = [];
  let minC: number | null = null;
  for (const e of m.elements || []) {
    if (e.contrast !== null && (e.tag === "p" || e.tag === "a" || e.tag === "button" || e.tag === "h1" || e.tag === "h2" || e.tag === "h3" || e.tag === "label" || (e.text && e.text.length > 0))) {
      if (minC === null || e.contrast < minC) minC = e.contrast;
      if (e.contrast < contrastMin) issues.push({ kind: "low_contrast", detail: `contrast ${e.contrast} < ${contrastMin} ("${e.text.slice(0, 40)}")`, severity: "fail", selector: e.sel, value: e.contrast });
    }
    if (e.interactive && (e.box.w < touchMin || e.box.h < touchMin)) {
      issues.push({ kind: "touch_target", detail: `touch target ${Math.min(e.box.w, e.box.h)}px < ${touchMin}px`, severity: "warn", selector: e.sel, value: Math.min(e.box.w, e.box.h) });
    }
  }
  return {
    horizontalOverflow: overflowAmount > 0,
    overflowAmount,
    lowContrast: issues.filter((i) => i.kind === "low_contrast"),
    smallTouchTargets: issues.filter((i) => i.kind === "touch_target"),
    consoleErrors: [...(m.console?.errors || [])],
    failedRequests: [...(m.failedRequests || [])],
    imagesNoAlt: [...(m.imagesNoAlt || [])],
    fontsLoaded: [...(m.fontsLoaded || [])],
    minContrast: minC,
  };
}
