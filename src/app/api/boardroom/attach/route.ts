import { getRunner, activeRunner, streamRunner } from "@/lib/boardRunner";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const runner = (id ? getRunner(id) : null) || activeRunner();
  if (!runner) return Response.json({ active: null });
  return streamRunner(runner);
}
