// src/app/api/boardroom/flags/route.ts — uchunguzi wa flags ya runtime (booleans tu — HAKUNA siri).
// Tunatumia kujibu haraka: "kwa nini milestones hazikuonekana?" — env za prod (XMD_MILESTONES/BOARD_PLAN_MODE/E2B).
import { NextResponse } from "next/server";
import { BOARD_PLAN_MODE } from "@/lib/env";
import { cuEnabled } from "@/lib/cu/engine";
import { milestonesEnabledFor } from "@/lib/milestone/host";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    flags: {
      /** XMD_MILESTONES !== off → on; host_inasimama kuzitengezwa kama ni plan-mode */
      milestonesEnvOn: milestonesEnabledFor(true),
      /** 'on' ⇒ code mode (milestones+CU); 'off' ⇒ plan mode (agenda+mpango tu) */
      boardPlanMode: BOARD_PLAN_MODE,
      cuEnabled: cuEnabled(),
      e2bKeyPresent: !!process.env.E2B_API_KEY,
      msBrowserEval: process.env.MS_BROWSER_EVAL === "1",
    },
    at: new Date().toISOString(),
  });
}
