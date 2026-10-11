# MPANGO KAZI R51 — OPENHANDS PHASE (Mode ya Pili ya XMD Computer)

> Tarehe: 2026-10-11 · Hali: **SUBIRI IDHINI YA CEO — hakuna code imeguswa**
> Kanuni: research kwanza (imefanyika ✅), plan inasomwa, halafu code. Hakuna hardcode — kila
> kitu kilichothibitishwa ndani ya sandbox halisi (`professor-xmd-browser-v3`).

---

## 0. MAAMUZI YA JUU (kutoka kwa CEO)

1. Mradi unakuwa na **MODE MBILI** za CU: `claude` (ya sasa) na `openhands` (mpya).
2. Claude **HAIFUTWI** code zake — **tunaizima tu** (flag). Kurudi nyuma = flip ya flag sekunde 0.
3. Claude **aondolewe kwenye uendeshaji wa sandbox** (hakuna `pip install claude-agent-sdk` tena; packages za baked `anthropic`/`lmnr-claude-code-proxy` zinaondolewa kwa `pip uninstall` wakati wa setup — za template ni za zamani; nullable).
4. OpenHands apewe **uwanja wote** (agent loop + tools zake native). **Hakuna MCP** — tools zake zinatosha.
5. Harness zetu **mbili zinabaki zilivyo (zikiendeshwa kwenye mode mpya)**: **History** na **Screenshot** — na ile ya screenshot **INAREKEBISHWA** (sheria iliyofanyiwa kazi tayari R33, lakini ina bug).
6. **Hakuna logic yetu inayotupwa:** zile OpenHands anazofanya native (verification ya evidence, critic, stuck detection, context condenser) logic yetu inakuwa **input** (mf. feature_list → objective ya judge), si duplicate.
7. UI yetu na mjadala (boardroom) **hawaguzwi kabisa**.

## 0.1 UKWELI ULIOTHIBITISHWA (sandbox probe 2026-10-11 — si kudhani)

- Template `professor-xmd-browser-v3` tayari ina: **openhands-sdk 1.46.0 + openhands-tools 1.46.0**, litellm 1.100.1, browser-use 0.13.10, playwright 1.62.0 + Chromium 657MB (kwenye `/code/openhands-venv`, pkgs 195).
- `claude-agent-sdk` HAIKUWA baked — hupakwa na `cu/setup.sh` **kila run** (hupoteza ~30s kila conversation).
- Verified imports kwenye 1.46.0: `LLM/Agent/Conversation/Tool` ✅, `run_goal` (judge loop) ✅, `APIBasedCritic/CriticBase` ✅, `AlwaysConfirm/NeverConfirm/ConfirmRisky` ✅, `LLMSecurityAnalyzer` ✅, `load_project_skills/Skill/AgentContext` ✅, `TerminalTool/FileEditorTool/TaskTrackerTool/BrowserToolSet` ✅. `openhands.sdk.preset` HAPO → tunatumia **explicit Tool list** (ni bora kwa control).
- PyPI latest = 1.54.0 → tunabaki **1.46.0 ya baked** (install sifuri); upgrade ya makusudi baadaye.
- OpenHands ina **native "kagua kabla ya kumaliza"**: `run_goal` (judge huruhusu Finish TU baada ya kuona evidence kwa transcript), Critic + iterative refinement (auto-retry), 4-phase system prompt (re-run tests kabla ya finish), stuck_detector. → **Hatujengi duplicate.**

---

## 1. RAMANI YA MABADILIKO (faili kwa faili)

| Faili | Nini kinabadilika | Mode |
|---|---|---|
| `src/lib/cu/engine.ts` | Flag `CU_AGENT_BACKEND` (`claude`\|`openhands`, **default `openhands`**); branch ya spawn: `bridge.py` (claude) au `oh_bridge.py` (openhands); resume path kwa `persistence_dir`; fixes 2 (§5) | zote |
| `cu/oh_bridge.py` | **MPYA** — brain ya OpenHands ndani ya sandbox (§3) | openhands |
| `cu/shotlaw.py` | **MPYA** — screenshot registry + sheria (deterministic) (§4) | openhands |
| `cu/xmd-law.md` | **MPYA** — sheria zote kama context file (auto-loaded) | openhands |
| `cu/setup.sh` | step 1 (claude pip) ifanywe TU backend=claude; purge ya baked claude pkgs backend=openhands; gh + chromium checks zinabaki | zote |
| `cu/bridge.py`, `cu/brain.py` | **HAIGUSWI** — hubaki kamili kwa mode=claude | claude |
| `src/lib/boardRunner.ts` | FIX chip ya uongo (§5.1) | zote |
| `cu/tests/*`, `src/lib/cu/*.test.ts` | testi mpya | — |

**Mikataba isiyobadilika (UI = zero changes):** event schema (`run_start/think/text/exec/shot/files/usage/usage_total/github/deploy/finish/run_end/snapshot/xmd_hook`), endpoint `/api/boardroom/cu-event` + Bearer token, chips, mirror→`cu_files`, E2B snapshot/pause, sessions (gz1), meters, mini reports, `--task-file` + `cu-config.json` interface ya bridge.

---

## 2. AWAMU 0 — KUZIMA CLAUDE (kufuta siyo)

- `engine.ts`: `const CU_AGENT_BACKEND = process.env.CU_AGENT_BACKEND || "openhands"`.
- Njia ya claude inafungwa nyuma ya `if (backend === "claude")` — **hakuna line inayofutwa**.
- `setup.sh`: pip ya `claude-agent-sdk` → tu mode=claude. Mode=openhands: `pip uninstall -y anthropic lmnr-claude-code-proxy claude-agent-sdk 2>/dev/null` (sekunde ~2) → sandbox ina **zero claude** wakati wa run.
- ✅ Acceptance: mode=openhands → hakuna process/pkg ya claude; mode=claude → run ya zamani inafanya kazi kama kawaida (parity test).

## 3. AWAMU 1 — OH BRIDGE (brain mpya ndani ya sandbox)

`cu/oh_bridge.py` (inaendeshwa na `/code/openhands-venv/bin/python`):

1. **LLM lanes**: yasomwe `cu-config.json` (muonekano ule ule wa leo). `LLM(model=..., base_url=..., api_key=...)` kwa lane inayotumika; rotation/wrapper thin kwa 429/503: lane inayofuata (policy ya leo inahamia hapa — **proxy ya brain.py HAIBEBWI**, claude-opencompat hairahitikwi tena kwa sababu LiteLLM anaongea moja kwa moja). **Meter mpya: requests counter per lane per run** (malipo ni per-request — uonekane live kwenye `usage_total`).
2. **Agent + tools**: explicit `[TerminalTool, FileEditorTool, TaskTrackerTool, BrowserToolSet]` + `XmdScreenshotTool` (Awamu 2). `AgentContext` na skills: `CLAUDE.md`/`AGENTS.md` (+ `cu/xmd-law.md` §5) — auto-load.
3. **Task**: content ile ile ya `--task-file plan.md` (+ resume note ya leo ikihusu). `persistence_dir=/home/user/ws/.xmd/oh-conv` + `conversation_id` per session → pause/resume native.
4. **Event adapter**: callback ya SDK → schema yetu (§1): ActionEvent(terminal)→`exec_start/exec_output/exec_end`; thinking/messages→`think_*`/`text_*`; file edits→`files`; metrics per step→`usage`; finish→`finish`+`run_end`. POST kwa `/api/boardroom/cu-event` kwa Bearer token ya leo.
5. **PROBE (gate la awamu):** ndani ya E2B halisi, task "andika FACTS.txt + run ls" kwa **lane ya kwanza** — inathibitisha tool-calling ya lane hiyo (~requests 3–5). Ikifeli → jaribu lane inayofuata; **ripoti kwa CEO kabla ya kuendelea**.
6. ✅ Acceptance: run moja kamili E2B; events zinaonekana prod UI bila mabadiliko; usage ina tokens+requests.

## 4. AWAMU 2 — SCREENSHOT HARNESS (MAREKEBISHO — sheria ya CEO)

`cu/shotlaw.py` + `XmdScreenshotTool` (custom, ina-wrap Playwright yetu — Chromium ipo):

- **Registry** `.xmd/shots.json`: `(route, viewport) → {hash, path, ts}`. File-hash inatokana na source files za page (git status/mtime baada ya FileEditor events).
- **SHERIA (deterministic, ndani ya tool — si ushauri):**
  1. **Cap ya picha 4 INAONDOLWA kabisa** (hii ndiyo bug ya sasa — cap inatafutwa na kufutwa popote ilipo: prompt/bridge/engine).
  2. **Kila page picha MOJA** — first shot ya page/view mpya: ruhusa kila mara.
  3. **Picha ya PILI+ kwa page/view ileile: RUHUSIWA TU faili limebadilishwa** (hash tofauti). Vinginevyo tool inarudisha observation: `"PICHA IPO TAYARI: {path} (hakuna kilichobadilika tangu {ts})"` — hakuna shot, hakuna token ya picha.
- Bytes → bucket + event `shot` kama leo (UI haibadiliki). UI-evidence ya verification inaendelea kama leo.
- ✅ Acceptance + testi: page 3 → picha 3 (sio 4 cap); re-shot bila change → denied; re-shot baada ya edit → allowed.

## 5. AWAMU 3 — SHERIA + NATIVE GATES (bila duplicate)

- `cu/xmd-law.md`: sheria zote (screenshot law, STATUS.md law, feature_list law, lugha/tone, GitHub/Vercel law) — OpenHands huijasia always-on.
- **Finish gate = `run_goal` native** (HATUJENGI): objective inatengenezwa **kutoka `feature_list.json`** — kila feature + verification yake kama checklist; judge (LLM ya lane tofauti) hukubalia TU akiona evidence kwa transcript (file contents, command output, picha). `max_iterations` (mf. 6) = cap. Ikiisha bila kupitisha → status ya kweli inaripotiwa (kama leo).
- **Critic**: **OFF by default v1** (experimental + requests zaidi; hosted critic inataka provider yao). Flag `CU_OH_CRITIC=1` kwa baadaye.
- **Stuck/detekta**: native `stuck_detector`. Watchdog yetu ya engine inabaki kama infra tu (RAM/stall network-level), si logic ya agent.
- **ConfirmationPolicy**: `NeverConfirm()` — autonomous + sandbox isolated (kama leo; hakuna kitu kinachosubiri binadamu katikati ya run).

### 5.1 FIXES zinazoingia (zilizoahidiwa — hazitengenezwi mara mbili)

| Fix | File | Kazi |
|---|---|---|
| **Chip ya uongo "haijakamilika"** | `boardRunner.ts` (~:3744-3760) | TUMA `bcast done`+status error+⚠️ chip TU CU imekufa KWELI; ikiwa hai → subiri. `CU_HARD_CAP_MS` = dead-man's switch tu (default inapandishwa; env override ipo) |
| **Stale snapshot** | `engine.ts` (`pauseComputerFromServer` ~:1048) | snapshot MPYA kila pause — ondoa `if (sbx && !cu.snapshot)` skip (ushahidi: be260373 ilikuwa na CLAUDE.md pekee → UHALI ulipotea) |
| **Requests meter** | `oh_bridge.py`→`usage_total` | onyesha requests/lane/run (si tokens tu) |
| **Deploy-guard** | (discipline yetu — si code) | kabla ya push: `/api/boardroom/active` + logs; run ikiwa hai → **HAKUNA PUSH** |

## 6. AWAMU 4 — HISTORY (INABAKI, INAIMARIKA)

Habari/testi nyingi hapa: mirror ya files→`cu_files`, E2B snapshot/pause, sessions gz1, chips, auto-resume (`checkPausedDue`, `/api/boardroom/resume`) — **zinabaki zote**. Nyongeza: resume ya OpenHands kwenda kwa `persistence_dir+conversation_id` (imara zaidi ya replay ya sasa); mirror hubaki kama usalama wa faili (streetwear-case hairudiwi).

## 7. AWAMU 5 — TESTI + SEA TRIAL + DEPLOY

1. Testi: python (shotlaw registry, event adapter, lanes config), vitest kwa TS iliyoguswa; suites za leo (186 + 183) zinabaki green.
2. Dry-import ya `oh_bridge` ndani ya E2B halisi (template ina kila kitu).
3. **Sea trial**: project ndogo (pages 2–3) kwenye prod — tunaangalia: events live, picha 1/page, re-shot baada ya edit, judge wa run_goal, requests meter.
4. Deploy-guard → push → Koyeb HEALTHY verification (kama kawaida: deploy mpaka iishe).

## 8. RISIKO / POINTI ZA KUVERIFY WAKATI WA BUILD

- API ya 1.46.0 vs docs (imports zimeverify-ika leo ✅; `run_goal` signature + AgentContext kwargs zitathibitishwa tena wakati wa kuandika).
- Nguvu ya tool-calling ya lanes (PROBE ya Awamu 1 ndio gate).
- RAM 2GB / CPU 2: footprint ya sdk + browser-use (sea trial; kama kazito → shotlaw inatumia Playwright yetu pekee, BrowserToolSet optional-flag).
- Banner ya SDK inazimwa (`OPENHANDS_SUPPRESS_BANNER=1`).
- R50 Awamu za zamani (2–8): nyingi **zimebadilishwa na native** (evaluator→judge, visual gate→shotlaw+evidence ya judge); `feature_list.json` **inabaki** kama input. Hii itaandikwa wazi kwenye faili la R50 kuwa superseded-by-R51 sehemu husika.

## 9. OUT OF SCOPE (sasa)

Template rebuild (ku-rip anthropic/lmnr kimwili — optional baadaye); hosted critic; MCP (haituhitajiki); mabadiliko ya UI (hakuna); report/mini-report systems; R50 harness ya mode=claude (inabaki iles dormant).

---

## 0.2 LANES — UCHUNGUZI WA LIVE (2026-10-11, probes kwa keys halisi)

Amri ya CEO: **xkiro → CONVERSATION pekee** (limit yake ni per-request); CU = UnoRouter ×2 + OpenRouter ×2 (+Groq/Gemini kama dharura).

| Kipimo | Matokeo ya live |
|---|---|
| `stealth/space-bunny-alpha` (OpenRouter) | **IMEFUTWA KABISA** — 404 "No endpoints found" kwa key yetu mwenyewe; stealth ilimalizika rasmi 2026-10-05. ❌ Haitumiki tena popote |
| `nvidia/nemotron-3-ultra-550b-a55b:free` (OpenRouter) | **8/8 OK sasa hivi** (keys zote mbili, 0.4–2.1s). 503 ni **ya muda fulani** (capacity), si kifo — rotation + retry inamsaidia |
| `nvidia/nemotron-3.5-lightning:free` (OpenRouter) | ✅ 200 (0.3s) — backup imara, 1M ctx, tools |
| UnoRouter free (live, `/api/pricing` → 110 free) | 1rpm **per model per user**; pools hushagaa → 503 `get_channel_failed` ("all providers busy") — **rotation ndio design yao rasmi**. Probe: deepseek-v4-flash:free ❌503, gpt-5.5:free ❌503, **nemotron-ultra:free ✅200** (kwa wakati huo) |
| Output cap (UnoRouter free) | **8K tokens/response** — agent steps ni fupi (OK); writes ndefu hupaswa kugawanyika (FileEditor str_replace) — testi ya Awamu 1 |

**Roster ya CU (UnoRouter, rotation):** nemotron-3-ultra-550b-a55b:free (1M ✅live), glm-5.2/5.3:free (1M), gpt-5.4/5.5:free (1.1M), deepseek-v4-flash/pro:free (1M), qwen3.5-397b-a17b:free (262K), step-3.7-flash:free (256K), minimax-m2.7:free (205K), qwen3.6-35b-a3b:free (recommended ya OpenHands). **Secondary (OpenRouter, ~50 req/day/account ×2 ≈ 100/day):** nemotron-3.5-lightning:free, nemotron-ultra:free, nemotron-3-super-120b:free, openrouter/free. Requests zilizotumika kwenye probes: OR#1=6, OR#2=4, UNO#1=3.

### 0.3 MIX YA LANES — "GIA 3" (design ya mwisho, agizo la CEO 2026-10-11)

Msingi wa observation ya CEO: **Gemini flash = haraka lakini wakati mwingine usahihi wake hauku; reasoning/step-by-step = usahihi wa hali ya juu lakini slow.** Kwa hiyo:

- **GIA 1 — MAIN BRAIN (kila step ya agent):** ROSTER inayozunguka = reasoning models za UnoRouter (§0.2) **+ Gemini flash ndani ya roster ile ile** (flash ni "mbio" wa roster — inaposhika hatua nyepesi inapiga mbio; reasoning models hushika mipango/code mgumu). Rotation = model inayofuata kwa kila request mpya (SDK agent ni stateless per step → kubadili model kati ya steps ni salama architecturally). Keys A→B zinatimbulana. **Roster 6–10 models × 1rpm/model = throughput endelevu bila kusubiri.**
- **GIA 2 — CONDENSER/AUX (maskini wa kazi nyepesi):** Gemini flash — condenser ya SDK (kufupisha context inapojaa), title/summary, quick-asks. Hapa kasi > usahihi wa kina, na flash ni bingwa wa hii.
- **GIA 3 — JUDGE/VERIFIER (independent, wala si lane ya main):** OpenRouter **nemotron-3.5-lightning:free** (verified 0.3s) → kisha nemotron-ultra:free ikiafa. Huyu ndiye `judge_llm` wa `run_goal` + verifier wa R50 evidence. Fresh-context + provider tofauti = hakuna self-eval bias (kanuni ya research: evaluator lazima awe huru).
- **DHARURA:** OpenRouter backups → Groq (hatua nyepesi) → **xkiro KAMWE si CU** (conversation only, agizo la CEO).

**SHERIA YA UKIMYA (inayebaki kuwa sheria #1 ya lanes — kama #7 ya brain.py):** 429/503/5xx/empty/`get_channel_failed`/timeout zote ni **KIMYA kwa UI** — log tu kwa server-side + meter; UI haioni chip, haioni error, haioni quota. Request inahama model/lane inayofuata bila mtumiaji kuona chochote. Kosa la KILELE (lanes zote zimekufa baada ya retries) ndio pekee linaloripotiwa. Hii inahamishwa 1:1 kwenye `oh_bridge.py` rotation wrapper — **kamwe isivunjwe**.

### 0.4 NATIVE vs ZETU — ukweli baada ya verification ya mwisho (2026-10-11, v1.46.0 halisi)

Verified ku-import ndani ya sandbox: `openhands.sdk.hooks` (HookConfig/HookDefinition/HookMatcher — **Claude-Code hook contract**: exit 0/2 + JSON decision) ✅, `tools.preset.default.get_default_agent` ✅, `run_goal(conversation, objective, judge_llm, *, max_iterations=10) -> GoalOutcome` ✅, LLM fields: **timeout/num_retries/retry_*/fallback_strategy/openrouter_app_name** ✅, Agent fields: **condenser/critic/agent_context/system_prompt_filename** ✅.

**TUNATUMIA NATIVE (hatucodei):** agent loop, tools 4, skills/CLAUDE.md auto-load, **hooks za command-mode (shell scripts deterministic)** kwa gates zilizobaki, confirmation policy, stuck detector, condenser, persistence/resume, **run_goal** (judge wa evidence).
**TUNATENGENEZA TU (thin):** rotation wrapper ya lanes (lanes ni zetu asili), event adapter (UI yetu), XmdScreenshotTool + shotlaw registry (sheria ya CEO haipo popote), context seeding (plan/feature/law files).
**UTaratibu wa verification (sheria ya CEO "code inakagua, sio model"):**
1. **CODE ndiye hakimu** — feature_list checks zinatekelezwa kwa bash/file-state (default-FAIL; verdict deterministic).
2. **Judge wa run_goal (native) si mwamuzi wa ubora** — ni mlinzi wa EVIDENCE: anasoma transcript na kukataa finish isiyo na evidence halisi (file contents, command output, picha). Provider tofauti + fresh context = hakuna self-eval.
3. **Hooks za command-mode** (shell) zikitaka kuzuia kitu, ni **script** inayoamua (exit 2), sio model.
**SHERIA ZA LANE (mwisho):** (a) UKIMYA: 429/503/5xx/empty/timeout hazionekani UI — log + meter tu; kosa la kilele pekee (lanes zote). (b) TIMEOUT: LLM.timeout native per call (default 180s) — kimepita → hop ya kimya kwa model inayofuata, step ileile inarudiwa; hakuna run inayokwama kwa ukimya wa model. (c) 8K output (Uno free): law ya FileEditor chunking (andika kwa vipande). (d) GATE ya roster: Awamu 1 inampima KILA model wa roster tool-call moja kabla hajaingizwa — deterministic acceptance.

### 0.5 ROSTER VERIFICATION — tool-call + reasoning LIVE (2026-10-11, UnoRouter key#1, requests 15)

| Model | Hali | Kasi | Tool-call | Reasoning | UAMUZI |
|---|---|---|---|---|---|
| kimi-k3:free (1M, 4 pools) | 200 | 3s | native ✅ | Y | ✅ GIA1 |
| deepseek-v4-flash:free (1M, 2 pools) | 200 | 3s | native ✅ | Y | ✅ GIA1 |
| deepseek-v4.1-flash:free (1M, 1 pool) | 200 | 2s | native ✅ | Y | ✅ GIA1 |
| laguna-s-2.1:free (1M, 4 pools, coding-agent) | 200 | 4s | native ✅ | – | ✅ GIA1 |
| north-mini-code:free (262K, 9 pools, agentic) | 200 | 2s | native ✅ | Y | ✅ GIA1 + backup JUDGE |
| **nemotron-3-super-120b:free (262K, 21 pools)** | 200 | **1s** | native ✅ | Y | ✅ GIA1 + **JUDGE mkuu** |
| minimax-m2.7:free (204K, **102 pools**) | 200 | 9s | native ✅ | – | ✅ GIA1 |
| codestral-latest:free (256K, 1 pool) | 200 | 1s | native ✅ | – | ✅ GIA1 (tier-2) |
| nemotron-3-ultra-550b:free (1M, 10 pools) | 200 | 5s | ⚠️ text-mode (SDK ina support) | – | ✅ GIA1 (tier-2) |
| ~~qwen3-coder-plus:free~~ | 429 "concurrent, retry shortly" | — | — | — | ⛔ **IMEOFUTWA** kwa agizo la CEO 2026-10-11 |
| glm-5.3 / glm-5.3-flash / think-search :free | **403 error 1010** (Cloudflare block — geo/signature) | 1s | — | — | ❌ nje ya roster |
| qwen3.6-plus:free | 200 lakini "账号存在异常风险…已停止使用" (upstream imeban account) | 3s | — | — | ❌ nje |
| step-3.7-flash:free | 200 | **76s** | text tu | – | ❌ nje (slow + no native tools) |

**JUDGE (kwa logic ya OpenHands: reasoning, independent, imara):** `nemotron-3-super-120b-a12b:free` (1s, reasoning, 21 pools) → backup `north-mini-code:free`. GLM-5.3 ingekuwa bora lakini imezuiwa na Cloudflare kutoka egress yetu.
**Roster ya GIA1 (verified leo):** gemini-flash (lane yetu) → kimi-k3 → deepseek-v4-flash → deepseek-v4.1-flash → nemotron-3-super-120b → laguna-s-2.1 → north-mini-code → minimax-m2.7 → codestral → nemotron-ultra (tier-2) → qwen3-coder-plus (hop). Keys UNO A↔B zinatimbulana; kila model lazima apite tool-call moja kabla ya kuingizwa (gate ya Awamu 1).

### 0.6 AWAMU YA LANE LOGIC — ✅ IMEJENGWA (2026-10-11 jioni)

**Commit ya kwanza ya R51.** Maamuzi ya kiundani (yote verified, sio kudhani):
- Mixing ya per-call ni **native**: `openhands.sdk.llm.router` (`RouterLLM`/`RandomRouter`, field `llms_for_routing`) — sdk 1.46.0. LiteLLM proxy imekataliwa (haina fastapi kwenye venv; kuiongeza = uharara).
- **`cu/lanes.py` (stdlib, ~330 lines) = POLICY ya lanes**, si engine mpya: quotas (Uno 1rpm/model/account; OR 50/**account**/siku shared; Gemini flashRpm/Rpd ya cfg, Pacific day), cooldowns (429 + Retry-After heshimiwa, 503 backoff cap 300s, timeout 30s), rotation thabiti yenye seed ya run-id, **tier-2 backstop**, meters `/home/user/lane-usage.jsonl` (haiziwahi kuwa na keys), `wait_seconds` + `AllLanesDead` (kosa la kilele pekee linalorubusiwa — UKIMYA kama kawaida). Roster nzima ina-override kupitia `cfg["ohRoster"]`/`CU_OH_ROSTER` (hakuna hardcode).
- Pools: `main` (gemini flash + Uno roster ×2 keys), `dharura` (OR ×2 → Groq), `judge` (super-120b → north-mini → OR lightning), `aux` (gemini).
- **engine.ts**: default ya `UNOROUTER_MODELS` imerekebishwa — space-bunny imefutwa (ilikuwa LIVE bug: model iliyokufa bado ilikuwa default!), roster mpya imewekwa; brain.py (mode=claude) pia inanufaika.
- Testi: `cu/tests/test_r51_lanes.py` **11/11 ✓**; suite nzima **python 197/197 ✓**.
- Wiring halisi (RouterLLM + oh_bridge + probes za tool-call kwa kila model) = Awamu 1 inayofuata.

## MASWALI YA MWISHO KABLA YA AWAMU 0 (majibu yenu yananifungulia)

- **D1 — Lanes za OpenHands CU:** nibakiie mpangilio wa leo (Gemini flash kwanza → XKiro → OpenRouter → Groq → Uno kama dharura) au qwen-first kama mjadala? *Mapendekezo: wa leo — ni wa requests-lifted, Gemini ni cheap; qwen anabaki kwenye mnyororo.*
- **D2 — Critic OFF by default v1?** (mapendekezo: ndiyo — run_goal judge inatosha kuanza)
- **D3 — Purge ya anthropic/lmnr kwenye setup (mode=openhands)?** (mapendekezo: ndiyo — "claude aondoke sandbox" kiukweli)
