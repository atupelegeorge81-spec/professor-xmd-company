"""cu/xmd_shot.py — R51 · CLI ya SHERIA YA SCREENSHOT (1/page; re-shot = source imebadilika).

Agent anaita hii (amri tupu) — Si jukumu lake kuamua kama shot inaruhusiwa:
registry ya shotlaw ndiyo inaamua. Matokeo:
  • exit 0 + JSON {"ok":true,...}   → shot imechukuliwa na kusajiliwa
  • exit 2 + JSON {"ok":false,"reason":"same-source-dup"} → SHERIA imekataza (ni kawaida,
    si kosa — page haijabadilika)
  • exit 1 → kosa halisi (browser/url)

Content hash = md5(rendered DOM + viewport + final_url) — kama page imebadilika kwa
kweli, hash inabadilika → re-shot inaruhusiwa. Hakuna cap ya jumla (sheria ya CEO).
"""
from __future__ import annotations

import argparse
import glob as _glob
import hashlib
import json
import os
import sys
import time

import shotlaw


def find_chrome() -> str | None:
    for pat in ("/home/user/.cache/ms-playwright/chromium-*/chrome-linux*/chrome",
                "~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome"):
        hits = _glob.glob(os.path.expanduser(pat))
        if hits:
            return sorted(hits)[-1]
    return None


def parse_viewport(s: str) -> tuple[int, int]:
    try:
        w, h = str(s).lower().replace("×", "x").split("x")
        return int(w), int(h)
    except Exception:
        return 1280, 800


def _maybe_reexec() -> None:
    """Playwright ipo kwenye venv ya template — interpreter isiyo venv ire-exec mwenyewe
    (agent huamrisha `python3 xmd_shot.py`; hajui venv yetu). Moja tu (guard env)."""
    try:
        import playwright  # noqa: F401
        return
    except ImportError:
        pass
    if os.environ.get("XMD_SHOT_REEXEC") == "1":
        return  # tumejaribu tayari — acha main ishughulikie (itachapa playwright-missing)
    here = os.path.abspath(__file__)
    for cand in ("/code/openhands-venv/bin/python", "/usr/bin/python3"):
        if cand != sys.executable and os.path.exists(cand):
            env = dict(os.environ, XMD_SHOT_REEXEC="1")
            os.execve(cand, [cand, here] + sys.argv[1:], env)


def main() -> int:
    _maybe_reexec()
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--label", default="")
    ap.add_argument("--ws", default="/home/user/ws")
    ap.add_argument("--viewport", default="1280x800")
    ap.add_argument("--wait", type=int, default=1500, help="ms baada ya load")
    ap.add_argument("--fullpage", action="store_true")
    ap.add_argument("--timeout", type=int, default=45000)
    a = ap.parse_args()

    w, h = parse_viewport(a.viewport)
    key = shotlaw.page_key(a.url, w, h)

    # SHERIA kwanza (haraka — bila browser): kama hash ya mwisho ipo na pengine
    # hatujabadilika... hash halisi hitajika: lazima tufungue page kuipima. Registry
    # haiwezi kutabiri; kwa hiyo browser inafunguliwa, DOM inapimwa, halafu sheria.
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(json.dumps({"ok": False, "reason": "playwright-missing"}))
        return 1

    out_dir = shotlaw.shots_dir(a.ws)
    os.makedirs(out_dir, exist_ok=True)

    chrome = find_chrome()
    try:
        with sync_playwright() as pw:
            kw = {"headless": True, "args": ["--no-sandbox"]}
            if chrome:
                kw["executable_path"] = chrome
            browser = pw.chromium.launch(**kw)
            try:
                pg = browser.new_page(viewport={"width": w, "height": h})
                pg.goto(a.url, wait_until="networkidle", timeout=a.timeout)
                if a.wait:
                    pg.wait_for_timeout(a.wait)
                dom = pg.content()
                final_url = pg.url
                content_hash = hashlib.md5(
                    (final_url + "|" + f"{w}x{h}" + "|" + dom).encode("utf-8", "ignore")
                ).hexdigest()

                reg = shotlaw.load(a.ws)
                allowed, reason = shotlaw.check(reg, key, content_hash)
                if not allowed:
                    prev = (reg.get("shots") or {}).get(key) or {}
                    print(json.dumps({"ok": False, "reason": reason,
                                      "existing": prev.get("path", "")}, ensure_ascii=False))
                    return 2

                slug = shotlaw.slugify(key.split("@")[0].split("//")[-1] or "page")
                n = int((((reg.get("shots") or {}).get(key) or {}).get("n") or 0)) + 1
                fname = f"{slug}-{w}x{h}-v{n}.png"
                fpath = os.path.join(out_dir, fname)
                pg.screenshot(path=fpath, full_page=bool(a.fullpage), timeout=a.timeout)
                entry = shotlaw.record(a.ws, reg, key, content_hash,
                                       a.label or a.url, fpath, url=final_url)
                print(json.dumps({"ok": True, "path": entry["path"], "page": key,
                                  "label": entry["label"], "reason": reason,
                                  "n": entry["n"]}, ensure_ascii=False))
                return 0
            finally:
                try:
                    browser.close()
                except Exception:
                    pass
    except Exception as e:
        print(json.dumps({"ok": False, "reason": f"{type(e).__name__}: {str(e)[:200]}"},
                         ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
