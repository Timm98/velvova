import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { holen } from "@/lib/documents/ablage";

/**
 * Das eigene Profilbild ausliefern.
 *
 * ── Warum eine Route und keine öffentliche Datei ──────────────
 *
 * Läge das Bild unter `/public`, wäre es für jeden abrufbar, der den
 * Pfad kennt — und der Pfad ist der Inhalts-Hash, also erratbar für
 * jeden, der dasselbe Bild besitzt. Ein Profilbild gehört zur Person;
 * wer es sieht, entscheidet nicht der Zufall.
 *
 * Diese Route liefert ausschliesslich das Bild des angemeldeten
 * Nutzers. Sie nimmt keinen Pfad entgegen — damit gibt es nichts, was
 * jemand manipulieren könnte, um an ein fremdes Bild zu kommen.
 */
export async function GET(anfrage: Request): Promise<Response> {
  const user = await requireUser();

  /* Die Kennung wird nicht geprüft, nur bemerkt. Sie ist ein Schlüssel
     für den Zwischenspeicher des Browsers und kein Zugriffsmittel —
     ausgeliefert wird immer das aktuelle Bild des angemeldeten
     Nutzers, egal was im Anhang steht. */
  const hatKennung = new URL(anfrage.url).searchParams.has("v");
  const db = await getDb();

  const [zeile] = await withUser(db, user.id, (tx) =>
    tx
      .select({ pfad: schema.userSettings.avatarPfad })
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, user.id))
      .limit(1),
  );

  if (!zeile?.pfad) return new Response(null, { status: 404 });

  const daten = await holen({ bucket: "profilbilder", pfad: zeile.pfad }).catch(() => null);
  if (!daten) return new Response(null, { status: 404 });

  const art = zeile.pfad.endsWith(".png")
    ? "image/png"
    : zeile.pfad.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

  return new Response(new Uint8Array(daten), {
    headers: {
      "Content-Type": art,
      /*
       * `private`, weil das Bild zur Person gehört: Ein gemeinsamer
       * Zwischenspeicher dürfte es sonst an den nächsten Abrufer
       * ausliefern.
       *
       * Ein Jahr Haltbarkeit gilt nur, wenn die Adresse eine Kennung
       * trägt — dann ist ein anderes Bild eine andere Adresse.
       *
       * Hier stand einmal dieselbe Haltbarkeit ohne diese Bedingung,
       * begründet mit dem Inhalts-Hash im Dateinamen. Der steht aber
       * im Speicher und nicht in der Adresse: Aufgerufen wurde immer
       * `/app/profilbild`, und der Browser holte das Bild nach dem
       * ersten Mal ein Jahr lang nicht mehr. Ein gewechseltes Bild
       * war deshalb nicht zu sehen.
       *
       * Ohne Kennung wird jetzt nur kurz zwischengespeichert. Das ist
       * der Fall, den niemand aufrufen sollte — er kostet dann eben
       * eine Anfrage statt ein falsches Bild.
       */
      "Cache-Control": hatKennung
        ? "private, max-age=31536000, immutable"
        : "private, max-age=0, must-revalidate",
    },
  });
}
