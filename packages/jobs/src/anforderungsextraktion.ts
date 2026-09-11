import {
  EXTRAKTIONSFASSUNG,
  abschnittWechsel,
  bedeutungAus,
  erfahrungAus,
  kategorisieren,
  verbindlichkeitAus,
  zeileTaugt,
  type Abschnitt,
  type Strukturierte,
} from "@paycheck/domain";

/**
 * ══════════════════════════════════════════════════════════════════
 * Eine Anzeige durchlesen — von oben nach unten, mit Gedächtnis
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Warum der Abschnitt mitläuft ────────────────────────────────
 *
 * Viele Anzeigen kennzeichnen ihre Punkte nicht. Die Trennung steckt
 * allein in zwei Überschriften: „Das bringen Sie mit" und „Das wäre
 * zusätzlich schön". Wer eine Zeile für sich liest, verliert die
 * einzige Information darüber, ob sie Pflicht ist.
 *
 * Dasselbe gilt für Aufgaben: „Kommissionierung von Waren" unter
 * „Ihre Aufgaben" ist eine Tätigkeit, unter „Ihr Profil" eine
 * Anforderung. Dieselbe Zeile, zwei Bedeutungen.
 *
 * ── Warum die Obergrenze grosszügiger ist als vorher ────────────
 *
 * Die alte Fassung nahm zwölf Zeilen und nur solche mit einem von
 * sieben Signalwörtern — Ergebnis: keine einzige von 120 Anzeigen
 * hatte zwei prüfbare Muss-Anforderungen. Vierzig ist die Menge, die
 * eine ausführliche Anzeige tatsächlich hergibt; darüber wiederholt
 * sich Werbung.
 */

/** Wörter, die eine Zeile auch ohne Abschnitt zu einer Aussage über die Stelle machen. */
/*
 * ── Warum die Stämme hinten offen sind ──────────────────────────
 *
 * `\bstapler\b` trifft „Staplerschein" nicht: Deutsch bildet
 * Komposita, und nach „stapler" steht keine Wortgrenze. Genau daran
 * fiel „Staplerschein ist Voraussetzung" durch — die Zeile trug ein
 * Signal und wurde trotzdem verworfen.
 *
 * Derselbe Fehler wie im Fähigkeitskatalog, dort mit neunzehn falsch
 * zugeordneten Fähigkeiten bezahlt. Die Grenze steht deshalb nur vorn.
 */
const SIGNAL =
  /\b(erfahrung|kenntnis|abschluss|ausbildung|schein|zertifikat|f(ue|ü)hrerschein|voraussetzung|erforderlich|zwingend|w(ue|ü)nschenswert|von vorteil|idealerweise|bereitschaft|schicht|sprach|deutsch|englisch|sap|erp|excel|stapler|qualifikation|lizenz|berechtigung)/i;

function traegtSignal(zeile: string): boolean {
  return SIGNAL.test(zeile);
}

/** So viele Einträge je Anzeige. Darüber beginnt die Wiederholung. */
export const MAX_EINTRAEGE = 40;

export interface Extraktion {
  fassung: string;
  eintraege: Strukturierte[];
}

/**
 * Aus dem Anzeigentext eine Struktur.
 *
 * Rein — keine Datenbank, kein Modell. Damit ist sie gegen ein
 * Gold-Set messbar und in einem Test reproduzierbar.
 */
export function anforderungenExtrahieren(beschreibung: string): Extraktion {
  const eintraege: Strukturierte[] = [];
  let abschnitt: Abschnitt = "unbekannt";
  const gesehen = new Set<string>();

  for (const roh of beschreibung.split(/\r?\n/)) {
    const zeile = roh.replace(/^[-•·*–]\s*/, "").trim();
    if (!zeile) continue;

    const wechsel = abschnittWechsel(zeile);
    if (wechsel !== null) {
      abschnitt = wechsel;
      /* Eine Überschrift ist selbst keine Anforderung. */
      continue;
    }

    /*
     * Der Angebotsblock bleibt draussen.
     *
     * „30 Urlaubstage" ist kein Anspruch an den Menschen, sondern
     * eine Zusage an ihn. Sie als Anforderung zu führen dreht die
     * Richtung um.
     */
    if (abschnitt === "angebot") continue;
    if (!zeileTaugt(zeile)) continue;

    /*
     * ── Vor der ersten Überschrift steht Werbung ────────────────
     *
     * „An derzeit über 120 Standorten haben wir es uns zur Aufgabe
     * gemacht…" ist ein Satz über das Unternehmen, kein Anspruch an
     * einen Menschen. Solche Zeilen kamen als `UNKNOWN` durch —
     * harmlos in der Verbindlichkeit, aber sie füllen die Liste, die
     * jemand liest.
     *
     * Ohne erkannten Abschnitt wird deshalb nur aufgenommen, was
     * selbst ein Signal trägt.
     */
    if (abschnitt === "unbekannt" && !traegtSignal(zeile)) continue;

    const bedeutung = bedeutungAus(zeile);
    if (bedeutung.length < 5) continue;

    /* Dieselbe Aussage zweimal ist keine zweite Anforderung. */
    const schluessel = bedeutung.toLowerCase();
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);

    const { verbindlichkeit, belegstelle, konfidenz } = verbindlichkeitAus(zeile, abschnitt);
    const kategorie = kategorisieren(zeile, abschnitt, verbindlichkeit);
    const erfahrung = kategorie === "EXPERIENCE" ? erfahrungAus(zeile) : { feld: null, mass: null };

    eintraege.push({
      original: zeile,
      bedeutung,
      kategorie,
      /*
       * Eine Tätigkeit ist keine Pflicht — auch nicht, wenn sie im
       * Profilblock steht. Sie beschreibt den Job, sie fordert nichts.
       */
      /*
       * ── Zwei Regeln, die falsche Pflichten verhindern ─────────
       *
       * Eine Tätigkeit fordert nichts — auch nicht im Profilblock.
       *
       * Und was wir nicht einordnen konnten, wird nicht zur Pflicht.
       * `UNKNOWN` mit `muss` ist die gefährlichste Kombination dieser
       * Datei: eine Hürde, von der niemand sagen kann, worin sie
       * besteht. Gemessen entstand sie vor allem dort, wo eine
       * Überschrift nicht erkannt wurde und der Profilblock bis zum
       * Ende der Anzeige weiterlief.
       */
      verbindlichkeit:
        kategorie === "TASK" || kategorie === "UNKNOWN" ? "unklar" : verbindlichkeit,
      belegstelle: kategorie === "TASK" || kategorie === "UNKNOWN" ? null : belegstelle,
      konfidenz: kategorie === "TASK" ? 60 : kategorie === "UNKNOWN" ? 30 : konfidenz,
      abschnitt,
      erfahrungsfeld: erfahrung.feld,
      erfahrungsmass: erfahrung.mass,
    });

    if (eintraege.length >= MAX_EINTRAEGE) break;
  }

  return { fassung: EXTRAKTIONSFASSUNG, eintraege };
}

/** Wie viele Einträge je Kategorie — für die Messung. */
export function verteilung(e: Extraktion): Record<string, number> {
  const raus: Record<string, number> = {};
  for (const x of e.eintraege) raus[x.kategorie] = (raus[x.kategorie] ?? 0) + 1;
  return raus;
}
