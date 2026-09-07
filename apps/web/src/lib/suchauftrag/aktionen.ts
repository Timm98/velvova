"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema, withUser } from "@paycheck/db";
import {
  auftragAktivieren,
  auftragAnlegen,
  auftragBeenden,
  auftragFortsetzen,
  auftragEntwurfAendern,
  auftragPausieren,
  auftragsname,
  filterZuKriterien,
  laufAussetzen,
  signalFesthalten,
  suchprofilAusText,
} from "@paycheck/jobs";
import { klaerungsfrage, kriteriumSatz, type Klaerungsfrage } from "@paycheck/matching";
import { requireUser } from "@/lib/auth";

/**
 * Die Aktionen am Suchauftrag — für Karte, Chat und Sprache dieselben.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum alle Oberflächen hier durchgehen
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Auftrag lässt sich über die Karte ändern, im Gespräch mit Monday
 * und per Sprache. Drei Wege, die dasselbe tun sollen — und wenn jeder
 * seinen eigenen Code hat, tun sie nach dem dritten Umbau
 * Verschiedenes.
 *
 * Der auffällige Fall wäre: Die Karte prüft, ob eine Adresse bestätigt
 * ist, und der Sprachweg nicht.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum kein „Aktivieren" ohne ausdrückliche Handlung
 * ══════════════════════════════════════════════════════════════
 *
 * Jede dieser Aktionen setzt voraus, dass jemand sie ausgelöst hat.
 * Es gibt keinen Weg, auf dem ein Vorschlag von selbst aktiv wird —
 * `auftragAnlegen` erzeugt einen Entwurf, und nur `auftragBestaetigen`
 * macht daraus einen laufenden Auftrag.
 */

export type Aktionsbefund = { ok: true } | { ok: false; grund: string };

/**
 * „Diese Suche von Monday weiterführen lassen."
 *
 * Legt einen Entwurf an — mehr nicht. Die Bestätigung ist ein zweiter
 * Schritt, weil ein Klick auf einen Filter keine Aussage ist.
 */
export async function suchauftragAusFiltern(
  params: Record<string, string | undefined>,
): Promise<{ ok: boolean; auftragId?: string; name?: string }> {
  const user = await requireUser();
  const kriterien = filterZuKriterien(params);
  if (kriterien.length === 0) return { ok: false };

  const db = await getDb();
  const name = auftragsname(params);
  const befund = await auftragAnlegen(db, {
    userId: user.id,
    name,
    herkunft: "suchergebnisse",
    kanal: "nur_app",
    kriterien,
    bestaetigungstext: bestaetigungssatz(name, kriterien),
  });

  await signalFesthalten(db, user.id, {
    ereignisSchluessel: `auftrag-aus-filtern:${befund.auftragId}`,
    art: "filter_uebernommen",
    quelle: "ui_filter",
    auftragId: befund.auftragId,
    inhalt: { params },
    /* Ein Filterklick ist eine Handlung, keine Aussage. */
    ausdruecklich: false,
  });

  revalidatePath("/app/suchauftraege");
  return { ok: true, auftragId: befund.auftragId, name };
}

/**
 * Der Satz, der zur Bestätigung angezeigt wird.
 *
 * Er zählt auf, was gilt — nicht, was Monday alles kann. Wer zustimmt,
 * soll wissen, wozu.
 */
function bestaetigungssatz(
  name: string,
  kriterien: { kriterium: string; wert: unknown; staerke: string }[],
): string {
  const muss = kriterien.filter((k) => k.staerke === "muss").map((k) => beschreiben(k));
  const wunsch = kriterien.filter((k) => k.staerke !== "muss").map((k) => beschreiben(k));
  const teile = [`Ich suche für dich weiter: ${name}.`];
  if (muss.length > 0) teile.push(`Muss stimmen: ${muss.join(", ")}.`);
  if (wunsch.length > 0) teile.push(`Wünschenswert: ${wunsch.join(", ")}.`);
  teile.push("Die Treffer findest du in Velvova. E-Mails sind aus, bis du sie einschaltest.");
  return teile.join(" ");
}

/*
 * Der Wortlaut steht in `@paycheck/matching`.
 *
 * Dieselbe Bedingung erscheint im Bestätigungssatz und später in der
 * Mail als „dein Wunsch". Zwei Fassungen desselben Wortlauts laufen
 * auseinander — und wer seinen eigenen Wunsch nicht wiedererkennt,
 * glaubt dem Rest auch nicht.
 */
const beschreiben = kriteriumSatz;

export async function auftragBestaetigen(auftragId: string): Promise<Aktionsbefund> {
  const user = await requireUser();
  const db = await getDb();
  const befund = await auftragAktivieren(db, user.id, auftragId);
  revalidatePath("/app/suchauftraege");
  return befund.ok ? { ok: true } : { ok: false, grund: befund.grund };
}

export async function auftragPause(auftragId: string): Promise<Aktionsbefund> {
  const user = await requireUser();
  await auftragPausieren(await getDb(), user.id, auftragId);
  revalidatePath("/app/suchauftraege");
  return { ok: true };
}

export async function auftragWeiter(auftragId: string): Promise<Aktionsbefund> {
  const user = await requireUser();
  await auftragFortsetzen(await getDb(), user.id, auftragId);
  revalidatePath("/app/suchauftraege");
  return { ok: true };
}

/** „Heute Nacht nicht." Setzt genau einen Lauf aus. */
export async function auftragHeuteAussetzen(auftragId: string): Promise<Aktionsbefund> {
  const user = await requireUser();
  const neu = await laufAussetzen(await getDb(), user.id, auftragId);
  revalidatePath("/app/suchauftraege");
  return neu === null ? { ok: false, grund: "kein_fenster" } : { ok: true };
}

export async function auftragSchliessen(auftragId: string): Promise<Aktionsbefund> {
  const user = await requireUser();
  await auftragBeenden(await getDb(), user.id, auftragId, "nutzer");
  revalidatePath("/app/suchauftraege");
  return { ok: true };
}

/**
 * „E-Mails aus, Suche weiter."
 *
 * Ausdrücklich etwas anderes als Pausieren. Wer keine Mails will, will
 * nicht keine Stellen — und die Verwechslung dieser beiden ist der
 * Grund, warum Menschen ihre Suche verlieren, wenn sie eine Nacht Ruhe
 * wollten.
 */
export async function mailsAusschalten(): Promise<Aktionsbefund> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .insert(schema.benachrichtigungEinstellungen)
      .values({ userId: user.id, emailAktiv: false })
      .onConflictDoUpdate({
        target: schema.benachrichtigungEinstellungen.userId,
        set: { emailAktiv: false, aktualisiertAm: new Date() },
      }),
  );
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.suchAuftraege)
      .set({ kanal: "nur_app", aktualisiertAm: new Date() })
      .where(and(eq(schema.suchAuftraege.userId, user.id), eq(schema.suchAuftraege.kanal, "app_und_email"))),
  );
  revalidatePath("/app/suchauftraege");
  return { ok: true };
}

/**
 * „Nur noch Teilzeit." — aus dem Gespräch oder per Sprache.
 *
 * Legt einen Entwurf an und gibt den Satz zurück, mit dem Monday
 * nachfragt. Ändert nichts. Das ist der Unterschied zwischen einer
 * Assistenz und einem System, das mithört und entscheidet.
 *
 * Ohne Auftragskennung wird der einzige laufende Auftrag genommen.
 * Gibt es mehrere, kommt eine Rückfrage statt einer Vermutung — bei
 * mehrdeutigem Bezug zu raten ist genau der Fall, in dem jemand
 * hinterher eine Suche geändert bekommt, die er nicht gemeint hat.
 */
export async function auftragAendernVorschlagen(eingabe: {
  auftragId?: string | null;
  kriterium: string;
  wert: unknown;
  staerke?: "muss" | "wunsch";
  aussage: string;
  quelle?: string;
}): Promise<
  | { ok: true; profilId: string; frage: string; rueckfragen: string[] }
  | { ok: false; grund: "kein_auftrag" | "mehrdeutig" | "nicht_gefunden"; auswahl?: { id: string; name: string }[] }
> {
  const user = await requireUser();
  const db = await getDb();

  let auftragId = eingabe.auftragId ?? null;
  if (!auftragId) {
    const laufende = await withUser(db, user.id, (tx) =>
      tx
        .select({ id: schema.suchAuftraege.id, name: schema.suchAuftraege.name })
        .from(schema.suchAuftraege)
        .where(and(eq(schema.suchAuftraege.userId, user.id), eq(schema.suchAuftraege.status, "aktiv"))),
    );
    if (laufende.length === 0) return { ok: false, grund: "kein_auftrag" };
    if (laufende.length > 1) return { ok: false, grund: "mehrdeutig", auswahl: laufende };
    auftragId = laufende[0]!.id;
  }

  const befund = await auftragEntwurfAendern(db, user.id, auftragId, {
    kriterium: eingabe.kriterium,
    wert: eingabe.wert,
    staerke: eingabe.staerke ?? "wunsch",
    aussage: eingabe.aussage,
    quelle: eingabe.quelle ?? "chat",
  });

  revalidatePath("/app/suchauftraege");
  if (!befund.ok || !befund.profilId) return { ok: false, grund: "nicht_gefunden" };
  return {
    ok: true,
    profilId: befund.profilId,
    frage: befund.bestaetigungstext ?? "Soll ich das so übernehmen?",
    rueckfragen: befund.rueckfragen ?? [],
  };
}

/**
 * Der einzige laufende Auftrag — oder nichts.
 *
 * Für die Aktionen, die Monday ohne Kennung auslöst („pausiere die
 * Suche"). Bei mehreren fragt sie nach, statt einen zu wählen.
 */
export async function einzigerAuftrag(): Promise<
  { ok: true; id: string } | { ok: false; grund: "keiner" | "mehrere" }
> {
  const user = await requireUser();
  const db = await getDb();
  const laufende = await withUser(db, user.id, (tx) =>
    tx
      .select({ id: schema.suchAuftraege.id })
      .from(schema.suchAuftraege)
      .where(and(eq(schema.suchAuftraege.userId, user.id), eq(schema.suchAuftraege.status, "aktiv"))),
  );
  if (laufende.length === 0) return { ok: false, grund: "keiner" };
  if (laufende.length > 1) return { ok: false, grund: "mehrere" };
  return { ok: true, id: laufende[0]!.id };
}

/**
 * „Monday, such für mich weiter nach …"
 *
 * Der Einstieg aus Chat und Sprache. Legt einen Entwurf an und gibt
 * zurück, was gälte — mehr nicht. Ein gesprochener Satz ist mehrdeutig,
 * und später wird jemand fragen, wann die Person zugestimmt hat.
 *
 * Ohne eingerichtetes Modell passiert nichts, und das steht in der
 * Antwort. Einen Auftrag aus Stichwörtern zusammenzuraten wäre
 * schlechter als keiner.
 */
export async function suchauftragAusText(
  text: string,
  quelle: "chat" | "voice" = "chat",
  auftragId?: string | null,
): Promise<
  | {
      ok: true;
      auftragId: string;
      bestaetigungstext: string;
      rueckfrage: string | null;
      kriterien: string[];
      /* Was weggefallen ist — die Person soll es erfahren, nicht raten. */
      verworfen: string[];
      /* Ob keine Tätigkeit erkannt wurde. Kein Fehler, aber eine
         sehr breite Suche — und das gehört vor die Zustimmung. */
      ohneTaetigkeit: boolean;
    }
  | { ok: false; grund: string }
> {
  const user = await requireUser();
  const db = await getDb();

  const { modellBereit, modellrufer, PROMPT_SUCHPROFIL } = await import("./modellrufer");
  const modell = await modellBereit();
  if (!modell.bereit) return { ok: false, grund: "kein_modell" };

  const befund = await suchprofilAusText(db, {
    userId: user.id,
    text,
    quelle,
    auftragId: auftragId ?? null,
    rufer: modellrufer(),
    prompt: PROMPT_SUCHPROFIL,
  });

  revalidatePath("/app/suchauftraege");
  if (!befund.ok || !befund.auftragId) return { ok: false, grund: befund.grund ?? "fehler" };
  return {
    ok: true,
    auftragId: befund.auftragId,
    bestaetigungstext: befund.bestaetigungstext ?? "",
    rueckfrage: befund.rueckfrage ?? null,
    kriterien: befund.kriterien ?? [],
    verworfen: (befund.verworfen ?? []).map((v) => v.kriterium),
    ohneTaetigkeit: befund.ohneTaetigkeit === true,
  };
}

export interface Auftragsansicht {
  id: string;
  name: string;
  status: string;
  kanal: string;
  rhythmus: string;
  sendezeitLokal: string;
  zeitzone: string;
  laufzeit: string;
  naechsteFaelligkeit: Date | null;
  zuletztGeprueft: Date | null;
  bestaetigtAm: Date | null;
  bestaetigungstext: string | null;
  kriterien: { kriterium: string; wert: unknown; staerke: string; gruppe: string | null }[];
  /** Vollständige Empfehlungen. */
  neu: number;
  /** Treffer, bei denen eine Muss-Bedingung offen ist. */
  zuKlaeren: number;
}

/**
 * Die Aufträge einer Person, mit ihren Zahlen.
 *
 * `neu` und `zuKlaeren` sind getrennt, weil sie Verschiedenes sind:
 * Das eine ist ein Vorschlag, das andere eine Frage. Sie in einer Zahl
 * zusammenzufassen hiesse, eine offene Frage als Empfehlung zu zählen.
 */
export async function auftraegeLaden(): Promise<Auftragsansicht[]> {
  const user = await requireUser();
  const db = await getDb();
  return withUser(db, user.id, async (tx) => {
    const auftraege = await tx
      .select()
      .from(schema.suchAuftraege)
      .where(eq(schema.suchAuftraege.userId, user.id))
      .orderBy(desc(schema.suchAuftraege.erstelltAm));

    const ansichten: Auftragsansicht[] = [];
    for (const a of auftraege) {
      if (a.status === "beendet") continue;
      const profilId = a.aktiveProfilVersion;
      const kriterien = profilId
        ? await tx
            .select({
              kriterium: schema.suchKriterien.kriterium,
              wert: schema.suchKriterien.wert,
              staerke: schema.suchKriterien.staerke,
              gruppe: schema.suchKriterien.gruppe,
            })
            .from(schema.suchKriterien)
            .where(eq(schema.suchKriterien.profilId, profilId))
        : await tx
            .select({
              kriterium: schema.suchKriterien.kriterium,
              wert: schema.suchKriterien.wert,
              staerke: schema.suchKriterien.staerke,
              gruppe: schema.suchKriterien.gruppe,
            })
            .from(schema.suchKriterien)
            .innerJoin(schema.suchProfile, eq(schema.suchProfile.id, schema.suchKriterien.profilId))
            .where(eq(schema.suchProfile.auftragId, a.id));

      const treffer = await tx
        .select({
          empfehlungsstatus: schema.auftragTreffer.empfehlungsstatus,
          zulaessigkeit: schema.auftragTreffer.zulaessigkeit,
        })
        .from(schema.auftragTreffer)
        .where(
          and(eq(schema.auftragTreffer.auftragId, a.id), eq(schema.auftragTreffer.zustand, "offen")),
        );

      ansichten.push({
        id: a.id,
        name: a.name,
        status: a.status,
        kanal: a.kanal,
        rhythmus: a.rhythmus,
        sendezeitLokal: a.sendezeitLokal,
        zeitzone: a.zeitzone,
        laufzeit: a.laufzeit,
        naechsteFaelligkeit: a.naechsteFaelligkeit,
        zuletztGeprueft: a.zuletztGeprueft,
        bestaetigtAm: a.bestaetigtAm,
        bestaetigungstext: null,
        kriterien,
        neu: treffer.filter((t) => t.empfehlungsstatus === "empfohlen").length,
        zuKlaeren: treffer.filter((t) => t.zulaessigkeit === "needs_clarification").length,
      });
    }
    return ansichten;
  });
}


/* ═══════════════════════════════════════════════════════════════
   Die Treffer im persönlichen Bereich
   ═══════════════════════════════════════════════════════════════ */

export interface Trefferansicht {
  trefferId: string;
  jobId: string;
  auftragId: string;
  auftragName: string;
  titel: string;
  arbeitgeber: string;
  ort: string;
  gehalt: string | null;
  fitScore: number | null;
  /** Die belegten Passungsgründe — höchstens zwei. */
  gruende: string[];
  /** Der wichtigste belegte offene Punkt, oder nichts. */
  caveat: string | null;
  /** Welche Muss-Bedingungen ungeklärt sind. */
  offenePunkte: string[];
  gefundenAm: Date;
  /** Ob die Stelle schon einmal gemeldet wurde. */
  bereitsGemeldet: boolean;
}

export interface Trefferlage {
  /** Vollständige Empfehlungen — nichts Offenes. */
  neu: Trefferansicht[];
  /** Passt womöglich, aber eine Muss-Bedingung ist ungeklärt. */
  zuKlaeren: Trefferansicht[];
}

/**
 * Was Monday gefunden hat — getrennt nach Empfehlung und offener Frage.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum zwei Listen und nicht eine sortierte
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Stelle, bei der das Gehalt fehlt und die Person ein
 * Mindestgehalt genannt hat, ist keine Empfehlung — sie ist eine
 * Frage. In einer gemeinsamen Liste stünde sie unter „gefunden für
 * dich", und die Person läse eine Zusage, die niemand gegeben hat.
 *
 * Getrennt kann sie auch etwas damit anfangen: Die zweite Liste ist
 * die Arbeitsliste — dort steht, was ein Anruf klären würde.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum dieselben gespeicherten Treffer und keine Neuberechnung
 * ══════════════════════════════════════════════════════════════
 *
 * Karte, Detailseite, Chat und Sprache sollen dasselbe sagen. Würde
 * diese Ansicht neu rechnen, zeigte sie nach einer Regeländerung
 * andere Zahlen als die Mail, die gestern hinausging — und niemand
 * könnte den Unterschied erklären.
 */
export async function trefferLaden(grenze = 40): Promise<Trefferlage> {
  const user = await requireUser();
  const db = await getDb();

  return withUser(db, user.id, async (tx) => {
    const zeilen = await tx
      .select({
        trefferId: schema.auftragTreffer.id,
        jobId: schema.auftragTreffer.jobId,
        kanonischeJobId: schema.auftragTreffer.kanonischeJobId,
        auftragId: schema.auftragTreffer.auftragId,
        auftragName: schema.suchAuftraege.name,
        zulaessigkeit: schema.auftragTreffer.zulaessigkeit,
        empfehlungsstatus: schema.auftragTreffer.empfehlungsstatus,
        fitScore: schema.auftragTreffer.fitScore,
        gruende: schema.auftragTreffer.gruende,
        caveat: schema.auftragTreffer.caveat,
        offenePunkte: schema.auftragTreffer.offenePunkte,
        berechnetAm: schema.auftragTreffer.berechnetAm,
        titel: schema.jobs.title,
        ort: schema.jobs.location,
        arbeitgeber: schema.companies.name,
        gehaltMin: schema.jobs.salaryMin,
        gehaltMax: schema.jobs.salaryMax,
        gehaltWaehrung: schema.jobs.salaryCurrency,
        gehaltZeitraum: schema.jobs.salaryPeriod,
        gehaltAngegeben: schema.jobs.salaryDisclosed,
      })
      .from(schema.auftragTreffer)
      .innerJoin(schema.suchAuftraege, eq(schema.suchAuftraege.id, schema.auftragTreffer.auftragId))
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.auftragTreffer.jobId))
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(
        and(
          eq(schema.auftragTreffer.userId, user.id),
          /*
           * Auch `ausgewaehlt` und `benachrichtigt` gehören hierher.
           *
           * Eine Stelle verschwindet nicht aus dem persönlichen
           * Bereich, weil eine Mail sie erwähnt hat — im Gegenteil,
           * dort sucht man sie danach.
           */
          inArray(schema.auftragTreffer.zustand, ["offen", "ausgewaehlt", "benachrichtigt"]),
        ),
      )
      .orderBy(desc(schema.auftragTreffer.berechnetAm))
      .limit(grenze * 2);

    const gemeldet = new Set(
      (
        await tx
          .select({ kanonischeJobId: schema.jobBenachrichtigungen.kanonischeJobId })
          .from(schema.jobBenachrichtigungen)
          .where(eq(schema.jobBenachrichtigungen.userId, user.id))
      ).map((g) => g.kanonischeJobId),
    );

    const abbilden = (z: (typeof zeilen)[number]): Trefferansicht => ({
      trefferId: z.trefferId,
      jobId: z.jobId,
      auftragId: z.auftragId,
      auftragName: z.auftragName,
      titel: z.titel,
      arbeitgeber: z.arbeitgeber,
      ort: z.ort,
      gehalt: gehaltstext(
        z.gehaltMin,
        z.gehaltMax,
        z.gehaltWaehrung,
        z.gehaltZeitraum,
        z.gehaltAngegeben,
      ),
      fitScore: z.fitScore,
      gruende: (z.gruende as string[]) ?? [],
      caveat: z.caveat,
      offenePunkte: (z.offenePunkte as string[]) ?? [],
      gefundenAm: z.berechnetAm,
      bereitsGemeldet: gemeldet.has(z.kanonischeJobId),
    });

    return {
      neu: zeilen
        .filter((z) => z.empfehlungsstatus === "empfohlen")
        .slice(0, grenze)
        .map(abbilden),
      zuKlaeren: zeilen
        .filter((z) => z.zulaessigkeit === "needs_clarification")
        .slice(0, grenze)
        .map(abbilden),
    };
  });
}

/**
 * Das Gehalt als Satz — oder nichts.
 *
 * Kein „Gehalt auf Anfrage". Das klingt nach einer Auskunft und ist
 * das Gegenteil: Die Anzeige sagt nichts, und das steht dann eben
 * nirgends.
 */
function gehaltstext(
  min: number | null,
  max: number | null,
  waehrung: string,
  zeitraum: string,
  angegeben: boolean,
): string | null {
  if (!angegeben || (min === null && max === null)) return null;
  const betrag = (n: number) => Math.round(n).toLocaleString("de-DE");
  const spanne = min !== null && max !== null && max > min ? `${betrag(min)} – ${betrag(max)}` : betrag((max ?? min)!);
  const je = zeitraum === "month" ? "im Monat" : zeitraum === "hour" ? "pro Stunde" : "im Jahr";
  return `${spanne} ${waehrung} ${je}`;
}


/* ═══════════════════════════════════════════════════════════════
   Rückmeldungen: fragen statt filtern
   ═══════════════════════════════════════════════════════════════ */

/**
 * Ob eine Klärungsfrage ansteht.
 *
 * Aus sieben Ablehnungen wegen Kundenkontakt wird kein Filter. Es
 * wird eine Frage — und erst aus der Antwort eine Präferenz.
 *
 * Gezählt werden nur Ablehnungen mit genanntem Grund. „Nicht
 * relevant" ohne Angabe heisst: diese Stelle nicht.
 */
export async function klaerungLaden(): Promise<Klaerungsfrage | null> {
  const user = await requireUser();
  const db = await getDb();
  return withUser(db, user.id, async (tx) => {
    const ablehnungen = await tx
      .select({
        grund: schema.matchFeedback.grund,
        erstelltAm: schema.matchFeedback.erstelltAm,
      })
      .from(schema.matchFeedback)
      .where(and(eq(schema.matchFeedback.userId, user.id), eq(schema.matchFeedback.art, "abgelehnt")))
      .orderBy(desc(schema.matchFeedback.erstelltAm))
      .limit(200);

    /*
     * Schon gestellte Fragen kommen nicht wieder.
     *
     * Sie stehen als Signal fest — auch wenn niemand geantwortet hat.
     * Eine Frage, die bei jedem Besuch erneut erscheint, ist keine
     * Frage mehr, sondern eine Aufforderung.
     */
    const gefragt = await tx
      .select({ schluessel: schema.profilSignale.ereignisSchluessel })
      .from(schema.profilSignale)
      .where(and(eq(schema.profilSignale.userId, user.id), eq(schema.profilSignale.art, "klaerung_gestellt")));

    return klaerungsfrage(
      ablehnungen,
      new Date(),
      gefragt.map((g) => g.schluessel.replace("klaerung:", "")),
    );
  });
}

/**
 * Die Antwort auf eine Klärungsfrage.
 *
 * `generell` wird zu einem weichen Kriterium — nicht zu einem Muss.
 * Ein Muss darf nur aus einer ausdrücklichen Bedingung entstehen, und
 * „das passt für mich generell nicht" ist eine Neigung, keine Grenze.
 */
export async function klaerungBeantworten(
  grund: string,
  antwort: "generell" | "diese_stellen",
): Promise<Aktionsbefund> {
  const user = await requireUser();
  const db = await getDb();

  await signalFesthalten(db, user.id, {
    ereignisSchluessel: `klaerung:${grund}`,
    art: "klaerung_gestellt",
    quelle: "feedback",
    inhalt: { grund, antwort },
    /* Die Antwort ist ausdrücklich — die Zählung, die zur Frage
       führte, war es nicht. */
    ausdruecklich: true,
  });

  if (antwort === "generell") {
    await withUser(db, user.id, (tx) =>
      tx.insert(schema.preferences).values({
        userId: user.id,
        kind: `abneigung_${grund}`,
        value: grund,
        /* Weich. Eine Neigung schliesst nichts aus. */
        harteBedingung: false,
        gewicht: 70,
        quelle: "feedback",
        konfidenz: 70,
        bestaetigt: true,
      }),
    );
  }

  revalidatePath("/app/suchauftraege");
  return { ok: true };
}

/**
 * Vermerken, dass jemand da war.
 *
 * Grundlage der Ruheregel: Nach 60 Tagen ohne verlässliche Aktivität
 * ruhen die Benachrichtigungen. „Verlässlich" heisst eine Handlung in
 * der Anwendung — nicht eine geöffnete Mail. Ein Öffnungspixel misst
 * Postfacheinstellungen, nicht Interesse.
 */
export async function aktivitaetVermerken(): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  const jetzt = new Date();
  await withUser(db, user.id, (tx) =>
    tx
      .insert(schema.benachrichtigungEinstellungen)
      .values({ userId: user.id, zuletztAktivAm: jetzt })
      .onConflictDoUpdate({
        target: schema.benachrichtigungEinstellungen.userId,
        set: { zuletztAktivAm: jetzt },
      }),
  );
}
