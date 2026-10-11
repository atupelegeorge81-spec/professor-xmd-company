"""cu/tests/test_r51_ohutil.py — objective ya judge + ramani ya makosa + shots pending."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import shotlaw  # noqa: E402
from oh_util import (build_objective, classify_fail, extract_usage,  # noqa: E402
                     first_words, read_shot_b64, shots_pending)

PLAN = """# MPANGO KAZI — Tovuti ya Mfano

### Step 1 — Scaffold ya mradi
Andika files za kuanzia.
**Verification:** `test -f package.json && echo OK`

### Step 2 — Ukurasa wa nyumbani
Tengeneza homepage.
**Verification:** `curl -s http://localhost:3000 | grep -q "Karibu"`

### Step 3 — Screenshots
Chukua picha kwa sheria.
"""


def test_objective_inajumuisha_steps_na_verification_verbatim():
    obj = build_objective("Tovuti ya Mfano", PLAN)
    assert "Tovuti ya Mfano" in obj
    assert "Step 1 — Scaffold ya mradi" in obj
    assert "Step 2 — Ukurasa wa nyumbani" in obj
    assert "test -f package.json && echo OK" in obj            # verbatim
    assert 'grep -q "Karibu"' in obj                          # verbatim (heshi ndani)
    assert "INCOMPLETE ikikosa" in obj                        # judge contract
    assert "SI tamko" in obj


def test_objective_bila_steps_maalum_bado_ina_mkataba():
    obj = build_objective("X", "andika kitu tu")
    assert "(plan.md haina vyeti" in obj
    assert "VIPIMA VYAKO" in obj


class FakeExc(Exception):
    def __init__(self, msg, status=None, headers=None):
        super().__init__(msg)
        self.status_code = status
        self.response = type("R", (), {"status_code": status, "headers": headers or {}})() \
            if status or headers else None


def test_classify_429_na_retry_after():
    k, ra = classify_fail(FakeExc("Too Many Requests", status=429, headers={"Retry-After": "25"}))
    assert k == "rate_limited" and ra == 25.0


def test_classify_500_na_timeout_na_default():
    assert classify_fail(FakeExc("boom", status=503))[0] == "server_error"
    assert classify_fail(FakeExc("APITimeoutError: request timed out", ))[0] == "timeout"
    assert classify_fail(FakeExc("401 Unauthorized", status=401))[0] == "server_error"
    assert classify_fail(FakeExc("weird unknown"))[0] == "server_error"


def test_extract_usage_kutoka_metrics_na_raw():
    u = type("U", (), {"prompt_tokens": 11, "completion_tokens": 7})()
    m = type("M", (), {"accumulated_token_usage": u})()
    resp = type("Resp", (), {"metrics": m, "raw_response": None})()
    assert extract_usage(resp) == (11, 7)

    raw = {"usage": {"prompt_tokens": 3, "completion_tokens": 4}}
    resp2 = type("Resp", (), {"metrics": None, "raw_response": raw})()
    assert extract_usage(resp2) == (3, 4)

    assert extract_usage(object()) == (0, 0)


def test_shots_pending_inataka_faili_halisi(tmp_path):
    ws = str(tmp_path)
    reg = shotlaw.load(ws)
    key = shotlaw.page_key("http://x/p1", 1280, 800)
    shotlaw.record(ws, reg, key, "h1", "lab", ".xmd/shots/p1.png")
    # faili HALISI haipo bado → hajarudishwi
    assert shots_pending(ws, set()) == []
    os.makedirs(os.path.join(ws, ".xmd", "shots"), exist_ok=True)
    with open(os.path.join(ws, ".xmd", "shots", "p1.png"), "wb") as fh:
        fh.write(b"\x89PNGfake")
    out = shots_pending(ws, set())
    assert len(out) == 1 and out[0]["label"] == "lab"
    assert shots_pending(ws, {".xmd/shots/p1.png"}) == []


def test_read_shot_b64_cap(tmp_path):
    p = tmp_path / "big.png"
    p.write_bytes(b"x" * 1024)
    assert read_shot_b64(str(p), cap=512) is None      # kubwa mno → None
    assert read_shot_b64(str(p), cap=4096) is not None
    assert read_shot_b64(str(tmp_path / "hakuna.png")) is None


def test_first_words():
    assert first_words("  a\n\nb   c ") == "a b c"
    assert len(first_words("z" * 999, 100)) == 100
