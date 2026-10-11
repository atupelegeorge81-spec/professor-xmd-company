"""cu/oh_router.py — R51 · Mungano wa MECHANISM (SDK RouterLLM) na POLICY (lanes.py).

Native-first (sheria ya CEO): OpenHands SDK ina router tayari — WANAOITUMIA VILIVYO.
  • `RouterLLM.completion` inaita `select_llm(messages)` halafu inadelegate kila kitu
    (tools, streaming, security-risk) kwa LLM iliyochaguliwa — hicho KINACHOBaki SDK 100%.
  • Tunachojenga ni policy tu (quotas/cooldowns/meters zetu) + retry-loop ya lanes —
    SDK haina hizo; model_validator yao inasema wazi: "Subclasses should implement
    select_llm()".

Architecture:
  LaneRouterCore — PURE (stdlib; testable local): pick/acquire/success/failure juu ya
      LanePool(s) — main kwanza, dharura ikipaswa; kusubiri hadi WAIT_HARD_CAP_S halafu
      AllLanesDead (kosa la kilele pekee).
  LaneRouter(RandomRouter) — glue: completion() yenye metering + retry; select_llm()
      ina delegate kwa core (inatumika pia na paths zozote za SDK zinazomuuliza router
      jina — tukio la kujitenga).
"""
from __future__ import annotations

import time

import lanes
from oh_util import classify_fail, extract_usage


class LaneRouterCore:
    """Policy core: inachagua lane, inapima matumizi, inasubiri kwa busara.

    `now`/`sleep` ni injectable — testi zinatumia saa bandia (fake time, bila network).
    """

    def __init__(self, main_pool: "lanes.LanePool", dharura_pool: "lanes.LanePool | None" = None,
                 now=time.time, sleep=time.sleep, usage_cb=None, event_cb=None,
                 wait_cap: float = lanes.WAIT_HARD_CAP_S):
        self.pools = [p for p in (main_pool, dharura_pool) if p is not None]
        self._owner = {l.lid: p for p in self.pools for l in p.lanes}
        self.now = now
        self.sleep = sleep
        self.usage_cb = usage_cb      # (lane, prompt_toks, completion_toks) — baada ya OK
        self.event_cb = event_cb      # (note: str) — tukio la kupendeza kwa UI (waiting/switch)
        self.wait_cap = wait_cap
        self.prompt_total = 0
        self.completion_total = 0
        self.fail_total = 0

    # ---- uchaguzi ----
    def pick(self, t: float | None = None) -> "lanes.Lane | None":
        for p in self.pools:
            lane = p.pick(t)
            if lane is not None:
                return lane
        return None

    def _wait_seconds(self, t: float) -> float:
        waits = [p.wait_seconds(t) for p in self.pools]
        waits = [w for w in waits if w is not None]
        return min(waits) if waits else self.wait_cap + 1

    def acquire(self) -> "lanes.Lane":
        """Lane eligible — ikikosekana: subiri (chunks ≤30s) hadi cap; kisha AllLanesDead."""
        wait_so_far = 0.0
        noted_wait = False
        while True:
            t = self.now()
            lane = self.pick(t)
            if lane is not None:
                self._owner[lane.lid].note_start(lane, t)
                return lane
            w = self._wait_seconds(t)
            if w <= 0:
                # race ya eligibility — jaribu tena mara moja
                continue
            if wait_so_far + w > self.wait_cap:
                raise lanes.AllLanesDead(
                    f"lanes zote zimeime zaidi ya cap ({self.wait_cap:.0f}s) — "
                    f"pools: {[p.tier for p in self.pools]}")
            chunk = min(w, 30.0, self.wait_cap - wait_so_far)
            if not noted_wait and self.event_cb:
                self.event_cb(f"⏳ lanes zote zimejaa — kusubiri ~{w:.0f}s (cap {self.wait_cap:.0f}s)")
                noted_wait = True
            self.sleep(chunk)
            wait_so_far += chunk

    # ---- matokeo ----
    def success(self, lane: "lanes.Lane", ms: float, resp=None) -> tuple[int, int]:
        pt, ct = extract_usage(resp) if resp is not None else (0, 0)
        self._owner[lane.lid].note_ok(lane, ms, pt, ct, self.now())
        self.prompt_total += pt
        self.completion_total += ct
        if self.usage_cb:
            try:
                self.usage_cb(lane, pt, ct)
            except Exception:
                pass
        return pt, ct

    def failure(self, lane: "lanes.Lane", exc: BaseException) -> tuple[str, float]:
        kind, ra = classify_fail(exc)
        cd = self._owner[lane.lid].note_fail(lane, kind, ra, self.now())
        self.fail_total += 1
        if self.event_cb:
            try:
                self.event_cb(f"↪ lane {lane.model[:40]} ({kind}) — cooldown {cd:.0f}s; nabadili lane")
            except Exception:
                pass
        return kind, cd

    def usage_totals(self) -> tuple[int, int]:
        return self.prompt_total, self.completion_total


# ================================================================ glue ya SDK (sandbox tu)
def make_router(core: LaneRouterCore, llms_by_lid: dict, event_cb=None):
    """Jenga LaneRouter ya SDK iliyounganishwa na core.

    LLM instances zinatengenezwa na caller (bridge) — faili hii haiimport SDK kwa
    module-level: DEFAULT ni ku-import hapa ndani (local tests haziihitaji).
    """
    from openhands.sdk.llm.router import RandomRouter  # SDK ya sandbox (v1.46+)
    from openhands.sdk.llm import Message  # noqa: F401 — typings za select_llm

    from pydantic import ConfigDict
    from typing import Any

    class LaneRouter(RandomRouter):
        model_config = ConfigDict(arbitrary_types_allowed=True)
        core: Any = None

        def select_llm(self, messages) -> str:  # no SDK-side randomness — policy yetu
            lane = self.core.acquire()
            return lane.lid

        def completion(self, messages, tools=None, add_security_risk_prediction=False,
                       on_token=None, call_context=None, **kwargs):
            # Loop ya lanes: kosa kwa lane moja = retry kwenye nyingine (policy), si kosa
            # kwa agent. Metering kamili (rpm/rpd/cooldowns kwa lanes.py).
            while True:  # acquire() ina cap yake — loop si ya milele
                lane = self.core.acquire()
                llm = self.llms_for_routing[lane.lid]
                t0 = time.monotonic()
                try:
                    resp = llm.completion(
                        messages=messages, tools=tools,
                        add_security_risk_prediction=add_security_risk_prediction,
                        on_token=on_token, call_context=call_context, **kwargs)
                except Exception as e:
                    self.core.failure(lane, e)
                    continue
                ms = (time.monotonic() - t0) * 1000.0
                self.core.success(lane, ms, resp)
                self.active_llm = llm
                return resp

    router = LaneRouter(llms_for_routing=llms_by_lid)
    router.core = core
    if event_cb:
        core.event_cb = event_cb
    return router
