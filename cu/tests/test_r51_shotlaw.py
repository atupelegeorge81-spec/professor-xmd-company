"""cu/tests/test_r51_shotlaw.py — sheria ya screenshot (1/page; re-shot = source imebadilika)."""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import shotlaw  # noqa: E402


def test_page_key_inajumuisha_viewport_na_inanormalize():
    k1 = shotlaw.page_key("http://localhost:3000/", 1280, 800)
    k2 = shotlaw.page_key("http://localhost:3000", 1280, 800)
    assert k1 == k2  # trailing slash ni moja
    k3 = shotlaw.page_key("http://localhost:3000/#about", 1280, 800)
    assert k3 == k2  # fragment haibadilishi page
    k4 = shotlaw.page_key("http://localhost:3000", 390, 844)
    assert k4 != k2  # viewport tofauti = view nyingine (inaruhusiwa)


def test_first_shot_inaruhusiwa_dup_same_hash_imekatazwa(tmp_path):
    ws = str(tmp_path)
    reg = shotlaw.load(ws)
    key = shotlaw.page_key("http://x/page", 1280, 800)
    ok, reason = shotlaw.check(reg, key, "hashA")
    assert ok and reason == "first-shot"
    shotlaw.record(ws, reg, key, "hashA", "home", os.path.join(ws, ".xmd", "shots", "p.png"),
                   url="http://x/page")
    reg2 = shotlaw.load(ws)  # round-trip kwa disk
    ok2, reason2 = shotlaw.check(reg2, key, "hashA")
    assert not ok2 and reason2 == "same-source-dup"


def test_source_imebadilika_re_shot_inaruhusiwa_na_n_inaongezeka(tmp_path):
    ws = str(tmp_path)
    reg = shotlaw.load(ws)
    key = shotlaw.page_key("http://x/page", 1280, 800)
    e1 = shotlaw.record(ws, reg, key, "hashA", "home", os.path.join(ws, "a.png"))
    assert e1["n"] == 1
    reg2 = shotlaw.load(ws)
    ok, reason = shotlaw.check(reg2, key, "hashB")
    assert ok and reason == "source-changed"
    e2 = shotlaw.record(ws, reg2, key, "hashB", "home v2", os.path.join(ws, "b.png"))
    assert e2["n"] == 2
    reg3 = shotlaw.load(ws)
    assert len(reg3["shots"]) == 1           # entry moja per key (hubadilishwa, haiongezwi)
    assert reg3["shots"][key]["hash"] == "hashB"


def test_hakuna_cap_ya_jumla_pages_nyingi_zinaruhusiwa(tmp_path):
    ws = str(tmp_path)
    reg = shotlaw.load(ws)
    for i in range(50):
        key = shotlaw.page_key(f"http://x/p{i}", 1280, 800)
        ok, _ = shotlaw.check(reg, key, f"h{i}")
        assert ok
        shotlaw.record(ws, reg, key, f"h{i}", f"p{i}", os.path.join(ws, f"p{i}.png"))
        reg = shotlaw.load(ws)
    assert len(reg["shots"]) == 50


def test_pending_inarudisha_zisizotumiwa_tu(tmp_path):
    ws = str(tmp_path)
    reg = shotlaw.load(ws)
    for i in range(3):
        key = shotlaw.page_key(f"http://x/p{i}", 1280, 800)
        shotlaw.record(ws, reg, key, f"h{i}", f"l{i}", f".xmd/shots/p{i}.png")
        reg = shotlaw.load(ws)
    pend = shotlaw.pending(reg, emitted=set())
    assert len(pend) == 3
    pend2 = shotlaw.pending(reg, emitted={".xmd/shots/p0.png", ".xmd/shots/p2.png"})
    assert [p["path"] for p in pend2] == [".xmd/shots/p1.png"]


def test_registry_mbovu_haivunji(tmp_path):
    ws = str(tmp_path)
    p = shotlaw.reg_path(ws)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w") as fh:
        fh.write("{not json")
    reg = shotlaw.load(ws)
    assert reg == {"version": 1, "shots": {}}
