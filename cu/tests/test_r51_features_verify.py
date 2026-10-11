"""cu/tests/test_r51_features_verify.py — harness ndiye mamlaka ya feature states."""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import features_verify as FV  # noqa: E402


def ws_with(tmp_path, features):
    p = tmp_path / "feature_list.json"
    data = {"schema_version": 1, "run_id": "t", "plan_id": "p",
            "generated_at": "x", "features": features}
    p.write_text(json.dumps(data))
    return str(tmp_path)


def blank(fid, checks, state="pending", evidence=None):
    return {"id": fid, "title": fid, "required": True, "qa": False, "state": state,
            "attempts": 0, "checks": checks, "evidence": evidence or [], "last_failure": None}


def cmd_check(cmd, state="not_run"):
    return {"id": "verify", "kind": "command", "required": True, "command": cmd,
            "state": state, "exit_code": None, "artifact": None}


def assert_check(expect="kitu"):
    return {"id": "verify", "kind": "assertion", "required": True, "expect": expect,
            "state": "not_run", "exit_code": None, "artifact": None}


def test_command_inayopita_mandiko_huwa_passed(tmp_path):
    (tmp_path / "ok.txt").write_text("OK")
    ws = ws_with(tmp_path, [blank("step-01", [cmd_check("python3 -c \"import os;print(1)\"")])])
    v = FV.verify_all(ws)
    assert v["ok"] and v["passed"] == 1
    data = json.loads((tmp_path / "feature_list.json").read_text())
    f = data["features"][0]
    assert f["state"] == "passed"
    assert f["checks"][0]["exit_code"] == 0
    assert any(e["kind"] == "command" and e["exit_code"] == 0 for e in f["evidence"])
    assert data["harness_verdict"]["ok"] is True


def test_command_inayofeli_huwa_failed_hata_agent_akasema_passed(tmp_path):
    # agent alidanganya (state="passed") — harness inaangusha
    feat = blank("step-01", [cmd_check("python3 -c \"import sys;sys.exit(7)\"")], state="passed")
    ws = ws_with(tmp_path, [feat])
    v = FV.verify_all(ws)
    assert not v["ok"] and v["failed"] == 1
    data = json.loads((tmp_path / "feature_list.json").read_text())
    f = data["features"][0]
    assert f["state"] == "failed" and f["checks"][0]["exit_code"] == 7
    assert "exit=7" in (f["last_failure"] or "")


def test_assertion_bila_evidence_haipiti_default_fail(tmp_path):
    ws = ws_with(tmp_path, [blank("step-01", [assert_check()])])
    v = FV.verify_all(ws)
    assert not v["ok"]
    data = json.loads((tmp_path / "feature_list.json").read_text())
    assert data["features"][0]["checks"][0]["state"] == "failed"
    assert "bila evidence" in (data["features"][0]["last_failure"] or "")


def test_assertion_na_browser_artifact_halisi_hupita(tmp_path):
    shots = tmp_path / ".xmd" / "shots"
    shots.mkdir(parents=True)
    (shots / "p.png").write_bytes(b"\x89PNGxxxx")
    ev = [{"kind": "browser", "ref": ".xmd/shots/p.png", "note": "Nimeona homepage"}]
    ws = ws_with(tmp_path, [blank("step-01", [assert_check()], evidence=ev)])
    v = FV.verify_all(ws)
    assert v["ok"], v
    data = json.loads((tmp_path / "feature_list.json").read_text())
    assert data["features"][0]["checks"][0]["artifact"] == ".xmd/shots/p.png"


def test_artifact_ya_uongo_haikubaliki(tmp_path):
    ev = [{"kind": "file", "ref": "hakuna/hii.png"}]
    ws = ws_with(tmp_path, [blank("step-01", [assert_check()], evidence=ev)])
    assert not FV.verify_all(ws)["ok"]


def test_required_false_haipimwi(tmp_path):
    feat = blank("optional-01", [cmd_check("python3 -c \"import sys;sys.exit(9)\"")])
    feat["required"] = False
    ws = ws_with(tmp_path, [feat, blank("step-01", [cmd_check("python3 -c \"print(1)\"")])])
    v = FV.verify_all(ws)
    assert v["ok"] and v["total"] == 1


def test_list_haipo_rudi_none(tmp_path):
    assert FV.verify_all(str(tmp_path)) is None
    assert "haipo" in FV.summary_line(None)


def test_feature_bila_check_ni_failed(tmp_path):
    feat = blank("step-01", [])
    ws = ws_with(tmp_path, [feat])
    v = FV.verify_all(ws)
    assert not v["ok"]
    data = json.loads((tmp_path / "feature_list.json").read_text())
    assert data["features"][0]["state"] == "failed"


def test_evidence_haizidi_30(tmp_path):
    evs = [{"kind": "file", "ref": "x.png", "note": str(i)} for i in range(40)]
    (tmp_path / "x.png").write_text("x")
    feat = blank("step-01", [assert_check()], evidence=evs)
    ws = ws_with(tmp_path, [feat])
    FV.verify_all(ws)
    data = json.loads((tmp_path / "feature_list.json").read_text())
    assert len(data["features"][0]["evidence"]) <= 30


def test_env_haipitishi_keys_kwa_checks(tmp_path):
    os.environ["UNOROUTER_API_KEY_TEST"] = "sikreti-mfupi"
    chk = cmd_check("python3 -c \"import os,sys;sys.exit(0 if 'UNOROUTER_API_KEY_TEST' not in os.environ else 5)\"")
    ws = ws_with(tmp_path, [blank("step-01", [chk])])
    v = FV.verify_all(ws)
    os.environ.pop("UNOROUTER_API_KEY_TEST", None)
    assert v["ok"], "check iliona key — _safe_env imevuja"


def test_curl_command_kama_ya_plan_verification(tmp_path):
    # check ya kawaida ya mpango: ls + grep — kwa shlex (hakuna shell ⇒ pipe haitafanya kazi;
    # engine huitengenezea kama amri MOJA; hapa binary ya kwanza ndiyo inayopimwa)
    (tmp_path / "f.txt").write_text("Karibu XMD")
    chk = cmd_check("python3 -c \"print(open('f.txt').read())\"")
    ws = ws_with(tmp_path, [blank("step-01", [chk])])
    assert FV.verify_all(ws)["ok"]
