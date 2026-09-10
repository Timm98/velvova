import { sql } from "drizzle-orm";
import { withSystem, type Database } from "@paycheck/db";
import { faelligeAuftraege } from "./auftrag.ts";
import { auftragslaufRunde, type Auftragszeile } from "./lauf.ts";
import { zusammenfassungBauen } from "./zusammenfassung.ts";
import { ausgangAbarbeiten, type Versender } from "./versand.ts";
import type { Modellrufer } from "./modell.ts";
import type { Prompt3 } from "./mailtext.ts";
import type { Prompt2 } from "./lauf.ts";
import { einbettungenNachziehen, type Einbetter, type Einbettungsmodell } from "./einbettung.ts";
import {
  nachtlaufAbbrechen,
  nachtlaufEroeffnen,
  nachtlaufSchliessen,
  nachtschluessel,
  phaseSetzen,
} from "./nachtlauf.ts";

/**
 * Ein vollständiger Durchlauf des Suchauftrags.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das hier steht und nicht im Skript
 * ══════════════════════════════════════════════════════════════
 *
 * Es gibt zwei Wege, den Dienst zu starten: das Skript von Hand und
 * den Zeitplan über einen Endpunkt. Beide sollen dasselbe tun.
 *
 * Stünde die Reihenfolge im Skript, müsste der Endpunkt sie nachbauen
 * — und beim ersten Nachbessern liefe der nächtliche Lauf anders als
 * der von Hand. Das ist der Fehler, den man am schwersten findet:
 * Beide funktionieren, nur eben verschieden.
 *
 * ══════════════════════════════════════════════════════════════
 * Der Versandweg wird hereingereicht
 * ══════════════════════════════════════════════════════════════
 *
 * Damit dieses Paket den Mailanbieter nicht kennt — und damit ein
 * Test nie versehentlich eine echte Mail auslösen kann. Ohne
 * `versender` läuft alles bis zur fertigen Mail im Ausgang und hört
 * dort auf. Das ist der Trockenlauf, und er ist der Normalfall,
 * solange kein Anbieter eingerichtet ist.
 */

export interface Durchlaufoptionen {
  jetzt?: Date;
  /** Wie viele Aufträge je Lauf. */
  stapel?: number;
  /** Die Basis der Links in der Mail. */
  basisUrl: string;
  /** Fehlt er, wird nichts versendet — die Mail bleibt im Ausgang. */
  versender?: Versender;
  /** Wie viele Kandidaten je Auftrag und Runde. */
  kandidaten?: number;
  /**
   * Die Empfehlungsschwelle.
   *
   * Nur für Abnahmeläufe und Diagnose. Im Betrieb gilt der Wert aus
   * `EMPFEHLUNG_V1` — eine Schwelle, die je Aufruf verstellbar ist,
   * wäre keine.
   */
  schwelle?: number;
  /**
   * Der Modellaufruf. Fehlt er, läuft alles deterministisch weiter —
   * das ist der Normalzustand und kein Ausfall.
   */
  rufer?: Modellrufer;
  /** Anweisung, Schema und Fassung von Systemprompt 3. */
  prompt3?: Prompt3;
  /** Anweisung, Schema und Fassung von Systemprompt 2. */
  prompt2?: Prompt2;
  /**
   * Der semantische Recall-Schritt.
   *
   * Fehlt er, läuft die Suche über Struktur und Stichwort. Das ist
   * kein Ausfall, sondern weniger Recall — und es steht im Bericht.
   */
  einbetter?: Einbetter;
  einbettungsmodell?: Einbettungsmodell;
}

export interface Auftragsbericht {
  name: string;
  geprueft: number;
  empfohlen: number;
  zurueckgestellt: number;
  ausgeschlossen: number;
  grund: string | null;
  /** Wie viele Stellen der semantische Schritt beisteuerte. */
  semantisch: number;
  /** Wie viele Kandidaten das Modell beurteilt hat. */
  belegt: number;
  /** Gesetzt, wenn dieser Auftrag scheiterte — die anderen liefen weiter. */
  fehler?: string;
}

export interface Durchlaufbericht {
  faellig: number;
  auftraege: Auftragsbericht[];
  zusammenfassungen: { fenster: string; posten: number; uebersprungen: string | null; mail: boolean }[];
  versand: { angenommen: number; wiederholt: number; gescheitert: number; unterdrueckt: number; ungewiss: number } | null;
  /** Warum nicht versendet wurde, wenn kein Versender da war. */
  versandGrund: string | null;
  /** `analyse` ist `null`, wenn keine Warteschlange vorhanden ist. */
  rueckstand: { analyse: number | null; faellig: number; ausgang: number; ungewiss: number };
  /** Wie viele Stellen in diesem Lauf eingebettet wurden. */
  einbettungen: { neu: number; unveraendert: number; gescheitert: number };
  dauerMs: number;
}

export async function durchlaufAusfuehren(
  db: Database,
  optionen: Durchlaufoptionen,
): Promise<Durchlaufbericht> {
  const begonnen = Date.now();
  const jetzt = optionen.jetzt ?? new Date();

  /*
   * Erst die Einbettungen nachziehen, dann suchen.
   *
   * In dieser Reihenfolge, weil eine Stelle ohne Vektor über den
   * semantischen Weg unsichtbar ist — und die Runde danach genau
   * diesen Weg benutzt.
   */
  const einbettungen = optionen.einbettungsmodell
    ? await einbettungenNachziehen(db, optionen.einbettungsmodell, optionen.einbetter)
    : { neu: 0, unveraendert: 0, gescheitert: 0 };

  const faellig = await faelligeAuftraege(db, jetzt, optionen.stapel ?? 20);

  const berichte: Auftragsbericht[] = [];
  const betroffene = new Set<string>();

  for (const eintrag of faellig) {
    const zeilen = (await withSystem(db, (tx) =>
      tx.execute(sql`
        select id, user_id as "userId", name, status, geltungsbereich,
               aktive_profil_version as "aktiveProfilVersion",
               zeitzone
        from such_auftraege where id = ${eintrag.id}::uuid`),
    )) as unknown as { rows: (Auftragszeile & { zeitzone: string | null })[] };
    const auftrag = zeilen.rows[0];
    if (!auftrag) continue;

    /*
     * Der Beleg über diese Nacht.
     *
     * Er wird vor der Runde eröffnet, nicht danach: Ein Lauf, der
     * abstürzt, soll als abgebrochen dastehen und nicht gar nicht.
     * Scheitert das Eröffnen selbst, bleibt `laufId` null und alles
     * Weitere läuft ohne Beleg — die Treffer sind wichtiger als die
     * Buchführung über sie.
     */
    const laufId = await nachtlaufEroeffnen(
      db,
      {
        userId: auftrag.userId,
        auftragId: auftrag.id,
        schluessel: nachtschluessel(jetzt, auftrag.zeitzone ?? "Europe/Berlin"),
      },
      jetzt,
    );

    try {
      await phaseSetzen(db, laufId, "bewerten");
      const lauf = await auftragslaufRunde(db, auftrag, {
        jetzt,
        grenze: optionen.kandidaten,
        schwelle: optionen.schwelle,
        einbetter: optionen.einbetter,
        einbettungsmodell: optionen.einbettungsmodell,
        rufer: optionen.rufer,
        prompt2: optionen.prompt2,
      });
      betroffene.add(auftrag.userId);

      /*
       * Die Bilanz — abgeleitet, nicht nachgerechnet.
       *
       * `gefunden` ist die Zahl der Kandidaten, die in die Runde
       * kamen (`geprueft` wird dort auf `kandidaten.length` gesetzt).
       * `nachFiltern` sind die, die kein Muss-Kriterium verletzen:
       * empfohlen plus zurückgestellt. Beides steht schon da; hier
       * wird nur umbenannt, was der Bericht braucht.
       */
      await nachtlaufSchliessen(
        db,
        laufId,
        {
          gefunden: lauf.geprueft,
          nachFiltern: lauf.empfohlen + lauf.zurueckgestellt,
          geprueft: lauf.geprueft,
          empfohlen: lauf.empfohlen,
          zurueckgestellt: lauf.zurueckgestellt,
          ausgeschlossen: lauf.ausgeschlossen,
          stilleChancen: 0,
          quellenFehler: einbettungen.gescheitert > 0 ? ["Einbettungen"] : [],
        },
        lauf.grund,
        jetzt,
      );

      berichte.push({
        name: auftrag.name,
        geprueft: lauf.geprueft,
        empfohlen: lauf.empfohlen,
        zurueckgestellt: lauf.zurueckgestellt,
        ausgeschlossen: lauf.ausgeschlossen,
        grund: lauf.grund,
        semantisch: lauf.semantisch,
        belegt: lauf.belegt,
      });
    } catch (fehler) {
      /*
       * Ein Auftrag, der scheitert, nimmt die anderen nicht mit.
       *
       * Seine Fälligkeit bleibt stehen — er kommt beim nächsten Lauf
       * wieder. Den ganzen Durchlauf abzubrechen hiesse, dass ein
       * kaputter Datensatz alle anderen Menschen um ihre
       * Zusammenfassung bringt.
       */
      await nachtlaufAbbrechen(db, laufId, String(fehler), jetzt);
      berichte.push({
        name: auftrag.name,
        geprueft: 0,
        empfohlen: 0,
        zurueckgestellt: 0,
        ausgeschlossen: 0,
        grund: null,
        semantisch: 0,
        belegt: 0,
        fehler: String(fehler).slice(0, 200),
      });
    }
  }

  const zusammenfassungen: Durchlaufbericht["zusammenfassungen"] = [];
  for (const userId of betroffene) {
    const befund = await zusammenfassungBauen(db, userId, {
      jetzt,
      basisUrl: optionen.basisUrl,
      mailVorbereiten: true,
      rufer: optionen.rufer,
      prompt: optionen.prompt3,
    });
    zusammenfassungen.push({
      fenster: befund.fensterschluessel,
      posten: befund.postenzahl,
      uebersprungen: befund.uebersprungen,
      mail: befund.ausgangId !== null,
    });
  }

  let versand: Durchlaufbericht["versand"] = null;
  let versandGrund: string | null = null;
  if (optionen.versender) {
    versand = await ausgangAbarbeiten(db, optionen.versender, { jetzt });
  } else {
    versandGrund = "kein_versandweg";
  }

  /*
   * Der Rückstand wird gemessen, nicht geschätzt.
   *
   * Ein Rückstau, den niemand zählt, fällt erst auf, wenn Menschen
   * ihre Mail nicht bekommen — und dann ist er Tage alt.
   */
  const zahlen = (await withSystem(db, (tx) =>
    tx.execute(sql`
      select
        (select count(*)::int from such_auftraege
          where status='aktiv' and naechste_faelligkeit <= now()) as faellig,
        (select count(*)::int from mail_ausgang where zustand in ('queued','sending')) as ausgang,
        (select count(*)::int from mail_ausgang where zustand='unknown') as ungewiss`),
  )) as unknown as {
    rows: { faellig: number; ausgang: number; ungewiss: number }[];
  };

  /*
   * Der Warteschlangenstand steht in einer eigenen Abfrage.
   *
   * `pgmq` gibt es in Produktion und in der Testumgebung nicht — dort
   * läuft PGlite im Speicher, und Erweiterungen lassen sich nicht
   * nachladen. Postgres prüft Relationen beim Parsen, nicht beim
   * Ausführen: Eine Bedingung davor hilft nicht, die ganze Abfrage
   * scheitert.
   *
   * Fehlt sie, ist der Rückstand unbekannt und nicht null. Der
   * Unterschied zählt: Null hiesse „nichts zu tun", unbekannt heisst
   * „hier misst gerade niemand".
   */
  let analyse: number | null = null;
  try {
    const q = (await withSystem(db, (tx) =>
      tx.execute(sql`select count(*)::int as n from pgmq.q_job_analyse`),
    )) as unknown as { rows: { n: number }[] };
    analyse = q.rows[0]?.n ?? null;
  } catch {
    /* Keine Warteschlange — kein Messwert. Kein Grund abzubrechen. */
  }

  return {
    faellig: faellig.length,
    auftraege: berichte,
    zusammenfassungen,
    versand,
    versandGrund,
    rueckstand: {
      analyse,
      faellig: zahlen.rows[0]?.faellig ?? 0,
      ausgang: zahlen.rows[0]?.ausgang ?? 0,
      ungewiss: zahlen.rows[0]?.ungewiss ?? 0,
    },
    einbettungen,
    dauerMs: Date.now() - begonnen,
  };
}
