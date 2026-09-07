import { desc, eq } from "drizzle-orm";
import { schema, withUser, type Database } from "@paycheck/db";
import {
  kriteriumBekannt,
  kriteriumSatz,
  ortNormalisieren,
  ortUndModellTrennen,
  staerkeEntscheiden,
  staerkeFuerKriterium,
  umkreisAusText,
  zeitarbeitAusgeschlossen,
  taetigkeitStamm,
  verdichten,
  type Aenderungsvorschlag,
  type Bestandskriterium,
  type Signal,
  type Staerke,
} from "@paycheck/matching";
import { ortNachschlagen } from "../geodaten.ts";
import { mitGrenze, type Modellrufer } from "./modell.ts";

/**
 * Systemprompt 1 — aus einem Satz ein Suchauftrag.
 *
 * ══════════════════════════════════════════════════════════════
 * „Monday, such für mich weiter nach Lagerstellen in Karlsruhe"
 * ══════════════════════════════════════════════════════════════
 *
 * Das ist der Einstieg, für den es ein Modell braucht. Ein Filterklick
 * ist strukturiert; ein Satz ist es nicht — und genau dazwischen liegt
 * der Unterschied zwischen einem Formular und einer Assistenz.
 *
 * ══════════════════════════════════════════════════════════════
 * Was das Modell hier NICHT entscheidet
 * ══════════════════════════════════════════════════════════════
 *
 * Ob etwas gilt. Es schlägt vor; `verdichten` entscheidet, und zwar
 * nach Regeln über Rechte, nicht über Sprache:
 *
 *   Jede Änderung braucht eine echte Signal-ID.
 *   Beobachtetes erzeugt kein Muss.
 *   Eine bestätigte Angabe wird nur durch einen ausdrücklichen
 *   Änderungsauftrag ersetzt.
 *   Eine Befristung ohne Frist ist keine.
 *
 * Danach kommt noch eine Prüfung, die es beim Filterweg nicht braucht:
 * Ein Schlüssel, für den es keine Prüfung gibt, wird verworfen. Sonst
 * stünde „arbeitsatmosphaere: gut" im Auftrag der Person und bewirkte
 * nie etwas.
 *
 * ══════════════════════════════════════════════════════════════
 * Und warum am Ende ein Entwurf steht
 * ══════════════════════════════════════════════════════════════
 *
 * Weil ein gesprochener Satz mehrdeutig ist und weil sich später
 * jemand fragen wird, wann die Person zugestimmt hat. Der Entwurf
 * zeigt, was gälte. Erst `auftragAktivieren` macht ihn wirksam —
 * dieselbe Funktion, die auch die Karte benutzt.
 */

export interface Prompt1 {
  anweisung: string;
  schema: unknown;
  fassung: string;
}

export interface Textauftrag {
  userId: string;
  /** Was die Person gesagt hat, im Wortlaut. */
  text: string;
  /** chat · voice */
  quelle: string;
  /** Ein bestehender Auftrag, der geändert werden soll. */
  auftragId?: string | null;
  rufer?: Modellrufer;
  prompt?: Prompt1;
  jetzt?: Date;
}

export interface Textbefund {
  ok: boolean;
  auftragId?: string;
  profilId?: string;
  /** Der Satz, mit dem Monday zur Bestätigung fragt. */
  bestaetigungstext?: string;
  /** Die Rückfrage, wenn etwas nicht ohne Nachfragen entschieden werden darf. */
  rueckfrage?: string | null;
  /** Was übernommen wurde, in Worten. */
  kriterien?: string[];
  /** Was weggefallen ist, und warum. */
  verworfen?: { kriterium: string; grund: string }[];
  /**
   * Ob keine Tätigkeit erkannt wurde.
   *
   * Kein Fehler — „alles Unbefristete über 50.000" ist ein legitimer
   * Auftrag. Aber die Person soll es wissen, bevor sie zustimmt.
   */
  ohneTaetigkeit?: boolean;
  grund?: "kein_modell" | "budget" | "fehler" | "nichts_erkannt" | "nicht_gefunden";
}

/** Was das Modell liefert — die Form prüft das Schema, den Inhalt der Code. */
interface Modellvorschlag {
  proposed_changes: {
    criterion_id: string;
    value: unknown;
    unit: string | null;
    operator: string;
    strength: string;
    scope: string;
    group: string | null;
    source_event_ids: string[];
    requires_confirmation: boolean;
    valid_until: string | null;
    is_change_order: boolean;
  }[];
  conflicts: { criterion_id: string; description: string }[];
  unknowns: string[];
  question: string | null;
  confirmation_text: string;
}

/**
 * Welchen Wert jedes Kriterium erwartet.
 *
 * Steht in der Eingabe an das Modell. Ein Schlüssel ohne Werteform
 * lässt zu viel offen — und was offen ist, lässt ein Modell im
 * Zweifel weg.
 */
const KRITERIENFORM: Record<string, string> = {
  taetigkeit: 'Freitext aus dem Satz, kleingeschrieben, als Liste. Keine Taxonomiekennung. Beispiel: ["lager"]',
  berufsfeld: 'Freitext, als Liste. Beispiel: ["logistik"]',
  taetigkeit_ausschluss: 'Freitext, als Liste, mit operator "nicht". Beispiel: ["callcenter"]',
  arbeitgeber_ausschluss: 'Firmenname als Liste. Beispiel: ["zeitarbeit müller"]',
  arbeitsort: 'Ortsnamen als Liste, kleingeschrieben. NIEMALS "remote" oder "homeoffice" — das ist arbeitsmodell.',
  arbeitsmodell: 'Eines oder mehrere aus ["on_site","hybrid","remote"], operator "einer_von"',
  mindestgehalt: 'Zahl, unit "year" oder "month", operator "mindestens"',
  wochenstunden: 'Zahl, operator "hoechstens" oder "mindestens"',
  vertragsform: 'Eines aus ["permanent","fixed_term","temp_agency","freelance","internship","apprenticeship","working_student"]',
  befristung: "true (befristet) oder false (unbefristet)",
  schichtarbeit: "false, wenn keine Schicht gewünscht ist",
  reisebereitschaft: 'Prozentzahl, operator "hoechstens"',
  pendelzeit: 'Minuten, operator "hoechstens"',
  erfahrungsniveau: 'Eines aus ["entry","junior","mid","senior","lead"]',
  lizenz: 'Nachweise als Liste. Beispiel: ["staplerschein"]',
  sprache: 'Objekt Sprache zu Niveau. Beispiel: {"de":"B2"}',
};

/** Kriterien, deren Werte Suchbegriffe sind. */
function begriffskriterium(schluessel: string): boolean {
  return (
    schluessel === "taetigkeit" ||
    schluessel === "berufsfeld" ||
    schluessel === "taetigkeit_ausschluss"
  );
}

const ERLAUBTE_OPERATOREN = new Set([
  "gleich",
  "mindestens",
  "hoechstens",
  "enthaelt",
  "einer_von",
  "nicht",
]);

/**
 * Aus einem Satz einen Auftragsentwurf machen.
 *
 * Ohne Modell passiert nichts — und zwar sichtbar. Einen Auftrag aus
 * Stichwörtern zusammenzuraten wäre schlechter als keiner: Die Person
 * bekäme etwas zur Bestätigung vorgelegt, das mit ihrem Satz wenig zu
 * tun hat, und würde es entweder wegklicken oder bestätigen.
 */
export async function suchprofilAusText(db: Database, e: Textauftrag): Promise<Textbefund> {
  const jetzt = e.jetzt ?? new Date();
  const text = e.text.trim().slice(0, 2000);
  if (!e.rufer || !e.prompt) return { ok: false, grund: "kein_modell" };
  if (text.length < 5) return { ok: false, grund: "nichts_erkannt" };

  /*
   * ══════════════════════════════════════════════════════════════
   * Drei Phasen, und die mittlere ohne Transaktion
   * ══════════════════════════════════════════════════════════════
   *
   *   1. Signal schreiben, Bestand lesen   in einer Transaktion
   *   2. Modellaufruf                      OHNE Transaktion
   *   3. Entwurf schreiben                 in einer zweiten
   *
   * Abschnitt 11 ist an dieser Stelle ausdrücklich: keine externen
   * Aufrufe innerhalb einer langen Datenbanktransaktion. Ein
   * Modellaufruf dauert Sekunden; solange bliebe die Transaktion
   * offen und hielte eine Verbindung.
   *
   * Das Signal steht bewusst schon in Phase 1: Bricht der Modellaufruf
   * ab, ist der Satz der Person trotzdem festgehalten. Ein Beleg, den
   * ein technischer Fehler verschluckt, fehlt später bei der Frage
   * „woher weisst du das".
   */
  const lese = await withUser(db, e.userId, async (tx) => {
    /*
     * Das Signal zuerst, und zwar bevor das Modell läuft.
     *
     * `verdichten` verlangt für jede Änderung eine Signal-ID, die
     * wirklich existiert. Sie hinterher anzulegen hiesse, dem Modell
     * eine Kennung zu geben, die es sich auch hätte ausdenken können.
     */
    const schluessel = `auftrag-aus-text:${e.userId}:${jetzt.getTime()}`;
    const [signal] = await tx
      .insert(schema.profilSignale)
      .values({
        userId: e.userId,
        auftragId: e.auftragId ?? null,
        ereignisSchluessel: schluessel,
        art: "nachricht",
        quelle: e.quelle,
        inhalt: { aussage: text },
        /* Gesagt, nicht beobachtet. */
        ausdruecklich: true,
      })
      .onConflictDoNothing({
        target: [schema.profilSignale.userId, schema.profilSignale.ereignisSchluessel],
      })
      .returning({ id: schema.profilSignale.id });
    if (!signal) return { frueh: { ok: false, grund: "fehler" as const } };

    /* Der bestehende Stand, wenn ein Auftrag geändert werden soll. */
    let bestand: Bestandskriterium[] = [];
    let vorigesProfil: { id: string; version: number } | null = null;
    if (e.auftragId) {
      const [aktuell] = await tx
        .select({ id: schema.suchProfile.id, version: schema.suchProfile.version })
        .from(schema.suchProfile)
        .where(eq(schema.suchProfile.auftragId, e.auftragId))
        .orderBy(desc(schema.suchProfile.version))
        .limit(1);
      if (!aktuell) return { frueh: { ok: false, grund: "nicht_gefunden" as const } };
      vorigesProfil = aktuell;
      const zeilen = await tx
        .select()
        .from(schema.suchKriterien)
        .where(eq(schema.suchKriterien.profilId, aktuell.id));
      bestand = zeilen.map((k) => ({
        kriterium: k.kriterium,
        wert: k.wert,
        einheit: k.einheit,
        operator: k.operator as never,
        staerke: k.staerke as Staerke,
        gruppe: k.gruppe,
        geltungsbereich: k.geltungsbereich as never,
        herkunft: k.herkunft as never,
        bestaetigungsstatus: k.bestaetigungsstatus as never,
        bestaetigtAm: k.bestaetigtAm,
        gueltigBis: k.gueltigBis,
        signalIds: k.signalIds,
      }));
    }

    return { signal, bestand, vorigesProfil };
  });

  if ("frueh" in lese && lese.frueh) return lese.frueh;
  const { signal, bestand, vorigesProfil } = lese as Exclude<typeof lese, { frueh: unknown }>;

  {
    /*
     * Was das Modell sieht.
     *
     * Der Satz, der bestehende Stand, die eine Signal-ID und die Liste
     * der Kriterien, für die es eine Prüfung gibt. Kein Chatverlauf,
     * keine anderen Nutzer, keine Stellendaten.
     */
    const eingabe = JSON.stringify({
      aussage: text,
      signal_id: signal.id,
      backendzeit: jetzt.toISOString(),
      bestehende_kriterien: bestand.map((k) => ({
        criterion_id: k.kriterium,
        value: k.wert,
        strength: k.staerke,
        bestaetigt: k.bestaetigungsstatus === "bestaetigt",
      })),
      /*
       * Die Kriterien samt erwarteter Werteform.
       *
       * Nur die Schlüssel zu nennen hat nicht gereicht: In zwei echten
       * Läufen liess das Modell die Tätigkeit weg — bei „Lagerstellen
       * in Karlsruhe" kamen Ort, Gehalt und Schicht, und der Beruf
       * wurde zur Rückfrage.
       *
       * Der Grund stand in der Anweisung: „Berufskennungen
       * ausschliesslich aus der vorhandenen Taxonomie übernehmen." Ohne
       * eine mitgelieferte Taxonomie liest sich das wie ein Verbot.
       * `taetigkeit` ist aber Freitext aus dem Satz der Person — und
       * das muss dastehen.
       */
      erlaubte_kriterien: KRITERIENFORM,
      anredeform: "du",
    });

    const antwort = await mitGrenze<Modellvorschlag>(db, {
      userId: e.userId,
      zweck: "suchauftrag:profil",
      promptKey: "suchprofil",
      promptVersion: e.prompt!.fassung,
      system: e.prompt!.anweisung,
      text: eingabe,
      schema: e.prompt!.schema,
      schemaName: "velvova_suchprofil",
      tier: "fast",
      rufer: e.rufer,
      lohntSich: true,
    });
    if (!antwort.ok) return { ok: false, grund: antwort.grund as Textbefund["grund"] };

    /*
     * Erst die Form säubern, dann `verdichten` entscheiden lassen.
     *
     * Ein unbekannter Schlüssel oder ein erfundener Operator fällt hier
     * heraus. Das ist keine Doppelung der Rechteprüfung — es ist die
     * Frage davor: Gibt es das überhaupt?
     */
    const verworfen: { kriterium: string; grund: string }[] = [];
    const vorschlaege: Aenderungsvorschlag[] = [];
    for (const v of antwort.data.proposed_changes ?? []) {
      if (!kriteriumBekannt(v.criterion_id)) {
        verworfen.push({ kriterium: v.criterion_id, grund: "unbekanntes_kriterium" });
        continue;
      }
      if (!ERLAUBTE_OPERATOREN.has(v.operator)) {
        verworfen.push({ kriterium: v.criterion_id, grund: "unbekannter_operator" });
        continue;
      }
      if (v.strength !== "muss" && v.strength !== "wunsch" && v.strength !== "interesse") {
        verworfen.push({ kriterium: v.criterion_id, grund: "unbekannte_staerke" });
        continue;
      }
      if (v.value === null || v.value === undefined || v.value === "") {
        /* Ein Kriterium ohne Wert prüft nichts. */
        verworfen.push({ kriterium: v.criterion_id, grund: "ohne_wert" });
        continue;
      }
      vorschlaege.push({
        kriterium: v.criterion_id,
        /*
         * Suchbegriffe auf den Stamm.
         *
         * Ein echter Lauf lieferte `["lagerstellen"]`. Die Prüfung
         * vergleicht am Wortanfang — das findet keine „Lagerhelfer",
         * und der Auftrag hätte im ganzen Bestand nichts gefunden.
         */
        wert: begriffskriterium(v.criterion_id) && Array.isArray(v.value)
          ? (v.value as unknown[]).map((w) => taetigkeitStamm(String(w)))
          : v.value,
        einheit: v.unit,
        operator: v.operator as never,
        /*
         * Die Stärke kommt aus dem Satz, nicht aus dem Modell.
         *
         * ══════════════════════════════════════════════════════════
         * Warum das Modell hier überstimmt wird
         * ══════════════════════════════════════════════════════════
         *
         * Bis hierher entschied Systemprompt 1 bei jedem Lauf neu, ob
         * ein Kriterium ein Muss ist. Derselbe Satz ergab montags
         * einen Wunsch und dienstags ein Muss.
         *
         * Ein Muss, das niemand gefordert hat, entfernt lautlos jede
         * Stelle, die es nicht erfüllt. Die Liste wird kürzer, und die
         * Erklärung dafür steht nirgends.
         *
         * Steht im Satz ein Marker — „mindestens", „möglichst",
         * „keine", „muss nicht unbedingt" —, gilt er. Steht keiner,
         * gilt der bestätigte Auftrag. Steht auch der nicht, darf das
         * Modell entwerfen. In dieser Reihenfolge und keiner anderen.
         */
        staerke: staerkeEntscheiden({
          ausText: staerkeFuerKriterium(
            text,
            Array.isArray(v.value)
              ? (v.value as unknown[]).map((w) => String(w))
              : [String(v.value)],
          ),
          bestaetigt:
            bestand.find(
              (k) => k.kriterium === v.criterion_id && k.bestaetigungsstatus === "bestaetigt",
            )?.staerke ?? null,
          modell: v.strength,
        }).staerke,
        gruppe: v.group,
        geltungsbereich: v.scope === "befristet" ? "befristet" : v.scope === "profil" ? "profil" : "auftrag",
        herkunft: "nutzer_aussage",
        signalIds: v.source_event_ids ?? [],
        bestaetigungNoetig: v.requires_confirmation,
        gueltigBisIso: v.valid_until,
        /*
         * Ein neuer Auftrag ist immer ein Änderungsauftrag: Die Person
         * hat gerade gesagt, was sie will. Bei einem bestehenden
         * Auftrag entscheidet das Modell — und `verdichten` prüft, ob
         * das Signal ausdrücklich war.
         */
        aenderungsauftrag: e.auftragId ? v.is_change_order === true : true,
      });
    }

    /*
     * Ort und Arbeitsmodell auseinanderhalten, bevor `verdichten`
     * urteilt.
     *
     * Ein Modellaufruf lieferte für „Karlsruhe oder komplett remote"
     * eine Ortsliste mit „remote" darin. Das sieht richtig aus und
     * wäre stillschweigend nie erfüllt gewesen.
     */
    const getrennt = ortUndModellTrennen(vorschlaege);

    /*
     * ══════════════════════════════════════════════════════════════
     * Der Umkreis, deterministisch aus dem Satz
     * ══════════════════════════════════════════════════════════════
     *
     * Ein echter Lauf mit
     *
     *   „bis 30 km um Karlsruhe"
     *
     * ergab `arbeitsort: ["karlsruhe"]` — einen Vergleich von
     * Ortsnamen — und schob die 30 km in eine Rückfrage. Von 25
     * gefundenen Stellen wurde daraufhin jede einzelne
     * ausgeschlossen; „Recycling- und Lagerhelfer" in Oberderdingen,
     * 28,7 km entfernt und damit im gewünschten Umkreis, scheiterte
     * daran, dass dort nicht „Karlsruhe" steht.
     *
     * Der Prüfer für `umkreis` war die ganze Zeit da, samt
     * Entfernungsrechnung. Es hat ihn nur nie jemand erzeugt.
     *
     * ── Warum der Umkreis den Ortsnamen ersetzt ─────────────────
     *
     * Weil beide als Muss nebeneinander eine Und-Verknüpfung wären:
     * im Umkreis UND genau in dieser Stadt. Das ist enger als beides
     * einzeln und enger als alles, was die Person gesagt hat.
     *
     * Ohne auflösbaren Mittelpunkt bleibt der Ortsname stehen. Ein
     * Umkreis ohne Mitte prüft nichts.
     */
    /*
     * ══════════════════════════════════════════════════════════════
     * Eine Zahl, zwei Bedeutungen
     * ══════════════════════════════════════════════════════════════
     *
     * Aus „bis 30 km um Karlsruhe" machte ein echter Lauf zusätzlich
     *
     *   pendelzeit  30  einheit: km  hoechstens  muss
     *
     * Eine Pendel-ZEIT, gemessen in Kilometern. Das Modell hat die
     * Einheit selbst danebengeschrieben und den Widerspruch nicht
     * bemerkt.
     *
     * Als Muss ist das teuer: Zur Fahrtzeit liegen keine Routendaten
     * vor, die Prüfung sagt `unbekannt`, und ein unbekanntes Muss
     * verhindert jede Empfehlung. Im Lauf vom 6. September war
     * „Versandmitarbeiter (m/w/d)" in Rastatt — 21 km entfernt,
     * Gehalt über der Grenze, unbefristet, keine Zeitarbeit, jede
     * andere Prüfung erfüllt — allein daran gescheitert.
     *
     * ── Warum die Prüfung auf zwei Wegen greift ─────────────────
     *
     * Die Einheit „km" an einer Zeitangabe ist für sich schon der
     * Beweis. Dieselbe Zahl wie der Umkreis ist der zweite Weg, falls
     * das Modell die Einheit weglässt.
     *
     * Nennt der Satz eine echte Zeit — „höchstens eine halbe Stunde"
     * —, bleibt die Pendelzeit stehen. Dann ist sie gemeint.
     *
     * Die Liste ist `getrennt`, nicht `vorschlaege`: Das ist die, die
     * weitergereicht wird. Die erste Fassung räumte in der falschen
     * auf, und die Pendelzeit stand danach unverändert im Auftrag.
     */
    const umkreis = umkreisAusText(text);
    if (umkreis && !/\b(minute|stunde)/i.test(text)) {
      for (let i = getrennt.length - 1; i >= 0; i--) {
        const v = getrennt[i]!;
        if (v.kriterium !== "pendelzeit") continue;
        const alsKm = String(v.einheit ?? "").toLowerCase() === "km";
        if (alsKm || Number(v.wert) === umkreis.km) {
          getrennt.splice(i, 1);
          verworfen.push({ kriterium: "pendelzeit", grund: "entfernung_als_zeit_gelesen" });
        }
      }
    }

    if (umkreis) {
      const mitte = await ortNachschlagen(db, umkreis.ort);
      if (mitte.latitude !== null && mitte.longitude !== null) {
        const mittelpunkt = ortNormalisieren(umkreis.ort);
        /* Den Ortsnamen genau für diesen Ort zurücknehmen — andere
           Ortsangaben im Satz bleiben, was sie sind. */
        for (let i = getrennt.length - 1; i >= 0; i--) {
          const v = getrennt[i]!;
          if (v.kriterium !== "arbeitsort") continue;
          const werte = Array.isArray(v.wert) ? v.wert.map((w) => ortNormalisieren(String(w))) : [];
          if (werte.length === 1 && werte[0] === mittelpunkt) getrennt.splice(i, 1);
        }
        getrennt.push({
          kriterium: "umkreis",
          wert: {
            breite: mitte.latitude,
            laenge: mitte.longitude,
            km: umkreis.km,
            ort: mitte.stadt ?? umkreis.ort,
          },
          einheit: "km",
          operator: "hoechstens",
          staerke: staerkeEntscheiden({
            ausText: staerkeFuerKriterium(text, [umkreis.ort, String(umkreis.km)]),
            modell: "muss",
          }).staerke,
          gruppe: null,
          geltungsbereich: "auftrag",
          herkunft: "nutzer_aussage",
          signalIds: [signal.id],
          bestaetigungNoetig: false,
          gueltigBisIso: null,
          aenderungsauftrag: true,
        });
      }
    }

    /*
     * ══════════════════════════════════════════════════════════════
     * „Keine Zeitarbeit" ist eine Vertragsart, kein Firmenname
     * ══════════════════════════════════════════════════════════════
     *
     * Das Modell machte daraus `arbeitgeber_ausschluss: ["zeitarbeit"]`
     * — einen Vergleich des Firmennamens gegen eine Zeichenkette. Im
     * echten Lauf stand daraufhin im Protokoll:
     *
     *   erfuellt  arbeitgeber_ausschluss
     *             — Arbeitgeber Franz & Wach Personalservice GmbH
     *
     * Eine Personalservice-GmbH heisst nicht „Zeitarbeit", und die
     * Prüfung sagte ja. Die Vertragsart der Stelle stand als Feld
     * daneben und wurde nicht angesehen.
     *
     * Der Firmennamensausschluss bleibt zusätzlich stehen: Die
     * Vertragsart kann fehlen, und zwei Prüfungen, die beide stimmen
     * müssen, sind für einen ausdrücklichen Ausschluss die richtige
     * Richtung.
     */
    if (
      zeitarbeitAusgeschlossen(text) &&
      !getrennt.some((v) => v.kriterium === "vertragsform")
    ) {
      getrennt.push({
        kriterium: "vertragsform",
        wert: ["temp_agency"],
        einheit: null,
        operator: "nicht",
        staerke: "muss",
        gruppe: null,
        geltungsbereich: "auftrag",
        herkunft: "nutzer_aussage",
        signalIds: [signal.id],
        bestaetigungNoetig: false,
        gueltigBisIso: null,
        aenderungsauftrag: true,
      });
    }

    const signale: Signal[] = [
      {
        id: signal.id,
        ausdruecklich: true,
        quelle: e.quelle,
        art: "nachricht",
        beobachtetAm: jetzt,
      },
    ];
    const verdichtung = verdichten(bestand, getrennt, signale, jetzt);
    for (const w of verdichtung.verworfen) verworfen.push({ kriterium: w.kriterium, grund: w.grund });

    if (verdichtung.kriterien.length === 0) {
      return { ok: false, grund: "nichts_erkannt" as const, verworfen };
    }

    /* ── Phase 3: schreiben ──────────────────────────────────── */
    return withUser(db, e.userId, async (tx) => {
    /* Auftrag anlegen oder eine neue Fassung an den bestehenden hängen. */
    let auftragId = e.auftragId ?? null;
    if (!auftragId) {
      const [neu] = await tx
        .insert(schema.suchAuftraege)
        .values({
          userId: e.userId,
          name: auftragsnameAus(verdichtung.kriterien),
          status: "entwurf",
          kanal: "nur_app",
          herkunft: e.quelle === "voice" ? "voice" : "chat",
        })
        .returning({ id: schema.suchAuftraege.id });
      auftragId = neu!.id;
      await tx
        .update(schema.profilSignale)
        .set({ auftragId })
        .where(eq(schema.profilSignale.id, signal.id));
    }

    const [profil] = await tx
      .insert(schema.suchProfile)
      .values({
        auftragId,
        userId: e.userId,
        version: (vorigesProfil?.version ?? 0) + 1,
        zustand: "entwurf",
        /* Was das Modell vorgeschlagen hat, unverändert — der Nachweis,
           dass das Backend und nicht das Modell entschieden hat. */
        vorschlag: { aussage: text, antwort: antwort.data as never },
        konflikte: [...verdichtung.rueckfragen, ...(antwort.data.conflicts ?? [])],
        offenePunkte: [...verworfen, ...(antwort.data.unknowns ?? [])],
        rueckfrage: rueckfrageAus(verdichtung, antwort.data.question),
        bestaetigungstext: bestaetigungstextAus(verdichtung.kriterien),
        promptFassung: e.prompt!.fassung,
      })
      .returning({ id: schema.suchProfile.id });

    const profilId = profil!.id;
    await tx.insert(schema.suchKriterien).values(
      verdichtung.kriterien.map((k) => ({
        profilId,
        userId: e.userId,
        kriterium: k.kriterium,
        wert: k.wert as never,
        einheit: k.einheit,
        operator: k.operator,
        staerke: k.staerke,
        gruppe: k.gruppe,
        geltungsbereich: k.geltungsbereich,
        herkunft: k.herkunft,
        signalIds: k.signalIds,
        bestaetigungsstatus: k.bestaetigungsstatus,
        bestaetigtAm: k.bestaetigtAm,
        gueltigBis: k.gueltigBis,
      })),
    );

    /*
     * Eine Suche ohne Tätigkeit ist eine sehr breite Suche.
     *
     * In einem echten Lauf lieferte das Modell für „Lagerstellen in
     * Karlsruhe" Ort, Gehalt und Schicht — und keine Tätigkeit. Der
     * Auftrag hätte danach jede Stelle in Karlsruhe über 32.000
     * gefunden.
     *
     * Verweigert wird deshalb nichts: „Alles Unbefristete über 50.000"
     * ist ein legitimer Auftrag. Aber die Person erfährt es, bevor sie
     * zustimmt — sonst wartet sie auf eine Eingrenzung, die niemand
     * gespeichert hat.
     */
    const hatTaetigkeit = verdichtung.kriterien.some(
      (k) => k.kriterium === "taetigkeit" || k.kriterium === "berufsfeld",
    );

    return {
      ok: true,
      auftragId,
      profilId,
      bestaetigungstext: bestaetigungstextAus(verdichtung.kriterien),
      rueckfrage: rueckfrageAus(verdichtung, antwort.data.question),
      kriterien: verdichtung.kriterien.map(kriteriumSatz),
      verworfen,
      ohneTaetigkeit: !hatTaetigkeit,
    };
    });
  }
}

/**
 * Der Name des Auftrags, aus den Kriterien abgeleitet.
 *
 * Nicht abgefragt und nicht vom Modell: Wer nichts verpassen will,
 * interessiert sich nicht dafür, wie die Suche heisst — und ein
 * Modell, das Namen erfindet, erfindet irgendwann auch einen, der
 * nach mehr klingt als die Suche hergibt.
 */
function auftragsnameAus(kriterien: Bestandskriterium[]): string {
  const was = kriterien.find((k) => k.kriterium === "taetigkeit" || k.kriterium === "berufsfeld");
  const wo = kriterien.find((k) => k.kriterium === "arbeitsort");
  const teile: string[] = [];
  if (was) teile.push(Array.isArray(was.wert) ? was.wert.join(" ") : String(was.wert));
  if (wo) {
    const ort = Array.isArray(wo.wert) ? wo.wert.join(" oder ") : String(wo.wert);
    /* Ohne Tätigkeit hiesse der Auftrag „in karlsruhe" — das liest
       sich wie ein abgeschnittener Satz. */
    teile.push(was ? `in ${ort}` : `Stellen in ${ort}`);
  }
  return (teile.join(" ") || "Meine Suche").slice(0, 120);
}

/**
 * Der Satz, mit dem Monday zur Bestätigung fragt.
 *
 * Serverseitig gebaut, nicht vom Modell übernommen. `confirmation_text`
 * steht im Schema, weil der Auftrag es vorsieht — aber was gilt, weiss
 * der Code nach `verdichten`, und das Modell kannte das Ergebnis nicht.
 * Ein Satz, der etwas anderes aufzählt als gespeichert wurde, wäre die
 * schlimmste Sorte Bestätigung.
 */
function bestaetigungstextAus(kriterien: Bestandskriterium[]): string {
  const teile: string[] = [];
  const muss = gruppiertInWorte(kriterien.filter((k) => k.staerke === "muss"));
  const wunsch = gruppiertInWorte(kriterien.filter((k) => k.staerke !== "muss"));
  if (muss.length > 0) teile.push(`Muss stimmen: ${muss.join(", ")}.`);
  if (wunsch.length > 0) teile.push(`Wünschenswert: ${wunsch.join(", ")}.`);
  teile.push("Die Treffer findest du in Velvova. E-Mails sind aus, bis du sie einschaltest.");
  return teile.join(" ");
}

/**
 * Kriterien in Worte — mit „oder" innerhalb einer Gruppe.
 *
 * ══════════════════════════════════════════════════════════════
 * Der Fehler, den das behebt
 * ══════════════════════════════════════════════════════════════
 *
 * Ein echter Lauf erzeugte diesen Satz:
 *
 *     „Muss stimmen: Arbeitsort karlsruhe, vollständig remote, …"
 *
 * Gemeint war „Karlsruhe ODER remote". Als Kommaliste liest sich das
 * wie zwei gleichzeitig geltende Bedingungen — und genau davor warnt
 * der Auftrag: Eine Alternative darf nicht zu zwei zwingend
 * gleichzeitig erforderlichen Standortbedingungen werden.
 *
 * Im Code war sie eine Gruppe und damit richtig. Im Satz, den die
 * Person zu lesen bekommt, stand das Gegenteil — und der Satz ist
 * das, wozu sie zustimmt.
 */
function gruppiertInWorte(kriterien: Bestandskriterium[]): string[] {
  const nachGruppe = new Map<string, Bestandskriterium[]>();
  for (const k of kriterien) {
    const schluessel = k.gruppe ?? `__einzeln__${k.kriterium}`;
    const liste = nachGruppe.get(schluessel);
    if (liste) liste.push(k);
    else nachGruppe.set(schluessel, [k]);
  }
  return [...nachGruppe.values()].map((gruppe) => gruppe.map(kriteriumSatz).join(" oder "));
}

function rueckfrageAus(
  verdichtung: ReturnType<typeof verdichten>,
  modellfrage: string | null,
): string | null {
  if (verdichtung.rueckfragen.length > 0) {
    const namen = verdichtung.rueckfragen.map((r) => r.kriterium).join(", ");
    return `Das widerspricht dem, was du zu ${namen} bestätigt hast. Was gilt?`;
  }
  /* Die Frage des Modells nur, wenn der Code keine eigene hat — und
     nie als Bestätigung getarnt. */
  return modellfrage?.trim() || null;
}
