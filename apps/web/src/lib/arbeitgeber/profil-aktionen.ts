"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { verlangeRolle, protokolliere } from "./zugang";
import { ALLE_FELDER, type Profilstand, type Wert } from "./profil-felder";

/**
 * Schreiben am Unternehmensprofil.
 *
 * ── Warum jedes Feld einzeln durch die Liste geht ─────────────
 *
 * Der bequeme Weg wäre, das ganze Formular in ein Objekt zu verwandeln
 * und der Datenbank zu übergeben. Dann bestimmte aber der Browser, was
 * geschrieben wird — ein zusätzliches Feld im Formular landete
 * ungeprüft in der Tabelle, und `veroeffentlicht_am` liesse sich vom
 * Formular aus setzen.
 *
 * `ALLE_FELDER` ist deshalb die Erlaubnisliste. Was dort nicht steht,
 * wird nicht geschrieben — auch wenn es mitgeschickt wurde.
 */

export type SpeicherErgebnis = { ok: boolean; fehler?: string; stand?: string };

/** Leere Eingaben werden zu `null`, nicht zu "". */
function sauber(wert: FormDataEntryValue | null): string | null {
  if (typeof wert !== "string") return null;
  const t = wert.trim();
  return t.length > 0 ? t.slice(0, 4000) : null;
}

export async function profilSpeichern(
  organizationId: string,
  formData: FormData,
): Promise<SpeicherErgebnis> {
  try {
    /*
     * „recruiter" reicht zum Schreiben, „admin" zum Veröffentlichen.
     *
     * Wer Stellen schreibt, schreibt auch am Profil — beides ist
     * derselbe Arbeitsvorgang. Das Veröffentlichen ist etwas anderes:
     * Danach steht es öffentlich im Namen des Unternehmens.
     */
    const { user } = await verlangeRolle(organizationId, "recruiter");

    const werte: Record<string, unknown> = {};
    for (const f of ALLE_FELDER) {
      if (f.name === "gruendungsjahr") {
        const roh = sauber(formData.get(String(f.name)));
        const zahl = roh ? Number.parseInt(roh, 10) : null;
        /* Ein Gründungsjahr in der Zukunft oder vor der Erfindung des
           Unternehmens ist ein Tippfehler, kein Wert. */
        werte[f.name] = zahl && zahl >= 1700 && zahl <= new Date().getFullYear() ? zahl : null;
        continue;
      }
      werte[f.name] = sauber(formData.get(String(f.name)));
    }

    /*
     * Die Werte kommen als drei Paare, nicht als JSON aus dem Browser.
     *
     * Ein JSON-Feld im Formular hiesse, dass die Struktur vom Client
     * bestimmt wird. Drei feste Paare lassen sich prüfen: Ein Wert ohne
     * Text fällt weg, ein Beispiel ohne Wert ebenfalls.
     */
    const paare: Wert[] = [];
    for (let i = 0; i < 3; i++) {
      const wert = sauber(formData.get(`wert_${i}`));
      if (!wert) continue;
      paare.push({ wert: wert.slice(0, 120), beispiel: sauber(formData.get(`beispiel_${i}`))?.slice(0, 600) ?? "" });
    }

    const db = await getDb();
    await withUser(db, user.id, async (tx) => {
      await tx
        .insert(schema.unternehmensprofile)
        .values({
          organizationId,
          ...(werte as Partial<Profilstand>),
          werte: paare,
          aktualisiertAm: new Date(),
          aktualisiertVon: user.id,
        })
        .onConflictDoUpdate({
          target: schema.unternehmensprofile.organizationId,
          /*
           * `veroeffentlichtAm` steht bewusst NICHT in dieser Menge.
           *
           * Sonst setzte jedes Speichern des Entwurfs die
           * Veröffentlichung zurück — oder, je nach Wert, löste eine
           * aus. Der Zeitpunkt gehört allein `profilVeroeffentlichen`.
           */
          set: {
            ...(werte as Partial<Profilstand>),
            werte: paare,
            aktualisiertAm: new Date(),
            aktualisiertVon: user.id,
          },
        });
    });

    revalidatePath("/business/unternehmensseite");
    return { ok: true, stand: new Date().toISOString() };
  } catch (fehler) {
    return { ok: false, fehler: fehler instanceof Error ? fehler.message : "Speichern fehlgeschlagen." };
  }
}

/**
 * Veröffentlichen — und was dafür dastehen muss.
 *
 * Zwei Bedingungen, beide nicht verhandelbar:
 *
 *   **Eine Kurzbeschreibung.** Eine Unternehmensseite ohne einen Satz
 *   darüber, was das Unternehmen tut, ist keine Seite.
 *
 *   **Eine geprüfte Zugehörigkeit.** Ohne sie stünde eine Seite im
 *   Namen eines Unternehmens öffentlich im Netz, das nichts davon
 *   weiss. Dieselbe Regel gilt schon für Stellenanzeigen; sie hier
 *   auszulassen wäre die Hintertür.
 */
export async function profilVeroeffentlichen(
  organizationId: string,
): Promise<SpeicherErgebnis> {
  try {
    const { user } = await verlangeRolle(organizationId, "admin");
    const db = await getDb();

    const [org] = await db
      .select({ verifiedAt: schema.organizations.verifiedAt, slug: schema.organizations.slug })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId))
      .limit(1);

    if (!org?.verifiedAt) {
      return {
        ok: false,
        fehler:
          "Die Zugehörigkeit zum Unternehmen ist noch nicht bestätigt. Solange sie offen ist, kann die Seite nicht veröffentlicht werden.",
      };
    }
    if (!org.slug) {
      return { ok: false, fehler: "Für die öffentliche Adresse fehlt noch der Profilname." };
    }

    const [profil] = await db
      .select({ kurzbeschreibung: schema.unternehmensprofile.kurzbeschreibung })
      .from(schema.unternehmensprofile)
      .where(eq(schema.unternehmensprofile.organizationId, organizationId))
      .limit(1);

    if (!profil?.kurzbeschreibung?.trim()) {
      return { ok: false, fehler: "Ohne Kurzbeschreibung fehlt der Seite ihr erster Satz." };
    }

    await withUser(db, user.id, (tx) =>
      tx
        .update(schema.unternehmensprofile)
        .set({ veroeffentlichtAm: new Date(), aktualisiertVon: user.id })
        .where(eq(schema.unternehmensprofile.organizationId, organizationId)),
    );

    await protokolliere(user.id, organizationId, "unternehmensseite_veroeffentlicht", organizationId);
    revalidatePath("/business/unternehmensseite");
    revalidatePath(`/unternehmen/${org.slug}`);
    return { ok: true };
  } catch (fehler) {
    return { ok: false, fehler: fehler instanceof Error ? fehler.message : "Veröffentlichen fehlgeschlagen." };
  }
}
