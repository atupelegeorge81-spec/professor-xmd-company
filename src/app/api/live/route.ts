/* P10 (#10): liveness ya kila kitu — inadaa DB/gharama. Usiguse DB hapa. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ ok: true, ts: Date.now() });
}
