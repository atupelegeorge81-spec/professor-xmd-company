---
name: browser
description: read or operate web pages cheaply (text, links, status)
---
# Browser
- Read a page as clean text: `xmd-fetch <url>` (first ~3000 chars; full text saved to a file you can grep).
- Just check a site is up: `xmd-check <url>` → `200 · title · time`.
- Interactive pages (click/type/login): `xmd-browse open <url>`, `xmd-browse snap` (lists elements as @e1, @e2…),
  `xmd-browse click @e3`, `xmd-browse type @e2 "text"`. Take a new `snap` after every action.
- Prefer xmd-fetch/xmd-check. Use xmd-browse only when interaction is really required.
