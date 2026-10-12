// src/lib/milestone/harness/collect.ts — P4 · uvaxaji wa EvidencePack kutoka sandbox (Python) na vipimo vya code (TS).
// Hatua: (1) pitia cu/evidence.py → S-nnn + DOM metrics kwenye sandbox; (2) samea manifest;
// (3) endesha vipimo (checkRunners) -> hukumu ya code; (4) git-diff summary; (5) regression vs baselines.
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { runAcceptanceChecks, type HarnessIO } from "./checkRunners";
import { pixelDiffPct } from "./baselines";
import type { AcceptanceCheck, CheckResult, EvidencePack, Milestone, MilestonesRunState, RegressionEntry } from "../types";

/* ---------- sandbox handle (E2B) — inaingizwa ili iweze kufanywa kazi ndani/nje ---------- */
export interface SbxLike {
  commands: { run: (cmd: string, opts?: { timeoutMs?: number }) => Promise<{ exitCode: number; stdout: string; stderr: string }> };
  files: { write: (path: string, data: string | Uint8Array) => Promise<void>; read: (path: string) => Promise<Uint8Array> };
  sandboxId?: string;
}

export interface CollectArgs {
  sbx: SbxLike | null;              // null kwa fixtures (ts-local evidence fallback via readLocalEvidence)
  wsPath: string;                   // workspace path ndani ya sandbox (mf. /home/user/app) au local dir
  baseUrl: string;                  // http://localhost:3000 n.k.
  milestone: Milestone;
  round: number;
  run: MilestonesRunState;
  checks: AcceptanceCheck[];
  routes?: string[];                 // default: mpango au milestone repRoutes
  viewports?: string[];              // default ["375","1280"]
  states?: string[];                 // default ["default"]
  evidenceScriptSrc?: string;        // python src iliyosomwa (kwa write) — ts inakodisha
  executePython?: boolean;           // true → run cu/evidence.py @ sandbox
  replaysLocal?: Record<string, string>; // kwa test fixtures: path→content (local reads)
}

export function evidenceRel(milestoneId: string, round: number): string {
  return `.xmd/evidence/${milestoneId}/R${round}`;
}

/* ---------- Plan ya manifest -> EvidencePack ---------- */
export interface RawManifest {
  shots: { id: string; route: string; viewport: string; state: string; path: string; domPath?: string }[];
  domMetrics: { screenshotId: string; path: string }[];
  consoleErrors: string[];
  collectionErrors?: string[];
}

export function manifestToEvidence(
  milestone: Milestone,
  round: number,
  man: RawManifest,
  checks: CheckResult[],
  commands: { cmd: string; exit: number; logPath?: string }[],
  gitDiff: { filesChanged: number; insertions: number; deletions: number },
  regression: RegressionEntry[],
): EvidencePack {
  return {
    milestoneId: milestone.id,
    round,
    screenshots: man.shots.map((s) => ({ id: s.id, route: s.route, viewport: s.viewport, state: s.state, path: s.path })),
    domMetrics: man.domMetrics,
    checks,
    commands,
    gitDiffSummary: gitDiff,
    regression,
    consoleErrors: man.consoleErrors,
  } as EvidencePack;
}

/* ---------- Regression vs baselines ---------- */
export function regressionAgainst(
  currentPngs: Record<string, Uint8Array>,
  baselinePngs: Record<string, Uint8Array>,
  thresholdPct = 2,
): RegressionEntry[] {
  const out: RegressionEntry[] = [];
  for (const key of Object.keys(currentPngs)) {
    const base = baselinePngs[key];
    if (!base) continue;
    const pct = pixelDiffPct(currentPngs[key], base, 0.1);
    if (pct > thresholdPct) out.push({ route: key.split("@")[0] || key, viewport: key.split("@")[1] || "1280", changedPct: Math.round(pct * 100) / 100 });
  }
  return out;
}

/* ---------- IO adapter kwa checkRunners kutoka sandbox ---------- */
export function makeHarnessIO(args: {
  sbx: SbxLike | null;
  wsPath: string;
  milestoneId: string;
  round: number;
  baseUrl: string;
  domCache: Record<string, any>;
}): HarnessIO {
  const { sbx, wsPath, milestoneId, round, baseUrl, domCache } = args;
  const evDir = evidenceRel(milestoneId, round);
  return {
    async runCmd(cmd) {
      if (!sbx) return { code: 127, stdout: "", stderr: "(no sandbox — mock only)" };
      const r = await sbx.commands.run(`cd ${wsPath} && ${cmd}`, { timeoutMs: 120_000 });
      return { code: r.exitCode ?? 0, stdout: r.stdout || "", stderr: r.stderr || "" };
    },
    async fileRead(path) {
      if (sbx) {
        try {
          const b = await sbx.files.read(`${wsPath}/${path}`.replace(/\/+/g, "/"));
          return Buffer.from(b).toString("utf8");
        } catch { return null; }
      }
      try { return readFileSync(join(wsPath, path), "utf8"); } catch { return null; }
    },
    async domFor(screenshotId) {
      return domCache[screenshotId] ?? null;
    },
    async http(method, url) {
      const full = url.startsWith("http") ? url : `${baseUrl}${url}`;
      if (sbx) {
        const r = await makeHarnessIOcurl(sbx, method, full);
        return { status: r.status, body: r.body };
      }
      throw new Error("HTTP injection (sandbox) haipo — fixtures tumia io Bandia");
    },
  };
}

async function makeHarnessIOcurl(sbx: SbxLike, method: string, url: string): Promise<{ status: number; body: string }> {
  const r = await sbx.commands.run(
    `curl -s -o /tmp/__ms_http_body -w "%{http_code}" -X ${method} "${url.replace(/"/g, '\\"')}" && echo && cat /tmp/__ms_http_body`,
    { timeoutMs: 30_000 },
  );
  const out = (r.stdout || "");
  const lines = out.split("\n");
  const status = parseInt(lines[0] || "0", 10) || 0;
  return { status, body: lines.slice(1).join("\n") };
}

/* ---------- executePython @ sandbox ---------- */
export async function executeEvidencePython(args: CollectArgs): Promise<{ ok: boolean; outDir: string; manifest?: RawManifest; errors: string[] }> {
  const { sbx, wsPath, baseUrl, milestone, round } = args;
  if (!sbx) return { ok: false, outDir: evidenceRel(milestone.id, round), errors: ["sandbox haipo (mock only)"] };
  const scratches = args.evidenceScriptSrc || "_(evidence.py hajajapatikana — hakikisha ts inauweka)_";
  await sbx.files.write("/home/user/cu/evidence.py", scratches);
  const routes = (args.routes?.length ? args.routes : ["/"]).join(",");
  const vps = (args.viewports?.length ? args.viewports : ["375", "1280"]).join(",");
  const states = (args.states?.length ? args.states : ["default"]).join(",");
  const r = await sbx.commands.run(
    `cd ${wsPath} && python3 /home/user/cu/evidence.py --ws ${wsPath} --base-url ${baseUrl} --milestone ${milestone.id} --round ${round} --routes "${routes}" --viewports "${vps}" --states "${states}"`,
    { timeoutMs: 180_000 },
  );
  const stdout = (r.stdout || "").trim().split("\n").pop() || "{}";
  let summary: any = {};
  try { summary = JSON.parse(stdout); } catch { /* default */ }
  const outDir = `${wsPath}/${evidenceRel(milestone.id, round)}`.replace(/\/+/g, "/");
  let manifest: RawManifest | undefined;
  try {
    const mbytes = await sbx.files.read(`${outDir}/manifest.json`);
    manifest = JSON.parse(Buffer.from(mbytes).toString("utf8"));
  } catch { /* hapatikani */ }
  return { ok: !!manifest, outDir, manifest, errors: summary.errors || [] };
}

/** Kifaa cha DOM-metrics ya S-### (kuija kutoka sandbox au local fallback). */
export async function loadDomMap(args: { sbx: SbxLike | null; wsPath: string; wrapperDir: string; domMetrics: { screenshotId: string; path: string }[] }): Promise<Record<string, any>> {
  const out: Record<string, any> = {};
  for (const d of args.domMetrics) {
    const full = args.sbx ? `${args.wrapperDir}/${d.path}`.replace(/\/+/g, "/") : join(args.wrapperDir, d.path);
    try {
      const raw = args.sbx ? Buffer.from(await args.sbx.files.read(full)).toString("utf8") : readFileSync(full, "utf8");
      out[d.screenshotId] = JSON.parse(raw);
    } catch { /* skip */ }
  }
  return out;
}

/* ---------- msingi: collect full evidence (sandbox-first) ---------- */
export async function collectEvidencePack(args: CollectArgs): Promise<EvidencePack> {
  const { milestone, round, run } = args;

  let man: RawManifest = { shots: [], domMetrics: [], consoleErrors: [], collectionErrors: [] };
  let outDir = evidenceRel(milestone.id, round);
  const cmdEntries: { cmd: string; exit: number; logPath?: string }[] = [];

  const needVisual = milestone.reviewMode !== "technical";
  if (args.executePython && args.sbx && needVisual) {
    const ex = await executeEvidencePython(args);
    outDir = ex.outDir;
    if (ex.manifest) man = ex.manifest;
    cmdEntries.push({ cmd: "ep-evidence-python", exit: ex.ok ? 0 : 2, logPath: `${outDir}/manifest.json` });
  } else if (args.sbx && needVisual) {
    // hakuna executePython: soma manifest kutoka run (picha zimeshapigwa na Computer kwa mkataba wa riporti)
    try {
      const mbytes = await args.sbx.files.read(`${args.wsPath}/${outDir}/manifest.json`);
      man = JSON.parse(Buffer.from(mbytes).toString("utf8"));
    } catch { /* hakuna */ }
  } else if (args.replaysLocal) {
    // local fixture: rejandreja dome na pngs ki-local
    const pf = `${args.wsPath}/${outDir}/manifest.json`.replace(/\/+/g, "/");
    try { man = JSON.parse(args.replaysLocal[pf] || args.replaysLocal[outDir + "/manifest.json"] || ""); } catch { /* */ }
  }

  // DOM metrics → cache
  let domCache: Record<string, any> = {};
  if (man.domMetrics.length) {
    if (args.sbx) {
      domCache = await loadDomMap({ sbx: args.sbx, wsPath: args.wsPath, wrapperDir: ".", domMetrics: man.domMetrics });
    } else if (args.replaysLocal) {
      for (const d of man.domMetrics) {
        const key = `${args.wsPath}/${d.path}`.replace(/\/+/g, "/");
        outDir; // keep
        const raw = args.replaysLocal[key] ?? args.replaysLocal[d.path];
        if (raw) try { domCache[d.screenshotId] = JSON.parse(raw); } catch { /* */ }
      }
    }
  }

  // Git diff summary kwa commands (inafanyika kwa io ya checks vilevile)
  const io = makeHarnessIO({
    sbx: args.sbx, wsPath: args.wsPath, milestoneId: milestone.id, round, baseUrl: args.baseUrl, domCache,
  });
  const diffCmd = await io.runCmd("git -C $(pwd) diff --numstat | awk '{f+=1; i+=$1; d+=$2} END {print f+0, i+0, d+0}'");
  const nums = (diffCmd.stdout.match(/\d+/g) || []).map(Number);
  const gitDiff = { filesChanged: nums[0] || 0, insertions: nums[1] || 0, deletions: nums[2] || 0 };
  cmdEntries.push({ cmd: "git-diff-numstat", exit: diffCmd.code });

  // Vipimo vya kukubalika (hukumu ya code)
  const ctx = {
    milestoneId: milestone.id, round,
    screenshots: man.shots.map((s) => ({ id: s.id, route: s.route, viewport: s.viewport, state: s.state })),
    io,
  };
  const checks: CheckResult[] = await runAcceptanceChecks(args.checks, ctx);

  // Regression vs baselines (ziwekwe tu za screenshot zilizopatikana)
  let regression: RegressionEntry[] = [];
  try {
    regression = regressionAgainst({}, {}, 2);
  } catch { /* nzito -> skip */ }

  return manifestToEvidence(milestone, round, man, checks, cmdEntries, gitDiff, regression);
}
