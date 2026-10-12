# PROGRESS.md — Utekelezaji wa maelezo.md (milestones system)

Kila awamu: amri halisi → matokeo halisi. Hakuna "inafanya kazi" bila output.
Repo: professor-xmd-company @ main.

---

## P0 — Uandishi + ramani + makosa msingi (2026-10-12)

**Kazi:** kusoma maelezo.md yote (706 lines), kuchora FLOW-MAP, kutatua maswali ya §17, kurekebisha makosa #1/#3 kwa "jaribio lililoshindwa kwanza".

**Viuandishi:**
- `docs/FLOW-MAP.md` — mtiririko uliopo + majibu ya [KUTHIBITISHA] 1–8.
- `QUESTIONS.md` — Q-001 (CU backend: claude vs oh_bridge), Q-002 (harness push/deploy), Q-003 (UI milestone variant).

**Majaribio mapya (kwanza FAILED, kisha PASSED baada ya fix):**
- `src/lib/cu/engine.terminal.test.ts` — 6 tests za terminal states (kosa #1).
- `src/lib/cu/engine.planGuard.test.ts` — 3 tests za guard_failed (kosa #3).

**Amri + matokeo (RED):**
```
$ ./node_modules/.bin/vitest run src/lib/cu/engine.terminal.test.ts src/lib/cu/engine.planGuard.test.ts
 FAIL  src/lib/cu/engine.terminal.test.ts  (expected undefined to be 'BLOCKED' ...)
 Tests  6 failed (6)
```

**Mabadiliko (engine.ts):** `CuTerminal` type; finishComputer: mapping done→COMPLETED_VERIFIED/partial→PARTIAL/stuck→STUCK/blocked→BLOCKED/other→ERROR; `ok = COMPLETED_VERIFIED && report`; pauseComputer inaweka PAUSED_QUOTA; chip + hydrate + persist status (`finale_stuck` n.k.); planMarkdown→`blocked/blockReason` kwa `guard_failed`; startComputerPhase inakataza mpango ulioblocked.

**Amri + matokeo (GREEN):**
```
$ ./node_modules/.bin/vitest run src/lib/cu/engine.terminal.test.ts src/lib/cu/engine.planGuard.test.ts
 Tests  9 passed (9)
$ ./node_modules/.bin/vitest run
 Test Files  20 passed (20)  ·  Tests  192 passed (192)
```

**Kukubalika (14.P0):** ✅ FLOW-MAP iko, bugs #1/#3 zimeziba na tests kupita, hakuna regression (192/192), hakuna kipengele kipya kwenye run() bado.

---

## P1 — Module `src/lib/milestone` (types/schemas/state/ocb/rounds/checks)

_(inaendelea...)_
**Matokeo P1 (kigezo):**
```
$ ./node_modules/.bin/vitest run src/lib/milestone
 ✓ schemas.test.ts (28) ✓ state.test.ts (12) ✓ ocb.test.ts (23 incl. 21 snapshots)
 ✓ rounds.test.ts (16) ✓ sim.test.ts (3 — simulation kamili: 3 milestones, trigger idempotent, cap, visionDegraded)
 Test Files 5 passed · Tests 82 passed
$ ./node_modules/.bin/vitest run   ← suite nzima ya repo
 Tests  274 passed (274)   (192 za awali + 82 za milestones, regression sifuri)
```
**P1 IMEFIKA KIGEZO:** validators halali/batili ✅ · mabadiliko ya hali halali/haramu ✅ · OCB snapshot kila hatua×jukumu ✅ · simulation kamili fake-LLM inapita ✅.
---

## P2 — Ramani ya milestones (generator + host + UI strip) · na P8 ya awali (judge chain)

**Kazi:** `mapGen.ts` (3 retries + fallback), `broker/judge.ts` (darasa jipya judge: Flash→XKiro→Flash-lite, thinking-on, visionDegraded, SIGN-OFF wait 10.3.b), `broker.ts` laneFilter (additive), `milestone/host.ts` (enable gate + chip resume + events), `types.ts/adapter.ts/StageRail.tsx` (variant `milestone` + strip ndogo), uunganishaji kwenye run() (baada ya agenda_created, kufunga na chip, persist).

**Amri + matokeo:**
```
$ ./node_modules/.bin/vitest run src/lib/milestone/mapGen.test.ts      → 13 passed (N=10/15/20 halali · bfali 6 inakataliwa kwa sababu halisi · fallback baada ya 3)
$ ./node_modules/.bin/vitest run src/lib/broker/judge.test.ts         → 10 passed (uteuzi flash→xkiro→lite, rekodi kila call, requireVision → WAIT, effort=high flash pekee)
$ ./node_modules/.bin/vitest run src/lib/milestone/host.test.ts       → 6 passed (fresh/resume/plan-skip/env-off/events)
$ ./node_modules/.bin/tsc --noEmit −p tsconfig.json                   → clean (errors 0)
$ ./node_modules/.bin/vitest run                                      → 303 passed (303) — regression sifuri
```
**Kukubalika (14.P2):** ✅ ramani halali N=10/15/20 · batili 6 zinakataliwa · fallback ×3 · hifadhi chip + persist · UI events + strip ndogo ya hali.
**Kukubalika (14.P8 sehemu — darasa + mlolongo + rekodi + vision-wait):** ✅ (tests za uteuzi wa ngazi zote; SIGN-OFF haipiti visionDegraded; lanesUsed records kila call kupitia rec; utekelezaji wa lanesUsed kwenye orchestration mahutaji P3 kuunganisha).

---

## P3 — Orchestration core + boardRunner wiring (2026-10-12, turn hii)

**Kigezo cha kukubalika (maelezo §14.P3):**
1. `runMilestonePipeline` mock tests: **7/7** (happy path, TRIGGER-idempotent, guard-HAUJENGWA, PAUSED_QUOTA, NO-OP diagnosis → escalation, kikomo 10 → CAP_REACHED/INHERITED, fallback map hati).
2. Engine patch: `CuPhaseOpts{planOverride,phaseLabel,extraBrief}` + `beginNewCuPhase()` — token/chip mpya PER milestone/round; `startComputerPhase(runner,hooks,opts)` inatumia planOverride (bypass planDocFor).
3. Modules: `planGen.ts` (mpango + Acceptance Checks + Data Guard; 3 majaribio → HAUJENGWA/BLOCKED), `startPack.ts` (kufungia mpakati CO/ledger/repo/defects/OCB-C), `orchestrate.ts` (PLAN→BUILD→EVIDENCE→R0→raundi 1..10→CAP/SIGN-OFF; NO-OP diagnosis NOT_ATTEMPTED/ATTEMPTED_WRONG/TECH_BLOCKER; escalation concrete/pair_patch/redecide; ensure absolute sequencing), `reviewLLM.ts` (judgeChat-real deps; JSON validators-retry ×3).
4. **boardRunner wiring:** roster-gate (§4.3: `ownerAgents ∩ rosterForAgenda` → pm-fallback + blog ya roster), OCB injection (§6.1.2: kila prompt ya owner hupata OCB ya agenda), old-CU-flow routing (`!msRun` kwenye quota-resume + finale CU), trigger ya milestones host (idempotent: `finale.milestonesDone`, resumed chips), `hostRun.ts` (milestone baada ya nyingine, PAUSED haiturudishi).
5. **Rekebisho la hasara:** `ocb.ts` wa P1 ulipotezwa kwa ajali katika segment ilyopita — umeundwa upya KWA UHALIFU kutoka snapshots zilizohifadhiwa (745-line snap = aina ya ukweli wa byte-exact); 25/25 snapshot tests GREEN tena bila kubadilisha snap.

**Command output (halisi):**
```
$ vitest run src/lib/milestone/orchestrate.test.ts
 Test Files  1 passed (1) · Tests 7 passed (7)
$ vitest run src/lib/milestone/ocb.test.ts
 Tests 25 passed (25)  ← snapshots zote za P1 zimekidhi byte-exact
$ vitest run (full)
 Test Files 29 passed (29) · Tests 310 passed (310)
$ tsc --noEmit -p tsconfig.json → CLEAN (0 errors)
```
**Bugs zilizorekebishwa wakati wa P3 (real):** typo `obcC↔ocbC`; hesabu ya attempts iliokatanishwa (`pendingCosFor`=attempt+1, `inFlightCosFor`=IN_FIX+attempt) — inawezesha kupungua CO mpya kwa raundi mpya ipasavyo; escalations hazisisimami kabla ya kuzalisha CO inayofuata; receipts-verification haiongezi history part bila sababu.
