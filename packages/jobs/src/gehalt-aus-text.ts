/**
 * Gehaltsangaben aus dem Beschreibungstext — als Ableitung, nie als Tatsache.
 *
 * ── Warum es das überhaupt gibt ───────────────────────────────
 *
 * Gemessen an echten Rohantworten: Arbeitnow kennt gar kein
 * Gehaltsfeld, Adzuna lieferte bei 20 deutschen Anzeigen keines,
 * JSearch bei 10 keines, TheirStack bei einer von zwanzig. Von 1015
 * gespeicherten Stellen hatte deshalb keine einzige eine Gehaltsangabe.
 *
 * Im Text steht es öfter: bei Arbeitnow nennen 24 von 175 Anzeigen
 * etwas, das nach Gehalt aussieht. Diese Angabe wegzuwerfen, weil sie
 * im falschen Feld steht, hiesse: die Person sieht „keine Angabe", wo
 * die Anzeige eine macht.
 *
 * ── Warum es getrennt geführt wird ────────────────────────────
 *
 * Eine aus Fliesstext gelesene Zahl ist nicht dasselbe wie ein Feld,
 * das der Arbeitgeber ausgefüllt hat. Sie kann sich auf etwas anderes
 * beziehen — ein Budget, einen Umsatz, ein Beispiel. Deshalb setzt
 * diese Datei NIE `salaryDisclosed`, sondern liefert ein eigenes
 * Ergebnis mit `herkunft: "text"`, und die Oberfläche schreibt „laut
 * Anzeigentext" statt „Gehalt".
 *
 * ── Warum die Muster so eng sind ──────────────────────────────
 *
 * Eine falsch gelesene Zahl ist hier teurer als eine fehlende: sie
 * entscheidet über eine harte Bedingung. Deshalb verlangt jedes Muster
 * eine Währung oder ein ausdrückliches Gehaltswort in der Nähe, und
 * alles ausserhalb plausibler Grenzen wird verworfen.
 */

export interface GehaltAusText {
  min: number | null;
  max: number | null;
  currency: string;
  period: "year" | "month" | "hour";
  /** Die Textstelle, aus der es stammt. Ohne sie ist es nicht prüfbar. */
  beleg: string;
  herkunft: "text";
}

/*
 * Plausible Grenzen je Bezugsgrösse.
 *
 * Sie halten Jahreszahlen, Postleitzahlen, Mitarbeiterzahlen und
 * Umsätze heraus. „Seit 2019" enthält eine Zahl und ist kein Gehalt;
 * „500.000 Kunden" auch nicht.
 */
const GRENZEN = {
  year: { min: 12_000, max: 500_000 },
  month: { min: 1_000, max: 40_000 },
  hour: { min: 10, max: 400 },
} as const;

/**
 * Wörter, die in der Nähe stehen müssen.
 *
 * Mit vorangestelltem Wortteil, denn Deutsch setzt zusammen:
 * „Stundenlohn", „Jahresgehalt", „Einstiegsgehalt", „Bruttovergütung".
 * Eine Wortgrenze davor — `\blohn\b` — findet in „Stundenlohn" nichts,
 * und genau die Anzeigen mit dem eindeutigsten Hinweis fielen deshalb
 * durch.
 */
/*
 * Was in der Nähe stehen muss, damit eine Zahl ein Gehalt ist.
 *
 * ── Was gefehlt hat ───────────────────────────────────────────
 *
 * An 2.506 echten Anzeigen gemessen: 113 nannten einen Eurobetrag, den
 * dieser Erkenner nicht fasste. Der häufigste Grund war nicht das
 * Zahlenmuster, sondern diese Liste — sie kannte „Gehalt" und
 * „Vergütung", aber nicht das Wort, das deutsche Anzeigen am
 * häufigsten benutzen:
 *
 *   „4.000 € BIS 5.000 € BRUTTO PRO MONAT"
 *   „Was wir zahlen: 55.000 bis 75.000 EUR brutto im Jahr"
 *   „monatlicher Verdienst 530 € – 1.650 €"
 *
 * Alle drei sind eindeutige Gehaltsangaben, und in keiner steht das
 * Wort „Gehalt".
 *
 * ── Warum die Liste trotzdem kurz bleibt ──────────────────────
 *
 * Sie ist der einzige Schutz gegen „Wir betreuen ein Budget von
 * 250.000 €". Jedes Wort, das hier dazukommt, muss ohne Ausnahme auf
 * Bezahlung hindeuten — „bonus", „zuschuss" oder „prämie" gehören
 * deshalb nicht hinein: „Weiterempfehlungsbonus in Höhe von 1.000 €"
 * ist kein Gehalt, und „Bis zu 467 € fürs Deutschlandticket" auch
 * nicht.
 */
const GEHALTSWORT =
  /[a-zäöüß]*(gehalt|geh[aä]lter|verg[uü]tung|entgelt|lohn|l[oö]hne|brutto|verdienst|verdienen|bezahlung|salary|compensation|remuneration)\b/i;

/** Zeitbezug im Text. */
function bezug(umfeld: string): "year" | "month" | "hour" | null {
  if (/\b(pro stunde|je stunde|\/\s?h\b|per hour|stundenlohn|€\s?\/\s?h)\b/i.test(umfeld)) return "hour";
  if (/\b(pro monat|monatlich|je monat|per month|\/\s?monat|monatsgehalt)\b/i.test(umfeld)) return "month";
  if (/\b(pro jahr|j[aä]hrlich|per year|p\.?a\.?|jahresgehalt|\/\s?jahr|annual)\b/i.test(umfeld)) return "year";
  return null;
}

/** „65.000", „65 000", „65k", „65.5k" → 65000. */
function zahl(roh: string): number | null {
  const s = roh.trim().toLowerCase().replace(/\s/g, "");
  const k = /^(\d+(?:[.,]\d+)?)k$/.exec(s);
  if (k) return Math.round(Number(k[1]!.replace(",", ".")) * 1000);
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/*
 * Auch zwei- und dreistellige Beträge.
 *
 * Ein Stundenlohn ist „18 €" — ohne diese Alternative fand das Muster
 * gar keinen Stundenlohn, und genau die Anzeigen ohne Jahresangabe
 * wären wieder die ohne Auskunft gewesen.
 *
 * Was die Zahl davor bewahrt, alles Mögliche zu treffen, sind nicht
 * die Ziffern, sondern die beiden Prüfungen weiter unten: ein
 * Gehaltswort in der Umgebung und plausible Grenzen je Bezugsgrösse.
 */
const BETRAG = String.raw`\d{1,3}(?:[.\s]\d{3})+|\d+(?:[.,]\d+)?k|\d{2,6}`;

/**
 * Der Versuch, eine Angabe zu finden. `null`, wenn nichts Sicheres da ist.
 *
 * Die Reihenfolge ist Absicht: eine Spanne („45.000 – 55.000 €") ist
 * aussagekräftiger als ein Einzelwert und wird zuerst gesucht.
 */
export function gehaltAusText(text: string): GehaltAusText | null {
  if (!text || text.length < 20) return null;

  const spanne = new RegExp(
    String.raw`(?:^|[^\d])(${BETRAG})\s*(?:€|EUR|eur)?\s*(?:-|–|—|bis|to)\s*(${BETRAG})\s*(€|EUR|eur)`,
    "i",
  );
  const spanneUmgekehrt = new RegExp(
    String.raw`(€|EUR)\s*(${BETRAG})\s*(?:-|–|—|bis|to)\s*(${BETRAG})`,
    "i",
  );
  const einzeln = new RegExp(String.raw`(?:^|[^\d])(${BETRAG})\s*(€|EUR|eur)`, "i");

  for (const [muster, art] of [
    [spanne, "spanne"],
    [spanneUmgekehrt, "spanne-um"],
    [einzeln, "einzeln"],
  ] as const) {
    const t = muster.exec(text);
    if (!t) continue;

    const umfeld = umgebung(text, t.index, t[0].length);
    const a = art === "spanne-um" ? zahl(t[2] ?? "") : zahl(t[1] ?? "");
    const b = art === "spanne" ? zahl(t[2] ?? "") : art === "spanne-um" ? zahl(t[3] ?? "") : null;
    if (a === null) continue;

    /*
     * Ohne Zeitbezug wird geraten — aber nur innerhalb der Grenzen.
     *
     * Ein vierstelliger Betrag mit € ist in Deutschland fast immer
     * monatlich, ein fünfstelliger jährlich. Passt keine Annahme in
     * ihre Grenzen, wird verworfen statt gebogen.
     */
    const gemeint = bezug(umfeld) ?? (a >= 12_000 ? "year" : a >= 1_000 ? "month" : "hour");
    const grenze = GRENZEN[gemeint];
    if (a < grenze.min || a > grenze.max) return null;

    /*
     * Eine unstimmige Spanne beendet die Suche — sie überspringt sie nicht.
     *
     * Hier stand `continue`, und das war der teuerste Fehler dieser
     * Datei: „Gehalt von 55.000 bis 45.000 €" scheiterte an der
     * Spannenprüfung, fiel auf das Einzelwert-Muster durch und kam als
     * „ab 45.000 €" heraus. Aus einer erkennbar kaputten Angabe wurde
     * eine plausible falsche.
     *
     * Wo eine Spanne dasteht und nicht stimmt, wissen wir nur eines
     * sicher: dass wir sie nicht verstanden haben.
     */
    if (b !== null && (b < grenze.min || b > grenze.max || b < a)) return null;

    /*
     * Ohne Gehaltswort in der Nähe wird nichts übernommen.
     *
     * „Wir betreuen ein Budget von 250.000 €" enthält eine Währung und
     * eine plausible Zahl und ist kein Gehalt. Das Wort in der
     * Umgebung ist der Unterschied zwischen Lesen und Raten.
     */
    if (!GEHALTSWORT.test(umfeld)) continue;

    /*
     * Bei kleinen Beträgen muss der Stundenbezug ausdrücklich dastehen.
     *
     * „Gehalt nach Tarifgruppe 18" oder „18 Urlaubstage" in der Nähe
     * eines Gehaltsworts ergäbe sonst einen Stundenlohn von 18 Euro.
     */
    if (gemeint === "hour" && bezug(umfeld) !== "hour") continue;

    return {
      min: a,
      max: b,
      currency: "EUR",
      period: gemeint,
      beleg: umfeld.replace(/\s+/g, " ").trim().slice(0, 160),
      herkunft: "text",
    };
  }

  return null;
}

/** Der Satz um eine Fundstelle — als Beleg und als Prüfumfeld. */
function umgebung(text: string, index: number, laenge: number): string {
  const von = Math.max(0, index - 120);
  const bis = Math.min(text.length, index + laenge + 120);
  return text.slice(von, bis);
}
