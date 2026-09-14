import { activeRunner } from "@/lib/boardRunner";
export const dynamic = "force-dynamic";
export async function GET() {
  const r = activeRunner();
  return Response.json({ active: r ? { id: r.id, status: r.status, project: r.project } : null });
}
