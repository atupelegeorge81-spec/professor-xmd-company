import { listConversations, getConversation, deleteConversation } from "@/lib/reports";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const c = await getConversation(id);
    return Response.json({ conversation: c });
  }
  const list = await listConversations();
  return Response.json({ conversations: list });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
  const ok = await deleteConversation(id);
  return Response.json({ ok });
}
