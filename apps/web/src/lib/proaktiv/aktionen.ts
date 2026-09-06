"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema, withUser } from "@paycheck/db";
import {
  automatikSchalten,
  handlungBeantworten,
  naechsteNachricht,
  stufeSetzen,
  type Ninanachricht,
} from "@paycheck/jobs";
import { HANDLUNGEN, type Eigeninitiative } from "@paycheck/matching";
import { requireUser } from "@/lib/auth";

/**
 * Was die Person mit Ninas Eigeninitiative tun kann.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum jede Handlung eine eigene Aktion hat
 * ══════════════════════════════════════════════════════════════
 *
 * Eine einzige `ninaEinstellen(alles)` wäre kürzer und würde die
 * Rechteprüfung an einen Parameter hängen. Getrennte Aktionen können
 * getrennt geprüft werden — und was hier nicht steht, lässt sich aus
 * der Oberfläche nicht auslösen.
 */

export interface Automatikeintrag {
  id: string;
  handlung: string;
  beschreibung: string;
  begruendung: string;
  jobId: string | null;
  jobTitel: string | null;
  arbeitgeber: string | null;
  nachricht: string | null;
  brauchtZustimmung: boolean;
  zustand: string;
  erstelltAm: Date;
  abschaltbar: boolean;
  /** Was die Handlung hervorgebracht hat — Fragen oder ein Vergleich. */
  ergebnis: Handlungsergebnis | null;
}

/**
 * Das Ergebnis, in genau den zwei Formen, die es heute gibt.
 *
 * ── Warum nicht `unknown` ─────────────────────────────────────
 *
 * Weil die Oberfläche es rendern muss. Ein `unknown`, das an einer
 * Stelle als Vergleich und an einer anderen als Fragenliste gelesen
 * wird, ist eine Fehlerquelle, die der Übersetzer nicht sieht.
 */
export type Handlungsergebnis =
  | { fragen: { schluessel: string; frage: string }[] }
  | {
      vergleich: {
        jobIds: string[];
        titel: string[];
        zeilen: { merkmal: string; werte: (string | null)[]; unterschiedlich: boolean }[];
        unterschiede: string[];
        offen: string[];
      };
    };

/**
 * Was in „Von Nina automatisch“ steht.
 *
 * Nur was noch offen ist oder gerade getan wurde — eine Liste, die
 * jede jemals ausgeführte Handlung zeigt, liest niemand mehr, und
 * dann fällt auch nicht auf, wenn etwas Ungewolltes darin steht.
 */
export async function automatikListe(grenze = 20): Promise<Automatikeintrag[]> {
  const user = await requireUser();
  const db = await getDb();

  const zeilen = await withUser(db, user.id, (tx) =>
    tx
      .select({
        id: schema.ninaHandlungen.id,
        handlung: schema.ninaHandlungen.handlung,
        begruendung: schema.ninaHandlungen.begruendung,
        jobId: schema.ninaHandlungen.jobId,
        nachricht: schema.ninaHandlungen.nachricht,
        zustand: schema.ninaHandlungen.zustand,
        ergebnis: schema.ninaHandlungen.ergebnis,
        erstelltAm: schema.ninaHandlungen.erstelltAm,
        jobTitel: schema.jobs.title,
        arbeitgeber: schema.companies.name,
      })
      .from(schema.ninaHandlungen)
      .leftJoin(schema.jobs, eq(schema.jobs.id, schema.ninaHandlungen.jobId))
      .leftJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(
        and(
          eq(schema.ninaHandlungen.userId, user.id),
          inArray(schema.ninaHandlungen.zustand, ["vorgeschlagen", "ausgefuehrt"]),
        ),
      )
      .orderBy(desc(schema.ninaHandlungen.erstelltAm))
      .limit(grenze),
  );

  return zeilen.map((z) => ({
    id: z.id,
    handlung: z.handlung,
    beschreibung: HANDLUNGEN[z.handlung]?.beschreibung ?? z.handlung,
    begruendung: z.begruendung,
    jobId: z.jobId,
    jobTitel: z.jobTitel,
    arbeitgeber: z.arbeitgeber,
    nachricht: z.nachricht,
    brauchtZustimmung: z.zustand === "vorgeschlagen",
    zustand: z.zustand,
    erstelltAm: z.erstelltAm,
    abschaltbar: HANDLUNGEN[z.handlung]?.abschaltbar ?? false,
    ergebnis: (z.ergebnis as Handlungsergebnis | null) ?? null,
  }));
}

/** „Behalten“ oder „Nicht interessant“ an einer automatischen Handlung. */
export async function handlungEntscheiden(
  handlungId: string,
  antwort: "behalten" | "verworfen",
): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const db = await getDb();
  const befund = await handlungBeantworten(db, user.id, handlungId, antwort);
  revalidatePath("/app/jobs");
  return befund;
}

/** „Nicht mehr automatisch machen“ für eine Handlungsart. */
export async function automatikAbschalten(
  handlung: string,
  erlaubt: boolean,
): Promise<{ abgeschaltet: string[] }> {
  const user = await requireUser();

  /*
   * Nur was die Tabelle als abschaltbar führt.
   *
   * `geschlossene_ausblenden` etwa ist nicht abschaltbar: Eine
   * abgelaufene Anzeige in den aktiven Vorschlägen zu lassen wäre
   * kein Dienst an der Person, sondern ein Fehler mit Schalter.
   */
  const regel = HANDLUNGEN[handlung];
  if (!regel || !regel.abschaltbar) return { abgeschaltet: [] };

  const db = await getDb();
  const liste = await automatikSchalten(db, user.id, handlung, erlaubt);
  revalidatePath("/app/einstellungen");
  return { abgeschaltet: liste };
}

/** Die Stufe von Ninas Eigeninitiative. */
export async function eigeninitiativeSetzen(stufe: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (stufe !== "zurueckhaltend" && stufe !== "ausgeglichen" && stufe !== "proaktiv")
    return { ok: false };

  const db = await getDb();
  await stufeSetzen(db, user.id, stufe as Eigeninitiative);
  revalidatePath("/app/einstellungen");
  return { ok: true };
}

export interface Eigeninitiativestand {
  stufe: string;
  abgeschaltet: string[];
  aktiv: boolean;
  /** Alle abschaltbaren Handlungen mit ihrer Beschreibung. */
  schalter: { handlung: string; beschreibung: string; erlaubt: boolean }[];
}

export async function eigeninitiativeStand(): Promise<Eigeninitiativestand> {
  const user = await requireUser();
  const db = await getDb();

  const [e] = await withUser(db, user.id, (tx) =>
    tx
      .select()
      .from(schema.ninaEigeninitiative)
      .where(eq(schema.ninaEigeninitiative.userId, user.id))
      .limit(1),
  );

  const abgeschaltet = new Set(e?.abgeschaltet ?? []);
  const schalter = Object.entries(HANDLUNGEN)
    .filter(([, r]) => r.abschaltbar)
    .map(([handlung, r]) => ({
      handlung,
      beschreibung: r.beschreibung,
      erlaubt: !abgeschaltet.has(handlung),
    }));

  return {
    stufe: e?.stufe ?? "ausgeglichen",
    abgeschaltet: [...abgeschaltet],
    aktiv: e?.aktiv ?? true,
    schalter,
  };
}


/**
 * Die nächste Sache, die Nina von sich aus sagen möchte.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum dieselbe Aktion für Chat und Sprache
 * ══════════════════════════════════════════════════════════════
 *
 * Weil sonst zwei Wege entstünden, auf denen Nina spricht — und
 * zwei Wege heisst früher oder später zwei verschiedene Regeln.
 *
 * Der Vermerk „gesagt“ liegt im Server. Deshalb sagt die Sprache
 * nicht noch einmal, was der Chat schon gesagt hat, und ein zweites
 * Gerät wiederholt nichts.
 *
 * Die Sprachausgabe bekommt dadurch keine zusätzlichen Rechte: Sie
 * liest denselben Satz vor, den auch im Chat stünde, und die
 * Zustimmung zu einem Vorschlag läuft über dieselbe Aktion.
 */
export async function ninaSagtEtwas(): Promise<Ninanachricht | null> {
  const user = await requireUser();
  const db = await getDb();
  return naechsteNachricht(db, user.id);
}
