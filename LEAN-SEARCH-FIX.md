# LEAN SEARCH FIX — Agent sasa atumia SearXNG ya northflank KILA MARA

**Tarehe:** 28 Sep 2026 · **Hali:** Imetekelezwa na imejaribiwa (unit 9/9 · e2e 21/21 · live 1/1 — jumla **31/31 PASS**)

---

## 1. Tatizo

Agent wa computer-use hakuwa anatumia engine ya kampuni (searxng-northflank) kwa ufasaha:
alijitafutia njia zake mwenyewe (curl ya google/duckduckgo) au akishindwa na engine,
akaacha kutafuta — wakati app ya **professor-xmd-company** inatumia engine ile ile kila mara bila shida.

### Kwanini company inafanya kazi kila mara (ilinganishwa kutoka `src/lib/search.ts`)

| Kitu | Company | Lean (kabla ya fix) |
|---|---|---|
| Majaribio | **11** (retries 10 + backoff 2s→4s→6s→8s) | **1 tu** — likifeli, limefeli |
| Timeout | 25s KILA jaribio | 40s mara moja tu |
| Engines | 7 zilizopo KWELI kwenye instance | orodha yenye 3 zisizokuwepo (duckduckgo/brave/wikipedia) |
| Headers | UA kamili ya Chrome + Accept + Accept-Language | UA fupi tu |
| Agizo kwa agent | `RESEARCH_REQUEST` — search ni ya MFUMO, agent hana chaguo | mstari mmoja kwenye orodha ya helpers, hakuna sheria |
| Fallback | HAKUNA — engine ya kampuni pekee | (mfumo wa zamani wa OpenHands) alikuwa ameagizwa DuckDuckGo waziwazi |

**Chanzo kikuu:** Render free tier instance hulala baada ya ~dakika 15 bila movement, na kuamka
kwake huchukua sekunde 50–90. Jaribio moja la 40s linakufa kabla instance haijaamka — kisha agent
anajiokoa kwa njia zake. Company ina majaribio 11 yenye subiri — instance inaamka katikati, matokeo yanakuja.

## 2. Mabadiliko (faili 6)

### `lean/bin/xmd-search` — tabia ile ile ya company (`doFreshSearch`)
- Retries **10 (majaribio 11)** + backoff `min(2s×attempt, 8s)` — inavuka cold-start ya Render.
- Timeout **25s kwa KILA jaribio` (env: `XMD_SEARCH_RETRIES`, `XMD_SEARCH_TIMEOUT`).
- Engines = **`bing,google,yandex,naver,seznam,github,stackoverflow`** — zile 7 za `keep_only` ya instance
  (zilizothibitishwa LIVE; zamani orodha ilikuwa inataja 3 zisizokuwepo).
- Headers kamili za browser (UA + Accept + Accept-Language) — nakili ya `search.ts`.
- Results 0 = si kosa: jaribio MOJA bila `engines` (defaults za instance), kisha "no results" (exit 0) — hakuna retry ya tupu.
- Maendeleo ya retries yanaandikwa **stderr** → yanaonekana LIVE kwenye UI (`exec_output`) na kwenye context ya model.
- Format ya matokeo HAIJABADILIKA (`N. title — url` + snippet) — UI ya `parseSearch` na model wanaendelea kuisoma.

### `lean/xmd_lean.py` — injini
1. **CORE prompt, sheria ya 8 (mpya):** *"Web search: ALWAYS `xmd-search` — the ONLY search tool… NEVER fetch
   google.com, bing.com, duckduckgo.com or any other search engine directly — that is forbidden."*
2. **ROUTES ya search imepanuliwa:** sasa ina-match pia `google|duckduckgo|bing|mtandaoni|online` —
   kazi ikigusa maneno hayo, skill ya search inapakiwa hata user hajatumia `@search`.
3. **Timeout ya amri za search = 360s** (default; nyingine 180s) — retries 11 za ndani zinatoshea ndani yake.
4. **Bug: `xmd-shot` imeondolewa kwenye prompt na `classify()`** — ilikuwa inatajwa lakini haipo kwenye `bin/`
   (agent angepata "command not found").

### `lean/skills/search/SKILL.md` — sheria za chuma
- `xmd-search` ni search tool PEKEE; curl/wget ya engines nyingine ni **marufuku**.
- Ina-retry yenyewe 11× — "be patient, never re-run it in a loop".
- Ikishindwa (inachapa "search failed after N attempts"): andika ripotini, ENDELEA bila web info — **usibadilishe njia**.

### `server.ts` (mfumo wa zamani OpenHands — `?old=1`)
- **Fallback ya DuckDuckGo imefutwa kabisa.** Mahali pake: subiri na retry ya SearXNG (instance hulala),
  na katazo wazi la kutumia engines nyingine. Engine ya kampuni pekee ndiyo inayoruhusiwa.

### `lean/bin/skill` — bug nyingine iliyokamatwa
- Haikuwa na exec bit (mode 100644) — `skill <name>` ingesema "command not found". Sasa ni 755.

### `lean/README.md`
- Rows mpya za env: `XMD_SEARCH_RETRIES` (10) na `XMD_SEARCH_TIMEOUT` (25).

## 3. Majaribio yaliyofanyika (yote kwenye clone halisi, mazingira ya majaribio)

**PHASE 1 — unit (`lean/bin/xmd-search` dhidi ya mock SearXNG yenye kuiga cold-start ya Render): 9/9**
- Kufeli mara 2 kisha kufaulu → exit 0, format sahihi, maendeleo 2 ya retry kwenye stderr, majaribio 3, engines 7 sahihi, format=json.
- Engine imezimwa kabisa → exit 2 + "search failed after 3 attempts".
- Results 0 → "no results" exit 0 + fallback bila engines ilijaribiwa.

**PHASE 2 — e2e (server.mjs HALISI + injini HALISI + mock LLM ya OpenAI-SSE + mock SearXNG): 21/21**
- Run kamili: `run_start → skill_loaded(search, router) → step → exec kind=search → usage → finish → run_end=done`.
- Cold-start ilipoigwa (503 ×2 kisha 200): **exec imefanikiwa, matokeo halisi yalirudi kwa model, model ALIONA retries zilifanyika.**
- CORE prompt imethibitishwa ina sheria ya 8, inakataza google/bing/duckduckgo, haitaji xmd-shot.
- Engine ikizimwa kabisa: exit 2, model alisoma "search failed after 3 attempts", run haikuingia loop — `done`.
- `state.json` + `events.jsonl` zimehifadhiwa (endelea/refresh zinafanya kazi); `/api/config` na `/api/threads` ziko sawa.

**LIVE — engine halisi ya northflank: 1/1**
- URL ile ile `xmd-search` mpya inayojenga (`format=json` + engines 7) ilitumwa kwenye instance halisi:
  **imerudisha matokeo** kutoka stackoverflow, bing **na yandex** (engine ambayo haikuwa ikionekana na orodha ya zamani).

> Harness ya majaribio: `e2e-search-test.py` (katika zip hii) — `python3 e2e-search-test.py`
> (inaanza mocks zenywe; haitaji keys wala mtandao).

## 4. Jinsi ya kutumia

```bash
cd professor-xmd-computer-use
cd copilotkit && npm install && npm run build && cd ..
XMD_API_KEY=<xkiro key> npm run lean     # http://localhost:8787
```

Agent sasa: kazi yoyote yenye ladha ya kutafuta → router inapakia skill ya search → anatumia `xmd-search` pekee
→ engine ikilala, anasubiri retries 11 (inapita mbele yake kwenye UI) → matokeo yanamrudia. Hakuna DuckDuckGo, hakuna curl za siri.

## 5. Mapendekezo (si lazima, lakini vitafanya iwe imara zaidi)

1. **UptimeRobot / cron-job.org** ipinge `https://searxng-northflank.onrender.com/healthz` kila dakika 10 —
   instance haitalala kabisa, na cold-start (sekunde 50–90) inaisha. Hili ndilo tatizo asili la "muda wowote inafanya kazi / agent anashindwa".
2. Mode ya **E2B bado haijajaribiwa** (README yenyewe inasema) — kwa production ijaribu na `E2B_API_KEY`.
3. `XMD_CMD_TIMEOUT` sasa inapuuza default tu (search 360s / nyingine 180s) — usiweke tena thamani moja kwa zote kama zamani.
