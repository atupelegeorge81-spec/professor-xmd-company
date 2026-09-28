#!/usr/bin/env python3
"""
XMD-Lean — injini ndogo ya computer-use isiyokula tokens.

Kanuni (kutoka MPANGO-computer-use-token-chache.md):
  * Zana 3 tu, hazibadiliki (bash, write_file, finish) -> prefix thabiti, cache inashika.
  * Skills (maelekezo) zinapakiwa kwa @mention / router / amri `skill <jina>` — si zana.
  * Kila output inakatwa (kichwa + mkia) na zima linahifadhiwa kwenye faili.
  * Outputs za zamani zinafichwa kwa makundi (observation masking) ili historia isikue.
  * Walinzi: bajeti ya tokens, kikomo cha hatua, kurudia amri, kosa lile lile.
  * Kila kitu kinatoka LIVE kama tukio: "@@XMD {json}" kwenye stdout.

Maktaba za nje: HAKUNA (stdlib tu) — inaendeshwa popote (E2B au local).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import select
import signal
import difflib
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKILLS_DIR = HERE / "skills"
BIN_DIR = HERE / "bin"

# ----------------------------------------------------------------------------
# Matukio (events)
# ----------------------------------------------------------------------------
_T0 = time.time()


def emit(_type: str, **data) -> None:
    data["t"] = round((time.time() - _T0) * 1000)
    sys.stdout.write("@@XMD " + json.dumps({"type": _type, **data}, ensure_ascii=False) + "\n")
    sys.stdout.flush()


# ----------------------------------------------------------------------------
# Skills: orodha fupi (ngazi 0) + mwili (ngazi 1) unaopakiwa inapohitajika
# ----------------------------------------------------------------------------
def read_frontmatter(p: Path) -> dict:
    txt = p.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", txt, re.S)
    meta, body = {}, txt
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        body = m.group(2)
    meta["body"] = body.strip()
    return meta


def load_catalog() -> dict[str, dict]:
    cat = {}
    if SKILLS_DIR.exists():
        for d in sorted(SKILLS_DIR.iterdir()):
            f = d / "SKILL.md"
            if f.exists():
                meta = read_frontmatter(f)
                cat[d.name] = meta
    return cat


ROUTES = [
    ("github", r"\b(github|push|commit|clone|repo|pull request|branch)\b"),
    ("deploy", r"\b(host|hosting|deploy|netlify|vercel|weka hewani|link ya site|publish)\b"),
    ("browser", r"(https?://|\b(website|tovuti|ukurasa|bofya|click|login|browser)\b)"),
    ("search", r"\b(tafuta|search|research|habari za|latest|news|google|duckduckgo|bing|mtandaoni|online)\b"),
    ("code", r"\b(code|bug|fix|rekebisha|app|feature|function|refactor|test|script)\b"),
]


def route(task: str, catalog: dict) -> tuple[list[str], str]:
    """Router isiyotumia LLM (tokens 0). @mention ya mtumiaji inashinda."""
    low = task.lower()
    chosen: list[str] = []
    for m in re.findall(r"@([a-z][\w-]*)", low):
        if m in catalog and m not in chosen:
            chosen.append(m)
    mentioned = bool(chosen)
    if not mentioned:
        for name, rx in ROUTES:
            if name in catalog and re.search(rx, low) and name not in chosen:
                chosen.append(name)
    size = "kubwa" if (len(chosen) >= 2 or len(task) > 400) else "ndogo"
    return chosen, size


BUDGETS = {
    "ndogo": {"steps": 12, "tokens": 45_000},
    "kubwa": {"steps": 40, "tokens": 180_000},
}

# ----------------------------------------------------------------------------
# Prompt ya msingi (ngazi 0) — HAIBADILIKI kati ya hatua (hakuna saa/tarehe hapa)
# ----------------------------------------------------------------------------
CORE = """You are XMD, an autonomous computer-use agent inside a Linux sandbox.
Workspace (your cwd): {ws}

Tools: bash (run ONE shell command), write_file (create/overwrite a file), finish (end with a short report).
Long outputs are cut to head+tail and the full text is saved to a file you can grep.

Skills = extra instructions you load only when needed with the bash command `skill <name>`:
{catalog}

Helper commands on PATH: skill NAME | xmd-search "query" | xmd-fetch URL | xmd-check URL | xmd-map [dir] | xmd-push "message" | xmd-deploy DIR

Rules:
1. Do the smallest thing that fully completes the task. Do not explore without reason.
2. One tool call per step; combine related shell commands with && when safe.
3. Never dump huge output: use head, tail, grep, wc.
4. Verify the result once (cat, ls, curl, test), then call finish.
5. If the same approach fails twice, change approach or finish with what you have.
6. Before each tool call write ONE short sentence saying what you are doing.
7. Write your one-line step narration AND the finish report in the user's language (Swahili or English), short and factual.
8. Web search: ALWAYS `xmd-search "query"` — it is the ONLY search tool and retries by itself (be patient; never re-run it in a loop). NEVER fetch google.com, bing.com, duckduckgo.com or any other search engine directly — that is forbidden."""

TEXT_PROTOCOL = """

ACTION FORMAT (no function calling). Every reply = one short sentence, then EXACTLY ONE action block:
<bash>one shell command</bash>
<write path="relative/or/absolute/path">full file content</write>
<finish>short report for the user</finish>
After a <bash> or <write> block, STOP and wait: the output comes back as <output step=N exit=CODE>...</output>.
PLAN: if the task needs 3+ steps, in your FIRST reply put a short checklist BEFORE the sentence:
<plan>
- [ ] first item
- [ ] second item
</plan>
(max 6 items, few words each). When an item is finished, repeat the whole <plan> with it marked - [x]. Skip the plan for tiny tasks."""

TOOLS = [
    {"type": "function", "function": {
        "name": "bash",
        "description": "Run one shell command in the workspace and return its output.",
        "parameters": {"type": "object", "properties": {
            "command": {"type": "string"}}, "required": ["command"]}}},
    {"type": "function", "function": {
        "name": "write_file",
        "description": "Create or overwrite a text file with the given content.",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string"}, "content": {"type": "string"}},
            "required": ["path", "content"]}}},
    {"type": "function", "function": {
        "name": "finish",
        "description": "Finish the task and give the user a short report (what was done, results, links).",
        "parameters": {"type": "object", "properties": {
            "report": {"type": "string"}}, "required": ["report"]}}},
]

# ----------------------------------------------------------------------------
# Kuunda output (5.3) na kuficha za zamani (5.4)
# ----------------------------------------------------------------------------
HEAD, TAIL, LIMIT = 900, 900, 2200


def shape(text: str, path: Path) -> tuple[str, bool]:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", errors="replace")
    if len(text) <= LIMIT:
        return text, False
    hidden = len(text) - HEAD - TAIL
    return (text[:HEAD] + f"\n…[{hidden} chars hidden — full output: {path} (use grep/sed)]…\n"
            + text[-TAIL:]), True


KEEP_RECENT = 4   # outputs za hatua 4 za mwisho zinabaki kamili
MASK_BATCH = 4    # mpaka wa kuficha unasogea kwa makundi -> cache inashika kati ya makundi


def build_messages(state: dict) -> list[dict]:
    msgs = state["messages"]
    step = state["step"]
    boundary = max(0, ((step - KEEP_RECENT) // MASK_BATCH) * MASK_BATCH)
    out = []
    for m in msgs:
        hidden = f"[output of step {m.get('_step')} hidden to save tokens — full text: {m.get('_file', '?')}]"
        if (m.get("role") == "tool" or m.get("_obs")) and m.get("_step", 10**9) < boundary and not m.get("_keep"):
            if m.get("_obs"):
                out.append({"role": "user", "content": f"<output step={m['_step']}>{hidden}</output>"})
            else:
                out.append({"role": "tool", "tool_call_id": m["tool_call_id"], "content": hidden})
        else:
            out.append({k: v for k, v in m.items() if not k.startswith("_")})
    return out


# ----------------------------------------------------------------------------
# LLM (OpenAI-compatible, streaming) — stdlib tu
# ----------------------------------------------------------------------------
class LLMError(Exception):
    def __init__(self, status: int, body: str):
        short = body.strip()
        if short.startswith("<"):
            short = "provider returned an HTML error page (blocked or down)"
        else:
            try:
                short = json.loads(short).get("error", {}).get("message", short)
            except Exception:
                pass
        super().__init__(f"HTTP {status}: {str(short)[:240]}")
        self.status, self.body = status, body


_CMD_RX = re.compile(r'"(?:command|path|report)"\s*:\s*"((?:[^"\\]|\\.)*)', re.S)


def _partial_arg(args: str) -> str:
    m = _CMD_RX.search(args)
    if not m:
        return ""
    s = m.group(1)
    try:
        return json.loads('"' + s + '"')
    except Exception:
        try:
            return json.loads('"' + s.rstrip("\\") + '"')
        except Exception:
            return s.replace("\\n", "\n").replace('\\"', '"')


_PLAN_RX = re.compile(r"<plan>(.*?)</plan>", re.S)
_PLAN_ITEM = re.compile(r"^\s*[-*]\s*\[( |x|X)\]\s*(.+?)\s*$", re.M)


def strip_plan(text: str) -> str:
    """Ondoa <plan> (kamili au iliyoanza tu) kwenye maandishi yanayoonyeshwa."""
    t = _PLAN_RX.sub("", text)
    k = t.find("<plan>")
    return (t[:k] if k >= 0 else t).lstrip("\n")


def parse_plan(text: str) -> list[dict] | None:
    ms = _PLAN_RX.findall(text)
    if not ms:
        return None
    items = [{"text": m[1][:90], "done": m[0].lower() == "x"} for m in _PLAN_ITEM.findall(ms[-1])]
    return items[:8] or None


# tag ambayo bado haijakamilika mwishoni mwa stream: "<", "<wri", '<write path="site/ind'
_PARTIAL_TAG = re.compile(r"<(?:(?:bash|write|finish)(?:\s[^>]*)?|b(?:a(?:s)?)?|w(?:r(?:i(?:t)?)?)?|f(?:i(?:n(?:i(?:s)?)?)?)?|p(?:l(?:a(?:n)?)?)?)?$")
_ACT_RX = re.compile(r"<(bash|write|finish)\b([^>]*)>", re.S)


def parse_action(text: str) -> tuple[str, dict | None]:
    """Text protocol: rudisha (maelezo, call) kutoka kwenye jibu la model."""
    m = _ACT_RX.search(text)
    if not m:
        return text.strip(), None
    tag, attrs, rest = m.group(1), m.group(2), text[m.end():]
    end = rest.find(f"</{tag}>")
    inner = rest if end < 0 else rest[:end]
    narr = text[:m.start()].strip()
    if tag == "bash":
        return narr, {"name": "bash", "args": json.dumps({"command": inner.strip()})}
    if tag == "write":
        pm = re.search(r'path\s*=\s*"([^"]+)"', attrs) or re.search(r"path\s*=\s*'([^']+)'", attrs)
        content = inner[1:] if inner.startswith("\n") else inner
        return narr, {"name": "write_file", "args": json.dumps({"path": pm.group(1) if pm else "", "content": content})}
    return narr, {"name": "finish", "args": json.dumps({"report": inner.strip()})}


def llm_stream(cfg: dict, messages: list[dict], effort: str | None, step: int) -> dict:
    text_mode = cfg.get("protocol") == "text"
    body = {
        "model": cfg["model"], "messages": messages,
        "stream": True, "stream_options": {"include_usage": True},
        "max_tokens": cfg["max_tokens"], "temperature": 0.2,
    }
    if text_mode:
        body["stop"] = ["</bash>", "</write>", "</finish>", "<output"]
    else:
        body["tools"] = TOOLS
    if os.environ.get("XMD_DUMP"):
        with open(os.environ["XMD_DUMP"], "a") as fh:
            fh.write(json.dumps({"step": step, "body": body}, ensure_ascii=False) + "\n")
    if effort and not cfg.get("no_effort"):
        body["reasoning_effort"] = effort
    req = urllib.request.Request(
        cfg["base_url"].rstrip("/") + "/chat/completions",
        data=json.dumps(body).encode(), method="POST",
        headers={"Authorization": f"Bearer {cfg['api_key']}", "Content-Type": "application/json",
                 "Accept": "text/event-stream", "User-Agent": "xmd-lean/1.0 (+openai-compatible)"})
    try:
        resp = urllib.request.urlopen(req, timeout=180)
    except urllib.error.HTTPError as e:
        raise LLMError(e.code, e.read().decode("utf-8", "replace"))

    reasoning, content = [], []
    calls: dict[int, dict] = {}
    usage, finish = {}, None
    think_open, think_t0 = False, 0.0
    text_open = False
    last_draft = 0.0
    text_sent = 0
    draft_open = False
    plan_sent = False
    for raw in resp:
        line = raw.decode("utf-8", "replace").strip()
        if not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if payload == "[DONE]":
            break
        try:
            ch = json.loads(payload)
        except Exception:
            continue
        if ch.get("error"):
            raise LLMError(int(ch["error"].get("code") or 500) if str(ch["error"].get("code", "")).isdigit() else 500,
                           json.dumps(ch["error"]))
        if ch.get("usage"):
            usage = ch["usage"]
        for c in ch.get("choices") or []:
            d = c.get("delta") or {}
            r = d.get("reasoning_content") or d.get("reasoning")
            if r:
                if not think_open:
                    think_open, think_t0 = True, time.time()
                    emit("think_start", step=step)
                reasoning.append(r)
                emit("think_delta", step=step, text=r)
            if d.get("content"):
                if think_open:
                    think_open = False
                    emit("think_end", step=step, ms=round((time.time() - think_t0) * 1000))
                content.append(d["content"])
                if text_mode:
                    raw = "".join(content)
                    if not plan_sent:
                        pl = parse_plan(raw)
                        if pl:
                            plan_sent = True
                            emit("plan", step=step, items=pl)
                    full = strip_plan(raw)
                    m = _ACT_RX.search(full)
                    shown = full[:m.start()] if m else _PARTIAL_TAG.sub("", full)
                    new = shown[text_sent:]
                    if new:
                        if not text_open:
                            text_open = True
                            emit("text_start", step=step)
                        emit("text_delta", step=step, text=new)
                        text_sent += len(new)
                    if m:
                        tag = m.group(1)
                        nm = {"bash": "bash", "write": "write_file", "finish": "finish"}[tag]
                        now = time.time()
                        if not draft_open or now - last_draft > 0.06:
                            draft_open, last_draft = True, now
                            _, call = parse_action(full)
                            prev, body_tail = "", None
                            if call:
                                a = json.loads(call["args"])
                                prev = a.get("command") or a.get("path") or a.get("report") or ""
                                if nm == "write_file":
                                    body_tail = a.get("content", "")[-3000:]
                            extra = {"content": body_tail} if body_tail is not None else {}
                            emit("tool_draft", step=step, id=f"call_{step}", name=nm, preview=prev, **extra)
                else:
                    if not text_open:
                        text_open = True
                        emit("text_start", step=step)
                    emit("text_delta", step=step, text=d["content"])
            for tc in d.get("tool_calls") or []:
                if think_open:
                    think_open = False
                    emit("think_end", step=step, ms=round((time.time() - think_t0) * 1000))
                i = tc.get("index", 0)
                slot = calls.setdefault(i, {"id": "", "name": "", "args": ""})
                if tc.get("id"):
                    slot["id"] = tc["id"]
                fn = tc.get("function") or {}
                if fn.get("name"):
                    slot["name"] = fn["name"]
                    emit("tool_draft", step=step, id=slot["id"] or f"s{step}", name=slot["name"], preview="")
                if fn.get("arguments"):
                    slot["args"] += fn["arguments"]
                    now = time.time()
                    if now - last_draft > 0.06:
                        last_draft = now
                        emit("tool_draft", step=step, id=slot["id"] or f"s{step}", name=slot["name"],
                             preview=_partial_arg(slot["args"]))
            if c.get("finish_reason"):
                finish = c["finish_reason"]
    if think_open:
        emit("think_end", step=step, ms=round((time.time() - think_t0) * 1000))
    if text_open:
        emit("text_end", step=step)
    full = "".join(content)
    if text_mode:
        narr, call = parse_action(strip_plan(full))
        if call and finish == "stop" and call["name"] != "finish":
            pass
        return {"reasoning": "".join(reasoning), "content": full, "narration": narr,
                "calls": ([{"id": f"call_{step}", **call}] if call else []), "usage": usage, "finish": finish}
    return {"reasoning": "".join(reasoning), "content": full, "narration": full,
            "calls": [calls[k] for k in sorted(calls)], "usage": usage, "finish": finish}


def llm_call(cfg, messages, effort, step) -> dict:
    tries = 0
    while True:
        tries += 1
        try:
            return llm_stream(cfg, messages, effort, step)
        except LLMError as e:
            if e.status == 400 and "reasoning" in e.body.lower() and not cfg.get("no_effort"):
                cfg["no_effort"] = True
                emit("notice", text="Provider hakubali reasoning_effort — naendelea bila hiyo.")
                continue
            if e.status in (500, 502, 503, 504) and tries < 3:
                emit("notice", text=f"Provider amejibu {e.status} — najaribu tena ({tries}/2)…")
                time.sleep(2 * tries)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if tries < 3:
                emit("notice", text=f"Mtandao umekatika ({e}) — najaribu tena…")
                time.sleep(2 * tries)
                continue
            raise LLMError(0, str(e))


# ----------------------------------------------------------------------------
# Kuendesha amri LIVE (output inatiririka mstari kwa mstari)
# ----------------------------------------------------------------------------
def classify(cmd: str) -> str:
    c = cmd.strip()
    first = c.split()[0] if c.split() else ""
    # cat/echo zenye redirect au heredoc zinaandika faili — si kusoma
    if first in ("cat", "echo", "printf", "tee", "head", "tail") and re.search(r"(^|[^2&])>{1,2}\s*[^&\s]|<<", c):
        return "bash"
    return {
        "skill": "skill", "xmd-search": "search", "xmd-fetch": "browse", "xmd-browse": "browse",
        "xmd-check": "check", "xmd-push": "git", "xmd-deploy": "deploy", "xmd-map": "map",
        "git": "git", "cat": "read", "head": "read", "tail": "read", "ls": "list", "tree": "list",
        "curl": "check", "npm": "pkg", "pip": "pkg", "pnpm": "pkg", "yarn": "pkg",
    }.get(first, "bash")


def run_bash(cmd: str, ws: Path, call_id: str, step: int, timeout: int) -> tuple[str, int, int]:
    env = dict(os.environ)
    env["PATH"] = f"{BIN_DIR}:{env.get('PATH', '')}"
    env["XMD_SKILLS_DIR"] = str(SKILLS_DIR)
    env.setdefault("PYTHONUNBUFFERED", "1")
    t0 = time.time()
    # -c (si -lc): login shell husoma /etc/profile na KUFUTA PATH yetu -> helpers "command not found"
    full = f'export PATH="{BIN_DIR}:$PATH"\n{cmd}'
    p = subprocess.Popen(["bash", "-c", full], cwd=str(ws), stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                         env=env, start_new_session=True)
    buf: list[str] = []
    pending = ""
    last_flush = time.time()
    fd = p.stdout.fileno()
    os.set_blocking(fd, False)
    killed = False
    while True:
        r, _, _ = select.select([fd], [], [], 0.1)
        if r:
            try:
                chunk = os.read(fd, 65536)
            except BlockingIOError:
                chunk = b""
            if chunk:
                s = chunk.decode("utf-8", "replace")
                buf.append(s)
                pending += s
            elif p.poll() is not None:
                break
        if pending and (time.time() - last_flush > 0.08 or len(pending) > 4000):
            emit("exec_output", step=step, id=call_id, chunk=pending[:8000])
            pending, last_flush = "", time.time()
        if p.poll() is not None and not r:
            # soma kilichobaki
            try:
                rest = os.read(fd, 1 << 20)
                if rest:
                    s = rest.decode("utf-8", "replace")
                    buf.append(s)
                    pending += s
            except Exception:
                pass
            break
        if time.time() - t0 > timeout:
            killed = True
            try:
                os.killpg(p.pid, signal.SIGKILL)
            except Exception:
                p.kill()
            break
    if pending:
        emit("exec_output", step=step, id=call_id, chunk=pending[:8000])
    code = p.wait() if not killed else 124
    out = "".join(buf)
    if killed:
        out += f"\n[XMD: command killed after {timeout}s timeout]"
    return out, code, round((time.time() - t0) * 1000)


# ----------------------------------------------------------------------------
# Loop kuu
# ----------------------------------------------------------------------------
def obs(cfg: dict, call_id: str, step: int, text: str, code: int = 0, **extra) -> dict:
    """Tokeo la zana kwa protocol husika (tool message au <output> ya user)."""
    if cfg.get("protocol") == "text":
        m = {"role": "user", "content": f"<output step={step} exit={code}>\n{text}\n</output>", "_obs": True, "_step": step}
    else:
        m = {"role": "tool", "tool_call_id": call_id, "content": text, "_step": step}
    m.update(extra)
    return m


def norm_cmd(c: str) -> str:
    return re.sub(r"\s+", " ", c.strip())[:400]


def partial_report(state: dict, reason: str) -> str:
    done = [a for a in state.get("actions", [])][-8:]
    lines = [f"⚠️ Nimesimama: {reason}.", "", f"Hatua zilizofanyika ({state['step']}):"]
    for a in done:
        lines.append(f"- {a}")
    lines.append("")
    lines.append("Andika \"endelea\" nikuendelezee kutoka hapa (historia imehifadhiwa).")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--task", required=True)
    ap.add_argument("--state", required=True, help="faili la hali ya thread (kwa 'endelea')")
    ap.add_argument("--workspace", required=True)
    ap.add_argument("--run-id", default="")
    args = ap.parse_args()

    cfg = {
        "model": os.environ.get("XMD_MODEL", "qwen/qwen3.8-max:free"),
        "base_url": os.environ.get("XMD_BASE_URL", "https://api.xkiro.com/v1"),
        "api_key": os.environ.get("XMD_API_KEY", ""),
        "max_tokens": int(os.environ.get("XMD_MAX_TOKENS", "4000")),
        "protocol": os.environ.get("XMD_PROTOCOL", "text"),
    }
    if not cfg["api_key"]:
        emit("error", message="XMD_API_KEY haijawekwa")
        return 2
    effort = os.environ.get("XMD_EFFORT", "low")
    ws = Path(args.workspace)
    ws.mkdir(parents=True, exist_ok=True)
    out_dir = Path(os.environ.get("XMD_OUT_DIR", str(ws / ".xmd" / "out")))
    state_path = Path(args.state)

    catalog = load_catalog()
    cat_lines = "\n".join(f"  @{k}: {v.get('description', '')}" for k, v in catalog.items())

    # ---- hali (state) — kwa "endelea"
    if state_path.exists():
        state = json.loads(state_path.read_text(encoding="utf-8"))
    else:
        sysmsg = CORE.format(ws=ws, catalog=cat_lines) + (TEXT_PROTOCOL if cfg["protocol"] == "text" else "")
        state = {"messages": [{"role": "system", "content": sysmsg}], "protocol": cfg["protocol"],
                 "step": 0, "used_total": 0, "loaded_skills": [], "actions": []}

    skills, size = route(args.task, catalog)
    budget = dict(BUDGETS[size])
    if os.environ.get("XMD_BUDGET_TOKENS"):
        budget["tokens"] = int(os.environ["XMD_BUDGET_TOKENS"])
    new_skills = [s for s in skills if s not in state["loaded_skills"]]
    user_text = args.task
    if new_skills:
        blocks = "\n\n".join(f"<skill name=\"{s}\">\n{catalog[s]['body']}\n</skill>" for s in new_skills)
        user_text += "\n\n(Skills loaded for this task)\n" + blocks
        state["loaded_skills"] += new_skills
    state["messages"].append({"role": "user", "content": user_text})

    cfg["protocol"] = state.get("protocol", cfg["protocol"])
    emit("run_start", task=args.task, model=cfg["model"], size=size, budget=budget, protocol=cfg["protocol"],
         skills=skills, catalog=list(catalog.keys()), resumed=state["step"] > 0,
         effort=effort, run_id=args.run_id)
    for s in new_skills:
        emit("skill_loaded", name=s, via="router" if f"@{s}" not in args.task.lower() else "mention",
             chars=len(catalog[s]["body"]))

    used = {"prompt": 0, "completion": 0, "cached": 0, "calls": 0}
    run_steps = 0
    seen: dict[str, int] = {}
    last_err_sig, same_err = "", 0
    fails = 0
    warned80 = False
    guard_note = ""
    status = "done"
    t_run = time.time()

    def save():
        state_path.parent.mkdir(parents=True, exist_ok=True)
        state_path.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")

    while True:
        if run_steps >= budget["steps"]:
            rep = partial_report(state, f"kikomo cha hatua {budget['steps']} kimefikiwa")
            emit("guard", kind="steps", message=f"Kikomo cha hatua ({budget['steps']}) kimefikiwa.")
            emit("finish", report=rep, partial=True)
            status = "stopped"
            break
        total_used = used["prompt"] + used["completion"]
        if total_used >= budget["tokens"]:
            rep = partial_report(state, f"bajeti ya tokens {budget['tokens']:,} imeisha")
            emit("guard", kind="budget", message="Bajeti ya tokens ya kazi hii imeisha.")
            emit("finish", report=rep, partial=True)
            status = "stopped"
            break

        state["step"] += 1
        run_steps += 1
        step = state["step"]
        cur_effort = "medium" if (fails >= 2 and effort == "low") else effort
        emit("step_start", step=step, run_step=run_steps, max_steps=budget["steps"], effort=cur_effort)

        msgs = build_messages(state)
        try:
            res = llm_call(cfg, msgs, cur_effort, step)
        except LLMError as e:
            msg = str(e)
            if e.status == 429:
                msg = "Quota ya provider imeisha kwa leo (429). Kazi imesimamishwa na historia imehifadhiwa."
            emit("error", message=msg, status=e.status)
            emit("finish", report=partial_report(state, msg), partial=True)
            status = "error"
            save()
            break

        u = res["usage"] or {}
        used["prompt"] += int(u.get("prompt_tokens") or 0)
        used["completion"] += int(u.get("completion_tokens") or 0)
        used["cached"] += int(((u.get("prompt_tokens_details") or {}).get("cached_tokens")) or u.get("prompt_cache_hit_tokens") or 0)
        used["calls"] += 1
        state["used_total"] = state.get("used_total", 0) + int(u.get("total_tokens") or 0)
        emit("usage", step=step, prompt=int(u.get("prompt_tokens") or 0), completion=int(u.get("completion_tokens") or 0),
             run_prompt=used["prompt"], run_completion=used["completion"], run_cached=used["cached"],
             run_total=used["prompt"] + used["completion"], budget=budget["tokens"], thread_total=state["used_total"])

        calls = res["calls"][:1]  # hatua moja = zana moja
        text_mode = cfg["protocol"] == "text"
        if text_mode:
            body_txt = res["content"] or ""
            if calls and calls[0]["name"] != "finish":
                tag = "bash" if calls[0]["name"] == "bash" else "write"
                if f"</{tag}>" not in body_txt:
                    body_txt += f"</{tag}>"
            asst = {"role": "assistant", "content": body_txt}
        else:
            asst = {"role": "assistant", "content": res["content"] or ""}
        if calls and not text_mode:
            c = calls[0]
            if not c["id"]:
                c["id"] = f"call_{step}"
            asst["tool_calls"] = [{"id": c["id"], "type": "function",
                                   "function": {"name": c["name"], "arguments": c["args"] or "{}"}}]
        state["messages"].append(asst)

        if not calls:
            # Hakuna zana: model imejibu kwa maneno -> tunaichukulia kama ripoti ya mwisho
            emit("finish", report=(res.get("narration") or res["content"] or "(hakuna jibu)"), partial=False)
            save()
            break

        c = calls[0]
        try:
            a = json.loads(c["args"] or "{}")
        except Exception:
            a = {}
            bad = f"Invalid JSON arguments for {c['name']}. Send valid JSON."
            state["messages"].append(obs(cfg, c["id"], step, bad, 1))
            emit("exec_start", step=step, id=c["id"], tool=c["name"], kind="error", command=c["args"][:300])
            emit("exec_end", step=step, id=c["id"], exit=1, ms=0, chars=len(bad), lines=1, truncated=False,
                 summary="JSON mbovu")
            fails += 1
            save()
            continue

        if c["name"] == "finish":
            rep = str(a.get("report", "")).strip() or "(ripoti tupu)"
            if cfg["protocol"] != "text":
                state["messages"].append(obs(cfg, c["id"], step, "ok"))
            emit("finish", report=rep, partial=False)
            save()
            break

        if c["name"] == "write_file":
            path = str(a.get("path", "")).strip()
            content = str(a.get("content", ""))
            target = (ws / path) if not os.path.isabs(path) else Path(path)
            existed = target.exists()
            old_text = target.read_text(errors="replace") if existed else ""
            old_lines = len(old_text.splitlines())
            emit("exec_start", step=step, id=c["id"], tool="write_file", kind="write", path=str(target),
                 lines=len(content.splitlines()), preview=content[:6000], existed=existed)
            t0 = time.time()
            try:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content, encoding="utf-8")
                out, code = f"Wrote {len(content.splitlines())} lines ({len(content)} chars) to {target}", 0
            except Exception as e:
                out, code = f"ERROR writing {target}: {e}", 1
            ms = round((time.time() - t0) * 1000)
            state["actions"].append(f"write_file {path} ({len(content.splitlines())} mistari)")
            state["messages"].append(obs(cfg, c["id"], step, out + guard_note, code))
            guard_note = ""
            added, removed, diff_txt = len(content.splitlines()), old_lines, None
            if existed:
                dl = list(difflib.unified_diff(old_text.splitlines(), content.splitlines(), lineterm="", n=2))[2:]
                added = sum(1 for x in dl if x.startswith("+"))
                removed = sum(1 for x in dl if x.startswith("-"))
                diff_txt = "\n".join(dl)[:6000]
            emit("exec_end", step=step, id=c["id"], exit=code, ms=ms, chars=len(content),
                 lines=len(content.splitlines()), truncated=False, added=added,
                 removed=removed, summary=out, diff=diff_txt)
            fails = fails + 1 if code else 0
            save()
            continue

        if c["name"] != "bash":
            msg = f"Unknown tool {c['name']}. Use bash, write_file or finish."
            state["messages"].append(obs(cfg, c["id"], step, msg, 1))
            emit("notice", text=msg)
            save()
            continue

        cmd = str(a.get("command", "")).strip()
        kind = classify(cmd)
        emit("exec_start", step=step, id=c["id"], tool="bash", kind=kind, command=cmd)
        key = norm_cmd(cmd)
        seen[key] = seen.get(key, 0) + 1
        # search ina retries zake ndani ya xmd-search (inaweza kuchukua ~5min wakati instance
        # ya Render inaamka) → timeout ya default ya search ni 360s; nyingine 180s
        cmd_to = int(os.environ.get("XMD_CMD_TIMEOUT") or (360 if kind == "search" else 180))
        out, code, ms = run_bash(cmd, ws, c["id"], step, cmd_to)
        shaped, truncated = shape(out, out_dir / f"{args.run_id or 'run'}-{step}.txt")
        is_skill = kind == "skill" and code == 0
        if is_skill:
            nm = cmd.split()[1] if len(cmd.split()) > 1 else "?"
            if nm not in state["loaded_skills"]:
                state["loaded_skills"].append(nm)
            emit("skill_loaded", name=nm, via="agent", chars=len(out))
        note = ""
        if seen[key] >= 3:
            note = "\n[XMD GUARD] You ran this exact command 3 times. Change approach or call finish."
            emit("guard", kind="loop", message="Amri ile ile imerudiwa mara 3 — agent ameonywa abadilishe njia.")
        if code != 0:
            sig = hashlib.md5(out[-400:].encode()).hexdigest()
            same_err = same_err + 1 if sig == last_err_sig else 1
            last_err_sig = sig
            fails += 1
        else:
            same_err, fails = 0, 0
        total_used = used["prompt"] + used["completion"]
        if not warned80 and total_used >= 0.8 * budget["tokens"]:
            warned80 = True
            note += "\n[XMD GUARD] 80% of the token budget is used. Finish now or report where you are."
            emit("guard", kind="budget80", message="80% ya bajeti imetumika — agent ameambiwa amalize.")
        if run_steps == budget["steps"] - 1:
            note += "\n[XMD GUARD] Last step: call finish now."
        body_out = (shaped or "(no output)") + ("" if cfg["protocol"] == "text" else f"\n[exit {code}]") + note
        tool_msg = obs(cfg, c["id"], step, body_out, code, _file=str(out_dir / f"{args.run_id or 'run'}-{step}.txt"))
        if is_skill:
            tool_msg["_keep"] = True
        state["messages"].append(tool_msg)
        state["actions"].append(f"$ {cmd[:120]}" + (f"  → exit {code}" if code else ""))
        emit("exec_end", step=step, id=c["id"], exit=code, ms=ms, chars=len(out),
             lines=len(out.splitlines()), truncated=truncated, file=str(out_dir / f"{args.run_id or 'run'}-{step}.txt"))
        save()
        if same_err >= 3:
            rep = partial_report(state, "kosa lile lile limerudia mara 3")
            emit("guard", kind="stuck", message="Kosa lile lile mara 3 — nimesimamisha ili kuokoa tokens.")
            emit("finish", report=rep, partial=True)
            status = "stuck"
            break

    save()
    emit("run_end", status=status, steps=run_steps, ms=round((time.time() - t_run) * 1000),
         prompt=used["prompt"], completion=used["completion"], cached=used["cached"],
         total=used["prompt"] + used["completion"], calls=used["calls"], thread_total=state.get("used_total", 0))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        emit("run_end", status="stopped", steps=0, ms=0, prompt=0, completion=0, cached=0, total=0, calls=0)
        sys.exit(130)
