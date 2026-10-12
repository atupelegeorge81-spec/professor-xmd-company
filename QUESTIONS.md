# QUESTIONS.md — Maswali ya utekelezaji (maelezo.md sheria ya 0.4)

Format: (a) ulichokuwa unafanya · (b) ulichokikuta · (c) chaguo · (d) pendekezo.
**[HALI] zinangoja majibu ya mmiliki — utekelezaji unaendelea kutumia pendekezo ililoandikwa.**

---

## Q-001: Backend ya Computer kwa mfumo wa milestones

- **(a)** Nilikuwa nikitekeleza sehemu 12 (mabadiliko upande wa Computer) na 10.5.
- **(b)** Hati inasema Computer akue kwenye `cu/brain.py` kama sasa (backend ya Claude + Gemini Swap Brain) na "Usiyaanze bila idhini" kwa LiteLLM/OpenHands. Lakini R51 Awamu 1–2 (zilizokwishafungwa na mmiliki wiki hii) ilibadilisha default kuwa **oh_bridge.py** (OpenHands SDK native + lanes.py + judge/harness) — `CU_AGENT_BACKEND=claude` inarudisha legacy.
- **(c)** Chaguo 1: nirudie default kwenye claude kwa mfumo wa milestones (kufuatia hati kwa herufi) — lakini hatakuachwa na kazi ya R51 iliyopitishwa kwa mithani. Chaguo 2: tekeleze milestones juu ya oh_bridge (mradi wa awali wa R51 yenyewe: judge+lanes+harness vinafanana na falsafa ya maelezo) na cu/bridge.py abaki kama legacy-mode inayotumia milestones-plumbing ileile (mpango, on_stop, OCB-C).
- **(d) [PENDEKEZO — nimetumia hiki]** Chaguo 2: milestones zinatumia **oh_bridge default** (OpenHands native — jina la kazi la mmiliki wa wiki hii); claude midomo haiondolewi. Sehemu 12 kwa claude-mode: marekebisho yanayohusu claude pekee (mfano 12.5 CLAUDE.md scaffold) yamefanywa kwenye bridge.py pia.

## Q-002: Harness ifanye push/deploy (12.6)

- **(a)** Sehemu 12.6 inataka Computer asione tokens; harness ifanye push/deploy. Kwa upande mwingine, hati yenyewe inasema "[UAMUZI] kutekeleza hili: kwa idhini ya mmiliki", lakini sehemu 17 ("[PENDEKEZO] tumia hadi atakaposema") inaitaja kama pendekeso lakini si agizo lililofungwa.
- **(b)** Leo: agent (Computer) ana GITHUB_TOKEN/VERCEL_TOKEN kwenye env yake; tokens zimekuwa zikionekana kwenye export za zamani.
- **(c)** (i) Push kutoka harness (mikono ya server, GITHUB_TOKEN ya server) — Computer haonekam kamwe. (ii) Push na agent kama sasa (kinyume na 12.6).
- **(d) [PENDEKEZO — nimetumia hiki]** Harness ndiyo ina-push + deploy (cu engine inaendesha `git push` + vercel kama amri za sandbox bila env za tokens kwenye bridge; redaction ya matokeo). Ukikataa, nifanye rudi kwa chaguo (ii) haraka.

## Q-003: UI ya milestone/round — kina cha chini

- **(a)** Maelezo.md (14.P2, 16.12) inataka onyesho dogo la milestone/round bila kuongeza "kipengele cha UI kikubwa".
- **(b)** BoardEvent (types.ts) ina variants zilizokwishatumika; UI hulenga kwa switch case.
- **(c)** (i) Variant mpya `milestone` + render ndogo (badge). (ii) Tumia matukio yaliyopo (`log`/`system`) bila mabadiliko ya UI.
- **(d) [PENDEKEZO — nimetumia hiki]** Chaguo (i) kidogo kabisa: variant `milestone` yenye id/title/status/round/mode; UI inaionyesha kama chip ya hali kando ya round indicator (sio bodi kubwa). Ukikataa, nitaifuta kwa chaguo (ii).
