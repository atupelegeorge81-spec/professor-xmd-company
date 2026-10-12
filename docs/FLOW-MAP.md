# FLOW-MAP — Ramani ya mtiririko uliopo (P0, 2026-10-12)

Andiko la P0 la maelezo.md. Chanzo: kusoma code halisi (si kukisia). Namba za mistari = za wakati huu.

## 1. Mtiririko mkuu uliopo (run ya Board, code mode)

`startRun()` (boardRunner.ts:225) → `startLoop()` → `run()` (447–3779):

1. **Title** (~1126-1144): Optimus (lane ya kawaida) anaandika jina — persist `title_created`.
2. **Agenda** (~1147-1150): `generateAgenda(pmClient("agenda","normal",true), pm.model, runner.project)` kutoka `src/lib/agenda.ts`. Kisha loop: `for (const item of agenda)` (1460).
3. **Kwa kila agenda** (1460–~2520): evidence-gate search → `createDeliberation` (R12) yenye owners/observers → zamu za majadiliano `HARD_TURNS` → R37 itifaki ya kufunga (2033-2144: consensus → kura ya mwisho → rough → fallback → defer) → ledger (`saveLedgerEntry`) → mini-report (`writeMiniReport` → `saveMiniReport` collection; ledger inapata pointer) → `runner.doneIdx += item.index` (2499) → persist.
4. **Mpango Kazi** (~3177-3330): `assemblePlanDocument` (workPlan.ts) kutoka mini-reports + ledger + facts; validators + **Data Guard** (`guardOf`) — matokeo: `saveProjectPlan({status: planHits.length ? "guard_failed" : "active"})` (3306).
5. **Ripoti ya Board** (~3336-3650): report sections zinazotengenezwa kwa LLM + repair loop.
6. **Computer** (~1108 patika ya resume, ~3733 normal): `startComputerPhase(runner, cuHooks)` (engine.ts). Phase moja TU mwishoni. `finishComputer` (engine.ts:1207) — kwa sasa `ok = !!cu.report && status !== "error"`.
7. **Persistence**: `persist(status, title)` (~532) — Appwrite collection (sessions); chips fiche zinabeba hali: `__professor_xmd_resume_state__` (agenda/doneIdx/mode/finale), brief, facts, `cuChipItemOf` (CU state), usage chip.
8. **SSE**: `attach()/streamRunner()` (200-225) — BoardEvent (types.ts:45) → `/api/boardroom/attach`. UI: `src/components/board/BoardRoom.tsx` (+ BoardLive/stage).

## 2. Majibu ya maswali ya [KUTHIBITISHA] (sehemu 17 ya maelezo.md)

1. **Wahusika na majukumu halisi (`agents.ts`)** — ✅ IMETHIBITISHWA:
   `pm`=Optimus (Project Manager), `designer`=**Ultron** (UI/UX Designer), `frontend`=**Vextron** (Frontend Engineer), `backend`=**Megatron** (Backend & DB Engineer), `qa`=**Cybertron** (QA & DevOps Engineer). Kwa hiyo: wakaguzi wa `visual` = Ultron+Vextron (kama ilivyokisiwa); Cybertron yuko kwa `technical`/qa.
2. **Je agenda zinaweza kuongezwa katikati ya run?** — ✅ **HAPANA.** `runner.agenda` huwekwa mara moja (~1150) kutoka `generateAgenda`; hakuna code inayo-append katikati (imekaguliwa kwa `grep agenda.push|insert|splice` — ni tupu kwenye mtiririko mkuu). Sheria ya 4.2(7) ("agenda zikiongezwa katikati") haitatumika sasa hivi; ramani ya milestones haihahitaji re-gen katikati ya run. (Ikiongezwa siku zijazo: andika upya ramani ya zilizobaki pekee.)
3. **Je XKiro/Flash-lite zinapokea picha kupitia broker/brain?** — ✅ **HAPANA, kwa namna yoyote.** `grep -r "image_url|inline_data|base64" src/lib/broker src/lib/chat src/lib/brain` = **tupu**. Pipeline ya Board haitumii content-arrays (picha) kabisa — ni maandishi tu. Kwa hiyo P8 itaongeza ujumbe wenye `image_url` kwa lanes zenye uwezo (Gemini Flash — openai-compat inaunga mkono vision format hii), na fallback ya **image digest** (10.3) lane ya mbadala isipoona. `visionDegraded` itatumika kama mlolongo unapoanguka chini ya Flash.
4. **Je `zod` ipo kwenye repo?** — ✅ **HAPANA** (package.json haina zod). Tutumia **validators za mkono** (kama maelezo.md inavyoruhusu, sehemu 5).
5. **Wapi pa kuongeza matukio ya milestone/raundi bila kuvunja UI?** — `src/lib/types.ts:45` (BoardEvent union) ndiyo mahali pekee pa kusanidi matukio; UI inasoma `BoardEvent` kupitia SSE (`/api/boardroom/attach`) na kuyachora kwenye `components/board/*`. Ongeza variant mpya (mfano `{type:"milestone"}`) — UI inayoshindwa kuitambua variant haitavunjika (switch yake ina default). **Uamuzi (P2):** variant moja `milestone` yenye `{milestoneId,title,status,round,mode}` + paint dogo ya hali; mageluni yenye kupimwa.
6. **Je sandbox ya E2B inaweza kudumu kati ya milestones?** — ✅ **NDIYO, mradi runner hai.** engine.ts: `getSandbox(cu)` ina-hold `cu.sandbox` duniani; heartbeat `setTimeout(60dk)` kila dakika inaionyesha khai; liveness/watchdog zinashughulikia kufa kwake (kotstate mpya + mirror restore). Muda wake wa maisha: E2B free sandbox ina cap (~saa kadhaa/juu ya `setTimeout` yetu), mirroring (`cu_files`) inarudisha faili. Awamu nyingi (milestone × raundi) → kila awamu: hb imeshika; mirror ndiyo insurer. `buildResumeNote` ni orodha ya amri 12 za mwisho (si hali iliyothibitishwa) — kubadilishwa na MilestoneStartPack kama maelezo inavyosema.
7. **`miniReport` iko wapi na inapokea nini?** — `src/lib/miniReport.ts` (`writeMiniReport` — inajenga kwa LLM kutoka MiniInput: agendaIndex/item/decision/consensus/owners/codeWriters/talk/observers/objection/priorTries → {detail,constraints,tradeOff,llm}). Hifadhi: `src/lib/server/miniReports.ts` (`saveMiniReport` collection + `saveLedgerEntry` pointer `MINI_LEDGER_POINTER`); `miniDetailsMap`, `miniDetailOf` (boardRuner) husoma kuanzia collection → ledger fallback.
8. **Je Playwright inapatikana ndani ya sandbox ya Computer?** — ✅ **NDIYO** (templeti `professor-xmd-browser-v3`: `~/.cache/ms-playwright/chromium-*`, + python playwright kwenye `/code/openhands-venv` — imethibitishwa R51). **Uamuzi:** harness ya ushahidi (P4) haitaendesha ndani ya server ya Koyeb (haina browser); itaendesha **ndani ya sandbox** kama CLI bandia (mfano xmd_shot.py) ambayo TS huita kupitia `sbx.commands.run` kwa JSON. Checks zisizo za DOM (command/grep/file/http) zinaweza pia kutekelezwa ndani ya sandbox bila browser.

## 3. Wavu ya usalama (regression guards) iliyoongezwa P0

- `src/lib/cu/engine.terminal.test.ts` (MPYA): terminal states za finishComputer — **inashindwa kabla ya fix #1, inapita baada**.
- `src/lib/cu/engine.planGuard.test.ts` (MPYA): `planMarkdown` ikikutana na `status:"guard_failed"` → haitoi mpango ("blocked") — **inashindwa kabla ya fix #3, inapita baada**.
- (Tests zilizopo ambazo hazijaguzwa: brokers, workPlan, dataGuard, cu/engine.* — zinabaki kama net ya kuashiria regression.)

## 4. Makosa #1 na #3 (P0 fix — majaribio kwanza)

- **#1** `finishComputer` engine.ts:1212: `ok = !!cu.report && status !== "error"` → `stuck`+ripoti = mafanikio. **Fix:** hali za mwisho zilizo wazi: `COMPLETED_VERIFIED | PARTIAL | STUCK | BLOCKED | PAUSED_QUOTA | ERROR`; ok = `done`+report pekee.
- **#3** `planMarkdown` engine.ts:304: haisomi `status` (guard_failed haisomwi popote) → mpango aliyofeli Data Guard unatekelezwa. **Fix:** `blocked_by_guard` — planMarkdown inarudisha `{blocked:true}` na startComputerPhase inakataa kuanza kwa kosa lenye maelezo.

(Imetekelezwa na tests kupita — angalia docs/PROGRESS.md P0.)
