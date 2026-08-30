import { listConversations } from "@/lib/nina/conversations";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Die eigenen Gespräche. Die Nutzerkennung kommt aus der Sitzung. */
export async function GET() {
  const user = await requireUser();
  const conversations = await listConversations(user.id);
  return Response.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      kind: c.kind,
      messageCount: c.messageCount,
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}
