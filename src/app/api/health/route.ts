import { Query } from "node-appwrite";
import { appwriteConfigured, databases, DB, SESSIONS_COL } from "@/lib/server/appwrite";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Afya ya mfumo: health check inapaswa KUTOIGUSA Database (Koyeb anaweza kuiua hali ya sms/#10).
 * DB itakaguliwa tu kwa ?db=1 (kuchunguza mara mvpere haraka kwa mgawo — si benti ya liveness). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const deep = url.searchParams.get("db") === "1";
  if (!appwriteConfigured) {
    // bila configuration ya Appwrite — app haiwezi kufanya kazi kamilly? report lakini USITUTE KOYEB kwa 503
    return Response.json({ ok: true, config: false, note: "appwrite not configured" });
  }
  if (!deep) return Response.json({ ok: true, write: false });
  try {
    await databases.listDocuments(DB, SESSIONS_COL, [Query.limit(1)]);
    return Response.json({ ok: true, appwrite: "ok" });
  } catch {
    return Response.json({ ok: false, appwrite: "unreachable" }, { status: 503 });
  }
}
