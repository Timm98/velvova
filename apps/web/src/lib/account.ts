"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { ablegen, inhaltsKennung } from "@/lib/documents/ablage";

/**
 * Den Anzeigenamen ändern.
 *
 * Bewusst eine eigene kleine Aktion statt eines Zweigs in
 * `updateSettings`: der Name steht in einer anderen Tabelle, und eine
 * Aktion, die je nach Formularinhalt in zwei Tabellen schreibt, wird
 * beim nächsten Feld unübersichtlich.
 */
export async function updateDisplayName(formData: FormData): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  const raw = String(formData.get("displayName") ?? "").trim();
  // Leer heißt: kein Name. Nicht der leere String — sonst steht später
  // "Hallo " ohne Namen dahinter.
  const displayName = raw.length > 0 ? raw.slice(0, 120) : null;

  await withUser(db, user.id, (tx) =>
    tx.update(schema.users).set({ displayName }).where(eq(schema.users.id, user.id)),
  );

  /*
   * Beide Wurzeln, nicht nur `/app`.
   *
   * Die Kopfzeile mit dem Profilbild steht auch über der Startseite
   * und den Marketingseiten. `revalidatePath("/app", …)` erreichte
   * die nie — wer sein Bild wechselte, sah im Anwendungsbereich das
   * neue und auf der Startseite weiter das alte.
   */
  revalidatePath("/app", "layout");
  revalidatePath("/", "layout");
}

/**
 * Ein Profilbild hochladen.
 *
 * ── Was geprüft wird und warum ────────────────────────────────
 *
 * **Der Typ, aus dem Inhalt und nicht aus dem Namen.** Eine Datei
 * `bild.png`, die in Wahrheit ein Skript ist, wäre sonst durchgegangen.
 * Die ersten Bytes verraten das Format zuverlässig; die Endung sagt
 * nur, wie jemand die Datei genannt hat.
 *
 * **Die Grösse.** Zwei Megabyte reichen für ein Bild, das mit 96
 * Pixeln angezeigt wird, um ein Vielfaches. Ohne Grenze lädt der
 * erste Nutzer ein 40-MB-Foto hoch, und danach jeder Seitenaufruf mit.
 *
 * ── Warum der Pfad die Kennung enthält ────────────────────────
 *
 * Der Dateiname ist der Inhalts-Hash. Lädt jemand dasselbe Bild
 * erneut, entsteht keine zweite Datei; lädt er ein anderes hoch,
 * ändert sich der Pfad — und damit umgeht die Anzeige jeden
 * Zwischenspeicher, ohne dass ein Zeitstempel angehängt werden muss.
 */
export async function profilbildHochladen(formData: FormData): Promise<void> {
  const user = await requireUser();
  const datei = formData.get("bild");
  if (!(datei instanceof File) || datei.size === 0) return;

  if (datei.size > 2 * 1024 * 1024) {
    throw new Error("Das Bild ist grösser als 2 MB.");
  }

  const daten = new Uint8Array(await datei.arrayBuffer());
  const art = bildArt(daten);
  if (!art) {
    throw new Error("Nur JPEG, PNG oder WebP.");
  }

  const kennung = inhaltsKennung(daten);
  const pfad = `${user.id}/${kennung}.${art}`;
  await ablegen({ bucket: "profilbilder", pfad }, daten);

  const db = await getDb();

  /*
   * ══════════════════════════════════════════════════════════
   * Anlegen oder ändern — nicht nur ändern
   * ══════════════════════════════════════════════════════════
   *
   * Hier stand ein blosses `update`. Wer noch keine Zeile in
   * `user_settings` hatte, für den traf es null Zeilen — und ein
   * `update`, das nichts trifft, ist kein Fehler. Die Datei landete
   * in der Ablage, die Kennung nirgends, und die Seite lud zurück,
   * als sei alles gut. Kein Bild, keine Meldung, nichts zu suchen.
   *
   * `settings-actions.ts` hatte dafür längst ein `ensureSettings()`.
   * Diese Datei kannte es nicht, weil sie älter ist als die Zeile,
   * die sie voraussetzt.
   *
   * Statt zweier Schritte hier ein `insert … on conflict`: eine
   * Anweisung, ein Netzweg, und kein Zeitfenster dazwischen, in dem
   * eine zweite Anfrage die Zeile anlegt.
   */
  await withUser(db, user.id, (tx) =>
    tx
      .insert(schema.userSettings)
      .values({ userId: user.id, avatarPfad: pfad })
      .onConflictDoUpdate({
        target: schema.userSettings.userId,
        set: { avatarPfad: pfad, updatedAt: new Date() },
      }),
  );

  /*
   * Beide Wurzeln, nicht nur `/app`.
   *
   * Die Kopfzeile mit dem Profilbild steht auch über der Startseite
   * und den Marketingseiten. `revalidatePath("/app", …)` erreichte
   * die nie — wer sein Bild wechselte, sah im Anwendungsbereich das
   * neue und auf der Startseite weiter das alte.
   */
  revalidatePath("/app", "layout");
  revalidatePath("/", "layout");
}

/**
 * Das Bildformat aus den ersten Bytes.
 *
 * Bewusst keine Bibliothek: Drei Formate lassen sich an ihrer Signatur
 * erkennen, und jede Abhängigkeit für diese Aufgabe brächte mehr
 * Angriffsfläche mit, als sie abnimmt.
 */
function bildArt(d: Uint8Array): "jpg" | "png" | "webp" | null {
  if (d.length < 12) return null;
  if (d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff) return "jpg";
  if (d[0] === 0x89 && d[1] === 0x50 && d[2] === 0x4e && d[3] === 0x47) return "png";
  const riff = String.fromCharCode(d[0]!, d[1]!, d[2]!, d[3]!);
  const webp = String.fromCharCode(d[8]!, d[9]!, d[10]!, d[11]!);
  if (riff === "RIFF" && webp === "WEBP") return "webp";
  return null;
}

/** Das Profilbild wieder entfernen. */
export async function profilbildEntfernen(): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  /* Die Datei bleibt liegen: Sie ist nach dem Inhalt benannt und
     könnte zu einem anderen Konto gehören, das dasselbe Bild nutzt.
     Ein Aufräumlauf kann verwaiste Dateien später einsammeln. */
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.userSettings)
      .set({ avatarPfad: null })
      .where(eq(schema.userSettings.userId, user.id)),
  );
  /*
   * Beide Wurzeln, nicht nur `/app`.
   *
   * Die Kopfzeile mit dem Profilbild steht auch über der Startseite
   * und den Marketingseiten. `revalidatePath("/app", …)` erreichte
   * die nie — wer sein Bild wechselte, sah im Anwendungsbereich das
   * neue und auf der Startseite weiter das alte.
   */
  revalidatePath("/app", "layout");
  revalidatePath("/", "layout");
}
