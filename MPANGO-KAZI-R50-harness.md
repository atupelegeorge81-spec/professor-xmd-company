# MPANGO KAZI R50 — HARNESS YA KUDUMU (feature_list.json · Step QA · Evidence Gate)

> **Hali: UTEKELEZAJI UNAENDELEA** — Awamu 0 (utafiti) ✅ · Awamu 0.5 ✅ · Awamu 1 ✅ · Awamu 2 inafuata.
> Tarehe: 11 Oktoba 2026 · Msingi: uchunguzi wa ChatGPT/Claude wa export ya SafariSmart + ukaguzi wa code (11-10) + `fix.md` Phase 0.5–4 + **utafiti wa nje wa agents (§0.0)**.
> Baseline mpya: **vitest 183/183 · python 186/186 · tsc clean** (kutoka 172/176). R48+R49 LIVE (Koyeb v407, SHA `e4b4a42` → hapo juu yake R50-Awamu 0.5+1).

---

## 0. Tatizo lililopimwa kwa data (si hisia)

SafariSmart (run halisi ya kwanza kamili) ilifeli kwa mambo ambayo **Board ilishaandika kwenye mpango**, lakini Computer haikulazimishwa kuyatimiza:

| Kipimo | Thamani halisi (export + code) |
|---|---|
| Tailwind | **Haikusakinishwa** — neno halipo kwenye export; picha zinaonyesha ukurasa bila style |
| VAT | Inaongezwa **juu ya 82.60** (ambayo tayari ina VAT) — imepitishwa kwenye mpango |
| PDF | **Bandia** — `Blob` ya maandishi yenye MIME ya PDF |
| Migration | **Ya kudumu kwa mkono** (95% na 90% daima) |
| Route za Kili | **Machame pekee** — Lemosho na Marangu hazipo |
| Screenshot | Zilipigwa hatua 48–55; ripoti iliandikwa hatua 64 — **bila picha** (compaction imeziondoa) |
| Agenda 11 (QA) | Iligeuzwa **orodha ya maandishi** — haikuzuia kumaliza |
| `on_stop` | Ilikagua **umbo la jibu** tu; tests gate haikuwaka (agent hakuandika test hata moja) |
| `CLAUDE.md` | Iliandikwa kwenye workspace **kabla ya scaffold** → `npm create vite .` ilighairiwa |
| Harness | **Haikuendesha** verification yenyewe — agent alijihesabia mwenyewe |

**Hitimisho:** mfumo unaamini "kazi imekamilika" kwa **maneno ya agent**, si kwa **artifacts zinazopimika**. R48 ilifunga mlango wa mwisho (verification gate) — R50 inafunga **mlango wa kila hatua**.

---

## 0.0 Utafiti wa nje (agizo la Mkuu: "usihard-code — jifunze kwanza, ndipo urudi uwanjani")

Vyanzo vya msingi vilichimbwa na kusomwa **KABLA ya code yoyote** (11-10 usiku):

| Chanzo | Kilichochukuliwa → kinatumika wapi |
|---|---|
| Anthropic, **"Effective harnesses for long-running agents"** (Nov 26 2025) | `feature_list.json` — **JSON si Markdown** (model haziharibu JSON kimakusudi); features ZOTE zinaanza `passes:false`; agent anagusa hali PEKEE; hatua MOJA kwa session; scaffold/`init.sh` LAZIMA iendeshe kwenye session yoyote; aina 4 za kufeli (kujidai kumaliza bila E2E, tests za kizembe, markup bila CSS, kufanya mengi kwa pamoja) → **Awamu 0.5 + 1 + 3** |
| Anthropic, **"Harness design for long-running application development"** (Mar 24 2026) | Planner/Generator/**Evaluator** — mkaguzi (context safi) anaendesha app HALISI kwa Playwright; **"sprint contract"** = done-criteria hukubaliwa KABLA ya code; self-eval bias ("confidently praise"); kila kipengele cha harness ni assumption kuhusu model — **prune on model upgrades** → **Awamu 3 (mkataba) + 8 (evaluator)** |
| **github.com/anthropics/cwc-long-running-agents** (Code with Claude 2026) | Primitives 3: **Default-FAIL contract** (`track-read.sh` + `verify-gate.sh` — harness inaKATAA kuandika hali bila evidence-file kufunguliwa kwanza); **fresh-context evaluator** (`evaluator.md` — Read/Glob/Grep/Bash pekee, HANA Write/Edit, `PASS | NEEDS_WORK`); **agent-maintained handoff** (CLAUDE.md + `commit-on-stop.sh` backstop) → **Awamu 2 + 5 + 8** |
| **Claude Code hooks mechanics** (docs 2026) | Stop ina-block kwa `decision:block`/exit 2; **LAZIMA** kuangalia `stop_hook_active` (loop guard); kikomo cha blocks 8 (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`); PreToolUse inaweza ku-rewrite args (`updatedInput`); gate isiyoweza kuisha = **jam ya milele** → **Awamu 2 + 4** |
| **Manus — context engineering lessons** | **Recitation** (`todo.md` inaandikwa upya kila mara — bias ya attention); file system = external context; mask-don't-remove; **keep errors in context** → **Awamu 5** |

**Kanuni iliyochukuliwa:** mechanism za R50 **hazijabuniwa** — ni muundo wa vyanzo hivi uliofungwa kwenye bridge yetu (`HookState`/`note_*` + engine). Hivyo "hard-code" ya ubunifu haipo.

**Bug iliyogunduliwa wakati wa kunakili (11-10) — muhimu:** hooks za mpango (R46-B/R48) zinapima `workspace/plan.md`, lakini plan iliandikwa `/home/user/plan.md` **PEKEE** → `plan_run` ilikuwa **False kila run** — gates zote za mpango (intent-prose, zero-exec, verification) **hazikuwaka kwenye production**. SafariSmart ilifeli ikiwa na gates zilizolala. **Fix (Awamu 0.5, leo):** bridge inaingiza `plan.md` kwenye workspace → gates zinawaka.

---

## 1. Uamuzi zinazoombwa (LOCKED baada ya idhini yako)

| # | Uamuzi |
|---|---|
| 1 | **`feature_list.json` ni sheria:** harness inaitengeneza kutoka Mpango Kazi; agent **habadilishi** muundo wake — anabadilisha `state`/`evidence` pekee |
| 2 | **Harness ndiyo mamlaka ya `passed`** — agent akipendekeza `passed` bila check ya harness iliyopita → BLOCK yenye orodha ya checks zinazoshindwa |
| 3 | **Step QA (mwisho) ni LAZIMA** — inatengenezwa deterministic na Board kutoka §7 QA Checklist; CU haiwezi kumaliza bila Step QA kupita |
| 4 | **Plan yenye matatizo ya muundo INAZUIA CU kuanza** (guard_failed ya kweli, si warning) — inarekebisha FIX-03 ya `fix.md` |
| 5 | **Harness inaendesha verification yenyewe** kwa commands za Step QA (allowlist: npm/npx/pytest/python/node/git/curl) — si kusubiri agent |
| 6 | Brake baada ya blocks 3-4 → **ripoti ya PARTIAL iliyo ya kweli** (haipo "Imekamilika ✓" ya uongo) |
| 7 | HAKUNA token/turn budget mpya (agizo lako la 05-10 linasimama) — hii ni **nidhamu ya ushahidi**, si kikomo cha matumizi |
| 8 | Hakuna mabadiliko ya UI isipokuwa chips/cards za hali ya features (hiari, hatua ya mwisho) |

---

## 2. Awamu 0.5 — PREFLIGHT (fix ndogo, faida kubwa) ⏱️ kwanza

**Lengo:** `npm create vite .` na scaffold zozote zisighairike; Tailwind-class ya SafariSmart isitokee tena.

| # | Kazi | Faili | Hali |
|---|---|---|---|
| 0.5.1 | **Stash/restore ya meta-files:** `pre_tool` (Bash) ikiona `SCAFFOLD_RX` → `META_FILES` (CLAUDE.md, STATUS.md, plan.md, feature_list.json, CONFLICTS.md) + `.xmd/` zinahamishwa `/tmp/xmd-meta/`; `PostToolUse`/`PostToolUseFailure`/`Stop` zinarudisha (idempotent; scaffold ikileta faili la jina lile — la scaffold linabaki) | `cu/bridge.py` | ✅ |
| 0.5.2 | **`plan.md` kwenye workspace (bug-fix ya kunakili):** hooks zinapima `workspace/plan.md` — sasa bridge inaiingiza (resume/mirror ikirudisha toleo la agent, hairudishi juu yake) → gates za R46-B/R48 **zinawaka** | `cu/bridge.py` | ✅ |
| 0.5.3 | **CLAUDE.md kutoka chanzo kimoja:** lugha ya "simama umripoti CEO" → **"weka CONFLICT kwenye `CONFLICTS.md`, endelea steps zisizoathirika"** | `cu/bridge.py` | Awamu 7 |
| 0.5.4 | Tests: stash/restore/collision/regex (10) | `cu/tests/test_r50_preflight.py` (mpya) | ✅ |

---

## 3. Awamu 1 — `feature_list.json` (msingi wa kila kitu)

**Lengo:** mpango (hatua N) unakuwa orodha rasmi ya features zinazopimika — schema ya `fix.md` §4.1.

### 3.1 Muundo
```json
{
  "schema_version": 1, "run_id": "…", "plan_id": "…",
  "features": [{
    "id": "step-01", "title": "Create the data files from Official Data",
    "required": true, "state": "pending", "attempts": 0,
    "checks": [
      { "id": "build", "kind": "command", "command": "npm run build", "required": true,
        "state": "not_run", "exit_code": null, "artifact": null },
      { "id": "home-visible", "kind": "browser_assertion", "required": true,
        "state": "not_run", "artifact": null }
    ],
    "evidence": [], "last_failure": null
  }]
}
```

### 3.2 Kazi
| # | Kazi | Faili | Hali |
|---|---|---|---|
| 1.1 | `featuresFromPlan(planMarkdown)`: parse `### Step N — Title` + `**Verification:**` → features; command salama (backtick) → check ya `command`, maandishi → `assertion`; step ya mwisho ya QA au §7 QA Checklist → `qa-final`; **ZOTE zinaanza `pending`/`not_run` (default-FAIL)** | `src/lib/cu/features.ts` (mpya) | ✅ |
| 1.2 | Engine inaituma sandbox: file inaandikwa `/home/user/ws/feature_list.json` **kabla ya agent kuanza** (kila run; resume: mirror inarudisha toleo la agent) | `src/lib/cu/engine.ts` | ✅ |
| 1.3 | Resume: file ikirudi kutoka kiovu → attempts/hali zinarejeshwa. *(Agent-written updates zina-mirror tayari; harness-writes zita-emit mirror eventos kwenye Awamu 2)* | `src/lib/cu/mirror.ts`, `cu/bridge.py` | ⏳ Awamu 2 |
| 1.4 | Task prompt inaunganisha: "FEATURE LIST (sheria): fanya **feature MOJA kwa wakati**; badilisha `state`/`attempts`/`evidence` pekee" | `cu/bridge.py` | ✅ |
| 1.5 | Tests: steps 8-15 + QA; command vs assertion; default-FAIL; hatua bila Verification → check ya kukataa (11) | `src/lib/cu/features.test.ts` (mpya) | ✅ |

---

## 4. Awamu 2 — `passes`-only + Evidence Gate

**Lengo:** agent anajihisi anadhibiti, **harness ndiyo mamlaka**.

| # | Kazi | Faili |
|---|---|---|
| 2.1 | **PreToolUse (Write/Edit `feature_list.json`):** diff ya JSON — inaruhusiwa TU: `features[].state` (`pending→in_progress→passed/failed`), `attempts`, `checks[].state/exit_code/artifact`, `evidence[]`, `last_failure`. Kubadilisha `id/title/required/command`, kuongeza/kufuta feature → **BLOCK** | `cu/bridge.py` |
| 2.2 | **Harness inarekodi check results yenyewe:** kila `PostToolUse (Bash)` — command ikilingana na `checks[].command` (fingerprint) → `state/exit_code/artifact` zinaandikwa **na harness** kwenye file (agent hana ruhusa ya kuzipinga) | `cu/bridge.py` |
| 2.3 | **`passed` inakubaliwa TU** kama checks zote `required` zimepita (kulingana na rekodi ya harness). La sivyo BLOCK: *"step-03: check «build» ilifeli (exit 1) — soma artifact, rekebisha."* | `cu/bridge.py` (`note_answer`) |
| 2.4 | **Evidence format:** `{kind: "command"\|"browser"\|"file", ref, exit_code, artifact, note, at}`; `browser` LAZIMA iwe na `note: "Nimeona: …"` (Awamu 5) | `cu/bridge.py` |
| 2.5 | Tests: kubadilisha title → BLOCK; `passed` bila checks → BLOCK; `passed` baada ya harness kurekodi exit 0 → PASS; kufuta feature → BLOCK | `cu/tests/test_r50_feature_gate.py` (mpya) |

---

## 5. Awamu 3 — Step QA inayozuia (Agenda QA → Step ya mpango)

**Lengo:** QA Checklist (§7) isiyokuwa maandishi — **Step ya mwisho inayopimika na inayozuia kumaliza**.

| # | Kazi | Faili |
|---|---|---|
| 3.1 | Board: `assemblePlanDocument` inaongeza **Step ya mwisho deterministic** — `### Step {N+1} — Final QA & Verification (REQUIRED)`; kila checkbox ya §7 → mstari wa check; kila check inapewa command au browser_assertion inayoweza kuendeshwa | `src/lib/board/workPlan.ts` |
| 3.2 | **Sehemu mpya ya lazima §9 — "Styling & Dependencies"** (chanzo cha ukweli kwa scaffold: framework, Tailwind/CSS, dependencies na versions) | `workPlan.ts` (`PLAN_SECTION_DEFS` 8→9), `boardRunner.ts` (plan parts) |
| 3.3 | **Validation inazuia:** `problems[]` → ikiwepo **mojawapo**: Step QA haipo, §9 haipo, step haina Verification, hatua < min — plan inakuwa `guard_failed` **na CU HAITOKUANZA** (engine inarudisha sababu wazi) | `workPlan.ts`, `src/lib/cu/engine.ts` |
| 3.4 | CU: **on_stop (Stop hook) haikubali kumaliza** kama QA feature haijapita — block + orodha ya checks zinazoshindwa; blocks 3 → PARTIAL | `cu/bridge.py` |
| 3.5 | Tests: plan bila Step QA → guard_failed + CU haianzi; QA check moja ikifeli → kumaliza kunazuiwa | vitest + `cu/tests/test_r50_qa_gate.py` (mpya) |

---

## 6. Awamu 4 — `on_stop` ya kila hatua + Harness verification

| # | Kazi | Faili |
|---|---|---|
| 4.1 | **Stop hook yenye orodha:** vipengele vyote `required` visivyo `passed` vinaorodheshwa kwenye block: *"ZINAZOSHINDWA: step-03 (build, exit 1), step-07 (fonts)"* — si jumla | `cu/bridge.py` |
| 4.2 | **Harness inaendesha commands za Step QA yenyewe** (allowlist + timeout 300s + artifact ya tail): agent asipozifanya, harness inafanya kabla ya kukubali mwisho | `cu/bridge.py` |
| 4.3 | **Ripoti inatengenezwa kutoka ushahidi:** VERIFIED (zote zimepita) · PARTIAL (baadhi) · BLOCKED (hakuna ushahidi) — harness inaiandika; agent haandiki hali ya mwisho | `cu/bridge.py` |
| 4.4 | Loop guard: block counter + brake iliyopo (R48) inaunganishwa — hakuna kuzuia bila kikomo | `cu/bridge.py` |
| 4.5 | Tests: features 3 kati ya 5 zikiwa passed → block yenye orodha kamili; zote → ripoti VERIFIED kutoka artifacts | `cu/tests/test_r50_report_from_evidence.py` (mpya) |

---

## 7. Awamu 5 — Recitation + compaction (Manus-style)

| # | Kazi | Faili |
|---|---|---|
| 5.1 | **Recitation kila zamu:** hali fupi ya `feature_list` (id + state) inaongezwa mwishoni mwa kila zamu (hook au brain append) — lengo linabaki mbele ya macho | `cu/bridge.py`, `cu/brain.py` |
| 5.2 | **Picha hazitupwi kama ushahidi haujaandikwa:** `compact_messages` inatupa picha ya zamani TU ikiwa feature yake ina `note: "Nimeona: …"`; la sivyo inabaki (cap ya picha N) | `cu/brain.py` |
| 5.3 | **"Nimeona:" inalazimishwa:** screenshot check (`browser_assertion`) ikipita, note yake inaingia evidence — bila note, check haipiti | `cu/bridge.py` |
| 5.4 | Tests: compaction inaacha picha yenye feature bila note; `browser` check bila note haipiti | `cu/tests/test_r50_recitation.py` (mpya) |

---

## 8. Awamu 6 — Visual Smoke Gate (Playwright)

| # | Kazi | Faili |
|---|---|---|
| 6.1 | Check mpya `browser_assertion` inaendesha: load page → **computed style** + `document.styleSheets` (idadi/bytes) | `cu/bridge.py` (harness-side) |
| 6.2 | **Viashiria vya failure:** `rgb(0, 0, 238)` / `#0000ee` / `#0000ff` / `Times New Roman` kwenye computed style ya body/links; stylesheet 0 au < 1KB; fonts za default | `cu/bridge.py` |
| 6.3 | Artifact: screenshot + `styles.json` + verdict; inaingia evidence ya QA feature | `cu/bridge.py` |
| 6.4 | Umoja: R34-B (marejeo tuli) inabaki; hii ni **runtime** — zote mbili zinahitajika | `cu/bridge.py` |
| 6.5 | Tests: HTML yenye CSS isiyopakiwa (fixture ya SafariSmart) → gate inagundua; HTML yenye style sahihi → inapita | `cu/tests/test_r50_visual_gate.py` (mpya) |

---

## 9. Awamu 7 — CONFLICT + isDemo (chanzo kimoja cha sheria)

| # | Kazi | Faili |
|---|---|---|
| 7.1 | **`CONFLICTS.md`:** mgongano wa data (mf. VAT ya SafariSmart) unaandikwa faili; plan §8 inasema "weka CONFLICT, endelea steps zisizoathirika, taja kwenye ripoti" — **lugha ya "simama umripoti CEO" inaondolewa** | `workPlan.ts`, `cu/bridge.py` |
| 7.2 | Board: `dataGuard` tofauti **zisizoweza kurekebishwa** → `CONFLICT` entries kwenye plan (si warning tu); Zinaingia `feature_list` kama check za QA | `boardRunner.ts`, `workPlan.ts` |
| 7.3 | **`isDemo`:** data za mfano LAZIMA zibebe `isDemo: true`; hook inakagua; ripoti inasema wazi "data ya mfano" | `cu/bridge.py` |
| 7.4 | Tests: conflict isiyotatuliwa → inaonekana kwenye ripoti; data ya mfano bila flag → block | `cu/tests/test_r50_conflict.py` (mpya) |

---

## 10. Awamu 8 — Mkaguzi Huru (verifier)

| # | Kazi | Faili |
|---|---|---|
| 8.1 | Verifier (context mpya, **lane tofauti** na mwandishi — kanuni za R49) anapokea: plan, `feature_list.json`, evidence, screenshots | `cu/bridge.py` |
| 8.2 | **Anaendesha mwenyewe:** build + kufungua browser (Playwright) — **kusoma ripoti PEKEE hakutoshi** | `cu/bridge.py` |
| 8.3 | Anatoka `VERIFIED / PARTIAL / BLOCKED` + findings; **engine inatumia matokeo yake** kwa hali ya mwisho | `src/lib/cu/engine.ts` |
| 8.4 | Tests: verifier mwenye build inayofeli → PARTIAL; zote zikiwa nzuri → VERIFIED | `cu/tests/test_r50_verifier.py` (mpya) |

---

## 11. Faili zitakazoguswa (hapa pekee)

**Mpya:** `src/lib/cu/features.ts` + `.test.ts` · `cu/tests/test_r50_*.py` (6-8 files)
**Zinaongezwa:** `cu/bridge.py` (hooks: preflight, feature gate, QA gate, on_stop, visual gate, conflict, verifier) · `cu/brain.py` (recitation, compaction) · `src/lib/cu/engine.ts` (kuandika feature_list, guard_failed gate, hali kutoka verifier) · `src/lib/board/workPlan.ts` (Step QA, §9, blocking validation) · `src/lib/boardRunner.ts` (plan parts, conflicts)
**Haziguswi:** Board engine (agenda/ledger/mjadala), UI, API nyingine zote.

---

## 12. Tests + Uthibitisho

| Ngazi | Kipimo |
|---|---|
| Unit (vitest) | `features.test.ts` + validation ya plan — jumla inatarajiwa **185+** |
| Unit (python) | `test_r50_*` — jumla inatarajiwa **200+** |
| Integration | Scaffold preflight kwenye sandbox halisi ya E2B (workspace yenye meta-files) |
| **LIVE E2E** | Mradi mpya mdogo wenye **makosa ya kusudi**: (a) CSS isiyopakiwa, (b) check moja inayofeli, (c) conflict ya data — vyote LAZIMA vionekane: `PARTIAL` yenye orodha, si "Imekamilika ✓" |
| Regression | Scenario za SafariSmart: Tailwind, VAT 82.60, PDF bandia, screenshot evidence |

---

## 13. Viwango vya kukubalika (definition of done)

| Hali | Behavior inayotakiwa |
|---|---|
| Agent anasema "nimemaliza" bila checks | **BLOCK** + orodha ya features/checks zinazoshindwa |
| Agent anabadilisha `feature_list.json` zaidi ya `state`/evidence | **BLOCK** |
| Check ya build inafeli | Inabaki `failed` + artifact; `passed` hairuhusiwi |
| QA (Step ya mwisho) haijapita | Run **haiishi** kama VERIFIED — PARTIAL/BLOCKED + sababu |
| Plan haina Step QA / haina Verification | `guard_failed` — **CU haianzi** |
| Scaffold inakuja | Inafanya kazi kwenye workspace (meta-files zinastashwa) |
| CSS isiyopakiwa | **Inagundulika** (visual gate) — si kuonekana kwenye ripoti pekee |
| Screenshot | Inabaki hadi "Nimeona: …" iandikwe |
| Mgongano wa data | `CONFLICTS.md` + ripoti inautaja |
| Mwisho | Verifier huru (build + browser) → VERIFIED/PARTIAL/BLOCKED |

---

## 14. Mipaka & hatari (kwa uwazi)

- **Gharama:** muda/tokens zitaongezeka (harness inaendesha commands; verifier ni call ya ziada). Siyo eneo la "pesa nyingi" — ni usahihi.
- **Loop:** kila gate ina block counter + brake (R48) — hakuna kukwama bila mwisho.
- **Dhaifu wa model haubadiliki:** Gemini/lane dhaifu ikirudi kwenye CU, inaweza kuandika code mbovu — lakini **haitaripoti uongo tena**.
- **Verifier lazima aendeshe** — akisoma ripoti pekee, atakubali uongo (hii ni sheria ya utekelezaji).
- **Phase 8 (verifier) ni kubwa zaidi** — inaweza kugawanywa R51 kama utaona inachelewesha.

---

## 15. Utaratibu (hali halisi ya utekelezaji)

1. ✅ Utafiti (§0.0) — vyanzo 5 vya msingi vimesomwa; hakuna mechanism iliyobuniwa
2. ✅ **Awamu 0.5** (preflight + `plan.md` workspace bug-fix) + **Awamu 1** (`feature_list.json`) — vitest **183/183** · python **186/186** · tsc clean
3. 🔨 **Awamu 2** (passes/evidence gate: PreToolUse JSON-diff + checks zinazorekodiwa na harness + orodha ya on_stop) → inafuata
4. 🔨 **Awamu 3** (Step QA + §9 Styling + guard_failed blocking) → tests 100%
5. 🚀 deploy Koyeb → **LIVE test ndogo** (mradi mdogo wenye makosa ya kusudi)
6. 🔨 **Awamu 4–6** (on_stop ya kila hatua, recitation, visual gate) → tests 100%
7. 🔨 **Awamu 7** (CONFLICT/isDemo) + **Awamu 8** (verifier huru) → tests 100%
8. 🚀 deploy → **LIVE test kubwa** (mradi mpya wa kweli) + ripoti ya R50

Kama kawaida: kila awamu — code → tests zote (vitest + python + tsc) → push (`main`) → Koyeb inadeploy yenyewe → uthibitisho wa live.

---

## 16. Maamuzi ya mpangilio (defaults — Mkuu anaweza kubadilisha wakati wowote)

1. **Mpangilio:** tunaenda **Awamu kwa Awamu**, kila awamu na commit/push yake (0.5+1 zimepushiwa pamoja leo kwa sababu ni mfumo mmoja: "plan inaingia workspace + feature_list inazaliwa").
2. **Awamu 8 (verifier huru):** inabaki **R50** — ni roho ya "mkaguzi huru" ya utafiti (Anthropic evaluator). Ikileta gharama kubwa, tutaipunguza kwenye R51.
3. **Visual gate (6):** inaendesha **kwenye kila QA step** — kosa la SafariSmart lilikuwa "markup bila style"; CSS isiyopakiwa igundulike MAPEMA, si mwishoni.
