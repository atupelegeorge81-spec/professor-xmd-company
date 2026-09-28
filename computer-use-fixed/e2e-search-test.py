#!/usr/bin/env python3
"""Harness ya majaribio ya SEARCH-FIX — hakuna keys wala mtandano inahitajika.

Usage:  python3 e2e-search-test.py
Inaanza: mock SearXNG (:8871, inaiga cold-start ya Render) + mock LLM ya OpenAI-SSE (:8872)
kisha inawasha server halisi lean/server.mjs (:8873) na kuendesha run nzima hadi run_end.
PHASE 1 = unit 9 (xmd-search CLI) · PHASE 2 = e2e 21 (server + injini) · PASS/FAIL kwa kila kigezo.
"""

import json, os, re, shutil, signal, subprocess, sys, threading, time, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REPO = Path(__file__).resolve().parent   # repo hii (zip imefunguliwa)
DATA = Path("/tmp/xmdtest-data")
SEARX_PORT, LLM_PORT, LEAN_PORT = 8871, 8872, 8873
PASS, FAIL = [], []

def check(name, cond, extra=""):
    (PASS if cond else FAIL).append(name)
    print(("  ✅ " if cond else "  ❌ ") + name + (f"   [{extra}]" if extra and not cond else ""))

# ---------------------------------------------------------------- mock SearXNG
SEARX_STATE = {"mode": "fail_first:2", "requests": [], "n": 0}   # modes: fail_first:N | always_fail | empty | ok
def set_searx_mode(m):
    SEARX_STATE["mode"] = m; SEARX_STATE["n"] = 0
RESULTS = {"results": [
    {"title": "Privacy Policy - Stripe", "url": "https://stripe.com/privacy", "content": "Stripe privacy practices and data handling."},
    {"title": "US privacy policy | OpenAI", "url": "https://openai.com/policies/us-privacy-policy/", "content": "OpenAI personal data collection."},
    {"title": "Privacy Policy - LinkedIn", "url": "https://www.linkedin.com/legal/privacy-policy", "content": "LinkedIn retains data while account is open."},
]}

class SearxHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        from urllib.parse import urlparse, parse_qs
        u = urlparse(self.path); q = parse_qs(u.query)
        SEARX_STATE["requests"].append({"path": u.path, "q": q.get("q", [""])[0],
                                        "format": q.get("format", [""])[0], "engines": q.get("engines", [""])[0]})
        mode = SEARX_STATE["mode"]
        SEARX_STATE["n"] += 1
        if mode == "always_fail" or (mode.startswith("fail_first:") and SEARX_STATE["n"] <= int(mode.split(":")[1])):
            self.send_response(503); self.end_headers(); self.wfile.write(b"cold start: instance waking up"); return
        body = json.dumps(RESULTS if mode != "empty" else {"results": []}).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self, *a): pass

# ---------------------------------------------------------------- mock LLM (OpenAI-compatible SSE)
LLM_STATE = {"calls": []}

class LlmHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        ln = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(ln) or b"{}")
        msgs = body.get("messages", [])
        saw_output = any("<output" in str(m.get("content", "")) for m in msgs if m.get("role") != "system")
        LLM_STATE["calls"].append({"system": next((m["content"] for m in msgs if m.get("role") == "system"), ""),
                                   "messages": msgs, "body": body})
        if not saw_output:
            text = 'Nataka kutumia engine ya kampuni kwanza.\n<bash>xmd-search "privacy policy"</bash>'
        else:
            text = "<finish>Ripoti: nimepata matokeo 3 — Stripe, OpenAI, LinkedIn (URL: https://stripe.com/privacy).</finish>"
        self.send_response(200); self.send_header("Content-Type", "text/event-stream"); self.end_headers()
        for i in range(0, len(text), 24):
            chunk = {"choices": [{"delta": {"content": text[i:i+24]}}]}
            self.wfile.write(f"data: {json.dumps(chunk)}\n\n".encode()); self.wfile.flush(); time.sleep(0.005)
        end = {"choices": [{"delta": {}, "finish_reason": "stop"}],
               "usage": {"prompt_tokens": 500, "completion_tokens": 40, "total_tokens": 540}}
        self.wfile.write(f"data: {json.dumps(end)}\n\ndata: [DONE]\n\n".encode()); self.wfile.flush()
    def log_message(self, *a): pass

def start_mocks():
    s1 = ThreadingHTTPServer(("127.0.0.1", SEARX_PORT), SearxHandler)
    s2 = ThreadingHTTPServer(("127.0.0.1", LLM_PORT), LlmHandler)
    threading.Thread(target=s1.serve_forever, daemon=True).start()
    threading.Thread(target=s2.serve_forever, daemon=True).start()
    return s1, s2

# ---------------------------------------------------------------- helpers
def run_search_cli(env_extra):
    env = dict(os.environ, SEARXNG_URL=f"http://127.0.0.1:{SEARX_PORT}", **env_extra)
    before = len(SEARX_STATE["requests"])
    p = subprocess.run([sys.executable, str(REPO / "lean/bin/xmd-search"), "privacy policy"],
                       capture_output=True, text=True, env=env, timeout=120)
    return p, SEARX_STATE["requests"][before:]

def api(path, method="GET", payload=None, timeout=120):
    req = urllib.request.Request(f"http://127.0.0.1:{LEAN_PORT}{path}", method=method,
                                 data=json.dumps(payload).encode() if payload is not None else None,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())

def sse_until(tid, want="run_end", timeout=120):
    events, buf = [], b""
    with urllib.request.urlopen(f"http://127.0.0.1:{LEAN_PORT}/api/threads/{tid}/stream", timeout=timeout) as r:
        t0 = time.time()
        while time.time() - t0 < timeout:
            chunk = r.read1(65536)
            if not chunk: break
            buf += chunk
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                line = line.decode("utf-8", "replace").strip()
                if line.startswith("data: "):
                    try: ev = json.loads(line[6:])
                    except Exception: continue
                    events.append(ev)
                    if ev.get("type") == want: return events
    return events

# ---------------------------------------------------------------- PHASE 1: unit
def phase1():
    print("\n━━━ PHASE 1: xmd-search CLI (mock SearXNG) ━━━")
    # T1 — fail 2 kisha success (inaiga cold-start ya Render)
    p, reqs = run_search_cli({"XMD_SEARCH_RETRIES": "2", "XMD_SEARCH_TIMEOUT": "3"})
    check("T1: exit 0 baada ya kufeli mara 2", p.returncode == 0, f"rc={p.returncode} err={p.stderr[:120]}")
    check("T1: format ya matokeo (N. title — url)", bool(re.search(r"^1\. .+ — https?://\S+$", p.stdout, re.M)), p.stdout[:120])
    check("T1: maendeleo ya retries kwenye stderr (LIVE)", p.stderr.count("search attempt") == 2, p.stderr[:200])
    check("T1: majaribio 3 yalifanyika (2 fail + 1 ok)", len(reqs) == 3, f"reqs={len(reqs)}")
    check("T1: engines = 7 za kweli za instance", all(r["engines"] == "bing,google,yandex,naver,seznam,github,stackoverflow" for r in reqs), str([r["engines"] for r in reqs]))
    check("T1: format=json", all(r["format"] == "json" for r in reqs))
    print("      matokeo (mstari wa 1):\n       " + p.stdout.splitlines()[0])

    # T2 — engine imekwisha kabisa
    set_searx_mode("always_fail")
    p, reqs = run_search_cli({"XMD_SEARCH_RETRIES": "2", "XMD_SEARCH_TIMEOUT": "3"})
    check("T2: exit 2 + jibu wazi 'search failed after 3 attempts'", p.returncode == 2 and "search failed after 3 attempts" in p.stdout, f"rc={p.returncode} out={p.stdout[:150]}")

    # T3 — results 0 (si kosa la mtandao) → fallback bila engines → "no results"
    set_searx_mode("empty")
    p, reqs = run_search_cli({"XMD_SEARCH_RETRIES": "1", "XMD_SEARCH_TIMEOUT": "3"})
    check("T3: exit 0 na 'no results'", p.returncode == 0 and "no results" in p.stdout, f"rc={p.returncode} out={p.stdout[:120]}")
    check("T3: fallback bila engines ilijaribiwa", any(r["engines"] == "" for r in reqs), str([r["engines"] for r in reqs]))

    set_searx_mode("fail_first:2")   # reset kwa e2e (counter mpya)

# ---------------------------------------------------------------- PHASE 2: e2e
LEAN_PROC = None

def phase2():
    global LEAN_PROC
    print("\n━━━ PHASE 2: e2e — server.mjs + injini halisi ━━━")
    if DATA.exists(): shutil.rmtree(DATA)
    env = dict(os.environ,
               PORT=str(LEAN_PORT), XMD_API_KEY="test-key", XMD_MODEL="mock-model",
               XMD_BASE_URL=f"http://127.0.0.1:{LLM_PORT}/v1", SEARXNG_URL=f"http://127.0.0.1:{SEARX_PORT}",
               XMD_SEARCH_RETRIES="2", XMD_SEARCH_TIMEOUT="3", XMD_DATA_DIR=str(DATA), XMD_EFFORT="low")
    LEAN_PROC = subprocess.Popen(["node", "lean/server.mjs"], cwd=str(REPO), env=env,
                                 stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True)
    for _ in range(60):
        try:
            api("/api/config", timeout=2); break
        except Exception: time.sleep(0.5)
    else:
        check("E0: server imeanza", False); return
    print("  ℹ️  server imewaka (mode=local, mock LLM + mock SearXNG)")

    # --- E1: run ya mafanikio (search inafeli 2 kisha inafaulu — kama Render cold-start)
    calls0 = len(LLM_STATE["calls"]); reqs0 = len(SEARX_STATE["requests"])
    r = api("/api/run", "POST", {"task": "Tafuta maelezo kuhusu privacy policy ya Stripe"}, timeout=30)
    tid = r["threadId"]
    evs = sse_until(tid)
    types = [e["type"] for e in evs]
    check("E1: run_start + run_end zote zimefika", "run_start" in types and "run_end" in types, str(types[:8]))
    check("E1: run_end status=done", evs[-1].get("status") == "done", str(evs[-1]))
    check("E1: skill ya search imepakiwa na router", any(e["type"] == "skill_loaded" and e.get("name") == "search" and e.get("via") == "router" for e in evs))
    ex_start = next((e for e in evs if e["type"] == "exec_start" and e.get("kind") == "search"), None)
    ex_end = next((e for e in evs if e["type"] == "exec_end"), None)
    check("E1: exec kind=search yenye amri ya xmd-search", ex_start is not None and "xmd-search" in str(ex_start.get("command", "")), str(ex_start))
    check("E1: exec imefanikiwa (exit 0, chars>0)", ex_end is not None and ex_end.get("exit") == 0 and ex_end.get("chars", 0) > 0, str(ex_end))
    check("E1: usage imerekodiwa (mock: 540 tokens × calls 2)", any(e["type"] == "usage" for e in evs) and len(LLM_STATE["calls"]) - calls0 == 2)
    fin = next((e for e in evs if e["type"] == "finish"), None)
    check("E1: ripoti ya finish imefika", fin is not None and "Ripoti" in str(fin.get("report", "")))

    calls = LLM_STATE["calls"][calls0:]
    sys1 = calls[0]["system"]
    check("E1: CORE prompt ina sheria ya 8 (xmd-search PEKEE)", "8. Web search: ALWAYS `xmd-search" in sys1)
    check("E1: CORE prompt inakataza google/bing/duckduckgo moja kwa moja", "NEVER fetch google.com, bing.com, duckduckgo.com" in sys1)
    check("E1: CORE prompt haitaji tena xmd-shot isiyokuwepo", "xmd-shot" not in sys1)
    check("E1: skill imeingia kwenye context (agizo la xmd-search pekee)", "ONLY search tool" in json.dumps([m.get("content", "") for m in calls[0]["messages"]], ensure_ascii=False))
    ctx2 = json.dumps([m.get("content", "") for m in calls[1]["messages"]], ensure_ascii=False)
    check("E1: matokeo halisi yalirudi kwa model (stripe.com/privacy)", "stripe.com/privacy" in ctx2)
    check("E1: model aliona retries zilifanyika (stderr → context)", "search attempt" in ctx2)
    check("E1: state.json imehifadhiwa (endelea inawezekana)", (DATA / "threads" / tid / "state.json").exists())
    check("E1: events.jsonl imehifadhiwa (refresh haipotezi kitu)", (DATA / "threads" / tid / "events.jsonl").exists())
    check("E1: mock SearXNG ilipigiwa mara 3 (2 fail + 1 ok)", len(SEARX_STATE["requests"]) - reqs0 == 3, f"reqs={len(SEARX_STATE['requests']) - reqs0}")

    # --- E2: engine imezimwa kabisa — agent hapigi kelele, habadilishi njia
    set_searx_mode("always_fail")
    calls0 = len(LLM_STATE["calls"])
    r = api("/api/run", "POST", {"task": "Tafuta taarifa mpya kuhusu AI Afrika"}, timeout=30)
    tid2 = r["threadId"]
    evs2 = sse_until(tid2)
    ex_end2 = next((e for e in evs2 if e["type"] == "exec_end"), None)
    check("E2: exec imeisha na exit 2 (kosa la engine limefika wazi)", ex_end2 is not None and ex_end2.get("exit") == 2, str(ex_end2))
    ctx = json.dumps([m.get("content", "") for m in LLM_STATE["calls"][calls0:][1]["messages"]], ensure_ascii=False) if len(LLM_STATE["calls"]) - calls0 >= 2 else ""
    check("E2: model alisoma 'search failed after 3 attempts'", "search failed after 3 attempts" in ctx, ctx[:200])
    check("E2: run haikuingia loop — run_end=done", evs2 and evs2[-1].get("type") == "run_end" and evs2[-1].get("status") == "done")

    # --- E3: API za server
    cfg = api("/api/config")
    check("E3: /api/config inaorodhesha skills (search iko)", any(s["name"] == "search" for s in cfg["skills"]))
    threads = api("/api/threads")
    check("E3: /api/threads ina mazungumzo 2", len(threads) >= 2, str(len(threads)))

if __name__ == "__main__":
    s1, s2 = start_mocks()
    try:
        phase1(); phase2()
    finally:
        if LEAN_PROC:
            try: os.killpg(LEAN_PROC.pid, signal.SIGTERM)
            except Exception: pass
        s1.shutdown(); s2.shutdown()
    print(f"\n═══════ HITIMISHO: {len(PASS)} PASS · {len(FAIL)} FAIL ═══════")
    if FAIL:
        print("YAMEFELI:"); [print("  ❌", f) for f in FAIL]; sys.exit(1)
    print("KILA KITU IMEPITA ✅")
