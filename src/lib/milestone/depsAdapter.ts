// src/lib/milestone/depsAdapter.ts — kiunganishi cha deps za pipeline na injini halisi:
//  • computerBuild → CU engine (MilestoneStartPack kama planOverride; token/phase mpya PER milestone/round)
//  • collectEvidence → HARNESS YA P4 (hakujawekwa — ready=false hivyo trigger inabaki imezimwa kwa uwazi)
// Kanuni: tusiipanje ushahidi. P4 inapoweka harness, ready inakuwa true na trigger inaamka.
import { beginNewCuPhase, startComputerPhase, cuEnabled, type CuHooks } from "../cu/engine";
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

  // --- collectEvidence: P4 harness (screenshots/DOM/commands/git diff) — HAKUJAWEKWA ---
  const ready = false;
  const reason = "harness ya ushahidi (P4) bado haijawekwa — trigger imehifadhiwa na imezimwa hadi basso";

  return { deps, ready, reason };
}
