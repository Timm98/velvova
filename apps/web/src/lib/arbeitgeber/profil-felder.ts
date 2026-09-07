/**
 * Die Felder der Unternehmensseite — und was sie taugen.
 *
 * ── Warum diese Datei kein `server-only` trägt ────────────────
 *
 * Sie wird von beiden Seiten gebraucht: Der Editor im Browser
 * berechnet damit die Vollständigkeit und die Hinweise, während man
 * tippt, und die öffentliche Seite auf dem Server rendert daraus ihre
 * Abschnitte.
 *
 * Alles hier ist deshalb rein — Beschreibungen und Rechnungen, keine
 * Datenbank. Die Abfragen liegen in `profil.ts` daneben, und die trägt
 * `server-only`. Beides in einer Datei hiesse, den Datenbanktreiber in
 * das Bündel für den Browser zu ziehen; der Build bricht dann ab, und
 * zwar zu Recht.
 *
 * ── Warum `Profilstand` hier von Hand steht ───────────────────
 *
 * Der Typ liesse sich aus dem Drizzle-Schema ableiten. Dann hinge
 * diese Datei an `@paycheck/db`, und damit wäre der Treiber doch
 * wieder im Browser. Der Preis: Beim nächsten neuen Feld muss er hier
 * mitgeführt werden — und weil der Editor daraus liest, meldet der
 * Übersetzer es sofort.
 */

/** Ein Wert mit dem Beispiel, das ihn belegt. */
export type Wert = { wert: string; beispiel: string };

/**
 * Der Datensatz, wie ihn beide Seiten sehen.
 *
 * Alle Textfelder sind `string | null`; die Struktur folgt der Tabelle
 * `unternehmensprofile`.
 */
export type Profilstand = {
  organizationId: string;
  gruendungsjahr: number | null;
  werte: Wert[];
  veroeffentlichtAm: Date | null;
  aktualisiertAm: Date;
  aktualisiertVon: string | null;
} & Record<string, unknown>;

/* ══════════════════════════════════════════════════════════════
   Die Felder — einmal beschrieben, überall benutzt
   ══════════════════════════════════════════════════════════════ */

/**
 * Die Feldliste ist die einzige Stelle, an der ein Feld beschrieben
 * wird.
 *
 * Editor, Vollständigkeitsrechnung, Monday-Hinweise und die öffentliche
 * Seite lesen alle hieraus. Vorher hätte jedes dieser vier Stücke eine
 * eigene Liste gehabt — und beim ersten neuen Feld hätten drei davon
 * es nicht gekannt: Es stünde im Editor, zählte aber nicht zur
 * Vollständigkeit und erschiene nicht auf der Seite. Genau die Sorte
 * Fehler, die niemand meldet, weil nichts abstürzt.
 */
export type Feld = {
  name: keyof Profilstand;
  label: string;
  /** Mehrzeilig? Sonst eine Zeile. */
  lang?: boolean;
  hinweis?: string;
  /** Zählt für die Vollständigkeit. Zusatzangaben nicht. */
  zaehlt?: boolean;
};

export type Bereich = { id: string; titel: string; einleitung: string; felder: Feld[] };

export const BEREICHE: Bereich[] = [
  {
    id: "grundlagen",
    titel: "Grundlagen",
    einleitung:
      "Beschreibt konkret, was Menschen bei euch erwartet. Werbesätze verbessern den Fit Score nicht.",
    felder: [
      { name: "kurzbeschreibung", label: "Kurzbeschreibung", zaehlt: true, hinweis: "Ein bis zwei Sätze. Steht oben auf eurer Seite." },
      { name: "beschreibung", label: "Ausführliche Beschreibung", lang: true, zaehlt: true },
      { name: "branche", label: "Branche", zaehlt: true },
      { name: "gruendungsjahr", label: "Gründungsjahr" },
      { name: "groesse", label: "Unternehmensgrösse", zaehlt: true, hinweis: "Etwa „120 Mitarbeitende an drei Standorten“." },
      { name: "hauptsitz", label: "Hauptsitz", zaehlt: true },
      { name: "weitereStandorte", label: "Weitere Standorte" },
      { name: "arbeitssprachen", label: "Arbeitssprachen", zaehlt: true },
    ],
  },
  {
    id: "arbeitsrealitaet",
    titel: "Arbeitsrealität",
    einleitung:
      "Der Teil, den Stellenanzeigen auslassen — und nach dem im Gespräch als Erstes gefragt wird.",
    felder: [
      { name: "arbeitsmodell", label: "Vor Ort, hybrid oder remote", zaehlt: true },
      { name: "wochenstunden", label: "Typische Wochenstunden", zaehlt: true },
      { name: "gleitzeit", label: "Flexible Arbeitszeiten" },
      { name: "kernarbeitszeit", label: "Kernarbeitszeiten" },
      { name: "schichtarbeit", label: "Schichtarbeit" },
      { name: "reisetaetigkeit", label: "Reisetätigkeit" },
      { name: "ueberstunden", label: "Umgang mit Überstunden", lang: true, zaehlt: true, hinweis: "Werden sie ausgezahlt, abgefeiert oder erwartet?" },
      { name: "meetingkultur", label: "Meeting-Kultur", lang: true },
      { name: "entscheidungswege", label: "Entscheidungswege", lang: true },
      { name: "fuehrungsstil", label: "Führungsstil", lang: true, zaehlt: true },
      { name: "teamgroessen", label: "Typische Teamgrössen" },
      { name: "arbeitsmittel", label: "Verwendete Arbeitsmittel" },
    ],
  },
  {
    id: "kultur",
    titel: "Kultur und Entwicklung",
    einleitung: "Werte zählen nur mit Beispiel. Ohne eines sind sie eine Behauptung.",
    felder: [
      { name: "feedbackRhythmus", label: "Feedback-Rhythmus", zaehlt: true },
      { name: "weiterbildung", label: "Weiterbildungen", lang: true, zaehlt: true },
      { name: "weiterbildungsbudget", label: "Weiterbildungsbudget" },
      { name: "karrierewege", label: "Karrierewege", lang: true },
      { name: "interneWechsel", label: "Interne Wechselmöglichkeiten" },
      { name: "onboarding", label: "Onboarding-Ablauf", lang: true, zaehlt: true },
      { name: "barrierefreiheit", label: "Barrierefreiheit", lang: true },
    ],
  },
  {
    id: "leistungen",
    titel: "Leistungen",
    einleitung: "Konkret statt aufzählend: „30 Tage“ sagt mehr als „attraktiver Urlaubsanspruch“.",
    felder: [
      { name: "urlaubstage", label: "Urlaubstage", zaehlt: true },
      { name: "homeoffice", label: "Homeoffice-Regelung", zaehlt: true, hinweis: "Wie viele Tage, wer entscheidet, welche Ausnahmen?" },
      { name: "bonusmodell", label: "Bonusmodell" },
      { name: "altersvorsorge", label: "Betriebliche Altersvorsorge" },
      { name: "mobilitaet", label: "Mobilitätsangebote" },
      { name: "gesundheit", label: "Gesundheitsangebote" },
      { name: "ausstattung", label: "Ausstattung" },
      { name: "elternzeit", label: "Eltern- und Pflegezeit", lang: true },
      { name: "weitereLeistungen", label: "Weitere Leistungen", lang: true },
    ],
  },
  {
    id: "bewerbung",
    titel: "Bewerbungsprozess",
    einleitung:
      "Wer weiss, was kommt, bewirbt sich eher — und springt seltener mittendrin ab.",
    felder: [
      { name: "ansprechperson", label: "Ansprechperson", zaehlt: true },
      { name: "antwortzeit", label: "Erwartete Antwortzeit", zaehlt: true, hinweis: "Eine Zusage, an der ihr euch messen lasst." },
      { name: "anzahlGespraeche", label: "Anzahl der Gespräche", zaehlt: true },
      { name: "beteiligteRollen", label: "Beteiligte Rollen" },
      { name: "prozessdauer", label: "Übliche Prozessdauer", zaehlt: true },
      { name: "probearbeit", label: "Probearbeit oder Aufgabe", lang: true },
      { name: "unterlagen", label: "Benötigte Unterlagen" },
      { name: "anpassungen", label: "Anpassungen für Bewerbende", lang: true, hinweis: "Etwa Gebärdensprache, barrierefreier Zugang, andere Gesprächsform." },
    ],
  },
];

export const ALLE_FELDER: Feld[] = BEREICHE.flatMap((b) => b.felder);

/* ══════════════════════════════════════════════════════════════
   Bewerten
   ══════════════════════════════════════════════════════════════ */

function gefuellt(wert: unknown): boolean {
  if (wert === null || wert === undefined) return false;
  if (typeof wert === "string") return wert.trim().length > 0;
  return true;
}

/**
 * Wie vollständig ist das Profil?
 *
 * Gezählt werden nur die Felder mit `zaehlt` — sonst hinge die Prozent­
 * zahl daran, ob jemand „Mobilitätsangebote" ausgefüllt hat. Ein
 * Unternehmen ohne Jobrad ist nicht unvollständig, es hat kein Jobrad.
 *
 * Die Werte zählen als ein Feld, und nur wenn mindestens einer ein
 * Beispiel trägt.
 */
export function vollstaendigkeit(profil: Profilstand | null): {
  prozent: number;
  offen: Feld[];
} {
  const pflicht = ALLE_FELDER.filter((f) => f.zaehlt);
  if (!profil) return { prozent: 0, offen: pflicht };

  const offen = pflicht.filter((f) => !gefuellt(profil[f.name]));
  const werteOk = (profil.werte ?? []).some((w) => w.wert?.trim() && w.beispiel?.trim());
  const gesamt = pflicht.length + 1;
  const erledigt = pflicht.length - offen.length + (werteOk ? 1 : 0);

  return { prozent: Math.round((erledigt / gesamt) * 100), offen };
}

/**
 * Woran Monday Anstoss nimmt.
 *
 * Ausschliesslich Regeln über das, was dasteht — keine Bewertung des
 * Unternehmens. „Eure Homeoffice-Regel ist noch nicht eindeutig" ist
 * eine Aussage über einen Text; „euer Angebot ist nicht
 * wettbewerbsfähig" wäre eine über einen Arbeitgeber, und die steht
 * uns nicht zu.
 */
export function ninaHinweise(profil: Profilstand | null): string[] {
  if (!profil) return ["Das Profil ist noch leer. Fangt mit der Kurzbeschreibung an."];
  const h: string[] = [];

  const fehlend = ALLE_FELDER.filter((f) => f.zaehlt && !gefuellt(profil[f.name]));
  if (fehlend.length > 0) {
    h.push(
      fehlend.length === 1
        ? `Bei einer Angabe fehlen Bewerbenden wichtige Informationen: ${fehlend[0]!.label}.`
        : `Bei ${fehlend.length} Angaben fehlen Bewerbenden wichtige Informationen.`,
    );
  }

  if (gefuellt(profil.homeoffice)) {
    const t = String(profil.homeoffice).toLowerCase();
    /* „nach Absprache" ist keine Regel, sondern ihre Abwesenheit — und
       genau daran scheitern Bewerbungen später im Gespräch. */
    if (/absprache|möglich|flexibel/.test(t) && !/\d/.test(t)) {
      h.push("Eure Homeoffice-Regel ist noch nicht eindeutig. Nennt Tage oder wer entscheidet.");
    }
  } else {
    h.push("Ergänzt eure Homeoffice-Regelung — danach wird am häufigsten gefragt.");
  }

  const werte = profil.werte ?? [];
  const ohneBeispiel = werte.filter((w) => w.wert?.trim() && !w.beispiel?.trim());
  for (const w of ohneBeispiel) {
    h.push(`Der Wert „${w.wert}“ enthält noch kein konkretes Beispiel.`);
  }

  if (!gefuellt(profil.antwortzeit)) {
    h.push("Ohne erwartete Antwortzeit weiss niemand, ab wann er nachfragen darf.");
  }

  return h;
}
