---
name: search
description: search the web and read the best 1-2 sources
---
# Search
1. `xmd-search "precise words"` → top 5 results, 2 lines each (title, url, snippet). It retries 11× by itself (the engine sleeps sometimes and needs up to ~1 min to wake) — be patient and NEVER re-run it in a loop; one call is enough.
2. Read at most 2 promising pages with `xmd-fetch <url>`; grep the saved full text for details.
3. Cite URLs in the finish report. Do not search more than 3 times for one question.
4. `xmd-search` is the ONLY search tool. NEVER curl/wget google.com, bing.com, duckduckgo.com or any other search engine directly — forbidden, and they return garbage or block you.
5. If `xmd-search` itself fails (it prints "search failed after N attempts"), write that in the finish report and continue the task without web info. Do NOT switch to another search method.
