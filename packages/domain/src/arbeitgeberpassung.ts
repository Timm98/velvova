import type { Arbeitgeberart } from "./stillechancen.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Passt dieser Arbeitgeber — obwohl er gerade nichts sucht?
 * ══════════════════════════════════════════════════════════════════
 *
 * Für eine ausgeschriebene Stelle steht die Antwort in der Anzeige.
 * Für einen Arbeitgeber ohne Anzeige steht sie nirgends, und genau
 * das macht die Frage interessant und gefährlich zugleich.
 *
 * ── Woher die Auskunft kommt ────────────────────────────────────
 *
 * Aus dem, was der Arbeitgeber früher ausgeschrieben hat. Wer vor
 * acht Monaten „Projektmanagerin Digitalisierung" gesucht hat,
 * beschäftigt solche Menschen — das ist keine Vermutung, das ist eine
 * Beobachtung mit Datum und Fundstelle.
 *
 * Das ist der ganze Trick, und er ist ehrlich: Wir behaupten nicht,
 * dass dort eine Stelle frei ist. Wir sagen, dass dort Menschen wie
 * du arbeiten und wann das zuletzt nachweisbar war.
 *
 * ── Die zwei Zahlen ─────────────────────────────────────────────
 *
 * `punkte` sagt, wie gut es passt. `belegdichte` sagt, worauf das
 * beruht. Beide gehören zusammen ausgegeben, denn eine 90 aus einem
 * einzigen Datenpunkt ist keine 90 — sie ist eine 90 mit der Aussage
 * „wir wissen fast nichts über diesen Arbeitgeber".
 *
 * Fast jedes System dieser Art führt nur die erste Zahl. Dann sieht
 * ein Arbeitgeber, über den nichts bekannt ist, genauso aus wie einer,
 * über den alles bekannt ist — und der Unterschied zwischen beiden ist
 * der einzige, der für eine Entscheidung zählt.
 *
 * ── Was hier NICHT passiert ─────────────────────────────────────
 *
 * Eine fehlende Angabe wird nicht zu 0,5 „weil man ja nichts weiss".
 * Eine unbekannte Dimension fliesst gar nicht ein und senkt die
 * Belegdichte. Der Mittelwert wäre die bequeme Variante und die
 * falsche: Er erzeugt aus Unwissen eine mittlere Zuversicht.
 */

/* ══════════════════════════════════════════════════════════════════
   Was wir über einen Arbeitgeber wissen
   ══════════════════════════════════════════════════════════════════ */

export interface FrühereStelle {
  titel: string;
  /** Berufsfamilie, wie das Produkt sie führt. `null`, wenn ungeklärt. */
  berufsfeld: string | null;
  ort: string | null;
  /** Wann diese Anzeige zuletzt gesehen wurde. */
  gesehenAm: Date;
  /** Fundstelle — Anzeigen-URL oder interne Kennung. */
  quelle: string;
}

export interface Arbeitgeberprofil {
  name: string;
  art: Arbeitgeberart;
  branche: string | null;
  ort: string | null;
  /**
   * Was dieser Arbeitgeber früher ausgeschrieben hat.
   *
   * Leer heisst: Wir haben ihn nie mit einer Anzeige gesehen. Das ist
   * die häufigste Lage und der Grund, warum die Belegdichte existiert.
   */
  frühereStellen: readonly FrühereStelle[];
}

export interface Suchprofil {
  /** Berufsfamilien, die infrage kommen. */
  berufsfelder: readonly string[];
  /** Orte, die passen — bereits aufgelöst, hier wird nicht gerechnet. */
  orte: readonly string[];
  /** Branchen, die ausdrücklich interessieren. Leer heisst: egal. */
  branchen: readonly string[];
  /** Bevorzugte Arbeitgeberart. `null` heisst: egal. */
  bevorzugteArt: Arbeitgeberart | null;
  /**
   * Was ausgeschlossen ist.
   *
   * Harte Filter, keine Abzüge. Ein Ausschluss, der nur Punkte kostet,
   * ist irgendwann durch einen guten Rest ausgleichbar — und dann
   * steht ein Arbeitgeber auf der Liste, den jemand ausdrücklich nicht
   * wollte.
   */
  ausgeschlosseneArten: readonly Arbeitgeberart[];
  ausgeschlosseneNamen: readonly string[];
}

/* ══════════════════════════════════════════════════════════════════
   Belege
   ══════════════════════════════════════════════════════════════════ */

export interface Passungsbeleg {
  /** Was hier gilt, in einem Satz für Menschen. */
  aussage: string;
  /** Worauf es beruht. Ohne Fundstelle kein Beleg. */
  quelle: string;
  /** Wie alt die Beobachtung ist. */
  standAm: Date;
}

export type Passungsurteil =
  | {
      bewertbar: true;
      /** 0 bis 100. Internes Rangsignal, keine Wahrheit über den Arbeitgeber. */
      punkte: number;
      /** 0 bis 1: auf wie viel Wissen die Punkte beruhen. */
      belegdichte: number;
      belege: Passungsbeleg[];
      /** Was fehlt, damit die Zahl mehr wert wäre. */
      luecken: string[];
    }
  | {
      bewertbar: false;
      /** Warum keine Zahl ausgegeben wird. */
      grund: string;
    };

/* ══════════════════════════════════════════════════════════════════
   Die Grenzen
   ══════════════════════════════════════════════════════════════════ */

/**
 * Unter dieser Belegdichte gibt es keine Zahl.
 *
 * Nicht eine niedrige Zahl — gar keine. Eine 34 mit dem Zusatz
 * „schwach belegt" wird gelesen als „34", und danach steht ein
 * Arbeitgeber in einer Rangliste, über den nichts bekannt ist.
 */
export const MIN_BELEGDICHTE = 0.34;

/**
 * Ab wann eine alte Anzeige nichts mehr über heute sagt.
 *
 * Zwei Jahre. Einstellungsmuster ändern sich — eine Abteilung wird
 * aufgelöst, ein Bereich ausgelagert. Eine Anzeige von 2023 beweist,
 * dass es die Rolle einmal gab, nicht dass es sie noch gibt.
 */
export const BELEG_VERFALL_TAGE = 730;

/** Wie stark eine Beobachtung mit dem Alter verliert. */
export function frischegewicht(gesehenAm: Date, jetzt: Date): number {
  const tage = (jetzt.getTime() - gesehenAm.getTime()) / 86_400_000;
  if (tage < 0) return 1;
  if (tage >= BELEG_VERFALL_TAGE) return 0;
  /* Linear. Eine Kurve wäre genauer und liesse sich nicht erklären. */
  return 1 - tage / BELEG_VERFALL_TAGE;
}

/* ══════════════════════════════════════════════════════════════════
   Die Bewertung
   ══════════════════════════════════════════════════════════════════ */

interface Dimension {
  name: string;
  gewicht: number;
  /** `null` heisst: dazu ist nichts bekannt. Fliesst NICHT als 0,5 ein. */
  wert: number | null;
  beleg: Passungsbeleg | null;
  luecke: string;
}

const vergleichbar = (s: string) => s.trim().toLowerCase();

/**
 * Passt dieser Arbeitgeber zu diesem Profil?
 *
 * Gibt `bewertbar: false` zurück, wenn zu wenig bekannt ist oder ein
 * Ausschluss greift. Beides ist ein gültiges Ergebnis und muss beim
 * Aufrufer zu einer ehrlichen Anzeige führen — nicht zu einer
 * geschätzten Zahl.
 */
export function arbeitgeberpassung(
  arbeitgeber: Arbeitgeberprofil,
  profil: Suchprofil,
  jetzt: Date = new Date(),
): Passungsurteil {
  /* Ausschlüsse zuerst und ohne Verrechnung. */
  if (profil.ausgeschlosseneArten.includes(arbeitgeber.art)) {
    return { bewertbar: false, grund: `Arbeitgeber dieser Art hast du ausgeschlossen.` };
  }
  if (
    profil.ausgeschlosseneNamen.some((n) => vergleichbar(n) === vergleichbar(arbeitgeber.name))
  ) {
    return { bewertbar: false, grund: "Diesen Arbeitgeber hast du ausgeschlossen." };
  }

  const dimensionen: Dimension[] = [];

  /* ── Berufsfeld: die wichtigste Frage ─────────────────────────
   *
   * Sie ist die einzige, die aus Beobachtung beantwortet wird und
   * nicht aus Stammdaten. Deshalb wiegt sie am schwersten.
   */
  const passende = arbeitgeber.frühereStellen.filter(
    (s) => s.berufsfeld && profil.berufsfelder.some((b) => vergleichbar(b) === vergleichbar(s.berufsfeld!)),
  );
  const juengste = passende
    .map((s) => ({ s, g: frischegewicht(s.gesehenAm, jetzt) }))
    .filter((x) => x.g > 0)
    .sort((a, b) => b.g - a.g)[0];

  if (arbeitgeber.frühereStellen.length === 0) {
    dimensionen.push({
      name: "berufsfeld", gewicht: 0.45, wert: null, beleg: null,
      luecke: "Wir haben von diesem Arbeitgeber noch keine Anzeige gesehen.",
    });
  } else if (juengste) {
    /*
     * Mehrere Treffer sind mehr wert als einer, aber nicht beliebig:
     * Wer dreimal dieselbe Rolle ausgeschrieben hat, beschäftigt sie
     * regelmässig. Wer sie zwanzigmal ausgeschrieben hat, ist deshalb
     * nicht zwanzigmal so passend.
     */
    const menge = Math.min(1, passende.length / 3);
    dimensionen.push({
      name: "berufsfeld",
      gewicht: 0.45,
      wert: 0.55 * juengste.g + 0.45 * menge,
      beleg: {
        aussage:
          passende.length > 1
            ? `Hat ${passende.length} Stellen in deinem Berufsfeld ausgeschrieben, zuletzt „${juengste.s.titel}".`
            : `Hat „${juengste.s.titel}" in deinem Berufsfeld ausgeschrieben.`,
        quelle: juengste.s.quelle,
        standAm: juengste.s.gesehenAm,
      },
      luecke: "",
    });
  } else {
    /*
     * Anzeigen ja, aber keine passenden. Das ist eine Auskunft und
     * kein fehlendes Wissen — deshalb 0 und nicht `null`.
     */
    dimensionen.push({
      name: "berufsfeld", gewicht: 0.45, wert: 0,
      beleg: {
        aussage: `Von ${arbeitgeber.frühereStellen.length} bekannten Anzeigen passt keine zu deinem Berufsfeld.`,
        quelle: arbeitgeber.frühereStellen[0]?.quelle ?? "",
        standAm: jetzt,
      },
      luecke: "",
    });
  }

  /* ── Ort ──────────────────────────────────────────────────── */
  const orte = [
    ...(arbeitgeber.ort ? [arbeitgeber.ort] : []),
    ...arbeitgeber.frühereStellen.map((s) => s.ort).filter((o): o is string => Boolean(o)),
  ];
  const ortTrifft = orte.find((o) => profil.orte.some((p) => vergleichbar(p) === vergleichbar(o)));
  dimensionen.push({
    name: "ort",
    gewicht: 0.25,
    wert: orte.length === 0 ? null : ortTrifft ? 1 : 0,
    beleg: ortTrifft
      ? { aussage: `Sitzt oder stellt ein in ${ortTrifft}.`, quelle: arbeitgeber.name, standAm: jetzt }
      : null,
    luecke: "Kein Standort bekannt.",
  });

  /* ── Arbeitgeberart ───────────────────────────────────────── */
  dimensionen.push({
    name: "art",
    gewicht: 0.15,
    /* Keine Vorliebe ist keine fehlende Angabe — es ist Gleichgültigkeit. */
    wert: profil.bevorzugteArt === null ? 1 : profil.bevorzugteArt === arbeitgeber.art ? 1 : 0,
    beleg:
      profil.bevorzugteArt === arbeitgeber.art
        ? {
            aussage: `Ist ein ${arbeitgeber.art === "oeffentlich" ? "öffentlicher" : "privater"} Arbeitgeber, wie von dir bevorzugt.`,
            quelle: arbeitgeber.name, standAm: jetzt,
          }
        : null,
    luecke: "",
  });

  /* ── Branche ──────────────────────────────────────────────── */
  const brancheTrifft =
    arbeitgeber.branche !== null &&
    profil.branchen.some((b) => vergleichbar(b) === vergleichbar(arbeitgeber.branche!));
  dimensionen.push({
    name: "branche",
    gewicht: 0.15,
    wert:
      profil.branchen.length === 0 ? 1 : arbeitgeber.branche === null ? null : brancheTrifft ? 1 : 0,
    beleg: brancheTrifft
      ? { aussage: `Branche ${arbeitgeber.branche} steht auf deiner Liste.`, quelle: arbeitgeber.name, standAm: jetzt }
      : null,
    luecke: "Keine Branche hinterlegt.",
  });

  /*
   * Nur bekannte Dimensionen zählen — für Punkte UND für ihr Gewicht.
   *
   * Die Belegdichte ist der Anteil des Gewichts, zu dem etwas bekannt
   * war. Damit sagt sie genau das, was sie soll: wie viel von dem, was
   * zählen sollte, tatsächlich vorlag.
   */
  const bekannt = dimensionen.filter((d) => d.wert !== null);
  const gewichtBekannt = bekannt.reduce((s, d) => s + d.gewicht, 0);
  const gewichtGesamt = dimensionen.reduce((s, d) => s + d.gewicht, 0);
  const belegdichte = gewichtGesamt === 0 ? 0 : gewichtBekannt / gewichtGesamt;

  if (belegdichte < MIN_BELEGDICHTE) {
    return {
      bewertbar: false,
      grund: "Über diesen Arbeitgeber ist zu wenig bekannt, um ihn einzuschätzen.",
    };
  }

  const summe = bekannt.reduce((s, d) => s + d.gewicht * (d.wert ?? 0), 0);
  const punkte = Math.round((summe / gewichtBekannt) * 100);

  return {
    bewertbar: true,
    punkte,
    belegdichte: Math.round(belegdichte * 100) / 100,
    belege: dimensionen.map((d) => d.beleg).filter((b): b is Passungsbeleg => b !== null),
    luecken: dimensionen.filter((d) => d.wert === null && d.luecke).map((d) => d.luecke),
  };
}
