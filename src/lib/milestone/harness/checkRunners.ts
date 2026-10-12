// src/lib/milestone/harness/checkRunners.ts — watekelezaji wa vipimo vya kukubalika (8.3).
// HUKUMU NI YA CODE: kila kipimo kinaendeshwa na kufanyiwa uamuzi hapa — LLM haihusiki.
// I/O inaingizwa (sbx exec/fetch/files) — kwa hivyo vipimo hivi vimejaweza majaribio yake.
import type { AcceptanceCheck, CheckResult, CheckType } from "../types";
import { analyzeDom, type DomMetricsJson } from "./domScript";

import { contrastPasses } from "./contrast";

/* ============ IO ya kubadilishwa (sandbox au mock) ============ */

export interface HarnessIO {
  /** amri ya shell ndani ya sandbox → exit code + out */
  runCmd: (cmd: string, opts?: { timeoutMs?: number }) => Promise<{ code: number; stdout: string; stderr: string }>;
  /** faili lipo + soma (relative kwenye workspace ya sandbox) */
  fileRead: (path: string) => Promise<string | null>;
  /** DOM metrics zilizokwishakusanywa kwa route×viewport (screenshotId → JSON) */
  domFor: (screenshotId: string) => Promise<DomMetricsJson | null>;
  /** HTTP request (mradi unakimbia kwenye sandbox → url huwa localhost) */
  http: (method: string, url: string) => Promise<{ status: number; body: string }>;
}

/** Context wa kipimo kimoja (kutoka ukweli ulio tayari). */
export interface RunCheckContext {
  milestoneId: string;
  round: number;
  /** S-### ids zilizopatikana tayari: route, viewport, state */
  screenshots: { id: string; route: string; viewport: string; state: string }[];
  io: HarnessIO;
}

const norm = (s: string | undefined) => (s || "").trim();

function fail(id: string, type: CheckType, detail: string): CheckResult {
  return { id, type, result: "FAIL", detail } as CheckResult;
}
function pass(id: string, type: CheckType, detail: string): CheckResult {
  return { id, type, result: "PASS", detail } as CheckResult;
}
function err(id: string, type: CheckType, detail: string): CheckResult {
  return { id, type, result: "ERROR", detail } as CheckResult;
}

/* ============ runners za kila aina (12) ============ */

async function runCommand(ch: AcceptanceCheck, ctx: RunCheckContext): Promise<CheckResult> {
  const id = ch.id || "C-?";
  const cmd = norm(ch.cmd);
  if (!cmd) return err(id, ch.type, "cmd imekosekana");
  try {
    const r = await ctx.io.runCmd(cmd);
    const want = ch.exitCode ?? 0;
    const got = r.code;
    return got === want
      ? pass(id, ch.type, `exit ${got} (inatarajiwa ${want})`)
      : fail(id, ch.type, `exit ${got} ≠ ${want} — ${(r.stderr || r.stdout).slice(0, 160)}`);
  } catch (e: any) {
    return err(id, ch.type, `amri imeshindwa kuendeshwa: ${String(e?.message || e).slice(0, 160)}`);
  }
}

async function runGrep(ch: AcceptanceCheck, ctx: RunCheckContext): Promise<CheckResult> {
  const id = ch.id || "C-?";
  const pat = norm(ch.pattern);
  if (!pat) return err(id, ch.type, "pattern imekosekana");
  const paths = ch.paths?.length ? ch.paths : ["."];
  let total = 0;
  for (const p of paths) {
    try {
      const r = await ctx.io.runCmd(`grep -r -c -E "${pat.replace(/"/g, '\\"')}" ${p} 2>/dev/null | awk -F: '{s+=$2} END {print s+0}'`);
      total += parseInt(r.stdout.trim(), 10) || 0;
    } catch (e: any) {
      return err(id, ch.type, `grep imeshindwa: ${String(e?.message || e).slice(0, 120)}`);
    }
  }
  const want = ch.count ?? 0;
  return total === want
    ? pass(id, ch.type, `idadi ${total} = ${want}`)
    : fail(id, ch.type, `idadi ${total} ≠ ${want} ya "${pat}" kwenye ${paths.join(",")}`);
}

async function runDomExists(ch: AcceptanceCheck, ctx: RunCheckContext): Promise<CheckResult> {
  const id = ch.id || "C-?";
  const sel = norm(ch.selector);
  const route = norm(ch.route);
  if (!sel) return err(id, ch.type, "selector imekosekana");
  const shots = ctx.screenshots.filter((s) => s.route === route);
  if (!route || !shots.length) return err(id, ch.type, `hakuna screenshot kwa route "${route || "(hajatajwa)"}"`);
  // Utafute kwenye DOM metrics za shots za route hizi: selector is the "sel" token prefix
  for (const s of shots) {
    const dom = await ctx.io.domFor(s.id);
    if (!dom) continue;
    const hit = dom.elements.find((e) => e.sel.split(" >")[0].startsWith(sel) || e.sel.endsWith(" " + sel) || e.sel.includes(sel));
    if (hit) return pass(id, ch.type, `selector "${sel}" imepatikana ("${hit.text.slice(0, 40)}")`);
  }
  return fail(id, ch.type, `selector "${sel}" haipo kwenye ${route}`);
}

async function runComputedStyle(ch: AcceptanceCheck, ctx: RunCheckContext): Promise<CheckResult> {
  const id = ch.id || "C-?";
  const sel = norm(ch.selector);
  const prop = norm(ch.property);
  const route = norm(ch.route);
  if (!sel || !prop) return err(id, ch.type, "selector/property imekosekana");
  const shots = ctx.screenshots.filter((s) => s.route === route);
  for (const s of shots) {
    const dom = await ctx.io.domFor(s.id);
    if (!dom) continue;
    const el = dom.elements.find((e) => e.sel.endsWith(" " + sel) || e.sel.split(" >").pop() === sel || e.sel.includes(sel));
    if (!el) return fail(id, ch.type, `selector "${sel}" haipo ili kupima ${prop}`);
    const key = prop.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
    const got = (el.style as any)[key] ?? (el.style as any)[prop];
    if (ch.expected !== undefined && norm(ch.expected) !== "") {
      return norm(got) === norm(ch.expected)
        ? pass(id, ch.type, `${sel} ${prop} = "${got}"`)
        : fail(id, ch.type, `${sel} ${prop} = "${got}" ≠ "${ch.expected}"`);
    }
    if (ch.forbidden?.length) {
      return ch.forbidden.some((f) => norm(f) === norm(got))
        ? fail(id, ch.type, `${sel} ${prop} = "${got}" ni marufuku (${ch.forbidden.join("/")})`)
        : pass(id, ch.type, `${sel} ${prop} = "${got}" (sio marufuku)`);
    }
    return err(id, ch.type, "hakuna expected wala forbidden");
  }
  return err(id, ch.type, `hakuna DOM metrics kwa route "${route}"`);
}

function domsOf(ctx: RunCheckContext, routes?: string[], viewports?: string[]): Promise<({ shot: string; dom: DomMetricsJson })[]> {
  const rr = routes?.length ? routes : undefined;
  const vv = viewports?.length ? viewports : undefined;
  const shots = ctx.screenshots.filter((s) => (!rr || rr.includes(s.route)) && (!vv || vv.includes(s.viewport)));
  return Promise.all(
    shots.map(async (s) => ({ shot: s.id, dom: (await ctx.io.domFor(s.id)) as DomMetricsJson })),
  ).then((arr) => arr.filter((x) => !!x.dom));
}

async function runNoHorizontalOverflow(ch: AcceptanceCheck, ctx: RunCheckContext): Promise<CheckResult> {
  const id = ch.id || "C-?";
  const doms = await domsOf(ctx, ch.routes?.length ? ch.routes : (norm(ch.route) ? [norm(ch.route)] : undefined), ch.viewports?.length ? ch.viewports : undefined);
  if (!doms.length) return err(id, ch.type, "hakuna DOM metrics (screenshots zimekosekana)");
  const bad: string[] = [];
  for (const d of doms) {
    const a = analyzeDom(d.dom);
    if (a.horizontalOverflow) bad.push(`${d.shot} (overflow ${a.overflowAmount}px)`);
  }
  return bad.length
    ? fail(id, ch.type, `overflow kwenye ${bad.length}: ${bad.join("; ")}`)
    : pass(id, ch.type, `hakuna overflow kati of ${doms.length} DOM(s)`);
}

async function runConsoleClean(ch: AcceptanceCheck, ctx: RunCheckContext): Promise<CheckResult> {
  const id = ch.id || "C-?";
  const doms = await domsOf(ctx, ch.routes?.length ? ch.routes : (norm(ch.route) ? [norm(ch.route)] : undefined));
  if (!doms.length) return err(id, ch.type, "hakuna DOM metrics");
  const errs: string[] = [];
  for (const d of doms) for (const e of d.dom.console.errors) errs.push(`${d.shot}: ${e.slice(0, 120)}`);
  return errs.length
    ? fail(id, ch.type, `console errors ${errs.length}: ${errs.slice(0, 3).join(" | ")}`)
    : pass(id, ch.type, `console safi (${doms.length} DOM(s))`);
}

async function runContrastMin(ch: AcceptanceCheck, ctx: RunCheckContext): Promise<CheckResult> {
  const id = ch.id || "C-?";
  const sel = norm(ch.selector);
  const route = norm(ch.route);
  const min = ch.min ?? 4.5;
  const shots = ctx.screenshots.filter((s) => (route ? s.route === route : true));
  for (const s of shots) {
    const dom = await ctx.io.domFor(s.id);
    if (!dom) continue;
    const el = dom.elements.find((e) => (sel ? e.sel.endsWith(" " + sel) || e.sel.split(" >").pop() === sel || e.sel.includes(sel) : e.contrast !== null && e.text));
    if (!el) continue;
    if (el.contrast === null) return err(id, ch.type, `${sel || el.sel}: contrast haikuhesabiwa`);
    const ok = el.contrast >= min;
    // Kagua tena kwa contrast.ts (pure) kama style iko
    let verify = "";
    if (el.style?.color) {
      const bg = el.style.background && el.style.background !== "rgba(0, 0, 0, 0)" ? el.style.background : "#ffffff";
      const v = contrastPasses(el.style.color, bg, min);
      verify = ` · verify ${v.detail}`;
    }
    return ok
      ? pass(id, ch.type, `contrast ${el.contrast} ≥ ${min}${verify}`)
      : fail(id, ch.type, `contrast ${el.contrast} < ${min} ("${el.text.slice(0, 40)}")${verify}`);
  }
  return err(id, ch.type, `selector "${sel || "(text)"}" haikupatikana kwa contrast`);
}

async function runTouchTargetMin(ch: AcceptanceCheck, ctx: RunCheckContext): Promise<CheckResult> {
  const id = ch.id || "C-?";
  const px = ch.px ?? 44;
  const doms = await domsOf(ctx, ch.routes?.length ? ch.routes : (norm(ch.route) ? [norm(ch.route)] : undefined));
  if (!doms.length) return err(id, ch.type, "hakuna DOM metrics");
  const bad: string[] = [];
  for (const d of doms) {
    for (const e of d.dom.elements) {
      if (e.interactive && (e.box.w < px || e.box.h < px)) bad.push(`${d.shot}:${e.sel} (${Math.min(e.box.w, e.box.h)}px)`);
    }
  }
  return bad.length
    ? fail(id, ch.type, `touch targets ndogo ${bad.length}: ${bad.slice(0, 4).join(" | ")}`)
    : pass(id, ch.type, `touch targets zote ≥ ${px}px (${doms.length} DOM(s))`);
}

async function runHttp(ch: AcceptanceCheck, ctx: RunCheckContext): Promise<CheckResult> {
  const id = ch.id || "C-?";
  const method = norm(ch.method) || "GET";
  const url = norm(ch.url);
  if (!url) return err(id, ch.type, "url imekosekana");
  try {
    const r = await ctx.io.http(method, url);
    const want = ch.status ?? 200;
    if (r.status !== want) return fail(id, ch.type, `${method} ${url} → ${r.status} ≠ ${want}`);
    if (ch.bodyContains && !r.body.includes(ch.bodyContains)) return fail(id, ch.type, `${method} ${url} → ${r.status}, mwili hauna "${ch.bodyContains.slice(0, 60)}"`);
    return pass(id, ch.type, `${method} ${url} → ${r.status}${ch.bodyContains ? ` & mwili una "${ch.bodyContains.slice(0, 40)}"` : ""}`);
  } catch (e: any) {
    return err(id, ch.type, `http ilishindwa: ${String(e?.message || e).slice(0, 120)}`);
  }
}

async function runFileExists(ch: AcceptanceCheck, ctx: RunCheckContext): Promise<CheckResult> {
  const id = ch.id || "C-?";
  const path = norm(ch.path);
  if (!path) return err(id, ch.type, "path imekosekana");
  const content = await ctx.io.fileRead(path);
  return content !== null
    ? pass(id, ch.type, `${path} ipo (${content.length} chars)`)
    : fail(id, ch.type, `${path} haipo`);
}

async function runFileContains(ch: AcceptanceCheck, ctx: RunCheckContext): Promise<CheckResult> {
  const id = ch.id || "C-?";
  const path = norm(ch.path);
  const text = norm(ch.text);
  if (!path || !text) return err(id, ch.type, "path/text imekosekana");
  const content = await ctx.io.fileRead(path);
  if (content === null) return fail(id, ch.type, `${path} haipo`);
  return content.includes(text)
    ? pass(id, ch.type, `${path} ina "${text.slice(0, 50)}"`)
    : fail(id, ch.type, `${path} haina "${text.slice(0, 50)}"`);
}

async function runScreenshotTaken(ch: AcceptanceCheck, ctx: RunCheckContext): Promise<CheckResult> {
  const id = ch.id || "C-?";
  const route = norm(ch.route);
  const state = norm(ch.state) || "default";
  const hits = ctx.screenshots.filter((s) => (!route || s.route === route) && (!state || s.state === state || (state === "default" && !s.state)));
  return hits.length
    ? pass(id, ch.type, `screenshot ${hits[0].id} (${route}/${state}) imepigwa`)
    : fail(id, ch.type, `screenshot ya "${route}/${state}" haikupigwa`);
}

/* ============ dispatcher kuu ============ */

export async function runAcceptanceCheck(ch: AcceptanceCheck, ctx: RunCheckContext): Promise<CheckResult> {
  switch (ch.type) {
    case "command": return runCommand(ch, ctx);
    case "grep": return runGrep(ch, ctx);
    case "dom_exists": return runDomExists(ch, ctx);
    case "computed_style": return runComputedStyle(ch, ctx);
    case "no_horizontal_overflow": return runNoHorizontalOverflow(ch, ctx);
    case "console_clean": return runConsoleClean(ch, ctx);
    case "contrast_min": return runContrastMin(ch, ctx);
    case "touch_target_min": return runTouchTargetMin(ch, ctx);
    case "http": return runHttp(ch, ctx);
    case "file_exists": return runFileExists(ch, ctx);
    case "file_contains": return runFileContains(ch, ctx);
    case "screenshot_taken": return runScreenshotTaken(ch, ctx);
    default: return err(ch.id || "C-?", ch.type, `aina isiyojulikana: ${ch.type}`);
  }
}

export async function runAcceptanceChecks(checks: AcceptanceCheck[], ctx: RunCheckContext): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  for (const ch of checks) out.push(await runAcceptanceCheck(ch, ctx));
  return out;
}
