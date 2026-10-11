"""cu/shotlaw.py — R51 · SHERIA YA SCREENSHOT (AGENTS.md law, deterministic).

Sheria (agizo la CEO — hakuna cap ya jumla):
  1. SCREENSHOT MOJA kwa kila page/view (page_key = url + viewport).
  2. Re-shot inaruhusiwa TU kama chanzo (content hash ya page) KIMEBADILIKA.
  3. Screenshot zinachukuliwa na `cu/xmd_shot.py` TU (CLI deterministic) —
     agent HAICHUKUI shot kwa tools zingine; hii ndiyo registry ya kweli.

Registry: <ws>/.xmd/shots.json — stdlib TU, bila network (testable local).
"""
from __future__ import annotations

import json
import os
import re
import time

REG_REL = os.path.join(".xmd", "shots.json")
_SHOTS_DIR_REL = os.path.join(".xmd", "shots")
SLUG_RX = re.compile(r"[^a-z0-9]+")


def slugify(s: str) -> str:
    out = SLUG_RX.sub("-", (s or "").strip().lower()).strip("-")
    return out[:60] or "page"


def page_key(url: str, width: int = 1280, height: int = 800) -> str:
    """Ufunguo wa sheria: page/view = url iliyonormalizwa + viewport."""
    u = (url or "").strip()
    u = re.sub(r"#.*$", "", u)          # fragments hazibadilishi page
    u = re.sub(r"/+$", "", u)
    return f"{u}@{int(width)}x{int(height)}"


def reg_path(ws: str) -> str:
    return os.path.join(ws, REG_REL)


def shots_dir(ws: str) -> str:
    return os.path.join(ws, _SHOTS_DIR_REL)


def load(ws: str) -> dict:
    try:
        with open(reg_path(ws), "r", encoding="utf-8") as fh:
            reg = json.load(fh)
        if isinstance(reg, dict) and isinstance(reg.get("shots"), dict):
            return reg
    except (OSError, ValueError):
        pass
    return {"version": 1, "shots": {}}


def save(ws: str, reg: dict) -> None:
    d = shots_dir(ws)
    os.makedirs(d, exist_ok=True)
    tmp = reg_path(ws) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(reg, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, reg_path(ws))


def check(reg: dict, key: str, content_hash: str) -> tuple[bool, str]:
    """Je, shot ya (key, hash) hii inaruhusiwa? Rudi (allowed, reason)."""
    prev = (reg.get("shots") or {}).get(key)
    if not prev:
        return True, "first-shot"
    if prev.get("hash") != content_hash:
        return True, "source-changed"
    return False, "same-source-dup"


def record(ws: str, reg: dict, key: str, content_hash: str, label: str,
           shot_path: str, url: str = "") -> dict:
    """Sajili shot mpya (1 per key — entry ya zamani hubadilishwa, HAIJUMLUISHWI)."""
    # path iwe relative-kwa-ws DAIMA (abs → relpath; relative → acha kama ilivyo)
    rel = os.path.relpath(shot_path, ws) if os.path.isabs(shot_path) else os.path.normpath(shot_path)
    entry = {
        "hash": content_hash,
        "label": (label or "")[:200],
        "path": rel,
        "url": url,
        "ts": round(time.time(), 3),
        "n": int(((reg.get("shots") or {}).get(key) or {}).get("n") or 0) + 1,
    }
    reg.setdefault("shots", {})[key] = entry
    save(ws, reg)
    return entry


def pending(reg: dict, emitted: set[str]) -> list[dict]:
    """Entries za registry ambazo Bridge bado haijazituma kama events (key = abs path)."""
    out = []
    for key, e in (reg.get("shots") or {}).items():
        p = e.get("path") or ""
        if p and p not in emitted:
            out.append({"page": key, **e})
    out.sort(key=lambda e: e.get("ts", 0))
    return out
