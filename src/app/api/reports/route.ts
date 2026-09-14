import { listReports } from "@/lib/reports";
export const dynamic = "force-dynamic";
export async function GET() {
  const reports = await listReports();
  return Response.json({ reports });
}
