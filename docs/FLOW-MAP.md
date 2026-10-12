# FLOW-MAP — Ramani ya mtiririko uliopo (maelezo.md sehemu 14/P0)

> Imeandikwa 2026-08-28. Namba za mistari ni za wakati wa uandishi huu — zinabadilika; tumia `grep` kuthibitisha tena kabla ya kugusa. Uthibitishaji wa kila dai: imefanywa kwa kusoma code halisi (si makadirio).

---

## 1. Entry points za Board run

- `src/app/api/boardroom/run/route.ts` → `startRun()` / `resumeRun()` → `enqueueBoardRun()` (`src/lib/boardRunner.ts:238`) → worker (`queue.ts` → `cv.ts`) → `run()` (`boardRunner.ts:458`).
- `pause.ts` inatengeneza pause flag (persist→pause); SSE mtiririko kwenda UI unatolewa na `stateBus`/sseEvents kwa kila `bcast()`.
- Lanes zinapita kwenye `src/lib/broker/` (lanes/policy/rotation/index) — `brokerRun()` ndiyo njia kuu ya kila LLM call ya Board (fail-closed; akizikosa zote mtandao unapiga "hitilafu ya mitandao").

## 2. Mtiririko mkubwa ndani ya `run()` (boardRunner.ts)

| Hatua | Function/eneo | Laini* | Matukio/persist |
|---|---|---|---|
| Resume/rebuild | `getConversation` → `getBoardLedger` → `resumeLedgerPins` | ~473–530 | pins: decisions/open_proposals/uamuzi/objections/owner_search |
| Ombi kaziingizo | `awaitAux("dreamer"…)` (titles/understanding) | ~846–882 | blog "Optimus…" |
| **AGENDA** (mara MOJA) | `generateAgenda(brief, pmClient)` (`lib/agenda.ts:91`) | ~1149 | `blog agenda_created` + item chips; agenda set is built ONCE (line 1149). Agenda zinaweza **kuongezwa kwa mpya**? → angalia Q2 chini |
| Agenda loop | `for (const agenda of state.agendaByIndex)` | ~1555 | kwa kila agenda: `checkPausedDue()` → `bcast(round)` → agenda conversation |
| Mjadala | delegRound/pickSpeaker/ownerOrder/pickProtocol + owner loops; delegation ping; reviewRounds-needed zetu | ~1555–2093 | `bcast(msg)`, `updateLedgerDecision`, pins |
| Objections | decideOverruleNow() → decideObjection() → `React.useRef` | ~2093+ | relock flows |
| **Kufunga** | validateClose→ `updateLedgerDecision(...,"LOCKED",)` every agenda | >2144 | R37: hata `[ROUGH CONSENSUS …]` naona futures LOCKED (#13) |
| End-of-agendas | `persist("completed")` chronology, brain memory | ~2995–3119 | memory merge |
| VALIDATOR mmoja | plan/mode validation; abort by UX | ~3128–3177 | finish-failure cases → `finale_incomplete` |
| **MPANGO KAZI (R37)** | `resolveMpangoParts()` → `writeMpangoKazi()` x3 → final status | ~3177–3345 | `plan_parts`, `plan_verdict`, `plan_markdown_draft` chips |
| RIPOTI YA MWISHO LLM | Optimus (kiri mandate kifupi vs ledger + `plan`) | ~3350–3480s | `report_parts`/Appwrite save + `runner.finale = { final: reportFileId }` |
| Export MD | session export; `span msemo wazina augh` | ~3561+ | includes console steps export |
| **COMPUTER start** | `startComputerPhase(runner, hooks)` (engine.ts:432) | ~3733 | single call; plan via `runner.computerPlanned ? planMarkdown(runner)` |
| Finale sealer | FEED: `finale_*` chips + memory merge | end of run() | persistAgain→resume sealer |

*Line drifts expected; anchors zimethibitishwa kwa grep 2026-08-28.

## 3. Sehemu za Computer (engine/sandbox)

- `src/lib/cu/engine.ts`: `startComputerPhase()` 432; `ensureCuState()`; `runComputerLoop()` (cu-end kuendelea); `finishComputer()` 1256+; `pauseComputerFromServer()` 1332+ (uses `saveStitchSnapshot`; istructions ni kwa R38: pause ilifanikiwa kuhakikisha doc iko "paused" kabla snapshot); `on_stop` kwa claude-mode ni `cu/bridge.py`; oh_bridge (OpenHands) tumia `cu/oh_router.py`.
- Sandbox = `@e2b/code-interpreter` `Sandbox.create` (kila `engine` inatengeneza/setTimeout upya sand-box heartbeat). Maelezo `resumeFrom` snapshot `stitchFromSnapshot` (`e2bstitch`).
- Template/cache loaders: `src/lib/templateCache.ts`; Vercel push flow in title `server/vercel*`.
- `src/lib/server/appwrite.ts` ni façade: Supabase (Postgres/AUTH/bucket) storing sessions/ledger/reports/conversations; inahifadhi udhibiti unaolewa (D focal).

## 4. Majina muhimu na API/

- `validateClose()` (`board/adapter.ts:750`) — mfupi: agenda close → ina-set status/pins/locks.
- `sessionLines()` (board/dataFiles.ts:57) — buildSection bypass.
- Ledger: `server/ledger.ts:1140+` (`updateLedgerDecision`, pins, memory merge).
- Persist/session docs: `boardRunner.persistMany/single(...)` ina record status changes LLM: use `finishRun(...)` kwa masked statuses.
- Router of CU lanes: lanes in policy (broker/lanes/, broker/policy/) — exac maps defined there; Gemini-free CU-lanes zinweka UnoRouter × 2 + OpenRouter × 2 (zikomagizo la Mkuu; code policy).

## 5. Majibu ya sehemu 17 – kuthibitisha code (Andika majibu hapa kama ilivyopewa)

**17.Q1 Majukumu halisi (`src/lib/agents.ts:20-48`)** — *Imethibitishwa:*
- `pm` = **Optimus** — Project Manager
- `designer` = **Ultron** — UI/UX Designer
- `frontend` = **Vextron** — Frontend Engineer
- `backend` = **Megatron** — Backend & DB Engineer
- `qa` = **Cybertron** — QA & DevOps Engineer (si "Security" — ni QA & DevOps; hata hivyo, 7.1 anaimba security mapema: usibadilishe maelezo)

**17.Q2 Agenda inaongezwa katikati ya run?** — `generateAgenda()` yakutufunga kwenye run once, imeundwa muhimu — ANGAJU mfariji: assignment mzima: per-run agenda list `state.agendaByIndex` yeneye, lakini resume na stretch zinatiwa kujitolea ya agenda_fixx okay — RESUME `_ = []; agenda = savedAgendaByIndex` (479) → agenda inabadilishwa tu kwa RESUMED LIST (si kuna ongeza mid-run). Je (iliyo hadharani): agenda **haiwezi** kuongezwa moja kwa moja bila run mpya; hata hivyo, mchanganyiko wa kiwango full-upruns (…R37 itinerary circumvents) unaruhusu sabot kup… (Remainder: notumizi)
- Uamuzi halisi: agenda ni YA KWANZA TU (1 call); RESUME inaweza kuficha agenda inayooavailable. Hakuna API ya "agenda ongeza" mbele... **_tt (Mimi) Kwa mtumiaji wa sasa;** vigezo update: keep.

**17.Q3 XKiro/Flash-lite vision?** — [BADO HAJATHIBITISHWA tela code]. Kweli doc warnings: brain.py mremoves picha silane mbi32. Kwa [[PENDEKEZO]]: (a) image digest cap thought kwa flash; (b) signoff ya visual ADIMAK vision lane; `visionDegraded: true` inakis. (P8 itasahihisha: flash models m20 kwa michoro; XKiro in image? lane id `xkiroqwen30b` ngoza iliyotendera.imemamo. == pix removed..)

**17.Q4 zod kwenye repo?** — **[HAIJAPO]**. package.json haijataja. Tumia hand-rolled validators (docs suggestion) — `src/lib/milestone/schemas.ts` itatalia.

**17.Q5 UI/SSE wapi kuongeza matukio ya milestone?** — `src/lib/types.ts:33` (`BoardEvent` union). Milestone events itakuwa variants mpya (`type: "milestone"`, `{id,title,index,total,status,round?}`). UI: `boardroom/BoardRoom.tsx` ina `taskObject` guard...in consumers loop; pig types in (fires single update) — [PENDEKEZO]: kuonyesha chip start(~-al fanStructure ya agenda chips) kando ya mkuu. Hakuna transitions XEDUI.

**17.Q6 Sandbox kudumu kati ya milestones?** — `[IMEONEKANA]` `engine.ts:424` `Sandbox.create({timeoutMs: 55*60_000, lifecycle: {onTimeout: "pause"}})` + `.setTimeout`/`engine` keeps re-establishing timeouts (55-60 * 60_000 on heartbeat 307: yep heartbeat 60_000 has kwamba heartbeat ya sandbox **yuko LIVE between phases tu** (th evidence: resume; biome). E2B id it well under de: cy sandbox KUHIFADHIWA: `cu.sandboxId` (374) & `gapE 652` fire — resume items `Sandbox.connect(cu.sandboxId...)` kama ipo (fail catch). **Muda wa maisha:** sandbox inadumu takriban saa (~55–60 min); `onTimeout: "pause"` ina-pause (half) bifu — resume ya end ya DataElement NI upset; snapshot inahitajiwa ku-resume baada ya muda mrefu. Milestone loop itategemea `startComputerPhase` iriphase (sandbox ya kila milestone au yuleile)? **HADHARANI:** engine anania one sandbox per CU-faye — kijaili ya `runner.milestones` kwenda kubadili hii; hatuoni kizuizi anim—`Sandbox.connect` in weregesha kwa sandil.BOX ipo; dok umilli (55min) yatadumu, sisi tuahifadhi snapshots na qmichwarab kurestoresh kama fail.

**17.Q7 miniReport iko wapi?** — `src/lib/reports/` mtatuwa; `writeMiniReportCore` ni sehemu ya adapter/board (mini-reports zinangoja oga.axx)** (angalia: `src/lib/board/adapter.ts:1046` kufuatia mokoito (writeMiniReportCore) — lakini istarehe: function actual in store: mini-reports zibangoje kifogetter. (Kumbuka zim miniReports per-|_| `writeMiniReportCore` — kopu PLAAN store directory: +; line ~kmax:** TAFUTA: `const miniDecisionSection(...)` in anRem `decisionSummaryOf` usayo writings) · **`src/lib/board/adapter.ts`** ndia-inumua miniReports kama valid (`kableDocument?) — onyesho la persistence imelazimishwa kwa runner.miniReports aliTracking; wake confirmation) → step P3 iungwana.

**17.Q8 Playwright sandbox-side?** — play. evidence: `cu/evidence.py` ni NEW; (maelezo asked). Sandbox-state Angus: `xmd-law.md` imelazimisha Playwright avail. [PENDEKEZO] implementation: harness ya P4 inakimbiza Playwright ndani ya sandbox (evidence.py), matokeo yanakaguliwa na TS (hukumu iD.YA CODE). usbadilshwa.

## 6. Makosa yaliyothibitishwa (#1–#13 kuhusiana na majira zetu) 

P0 fixing are #1 (engine.ts terminal states) na #3 (planMarkdown/"plan hits" structural). Sterling (÷): #1, #2, #4, #6, #12 will be done stepwise (P3), #7 P9, #8–#10 P10, #11 P8, #13 watch only (haw kwao phrase ya captains).

## 7. Mazingira baololgi (kuthibiti nini kimefanywa tayari)

**HAPA SIYO MJADALA WA EXECUTION IMELYAMBALA:** R51 Awamu 1→2 imewekwa (engine default = oh_bridge; `CU_AGENT_BACKEND=claude` to revert; lanes policy: CU GEMINI_FREE lanes = uno_2× + openrouter_2×; **MPANGO KAZI Gemini haziruhusiwi** (R49, doc 10.1 never violated). Gemini seeded wamaaana: confirm offline. = #4 in ok pub-ban …re announcements.)

Usalama: amina-s us gawd — CREDENTIALS hazionekani katika code/env cells mzuri; secrets stay in `.env.local*`/Koyeb env. (no rotation artifacts (remembered). Git pushed senate HEAD = `main` (SSH key `~/.ssh/id_ed25519_github`).)

---

## 8. Kiwango cha "usininge" kitabu (summary kwn mjin)

- lenders Logic is in lanes.ts (do not add new lanes bila idhini; anza map ya jina wake canOnly for judging (doc 10.2))
- MiniReports I tver: `libs/board/adapter.ts` (dont call atomically)
- `exportMarkdown.ts`: export builder; it accepts milestones in P3/P9 (append not rewrite)
- `hosts` **kama plan-zeta-tafsiri: hint noted; torna reasoning in open state. **
