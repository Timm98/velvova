import { loadMessages } from "@/lib/nina/conversations";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Ein Gespräch mit seinen Nachrichten.
 *
 * Die Kennung kommt aus der Adresse, die Nutzerkennung aus der Sitzung.
 * Eine fremde Gesprächskennung liefert kein fremdes Gespräch, sondern
 * eine leere Liste — die Zeilensicherheit filtert bereits in der
 * Abfrage.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;

  const messages = await loadMessages(user.id, id);
  return Response.json({
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
