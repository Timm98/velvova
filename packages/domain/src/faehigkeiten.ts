/**
 * ══════════════════════════════════════════════════════════════════
 * Von einem Beleg zu einer Fähigkeit — und zurück zur Anforderung
 * ══════════════════════════════════════════════════════════════════
 *
 * Am 10.09.2026 gemessen: 142 bestätigte Belege im Bestand,
 * 0 Zeilen in `profile_skills`. Der Passungswert kann deshalb nicht
 * sagen, ob jemand eine Anforderung erfüllt — er hat auf der einen
 * Seite Sätze und auf der anderen Sätze, und nichts dazwischen.
 *
 * Diese Datei ist das Dazwischen.
 *
 * ── Der Riegel, der zuerst auffiel ──────────────────────────────
 *
 * `profile_skills.skill_key` verweist auf `skills.key`, und `skills`
 * hat null Zeilen. Es liesse sich also gar keine Fähigkeit ablegen.
 * Der Katalog ist die Voraussetzung, nicht ein späterer Feinschliff.
 *
 * ── Warum der Katalog nicht aus den Anzeigen fallen kann ────────
 *
 * Naheliegend wäre, ihn aus den 529.225 Anforderungszeilen zu
 * gewinnen. Die häufigsten davon sind:
 *
 *   bereitschaft zur schichtarbeit            10.696
 *   bereitschaft zur arbeit im schichtsystem   1.153
 *   bereitschaft zum schichtdienst               791
 *
 * Das sind keine Fähigkeiten. Es sind Arbeitsbedingungen, und für sie
 * gibt es bereits ein Muss-Kriterium (`schichtarbeit`). Sie in einen
 * Fähigkeitskatalog zu übernehmen hiesse, dieselbe Frage zweimal zu
 * stellen — einmal als Bedingung, einmal als Können — und beim
 * zweiten Mal falsch: Wer Schichtarbeit ablehnt, kann sie trotzdem.
 *
 * `istBedingung()` hält sie deshalb heraus.
 *
 * ── Warum eine Fähigkeit ohne Beleg nicht entsteht ──────────────
 *
 * Weil sie sonst genau das wäre, was das Produkt nicht sein darf: ein
 * Wert über einen Menschen, den niemand nachprüfen kann. Jede
 * Fähigkeitsaussage trägt mindestens einen Beleg, und `stufeGrenze()`
 * begrenzt, was eine Belegart überhaupt tragen kann.
 */

/**
 * Wie weit jemand in einer Sache ist.
 *
 * Heisst `Koennensstufe` und nicht `Stufe`: Der kürzere Name gehört im
 * Domänenpaket dem Marktwert. Dasselbe gilt für `Belegart` statt
 * `Herkunft` (vergeben von `herkunft.ts`) und
 * `istAnforderungsLeerformel` statt `istLeerformel` (vergeben vom
 * Arbeitsweise-Profil). Zwei gleichnamige Begriffe nebeneinander sind
 * die Art Mehrdeutigkeit, die man beim Lesen nicht bemerkt.
 *
 * Vier Stufen, keine Zahl. „7 von 10" bei einer Fähigkeit ist eine
 * Genauigkeit, die niemand hat — und sie lädt dazu ein, Menschen
 * gegeneinander zu sortieren.
 */
export const KOENNENSSTUFEN = ["grundkenntnisse", "sicher", "routiniert", "anleitend"] as const;
export type Koennensstufe = (typeof KOENNENSSTUFEN)[number];

export function stufenrang(s: Koennensstufe): number {
  return KOENNENSSTUFEN.indexOf(s);
}

/**
 * Woher eine Fähigkeitsaussage kommt.
 *
 * Die Reihenfolge ist keine Rangfolge der Menschen, sondern der
 * Nachprüfbarkeit.
 */
export const BELEGARTEN = ["nutzer_aussage", "lebenslauf", "zertifikat", "arbeitsprobe"] as const;
export type Belegart = (typeof BELEGARTEN)[number];

/**
 * Wie weit eine Belegart überhaupt tragen kann.
 *
 * ── Warum ein Zertifikat bei „sicher" endet ─────────────────────
 *
 * Weil es belegt, dass jemand eine Prüfung bestanden hat — nicht,
 * dass er die Sache im Alltag anleitet. Der Unterschied ist genau
 * der, den ein Arbeitgeber im Gespräch herausfinden will; ihn vorher
 * einzuebnen nimmt beiden Seiten die Information.
 *
 * Eine bestandene Arbeitsprobe trägt weiter, weil dort jemand die
 * Sache getan hat. Bis „anleitend" trägt sie trotzdem nicht: Andere
 * anzuleiten ist eine andere Tätigkeit als es selbst zu können.
 */
export function stufeGrenze(h: Belegart): Koennensstufe {
  switch (h) {
    case "nutzer_aussage":
      return "sicher";
    case "lebenslauf":
      return "sicher";
    case "zertifikat":
      return "sicher";
    case "arbeitsprobe":
      return "routiniert";
  }
}

export interface Beleg {
  id: string;
  /** Der Satz, auf den sich die Fähigkeit stützt. */
  aussage: string;
  herkunft: Belegart;
  bestaetigt: boolean;
}

export interface Faehigkeitsaussage {
  /** Der Schlüssel aus dem Katalog. */
  schluessel: string;
  stufe: Koennensstufe;
  /** Nie leer. Eine Fähigkeit ohne Beleg entsteht nicht. */
  belegtDurch: readonly string[];
  herkunft: Belegart;
}

/* ── Was keine Fähigkeit ist ── */

/**
 * Zeilen, die eine Arbeitsbedingung beschreiben.
 *
 * Sie beantworten „will ich das", nicht „kann ich das" — und dafür
 * gibt es eigene Muss-Kriterien. Die Muster sind hinten offen, weil
 * Deutsch beugt.
 */
export const BEDINGUNGSMUSTER: readonly RegExp[] = [
  /\bbereitschaft\b/i,
  /\bschicht(arbeit|dienst|system)?\b/i,
  /\bwochenend/i,
  /\bnachtdienst/i,
  /\brufbereitschaft/i,
  /\breisebereit/i,
  /\bumzugsbereit/i,
  /\bflexib/i,
  /\bbelastbar/i,
];

export function istBedingung(text: string): boolean {
  return BEDINGUNGSMUSTER.some((m) => m.test(text));
}

/**
 * Wörter, die über niemanden etwas aussagen.
 *
 * Dieselbe Sperre wie im Arbeitsweise-Profil, hier für die
 * Anzeigenseite: „teamfähig" als Anforderung ist keine, die sich
 * belegen liesse.
 */
export const ANFORDERUNGS_LEERFORMELN: readonly RegExp[] = [
  /\bteamf[äa]hig/i,
  /\bmotiviert\b/i,
  /\bengagiert\b/i,
  /\bzuverl[äa]ssig/i,
  /\bkommunikativ/i,
  /\beigenverantwortlich/i,
  /\bsorgf[äa]ltig/i,
];

export function istAnforderungsLeerformel(text: string): boolean {
  return ANFORDERUNGS_LEERFORMELN.some((m) => m.test(text));
}

/**
 * Taugt diese Anforderungszeile überhaupt für einen Fähigkeitsabgleich?
 *
 * Drei Arten fallen heraus: Bedingungen (dafür gibt es Kriterien),
 * Leerformeln (nicht belegbar) und zu Kurzes.
 */
export function abgleichbar(anforderung: string): boolean {
  const t = anforderung.replace(/^[-•·*]\s*/, "").trim();
  return t.length >= 6 && !istBedingung(t) && !istAnforderungsLeerformel(t);
}

/* ── Der Abgleich ── */

export type Abgleichstand =
  /** Belegt und mindestens auf der verlangten Stufe. */
  | "erfuellt"
  /** Belegt, aber nicht so weit wie verlangt. */
  | "teilweise"
  /** Es gibt keinen Beleg dafür. Das heisst nicht: kann es nicht. */
  | "nicht_belegt"
  /** Die Zeile taugt nicht für einen Fähigkeitsabgleich. */
  | "nicht_zustaendig";

export interface Abgleichergebnis {
  stand: Abgleichstand;
  /** Auf welche Fähigkeit es sich stützt. */
  schluessel: string | null;
  /** Die Belege dahinter — damit die Person sieht, woher es kommt. */
  belege: readonly string[];
  satz: string;
}

/**
 * Eine Anforderung gegen die belegten Fähigkeiten halten.
 *
 * ── Warum „nicht belegt" und nicht „fehlt" ──────────────────────
 *
 * Weil ein fehlender Beleg keine fehlende Fähigkeit ist. Wer zehn
 * Jahre Dienstpläne geschrieben hat und es nie erzählt hat, kann es
 * trotzdem. Das Wort entscheidet darüber, ob jemand eine Stelle
 * überspringt, die er könnte — und in dieser Richtung ist der Fehler
 * teurer.
 */
export function anforderungAbgleichen(
  anforderung: string,
  verlangteStufe: Koennensstufe,
  faehigkeiten: readonly Faehigkeitsaussage[],
  /** Schlüssel je Anforderungstext — aus dem Katalog, nicht geraten. */
  schluesselFuer: (text: string) => string | null,
): Abgleichergebnis {
  if (!abgleichbar(anforderung)) {
    return {
      stand: "nicht_zustaendig",
      schluessel: null,
      belege: [],
      satz: istBedingung(anforderung)
        ? "Das ist eine Arbeitsbedingung, keine Fähigkeit — sie wird über deine Kriterien geprüft."
        : "Daraus lässt sich keine belegbare Fähigkeit lesen.",
    };
  }

  const schluessel = schluesselFuer(anforderung);
  if (schluessel === null) {
    return {
      stand: "nicht_zustaendig",
      schluessel: null,
      belege: [],
      satz: "Dafür gibt es im Katalog noch keinen Eintrag.",
    };
  }

  const treffer = faehigkeiten.filter((f) => f.schluessel === schluessel);
  if (treffer.length === 0) {
    return {
      stand: "nicht_belegt",
      schluessel,
      belege: [],
      satz: "Dazu liegt nichts vor. Das heisst nicht, dass du es nicht kannst — nur, dass du es noch nicht erzählt hast.",
    };
  }

  /* Die weiteste belegte Stufe zählt. */
  const beste = treffer.reduce((a, b) => (stufenrang(b.stufe) > stufenrang(a.stufe) ? b : a));
  const belege = treffer.flatMap((t) => t.belegtDurch);

  if (stufenrang(beste.stufe) >= stufenrang(verlangteStufe)) {
    return { stand: "erfuellt", schluessel, belege, satz: `Belegt auf der Stufe „${beste.stufe}".` };
  }
  return {
    stand: "teilweise",
    schluessel,
    belege,
    satz: `Belegt auf der Stufe „${beste.stufe}", verlangt ist „${verlangteStufe}".`,
  };
}

/**
 * Was aus einem Beleg werden darf.
 *
 * ── Warum das eine Funktion ist und keine Modellaufgabe ─────────
 *
 * Ein Modell darf vorschlagen, welche Fähigkeit in einem Satz steckt.
 * Es darf nicht entscheiden, wie weit sie trägt — das hängt allein an
 * der Belegart, und eine Zahl aus einem Modell an dieser Stelle wäre
 * genau der Wert über einen Menschen, den es hier nicht geben soll.
 */
export function ausBeleg(
  beleg: Beleg,
  schluessel: string,
  vorgeschlageneStufe: Koennensstufe,
): Faehigkeitsaussage | null {
  if (!beleg.bestaetigt) return null;
  if (istBedingung(beleg.aussage) || istAnforderungsLeerformel(beleg.aussage)) return null;

  const grenze = stufeGrenze(beleg.herkunft);
  const stufe =
    stufenrang(vorgeschlageneStufe) > stufenrang(grenze) ? grenze : vorgeschlageneStufe;

  return {
    schluessel,
    stufe,
    belegtDurch: [beleg.id],
    herkunft: beleg.herkunft,
  };
}

/**
 * Wie viel von den Muss-Anforderungen einer Stelle belegt ist.
 *
 * Gezählt wird nur, was abgleichbar war. Bedingungen und Leerformeln
 * gehen weder in den Zähler noch in den Nenner — sonst sähe eine
 * Anzeige, die zehnmal „Bereitschaft zur Schichtarbeit" schreibt, aus
 * wie eine, für die man nichts kann.
 */
export function deckung(ergebnisse: readonly Abgleichergebnis[]): {
  erfuellt: number;
  teilweise: number;
  offen: number;
  gerechnet: number;
} {
  const zaehlbar = ergebnisse.filter((e) => e.stand !== "nicht_zustaendig");
  return {
    erfuellt: zaehlbar.filter((e) => e.stand === "erfuellt").length,
    teilweise: zaehlbar.filter((e) => e.stand === "teilweise").length,
    offen: zaehlbar.filter((e) => e.stand === "nicht_belegt").length,
    gerechnet: zaehlbar.length,
  };
}

/**
 * Welche Stufe eine Anzeige verlangt, wenn sie keine nennt.
 *
 * ── Warum „sicher" und nicht „grundkenntnisse" ──────────────────
 *
 * Deutsche Anzeigen nennen fast nie eine Stufe. Nähme man die
 * unterste an, wäre jede Anforderung durch jeden Beleg erfüllt, und
 * `teilweise` käme nie vor — der Abgleich hätte dann nur zwei
 * Zustände und würde genau die Fälle verschlucken, um die es geht.
 *
 * Nähme man die oberste, stünde bei fast jedem Menschen „teilweise",
 * auch bei einer Arbeitsprobe.
 *
 * „Sicher" ist die Stufe, die eine Anzeige meint, wenn sie „Erfahrung
 * in X" schreibt. Sie ist eine Annahme, und sie steht deshalb hier an
 * einer Stelle statt verteilt im Code.
 */
export const VERLANGTE_STUFE_STANDARD: Koennensstufe = "sicher";

/**
 * Aus der gespeicherten Zahl wieder eine Stufe.
 *
 * `profile_skills.self_assessed_level` hält 1 bis 4 — die Umkehrung
 * von `stufenrang(s) + 1`. Ohne diese Funktion stand im Profilkontext
 * `String(level)`, also „2" statt „sicher", und ein Abgleich gegen
 * eine Stufe verglich eine Ziffer mit einem Wort. Es fiel nicht auf,
 * weil die Stufe dort nie gelesen wurde.
 *
 * Ausserhalb von 1 bis 4 die unterste: Eine unbekannte Zahl darf
 * niemanden hochstufen.
 */
export function stufeAusZahl(n: number | null): Koennensstufe {
  const i = Math.trunc(n ?? 1) - 1;
  return KOENNENSSTUFEN[i] ?? KOENNENSSTUFEN[0]!;
}
