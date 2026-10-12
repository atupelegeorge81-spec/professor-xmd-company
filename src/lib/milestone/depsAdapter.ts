// src/lib/milestone/depsAdapter.ts — kiunganishi cha deps za pipeline na injini halisi:
//  • computerBuild → CU engine (MilestoneStartPack kama planOverride; token/phase mpya PER milestone/round)
//  • collectEvidence → HARNESS YA P4 (hakujawekwa — ready=false hivyo trigger inabaki imezimwa kwa uwazi)
// Kanuni: tusiipanje ushahidi. P4 inapoweka harness, ready inakuwa true na trigger inaamka.
import { beginNewCuPhase, startComputerPhase, cuEnabled, type CuHooks } from "../cu/engine";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectEvidencePack, evidenceRel, type CollectArgs, type SbxLike } from "./harness/collect";
import { parseReceiptFiles, receiptFetchShell } from "./receipts";
import type { OrchestratorDeps, ComputerBuildRequest, ComputerBuildResult, BuildTerminal } from "./orchestrate";

/**
 * Soma risiti HALISI (.xmd/receipts/*.json) kutoka kwenye sandbox baada ya CU kumaliza
 * hatua ya ujenzi. handle haipo (mf. test fixtures) → orodha tupu (gate itasema NOT_ATTEMPTED).
 */
/** Fufua secret yoyote kwa "***" — output ya git push inaweza kumuipiga token kwenye URL ya remote. */
function redactSecret(text: string): string {
  const token = process.env.CU_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
  let out = typeof text === "string" ? text : String(text || "");
  if (token) out = out.split(token).join("***");
  out = out.replace(/x-access-token:[^@\s]*@/g, "x-access-token:***@");
  return out.slice(0, 400);
}

async function readSandboxReceipts(runner: Record<string, unknown>): Promise<ReturnType<typeof parseReceiptFiles>> {
  const sbx = (runner as any)?.__sbx as SbxLike | null | undefined;
  if (!sbx?.commands?.run) return [];
  try {
    const ws = ((runner as any)?.cu?.workspace as string) || "/home/user/app";
    const r = await sbx.commands.run(`cd "${ws}" && ${receiptFetchShell()}`, { timeoutMs: 20_000 });
    if (!r || typeof r.stdout !== "string" || !r.stdout) return [];
    const files: Record<string, string> = {};
    const parts = r.stdout.split(/@@@RECEIPT:([^\n]+)\n/);
    for (let i = 1; i + 1 < parts.length; i += 2) files[parts[i].trim()] = parts[i + 1] || "";
    return parseReceiptFiles(files);
  } catch { return []; }
}

export interface DepsAdapterArgs {
  runner: { id: string; sessionId: string; project: string; items: unknown[]; cu?: any; finale?: any } & Record<string, unknown>;
  cuHooks: CuHooks;
}

/**
 * Tengeneza deps za pipelini kutoka injini halisi.
 * `ready` = trigger ya host iko tayari kuendesha full-cycle halisi (lengo: baada ya P4 harness).
 */
export function milestoneDepsFor(args: DepsAdapterArgs): { deps: Partial<OrchestratorDeps>; ready: boolean; reason?: string } {
  const deps: Partial<OrchestratorDeps> = {};

  // --- computerBuild (HALISI): kila milestone/round → token mpya (beginNewCuPhase) + planOverride = StartPack ---
  deps.computerBuild = async (req: ComputerBuildRequest): Promise<ComputerBuildResult> => {
    const runner = args.runner as any;
    if (!cuEnabled()) throw new Error("CU engine haikuwezeshwa (cuEnabled=false)");
    // (a) phase mpya: chip + token zinazodondoka — mazingira safi kwa kila hatua (maelezo 4.4)
    beginNewCuPhase(runner);
    // (b) edaa msingi: planOverride = StartPack/planMd + phaseLabel ya hatua (divider/blog)
    await startComputerPhase(runner, args.cuHooks, {
      planOverride: {
        title: req.label || "milestone",
        md: req.planMd,
        steps: (req.planMd.match(/^###\s/gm) || []).length || 1,
      },
      phaseLabel: req.label || (req.round ? `raundi ${req.round}` : "ujenzi"),
      // C7: token haziyui bridge env — push/deploy yote ni YA HARNESS (server-side, hapa chini)
      noSecrets: true,
    });
    const cu = runner.cu;
    const report: string | undefined = cu?.report;
    const changed: string[] = Array.isArray(cu?.files) ? cu.files.filter((x: any) => typeof x === "string") : [];
    const cuDone = !!cu?.done;
    if (!cuDone) throw new Error(`CU haikumaliza (${cu?.paused ? "PAUSED_QUOTA" : "imekatizwa"}) — pipeline inasimama kwa usalama (curatibu wa pause).`);
    const terminal: BuildTerminal = (cu?.terminal as BuildTerminal | undefined) || "COMPLETED_VERIFIED";
    // Risiti HALISI (5.6/7.3): zimesomwa kutoka kwenye .xmd/receipts/ ya sandbox —
    // receipt-gate ya orchestrate itazithibitisha dhidi ya git diff na kupiga NO-OP zinazohitilafiana.
    const receipts = await readSandboxReceipts(runner);
    return { terminal, report, receipts, changedFiles: changed };
  };

  // --- C6+C7 (4.10): sign-off commit + git tag milestone-Mk + push — YOTE Server-SIDE, token haipici bridge env ---
  deps.signOffCommit = async (milestoneId: string) => {
    const runner = args.runner as any;
    const sbx = runner?.__sbx as SbxLike | null | undefined;
    if (!sbx?.commands?.run) return { tag: null, pushed: false, note: "hakuna sandbox (tag hairusiwi kwa fixtures)" };
    const token = process.env.CU_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
    const ws = (runner?.cu?.workspace as string) || "/home/user/app";
    const tag = `milestone-${milestoneId}`;
    const script = [
      `cd '${ws}' || exit 1`,
      `git config user.email 'harness@xmd.local' && git config user.name 'XMD Harness'`,
      `git add -A >/dev/null 2>&1 || true`,
      `(git diff --cached --quiet || git commit -qm 'chore(${milestoneId}): sign-off — XMD harness')`,
      `git tag -af '${tag}' -m 'milestone ${milestoneId} signed-off'`,
      `REMOTE=$(git remote get-url origin 2>/dev/null || true)`,
      `if [ -n "$REMOTE" ] && [ -n "$TOKEN" ]; then`,
      `  CLEAN=$(printf '%s' "$REMOTE" | sed -E 's#(https://)[^@/]*@#\\1#')`,
      `  PUSH_URL=$(printf '%s' "$CLEAN" | sed -E "s#https://#https://x-access-token:\${TOKEN}@#")`,
      `  git push "$PUSH_URL" HEAD --tags >/dev/null 2>&1 && echo PUSH_OK || echo PUSH_FAILED`,
      `else echo PUSH_SKIPPED; fi`,
    ].join("; ");
    try {
      const r = await sbx.commands.run(`export TOKEN='${token}'; ${script}`, { timeoutMs: 60_000 });
      const out = redactSecret(`${r?.stdout || ""} ${r?.stderr || ""}`);
      const pushed = out.includes("PUSH_OK");
      const note = pushed ? "push imekamilika" : out.includes("PUSH_SKIPPED") ? "hakuna remote/token — push imerukwa" : "push imeshindikana (angalia server log)";
      return { tag, pushed, note };
    } catch (e) {
      return { tag: null, pushed: false, note: redactSecret(String((e as { message?: string })?.message || e).slice(0, 160)) };
    }
  };

  // --- collectEvidence (P4 HALISI): sandbox ya cu kwakufanya evidence.py + checks ya code ---
  // --- P8-REST: 10.3.b — SUBIRI lane yenye vision kwa SIGN-OFF (hatukama sign na mechi ijali) ---
  deps.awaitVisionLane = async (reason: string): Promise<boolean> => {
    args.cuHooks?.blog?.("info", `👁️ vision lane: ${reason} — tunasubiri hadi juu ya dakika 3 kwa kujaribu tena (10.3.b).`);
    for (let t = 0; t < 4; t++) {
      await new Promise((res) => setTimeout(res, 45_000));
      // Rekodi ni rahisi tu: subiri, na judgeChat yeneye `requireVision: true` ndani ya verify ni ya majaribio — kwamba kutegemea lane
      // Inakula kwa counter: ilikuwa verifyRound imeendeshwa (anakuja tena mara baadae); subiri tena — mwishoni, false (ivisionOk ap conciliator)
    }
    args.cuHooks?.blog?.("warning", "⚠️ vision lane bado haikutokea baada ya majaribio — sign-off imezuiwe (10.3.b: badrenge mechi).");
    return false;
  };

  deps.collectEvidence = async (milestone, round, rep, run) => {
    const runner = args.runner as any;
    const cu = runner?.cu;
    const sbx = runner?.__sbx as SbxLike | null | undefined;  // engine inaweka bootloader muda
    if (!sbx) throw new Error("sandbox handle (__sbx) haipo — engine istacomplete kupanga");
    const wsPath = cu?.workspace || "/home/user/app";
    const baseUrl: string = cu?.links?.live || "http://localhost:3000";
    let evidenceSrc = (args as any).evidenceScriptSrc as string | undefined;
    if (!evidenceSrc) {
      // Q-004 uamuzi: TS inakimbia kwenye ndege ya backend; evidence.py inakuja kimatini
      try { evidenceSrc = readFileSync(resolve(process.cwd(), "src/lib/milestone/harness/evidence.py"), "utf8"); } catch { evidenceSrc = undefined; }
    }
    const pack = await collectEvidencePack({
      sbx, wsPath, baseUrl, milestone, round, run,
      checks: (run.plans[milestone.id]?.checks || []) as any,
      routes: Array.from(new Set((run.plans[milestone.id]?.checks || []).flatMap((c: any) => (c.routes as string[] | undefined) || (c.route ? [c.route as string] : [])))) || ["/"],
      executePython: true,
      evidenceScriptSrc: evidenceSrc,
    } as CollectArgs);
    // Ripoti inatumwa kwa rip-missing check (P9); leo iwekwe comment hakika
    void rep;
    return pack;
  };

  // ready: kwa PARACHA ya production inahitaji sandbox — trigger ya milestones host
  // inawaliza kama `cuEnabled()` (sandbox inaweza kufunguliwa). Kwa tests za CI (hakuna e2b),
  // host hailizi na full cycle unapimwa na mocks (orchestrate.test).
  const ready = cuEnabled();
  const reason = ready
    ? "harness iko tayari (cuEnabled) — sandbox itafunguka kwa kufika dart"
    : "CU engine haikuwezeshwa mazingira haya (hakuna E2B) — trigger imezimwa";

  return { deps, ready, reason };
}
