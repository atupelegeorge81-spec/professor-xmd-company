"""cu/oh_util.py — R51 · utilities za oh_bridge (stdlib TU — testable local, bila SDK).

Yaliyomo:
  • build_objective  — objective ya run_goal (judge contract) kutoka plan.md
  • classify_fail    — exception → kind (rate_limited/server_error/timeout/…)+retry_after
  • extract_usage    — token-usage kutoka LLMResponse ya SDK (defensive — schema inabadilika)
  • shots_pending    — screenshot mpya kutoka registry ya shotlaw (bado hazijatumiwa UI)
  • read_shot_b64    — faili ya picha → base64 (≤ cap)
  • first_words      — muhtasari salama wa action/observation kwa events
"""
from __future__ import annotations

import base64
import re

import shotlaw

# --------------------------------------------------------------------- objective ya judge
STEP_RX = re.compile(r"^#{1,4}\s*(?:Step|Hatua)\s*(\d+)\s*[—\-:.]\s*(.+)$", re.I | re.M)
VERIFY_RX = re.compile(r"\*\*Verification:?\*\*\s*`?([^`\n]+)`?", re.I)


def _extract_steps(plan_md: str) -> list[str]:
    out = []
    for m in STEP_RX.finditer(plan_md or ""):
        out.append(f"Step {m.group(1)} — {m.group(2).strip()}")
    return out


def _extract_verifications(plan_md: str) -> list[str]:
    return [m.group(1).strip() for m in VERIFY_RX.finditer(plan_md or "")]


def build_objective(title: str, plan_md: str, evidence_dir: str = ".xmd/shots") -> str:
    """Objective ya run_goal: judge lazima athibitishe USHAHIDI, si madai.

    Inajumuisha steps zote + Verification commands VIVYO HIVYO (verbatim) — ndiyo
    sababu hatucheat: judge anakagua transcript kwa orodha hii halisi."""
    steps = _extract_steps(plan_md)
    vers = _extract_verifications(plan_md)
    parts = [
        f'OBJECTIVE YA MKATABA: "{title}" — mpango umehifadhiwa kwenye plan.md umetekelezwa '
        'KIKAMILIFU, kwa ushahidi halisi.',
        '',
        'HATUA ZOTE ZINAPASWA KUWA ZIMEKAMILIKA (kwa mpangilio wa plan.md):',
    ]
    if steps:
        parts += [f"  {i+1}. {s}" for i, s in enumerate(steps)]
    else:
        parts.append("  (plan.md haina vyeti vya hatua vilivyoonekana — kagua ripoti ya mwisho).")
    if vers:
        parts += ['', 'VERIFICATION COMMANDS ZA KILA HATUA (zinapaswa kuwa zimeendeshwa na KUPITA):']
        parts += [f"  • `{v}`" for v in vers]
    parts += [
        '',
        'VIPIMA VYAKO (judge — mark COMPLETE tu vipimo hivi vikithibitishwa kwenye transcript):',
        '  a) Kila hatua hapo juu ina USHAHIDI halisi kwenye transcript: command output yenye '
        '     exit 0, faili lililoandikwa na kusomwa, au assertion iliyopita — SI tamko la agent.',
        '  b) Verification commands zimeendeshwa baada ya kazi husika, na zimepita.',
        '  c) Ikiwa mpango ulitaka deliverable (website/app), kuna ushahidi kuwa INAFANYA KAZI '
        '     (server ilisimama, ukurasa umefunguliwa, content halisi imeonekana).',
        f'  d) Screenshots za deliverable zipo chini ya {evidence_dir}/ (shotlaw registry).',
        '  e) Ripoti ya mwisho ya Kiswahili imeandikwa (live link/GitHub kama zimetakiwa).',
        '',
        'Mark INCOMPLETE ikikosa hata kimoja — kwa sababu agent hana ruhusa ya kumaliza kwa madai.',
    ]
    return "\n".join(parts)


# --------------------------------------------------------------------- makosa → lane kind
RETRY_AFTER_RX = re.compile(r"retry[- ]after[=: ]+(\d+(?:\.\d+)?)", re.I)


def _status_of(exc: BaseException) -> int | None:
    for attr in ("status_code", "status", "code"):
        v = getattr(exc, attr, None)
        if isinstance(v, int) and 100 <= v < 600:
            return v
        if isinstance(v, str) and v.isdigit() and 100 <= int(v) < 600:
            return int(v)
    resp = getattr(exc, "response", None)
    if resp is not None:
        v = getattr(resp, "status_code", None)
        if isinstance(v, int):
            return v
    return None


def _retry_after_of(exc: BaseException) -> float | None:
    headers = getattr(getattr(exc, "response", None), "headers", None) or {}
    try:
        if hasattr(headers, "get"):
            v = headers.get("retry-after") or headers.get("Retry-After")
            if v:
                return float(v)
    except (TypeError, ValueError):
        pass
    m = RETRY_AFTER_RX.search(str(exc))
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            return None
    return None


def classify_fail(exc: BaseException) -> tuple[str, float | None]:
    """kind zinazoendana na lanes.note_fail: rate_limited | server_error | timeout |
    pool_busy | empty. 401/403 → server_error (lane icheze pwa muda mrefu)."""
    ra = _retry_after_of(exc)
    st = _status_of(exc)
    if st == 429:
        return "rate_limited", ra
    if st is not None and 500 <= st < 600:
        return "server_error", ra
    if st in (401, 403):
        return "server_error", ra
    txt = f"{type(exc).__name__}: {exc}".lower()
    if "timed out" in txt or "timeout" in txt or "deadline" in txt:
        return "timeout", ra
    if "connection" in txt or "dns" in txt or "unreachable" in txt:
        return "server_error", ra
    if "rate limit" in txt or "too many" in txt:
        return "rate_limited", ra
    if "empty" in txt or "no content" in txt:
        return "empty", ra
    return "server_error", ra


# --------------------------------------------------------------------- usage ya SDK
def _num(v) -> int:
    try:
        return int(v or 0)
    except (TypeError, ValueError):
        return 0


def extract_usage(resp) -> tuple[int, int]:
    """(prompt, completion) kutoka LLMResponse — schema za SDK hubadilika; defensive.

    Njia zinazojaribiwa kwa mpangilio:
      resp.metrics.accumulated_token_usage / .token_usage → prompt_tokens/completion_tokens
      resp.raw_response (OpenAI-shaped) → usage.prompt_tokens/completion_tokens
    """
    metrics = getattr(resp, "metrics", None)
    for holder in (metrics, getattr(metrics, "accumulated_token_usage", None),
                   getattr(metrics, "token_usage", None)):
        if holder is None:
            continue
        p = getattr(holder, "prompt_tokens", None)
        c = getattr(holder, "completion_tokens", None)
        if p is None and isinstance(holder, dict):
            p, c = holder.get("prompt_tokens"), holder.get("completion_tokens")
        if p is None:
            p = getattr(holder, "input_tokens", None) or (holder.get("input_tokens") if isinstance(holder, dict) else None)
        if c is None:
            c = getattr(holder, "output_tokens", None) or (holder.get("output_tokens") if isinstance(holder, dict) else None)
        if p is not None or c is not None:
            return _num(p), _num(c)
    raw = getattr(resp, "raw_response", None)
    usage = getattr(raw, "usage", None)
    if usage is None and isinstance(raw, dict):
        usage = raw.get("usage")
    if usage is not None:
        if isinstance(usage, dict):
            return _num(usage.get("prompt_tokens")), _num(usage.get("completion_tokens"))
        return _num(getattr(usage, "prompt_tokens", None)), _num(getattr(usage, "completion_tokens", None))
    return 0, 0


# --------------------------------------------------------------------- screenshots (shotlaw)
def shots_pending(ws: str, emitted: set[str]) -> list[dict]:
    """Registry → records zilizo bado hazijatumwa (zina faili halisi disk)."""
    import os
    reg = shotlaw.load(ws)
    out = []
    for rec in shotlaw.pending(reg, emitted):
        p = rec.get("path") or ""
        full = os.path.join(ws, p)
        if p and os.path.isfile(full):
            rec2 = dict(rec)
            rec2["abs"] = full
            out.append(rec2)
    return out


def read_shot_b64(path: str, cap: int = 4 * 1024 * 1024) -> str | None:
    import os
    try:
        if os.path.getsize(path) > cap:
            return None
        with open(path, "rb") as fh:
            return base64.b64encode(fh.read()).decode()
    except OSError:
        return None


# --------------------------------------------------------------------- muhtasari salama
def first_words(text: str, limit: int = 180) -> str:
    t = re.sub(r"\s+", " ", (text or "")).strip()
    return t[:limit]


def action_command(action) -> str:
    """Amri/path ya action kwa exec chip — kutoka fields za kawaida za OpenHands."""
    for attr in ("command", "path", "file_path", "url", "query"):
        v = getattr(action, attr, None)
        if isinstance(v, str) and v.strip():
            return v.strip()[:400]
    s = str(action)
    return first_words(s, 400)
