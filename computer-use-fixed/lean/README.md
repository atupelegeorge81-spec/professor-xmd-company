# XMD-Lean

Injini nyepesi ya computer-use + UI mpya yenye kila kitu LIVE.

## Kuendesha

```bash
cd copilotkit && npm install && npm run build && cd ..
XMD_API_KEY=<xkiro key> npm run lean        # http://localhost:8787
```

UI ya zamani bado ipo: `http://localhost:8787/?old=1`

## Env

| Jina | Default | Maana |
|---|---|---|
| `XMD_API_KEY` | — (lazima) | key ya provider (OpenAI-compatible) |
| `XMD_MODEL` | `qwen/qwen3.8-max:free` | model |
| `XMD_BASE_URL` | `https://api.xkiro.com/v1` | provider |
| `XMD_PROTOCOL` | `text` | `text` = amri ndani ya maandishi (tokens ~1,100 chache kwa kila ombi); `tools` = native function calling |
| `XMD_EFFORT` | `low` | reasoning effort (inapanda hadi medium baada ya makosa 2) |
| `XMD_BUDGET_TOKENS` | 45K ndogo / 180K kubwa | kikomo cha tokens kwa kazi |
| `SEARXNG_URL` | searxng-northflank | utafutaji (`xmd-search`) |
| `XMD_SEARCH_RETRIES` | 10 | retries za `xmd-search` (majaribio = retries+1, backoff 2s→8s — inavuka cold-start ya Render) |
| `XMD_SEARCH_TIMEOUT` | 25 | timeout ya sekunde KWA KILA jaribio la `xmd-search` |
| `GITHUB_TOKEN`, `NETLIFY_AUTH_TOKEN`, `VERCEL_TOKEN` | — | `xmd-push`, `xmd-deploy` |
| `XMD_MODE=e2b` + `E2B_API_KEY` | local | injini inaendeshwa ndani ya E2B (HAIJAJARIBIWA) |
| `XMD_DUMP` | — | faili la kuhifadhi kila ombi (debug ya tokens) |

## Muundo

- `xmd_lean.py` — injini (stdlib tu). Inatoa mistari `@@XMD {json}`: think_delta, tool_draft (amri ikiandikwa), exec_start / exec_output (kila 80ms) / exec_end, usage, finish, run_end.
- `server.mjs` — Node `http` bila dependency: inaendesha injini, inatuma events kwa SSE, inazihifadhi (`.runs/threads/<id>/events.jsonl`) ili refresh isipoteze kitu; `/ws/<id>/` inaonyesha site iliyotengenezwa.
- `bin/` — helpers zinazotoa mistari michache: `skill`, `xmd-search`, `xmd-fetch`, `xmd-check`, `xmd-map`, `xmd-push`, `xmd-deploy`, `xmd-browse`.
- `skills/*/SKILL.md` — zinapakiwa tu kwa `@jina` au router.
- `../copilotkit/src/lean/` — UI mpya (model.ts, useLean.ts, Timeline, tools, Computer, Composer, lean.css).

⚠️ Mode ya `local` inaendesha amri kwenye mashine ya server yenyewe. Kwa production tumia E2B au container.
