import { getLatestSession } from "@/lib/reports";
export const dynamic = "force-dynamic";
export async function GET() {
  const s = await getLatestSession();
  return Response.json({ session: s });
}
