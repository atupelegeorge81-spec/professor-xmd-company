import { startRun, streamRunner } from "@/lib/boardRunner";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const project = typeof body.project === "string" ? body.project.trim() : "";
  if (!project) return Response.json({ error: "Missing project" }, { status: 400 });
  const runner = startRun(project);
  return streamRunner(runner);
}
