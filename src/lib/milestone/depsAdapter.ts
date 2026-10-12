// src/lib/milestone/depsAdapter.ts — kiunganishi cha deps za pipeline na injini halisi:
//  • computerBuild → CU engine (MilestoneStartPack kama planOverride; token/phase mpya PER milestone/round)
//  • collectEvidence → HARNESS YA P4 (hakujawekwa — ready=false hivyo trigger inabaki imezimwa kwa uwazi)
// Kanuni: tusiipanje ushahidi. P4 inapoweka harness, ready inakuwa true na trigger inaamka.
import { beginNewCuPhase, startComputerPhase, cuEnabled, type CuHooks } from "../cu/engine";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectEvidencePack, evidenceRel, type CollectArgs, type SbxLike } from "./harness/collect";
import type { OrchestratorDeps, ComputerBuildRequest, ComputerBuildResult, BuildTerminal } from "./orchestrate";

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
    });
    const cu = runner.cu;
    const report: string | undefined = cu?.report;
    const changed: string[] = Array.isArray(cu?.files) ? cu.files.filter((x: any) => typeof x === "string") : [];
    const cuDone = !!cu?.done;
    if (!cuDone) throw new Error(`CU haikumaliza (${cu?.paused ? "PAUSED_QUOTA" : "imekatizwa"}) — pipeline inasimama kwa usalama (curatibu wa pause).`);
    const terminal: BuildTerminal = (cu?.terminal as BuildTerminal | undefined) || "COMPLETED_VERIFIED";
    // Risiti zinaondolewa kutoka kwenye Ripoti ya Milestone kwa P4 (mkataba wa receipts 5.6/7.3). Sasa:
    // tunarudisha tupu — harness itathibitisha NO-OP, na round-verify itasema kusema ukweli.
    return { terminal, report, receipts: [], changedFiles: changed };
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
