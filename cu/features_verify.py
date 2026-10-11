"""cu/features_verify.py — R51 · AWAMU 2: HARNESS ndiye mamlaka ya `feature_list.json`.

Mkataba (utafiti R50 — "Default-FAIL"): agent ANARUHUSIWA kuandika state/evidence pekee;
`passed` hukubaliwa TU na harness yenye USHAHIDI:
  • check kind="command"   → tuna-RE-RUN wenyewe (cwd=workspace, timeout, exit_code halisi).
  • check kind="assertion" → inapita TU kama feature ina evidence ya browser/file yenye
                             artifact inayo-exist kweli disk (hakuna "Nimeona" bila faili).
UAMUUZI: feature = passed i.w.p. checks zote required zimepita; vinginevyo failed
(default-FAIL — ushahidi usipokuwepo ni kukatazwa, si "bado").

Stdlib TU — inaendesha local (testi) na sandbox (bridge). Hakuna network.
CLI (sandbox/diagnostics):  python3 features_verify.py --ws /home/user/ws
  exit 0 = features zote required zimepita; 3 = vinginevyo; 1 = faili haipo/mbovu.
"""
from __future__ import annotations

import json
import os
import shlex
import subprocess
import time

LIST_REL = "feature_list.json"
CMD_TIMEOUT = int(os.environ.get("XMD_VERIFY_TIMEOUT", "120") or 120)


def list_path(ws: str) -> str:
    return os.path.join(ws, LIST_REL)


def load(ws: str) -> dict | None:
    try:
        with open(list_path(ws), "r", encoding="utf-8") as fh:
            data = json.load(fh)
        if isinstance(data, dict) and isinstance(data.get("features"), list):
            return data
    except (OSError, ValueError):
        pass
    return None


def save(ws: str, data: dict) -> None:
    tmp = list_path(ws) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    os.replace(tmp, list_path(ws))


# --------------------------------------------------------------------- checks
def _run_command(ws: str, cmd: str, timeout: int = CMD_TIMEOUT) -> tuple[int, str]:
    """Endesha check ya command KAMA ILIVYO (bila shell — SAFE_CMD_RX ya engine
    imekwishaakataa metachars). Rudi (exit_code, output-tail). Timeout → 124 (kama GNU)."""
    try:
        argv = shlex.split(cmd)
    except ValueError:
        return 2, "command haijapasuka (shlex)"
    if not argv:
        return 2, "command tupu"
    try:
        r = subprocess.run(argv, cwd=ws, capture_output=True, text=True,
                           timeout=timeout, env=_safe_env())
        out = ((r.stdout or "") + (r.stderr or "")).strip()
        return r.returncode, out[-500:]
    except subprocess.TimeoutExpired:
        return 124, f"timeout baada ya {timeout}s"
    except (OSError, PermissionError) as e:
        return 127, f"{type(e).__name__}: {e}"


def _safe_env() -> dict:
    """Environment salama kwa checks: inheritance iko sawa, ila hatupiti keys zetu za
    utility (cu-config) — checks ni za project tu."""
    env = dict(os.environ)
    for k in list(env):
        if k.startswith(("UNOROUTER_API_KEY", "OPENROUTER_API_KEY", "GEMINI_API_KEY",
                         "E2B_API_KEY", "XTROUTER")):
            env.pop(k, None)
    return env


def _assertion_evidence(ws: str, feature: dict) -> tuple[bool, str]:
    """Assertion inahitaji evidence ya browser/file yenye artifact iliyopo disk."""
    evs = feature.get("evidence") or []
    for ev in evs:
        if not isinstance(ev, dict):
            continue
        if ev.get("kind") not in ("browser", "file"):
            continue
        ref = ev.get("artifact") or ev.get("ref") or ""
        if not isinstance(ref, str) or not ref.strip():
            continue
        p = ref if os.path.isabs(ref) else os.path.join(ws, ref)
        if os.path.isfile(p) and os.path.getsize(p) > 0:
            return True, ref
    return False, ""


# --------------------------------------------------------------------- uamuzi wa harness
def verify_feature(ws: str, feature: dict, now: float | None = None) -> dict:
    """Thibitisha feature MOJA kwa kuendesha checks — state mpya huandikwa (authority).

    HUHARIRI feature in-place na kurejesha: {"id", "state", "checks_run", "fail"}.
    """
    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now if now is not None else time.time()))
    _cap_evidence(feature)  # cap ni kwa list NZIMA (agent+ harness), si append pekee
    checks = feature.get("checks") or []
    if not isinstance(checks, list) or not checks:
        feature["state"] = "failed"
        feature["last_failure"] = "feature haina checks (haiwezi kupimika)"
        _append_evidence(feature, {"kind": "command", "ref": "harness", "exit_code": 2,
                                   "note": "no checks", "at": ts})
        return {"id": feature.get("id", "?"), "state": "failed", "checks_run": 0,
                "fail": feature["last_failure"]}

    all_pass, first_fail = True, None
    run = 0
    for chk in checks:
        if not isinstance(chk, dict):
            continue
        kind = chk.get("kind")
        run += 1
        if kind == "command" and chk.get("command"):
            code, out = _run_command(ws, str(chk["command"]))
            chk["state"] = "passed" if code == 0 else "failed"
            chk["exit_code"] = code
            chk["artifact"] = None
            _append_evidence(feature, {
                "kind": "command", "ref": str(chk["command"])[:200], "exit_code": code,
                "note": ("ok" if code == 0 else "fail") + (": " + out[-160:] if (code != 0 and out) else ""),
                "at": ts})
            if code != 0:
                all_pass = False
                first_fail = first_fail or f"check `{str(chk['command'])[:60]}` exit={code}"
        elif kind == "assertion":
            ok, ref = _assertion_evidence(ws, feature)
            chk["state"] = "passed" if ok else "failed"
            chk["exit_code"] = None
            chk["artifact"] = ref or None
            if not ok:
                all_pass = False
                first_fail = first_fail or "assertion bila evidence yenye artifact halisi"
        else:
            chk["state"] = "skipped"

    if all_pass:
        feature["state"] = "passed"
        feature["last_failure"] = None
    else:
        feature["state"] = "failed"
        feature["last_failure"] = first_fail or "checks zimeshindwa"
    return {"id": feature.get("id", "?"), "state": feature["state"], "checks_run": run,
            "fail": feature.get("last_failure")}


def _cap_evidence(feature: dict, keep: int = 30) -> None:
    evs = feature.get("evidence")
    if isinstance(evs, list) and len(evs) > keep:
        del evs[:-keep]


def _append_evidence(feature: dict, ev: dict) -> None:
    evs = feature.setdefault("evidence", [])
    if isinstance(evs, list):
        evs.append(ev)
        _cap_evidence(feature)


def verify_all(ws: str, now: float | None = None) -> dict | None:
    """Thibitisha feature list nzima. Rudi verdict (na kui-andika) au None kama haipo.

    Verdict: {"ok": bool, "passed": int, "failed": int, "total": int,
              "failures": [str], "verified_at": iso, "results": [...]}
    ok = features ZOTE required zimepita (qa zikiwemo zilizo required)."""
    data = load(ws)
    if data is None:
        return None
    ts_now = now if now is not None else time.time()
    results, failures = [], []
    p_ = f_ = 0
    for feat in data.get("features") or []:
        if not isinstance(feat, dict):
            continue
        if not feat.get("required", True):
            continue
        r = verify_feature(ws, feat, ts_now)
        results.append(r)
        if r["state"] == "passed":
            p_ += 1
        else:
            f_ += 1
            if r.get("fail"):
                failures.append(f"{r['id']}: {r['fail']}")
    verdict = {
        "ok": f_ == 0 and p_ > 0,
        "passed": p_,
        "failed": f_,
        "total": p_ + f_,
        "failures": failures[:10],
        "verified_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts_now)),
        "results": results,
    }
    data["harness_verdict"] = {k: v for k, v in verdict.items() if k != "results"}
    save(ws, data)
    return verdict


def summary_line(verdict: dict | None) -> str:
    if verdict is None:
        return "feature_list.json haipo — hakuna cha kuthibitisha"
    v = verdict
    if v["ok"]:
        return f"features {v['passed']}/{v['total']} ✓ (harness-verified)"
    fl = "; ".join(v.get("failures") or [])[:180]
    return f"features {v['passed']}/{v['total']} — IMESHINDWA: {fl}"


# --------------------------------------------------------------------- CLI
def main() -> int:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--ws", default="/home/user/ws")
    a = ap.parse_args()
    verdict = verify_all(a.ws)
    if verdict is None:
        print(json.dumps({"ok": False, "reason": "feature_list.json haipo au ni mbovu"}))
        return 1
    out = dict(verdict)
    out["summary"] = summary_line(verdict)
    print(json.dumps(out, ensure_ascii=False, indent=1))
    return 0 if verdict["ok"] else 3


if __name__ == "__main__":
    raise SystemExit(main())
