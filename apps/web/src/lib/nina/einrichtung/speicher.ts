import "server-only";

import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { meineOrganisationen } from "@/lib/arbeitgeber/zugang";
import {
  IST_BEDIENART, IST_KANAL, IST_RHYTHMUS, IST_SPEICHERUNG, IST_STUFE, IST_ZEIT,
  TEXTFASSUNG,
  type Bedienart, type Kanal, type Kontotyp, type Rhythmus, type Sprachspeicherung, type Stufe,
} from "./texte";
import { pruefe } from "./pruefung";

/**
 * Ninas Einrichtung lesen, schreiben, widerrufen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum jeder Wert hier noch einmal geprüft wird
 * ══════════════════════════════════════════════════════════════
 *
 * Die Oberfläche zeigt drei Stufen an. Was ankommt, ist eine
 * Zeichenkette aus einem Formular — und ein Formular ist ein
 * Vorschlag, keine Zusicherung. Ohne Prüfung liesse sich eine vierte
 * Stufe erfinden, oder `prepare_and_connect` setzen, ohne dass die
 * Seite je angezeigt wurde.
 *
 * Deshalb steht hier `IST_STUFE` und nicht `as Stufe`. Eine
 * Typzusicherung prüft nichts; sie behauptet.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Kontotyp nicht vom Client kommt
 * ══════════════════════════════════════════════════════════════
 *
 * Er wird aus den Mitgliedschaften abgeleitet. Käme er mit dem
 * Formular, könnte sich ein Arbeitnehmerkonto als Unternehmen
 * eintragen — und bekäme damit die Stufentexte und später die
 * Weiterleitung eines Arbeitgebers.
 */

export type Einrichtungsstand = {
  kontotyp: Kontotyp;
  abgeschlossen: boolean;
  bedienart: Bedienart | null;
  sprachspeicherung: Sprachspeicherung;
  stufe: Stufe | null;
  briefingAktiv: boolean;
  briefingRhythmus: Rhythmus;
  briefingZeit: string;
  zeitzone: string;
  kanaele: Kanal[];
  textfassung: string | null;
  zugestimmtAm: Date | null;
  widerrufenAm: Date | null;
};

/** Wer eine Organisation hat, ist ein Unternehmenskonto. */
export async function kontotypVon(userId: string): Promise<Kontotyp> {
  const orgs = await meineOrganisationen(userId);
  return orgs.length > 0 ? "unternehmen" : "arbeitnehmer";
}

const STANDARD = (kontotyp: Kontotyp): Einrichtungsstand => ({
  kontotyp,
  abgeschlossen: false,
  bedienart: null,
  sprachspeicherung: "nur_bestaetigte",
  stufe: null,
  briefingAktiv: false,
  briefingRhythmus: "werktags",
  briefingZeit: "08:00",
  zeitzone: "Europe/Berlin",
  kanaele: ["in_app"],
  textfassung: null,
  zugestimmtAm: null,
  widerrufenAm: null,
});

export async function standLaden(userId: string): Promise<Einrichtungsstand> {
  const kontotyp = await kontotypVon(userId);
  const db = await getDb();

  const [zeile] = await withUser(db, userId, (tx) =>
    tx.select().from(schema.ninaEinrichtung).where(eq(schema.ninaEinrichtung.userId, userId)).limit(1),
  );

  if (!zeile) return STANDARD(kontotyp);

  return {
    /*
     * Der Kontotyp von JETZT, nicht der gespeicherte.
     *
     * Wer als Arbeitnehmer eingerichtet hat und danach eine Firma
     * anlegt, soll die Unternehmenstexte sehen. Was gespeichert ist,
     * bleibt trotzdem stehen — es belegt, welchen Text er damals
     * gelesen hat.
     */
    kontotyp,
    abgeschlossen: zeile.abgeschlossen,
    bedienart: IST_BEDIENART(zeile.bedienart) ? zeile.bedienart : null,
    sprachspeicherung: IST_SPEICHERUNG(zeile.sprachspeicherung) ? zeile.sprachspeicherung : "nur_bestaetigte",
    stufe: IST_STUFE(zeile.stufe) ? zeile.stufe : null,
    briefingAktiv: zeile.briefingAktiv,
    briefingRhythmus: IST_RHYTHMUS(zeile.briefingRhythmus) ? zeile.briefingRhythmus : "werktags",
    briefingZeit: IST_ZEIT(zeile.briefingZeit) ? zeile.briefingZeit : "08:00",
    zeitzone: zeile.zeitzone,
    kanaele: (zeile.kanaele ?? []).filter(IST_KANAL),
    textfassung: zeile.textfassung,
    zugestimmtAm: zeile.zugestimmtAm,
    widerrufenAm: zeile.widerrufenAm,
  };
}

/**
 * Muss die Seite gezeigt werden?
 *
 * Einmal je Konto — und erneut, wenn sich die Textfassung geändert
 * hat. Nicht bei jeder Anmeldung: Eine Einwilligung, die immer wieder
 * abgefragt wird, wird irgendwann weggeklickt, und dann steht im
 * Protokoll eine Zustimmung, die niemand gelesen hat.
 */
export function musstZeigen(stand: Einrichtungsstand): boolean {
  if (!stand.abgeschlossen) return true;
  if (stand.widerrufenAm !== null) return true;
  return stand.textfassung !== TEXTFASSUNG;
}

/* ── Protokoll ────────────────────────────────────────────────── */

async function protokolliere(
  userId: string,
  eintraege: { ereignis: string; vorher?: string | null; nachher?: string | null }[],
): Promise<void> {
  if (eintraege.length === 0) return;
  const db = await getDb();
  await withUser(db, userId, (tx) =>
    tx.insert(schema.ninaEinrichtungProtokoll).values(
      eintraege.map((e) => ({
        userId,
        ereignis: e.ereignis,
        vorher: e.vorher ?? null,
        nachher: e.nachher ?? null,
        textfassung: TEXTFASSUNG,
      })),
    ),
  );
}

/* ── Schreiben ────────────────────────────────────────────────── */

export type Einrichtungswunsch = {
  bedienart: unknown;
  sprachspeicherung: unknown;
  stufe: unknown;
  briefingAktiv: unknown;
  briefingRhythmus: unknown;
  briefingZeit: unknown;
  zeitzone: unknown;
  kanaele: unknown;
};

export type Speicherergebnis =
  | { ok: true; stand: Einrichtungsstand }
  | { ok: false; fehler: string };

export async function einrichtungSpeichern(
  userId: string,
  wunsch: Einrichtungswunsch,
): Promise<Speicherergebnis> {
  const kontotyp = await kontotypVon(userId);
  const vorher = await standLaden(userId);

  const geprueft = pruefe(wunsch);
  if (!geprueft.ok) return { ok: false, fehler: geprueft.fehler };
  const {
    bedienart, sprachspeicherung, stufe, briefingAktiv,
    briefingRhythmus, briefingZeit, zeitzone, kanaele,
  } = geprueft.werte;

  const jetzt = new Date();
  const db = await getDb();

  await withUser(db, userId, (tx) =>
    tx
      .insert(schema.ninaEinrichtung)
      .values({
        userId,
        kontotyp,
        abgeschlossen: true,
        abgeschlossenAm: jetzt,
        bedienart,
        sprachspeicherung,
        stufe,
        briefingAktiv,
        briefingRhythmus,
        briefingZeit,
        zeitzone,
        kanaele,
        textfassung: TEXTFASSUNG,
        zugestimmtAm: jetzt,
        /* Eine neue Zustimmung hebt einen früheren Widerruf auf. */
        widerrufenAm: null,
        aktualisiertAm: jetzt,
      })
      .onConflictDoUpdate({
        target: schema.ninaEinrichtung.userId,
        set: {
          kontotyp,
          abgeschlossen: true,
          abgeschlossenAm: jetzt,
          bedienart,
          sprachspeicherung,
          stufe,
          briefingAktiv,
          briefingRhythmus,
          briefingZeit,
          zeitzone,
          kanaele,
          textfassung: TEXTFASSUNG,
          zugestimmtAm: jetzt,
          widerrufenAm: null,
          aktualisiertAm: jetzt,
        },
      }),
  );

  /* Nur, was sich geändert hat. Ein Protokoll, in dem bei jedem
     Speichern alles steht, ist beim Nachlesen wertlos. */
  const eintraege: { ereignis: string; vorher?: string | null; nachher?: string | null }[] = [];
  const merke = (ereignis: string, alt: unknown, neu: unknown) => {
    const a = JSON.stringify(alt ?? null);
    const n = JSON.stringify(neu ?? null);
    if (a !== n) eintraege.push({ ereignis, vorher: a, nachher: n });
  };
  merke("bedienart", vorher.bedienart, bedienart);
  merke("sprachspeicherung", vorher.sprachspeicherung, sprachspeicherung);
  merke("stufe", vorher.stufe, stufe);
  merke("briefing", vorher.briefingAktiv, briefingAktiv);
  merke("briefing_rhythmus", vorher.briefingRhythmus, briefingRhythmus);
  merke("kanaele", vorher.kanaele, kanaele);
  if (!vorher.abgeschlossen) eintraege.push({ ereignis: "abschluss", nachher: TEXTFASSUNG });
  if (vorher.widerrufenAm) eintraege.push({ ereignis: "erneute_zustimmung", nachher: TEXTFASSUNG });
  await protokolliere(userId, eintraege);

  return { ok: true, stand: await standLaden(userId) };
}

/**
 * Die Hintergrundsuche widerrufen.
 *
 * Setzt die Stufe auf `manual` und schaltet das Briefing ab. Was
 * bereits gespeichert wurde, bleibt liegen: Ein Widerruf beendet die
 * künftige Verarbeitung — er ist kein Löschauftrag. Ob die
 * vorhandenen Ergebnisse bleiben, entscheidet die Person getrennt.
 */
export async function hintergrundWiderrufen(userId: string): Promise<Einrichtungsstand> {
  const vorher = await standLaden(userId);
  const jetzt = new Date();
  const db = await getDb();

  await withUser(db, userId, (tx) =>
    tx
      .update(schema.ninaEinrichtung)
      .set({
        stufe: "manual",
        briefingAktiv: false,
        kanaele: [],
        widerrufenAm: jetzt,
        aktualisiertAm: jetzt,
      })
      .where(eq(schema.ninaEinrichtung.userId, userId)),
  );

  await protokolliere(userId, [
    { ereignis: "widerruf", vorher: JSON.stringify(vorher.stufe), nachher: JSON.stringify("manual") },
  ]);

  return standLaden(userId);
}

/** Der Verlauf — für das Privacy Center. */
export async function protokollLaden(userId: string, grenze = 50) {
  const db = await getDb();
  const { desc } = await import("drizzle-orm");
  return withUser(db, userId, (tx) =>
    tx
      .select()
      .from(schema.ninaEinrichtungProtokoll)
      .where(eq(schema.ninaEinrichtungProtokoll.userId, userId))
      .orderBy(desc(schema.ninaEinrichtungProtokoll.erstelltAm))
      .limit(grenze),
  );
}
