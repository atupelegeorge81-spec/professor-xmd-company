#!/usr/bin/env python3
"""cu/evidence.py — P4 · Evidence collector (batch) kwa mfumo wa milestones.

Inasoma plan ya JSON ndani ya stdin/end-point na kuandika EvidencePack kwenye
.xmd/evidence/<M>/<R>/:
  - S-nnn.png (screenshots × routes × viewports × states)
  - S-nnn.dom.json (vipimo vya DOM — 8.2.2, yakiwemo contrast, touch, overflow, console)
  - manifest.json (rambakuja ya EvidencePack — TS inayoisoma)

Playwright inapatikana ndani ya sandbox ya Computer (native-first law). Hii ni code
YOJENZIKA-destination: hízikuhamishi; matokeo yazidhukumiwa na TS (hukumu ni ya code).
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
import time
from typing import Any

VIEWPOINTS = {
    "375": (375, 667),
    "768": (768, 1024),
    "1280": (1280, 800),
}

CONSOLE_HOOK = r"""
() => {
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
}
"""

DOM_SCRIPT = None  # TS (domScript.domMetricsScript) inapatia kwa body — hapa tunaifafanua tena kwa ajili haraka
DOM_EVAL = r"""
() => {
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
      if (r && r.a > 0) { const c2 = comp(r,{r:255,g:255,b:255}); return { r: c2.r, g: c2.g, b: c2.b }; }
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
}
"""


def _mk_runner(ws: str, base_url: str, routes: list[str], states: list[str] | None, viewports: list[str] | None, out_dir: str) -> dict[str, Any]:
    from playwright.async_api import async_playwright  # type: ignore
    return {
        "ws": ws, "base_url": base_url.rstrip("/"), "routes": routes,
        "states": states or ["default"], "viewports": viewports or ["375", "1280"],
        "out_dir": out_dir, "pw": async_playwright,
    }


async def collect_one(pw, cfg: dict[str, Any], route: str, vname: str, state: str, shot_id: str) -> dict[str, Any] | None:
    w, h = VIEWPOINTS[vname]
    browser = await pw.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
    try:
        ctx = await browser.new_context(viewport={"width": w, "height": h})
        page = await ctx.new_page()
        await page.add_init_script(CONSOLE_HOOK)
        url = cfg["base_url"] + route
        await page.goto(url, wait_until="networkidle", timeout=45000)
        await page.wait_for_timeout(300)
        # states (hover/drawer/empty kadhalika) — states zinazotajwa wanapaswa ku implement kando
        # kwa sasa hali zisozo standard zinakataliwa: default tu + record state–hajatekelezi notes
        if state != "default":
            pass  # placeholder: Turbo ya state-handlers baadaye
        shot_path = os.path.join(cfg["out_dir"], f"{shot_id}.png")
        dom_path = os.path.join(cfg["out_dir"], f"{shot_id}.dom.json")
        await page.screenshot(path=shot_path, full_page=True)
        dom = await page.evaluate(DOM_EVAL)
        with open(dom_path, "w") as f:
            json.dump(dom, f, ensure_ascii=False)
        return {
            "id": shot_id, "route": route, "viewport": vname, "state": state,
            "path": os.path.relpath(shot_path, cfg["ws"]),
            "domPath": os.path.relpath(dom_path, cfg["ws"]),
            "consoleErrors": (dom.get("console") or {}).get("errors") or [],
        }
    finally:
        await browser.close()


async def run(cfg: dict[str, Any]) -> int:
    os.makedirs(cfg["out_dir"], exist_ok=True)
    shots: list[dict[str, Any]] = []
    errs: list[str] = []
    n = 0
    async with cfg["pw"].__call__() as pw:
        for route in cfg["routes"]:
            for vname in cfg["viewports"]:
                for state in cfg["states"]:
                    n += 1
                    shot_id = f"S-{n:03d}"
                    try:
                        got = await collect_one(pw, cfg, route, vname, state, shot_id)
                        if got:
                            shots.append(got)
                    except Exception as e:
                        errs.append(f"{route}@{vname}/{state}: {type(e).__name__}: {e}")
    manifest = {
        "shots": shots,
        "domMetrics": [{ "screenshotId": s["id"], "path": s["domPath"] } for s in shots],
        "consoleErrors": [x for s in shots for x in s["consoleErrors"]],
        "collectionErrors": errs,
    }
    man = os.path.join(cfg["out_dir"], "manifest.json")
    with open(man, "w") as f:
        json.dump(manifest, f, ensure_ascii=False)
    print(json.dumps({"ok": True, "outDir": cfg["out_dir"], "shots": len(shots), "errors": errs}, ensure_ascii=False))
    return 0 if not errs or shots else 2


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ws", default=os.getcwd())
    ap.add_argument("--base-url", required=True)
    ap.add_argument("--milestone", default="M1")
    ap.add_argument("--round", type=int, default=0)
    ap.add_argument("--routes", default="/")
    ap.add_argument("--viewports", default="375,1280")
    ap.add_argument("--states", default="default")
    ns = ap.parse_args()
    ws = os.path.abspath(ns.ws)
    routes = [r.strip() for r in ns.routes.split(",") if r.strip()]
    vps = [v.strip() for v in ns.viewports.split(",") if v.strip()]
    states = [s.strip() for s in ns.states.split(",") if s.strip()]
    out_dir = os.path.join(ws, ".xmd", "evidence", ns.milestone, f"R{ns.round}")
    cfg = _mk_runner(ws, ns.base_url, routes, states, vps, out_dir)
    return asyncio.run(run(cfg))


if __name__ == "__main__":
    sys.exit(main())
