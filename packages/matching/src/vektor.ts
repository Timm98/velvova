/**
 * Vektorähnlichkeit — der Rechenteil der semantischen Suche.
 *
 * ══════════════════════════════════════════════════════════════
 * Was semantische Ähnlichkeit hier ist und was nicht
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Werkzeug für den Fund, nicht für das Urteil.
 *
 * Sie darf eine Stelle in die Auswahl bringen, die über Titel und
 * Stichwort nie aufgetaucht wäre — „Kommissionierer" für jemanden,
 * der „Lagerhelfer" gesagt hat. Sie darf danach nichts mehr: keine
 * Muss-Bedingung erfüllen, keine ersetzen, keinen Fit erhöhen.
 *
 * Der Grund ist nüchtern. Ähnlichkeit misst, wie ähnlich zwei Texte
 * klingen. Ob jemand 45.000 verdient, ob er dreissig Kilometer fahren
 * muss, ob er den Staplerschein hat — davon weiss ein Vektor nichts,
 * und er sagt trotzdem eine Zahl.
 */

/**
 * Kosinusähnlichkeit zweier Vektoren, zwischen -1 und 1.
 *
 * `null` bei ungleicher Länge oder einem Nullvektor: Zwei Vektoren
 * verschiedener Modelle sind nicht vergleichbar, und ein Nullvektor
 * hat keine Richtung. In beiden Fällen wäre jede Zahl erfunden.
 */
export function kosinus(a: readonly number[], b: readonly number[]): number | null {
  if (a.length === 0 || a.length !== b.length) return null;
  let punkt = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    punkt += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return null;
  return punkt / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Ab welcher Ähnlichkeit eine Stelle in die Auswahl kommt.
 *
 * ══════════════════════════════════════════════════════════════
 * Woher diese Zahl kommt
 * ══════════════════════════════════════════════════════════════
 *
 * Die erste Fassung stand bei 0.62 und liess nur durch, was die
 * Stichwortsuche ohnehin schon hatte — ein Recall-Schritt, der nichts
 * Neues findet, ist keiner. Daraufhin 0.50, gemessen an 200 Anzeigen
 * mit `text-embedding-3-small`.
 *
 * Nachgemessen am 6. September 2026 an allen 1209 analysierten
 * Stellen, nach dem Wechsel auf `text-embedding-3-large`, gegen
 * dasselbe Lagerprofil:
 *
 *   0.728  Fachkraft für Lagerlogistik
 *   0.702  Staplerfahrer
 *   0.613  Lagerhelfer
 *   0.594  Transportmitarbeiter
 *   0.578  Teamleiter im Logistikzentrum
 *   0.555  Staplerfahrer:in
 *   0.520  Versandmitarbeiter
 *   0.508  Verkäufer Teilzeit
 *   0.501  Produktionshelfer DruckService
 *   0.471  Operativer Leiter Logistik-Dienstleistungen
 *
 * 0.50 lässt 58 von 1209 durch.
 *
 * ══════════════════════════════════════════════════════════════
 * Was der Modellwechsel verbessert hat
 * ══════════════════════════════════════════════════════════════
 *
 * Bei `small` stand „Teamleiter im Logistikzentrum" mit 0.595 ÜBER
 * „Lagerhelfer" mit 0.546 — die Führungsrolle näher am Helferprofil
 * als die Helferstelle. Und „Chef de Partie", ein Küchenberuf, lag
 * mit 0.504 mitten in der Liste.
 *
 * Bei `large` liegt der Teamleiter unter dem Lagerhelfer, und der
 * Küchenberuf kommt gar nicht mehr vor. Die Reihenfolge stimmt jetzt
 * mit dem überein, was ein Mensch erwarten würde.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum 0.50 trotzdem bleibt
 * ══════════════════════════════════════════════════════════════
 *
 * Zwischen 0.50 und 0.55 stehen „Versandmitarbeiter" (0.520) und
 * „Lagerhilfskraft Obst und Gemüse" (0.545). Der erste ist der
 * eigentliche Ertrag dieses Schritts: Sein Titel enthält das Wort
 * „Lager" nicht, die Stichwortsuche findet ihn nie.
 *
 * Höher zu gehen würde vor allem das entfernen, wofür es die
 * semantische Suche gibt. Was an Rauschen mitkommt — „Verkäufer
 * Teilzeit", „Produktionshelfer" — fällt danach an den Kriterien
 * heraus. Dieser Schritt findet; er urteilt nicht.
 *
 * Der Wert ist eine Produktentscheidung und modellgebunden, nicht
 * gegen Nutzerurteile validiert. Ein Modellwechsel macht ihn
 * ungültig — deshalb wurde er hier neu gemessen und nicht
 * übernommen.
 */
export const AEHNLICHKEIT_SCHWELLE = 0.5;

export interface Vektortreffer<T> {
  eintrag: T;
  aehnlichkeit: number;
}

/**
 * Die ähnlichsten Einträge, absteigend.
 *
 * ── Warum die Sortierung bei Gleichstand festgelegt ist ───────
 *
 * Ohne sie hängt die Reihenfolge zweier gleich ähnlicher Stellen an
 * der Laune der Datenbank, und ein wiederholter Lauf erzeugt eine
 * andere Auswahl als der erste. Ein Test darauf wäre nicht
 * schreibbar, und „warum kam die gestern und heute nicht" wäre nicht
 * beantwortbar.
 */
export function aehnlichste<T>(
  anfrage: readonly number[],
  eintraege: readonly { schluessel: string; vektor: readonly number[]; wert: T }[],
  grenze: number,
  schwelle = AEHNLICHKEIT_SCHWELLE,
): Vektortreffer<T>[] {
  const treffer: (Vektortreffer<T> & { schluessel: string })[] = [];
  for (const e of eintraege) {
    const aehnlichkeit = kosinus(anfrage, e.vektor);
    if (aehnlichkeit === null || aehnlichkeit < schwelle) continue;
    treffer.push({ eintrag: e.wert, aehnlichkeit, schluessel: e.schluessel });
  }
  treffer.sort((a, b) => b.aehnlichkeit - a.aehnlichkeit || a.schluessel.localeCompare(b.schluessel));
  return treffer.slice(0, grenze).map(({ eintrag, aehnlichkeit }) => ({ eintrag, aehnlichkeit }));
}

/* ═══════════════════════════════════════════════════════════════
   Was eingebettet wird
   ═══════════════════════════════════════════════════════════════ */

/**
 * Der Text einer Stelle, aus dem ein Vektor entsteht.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nicht die ganze Anzeige
 * ══════════════════════════════════════════════════════════════
 *
 * Weil eine Stellenanzeige zur Hälfte aus Dingen besteht, die mit der
 * Arbeit nichts zu tun haben: Unternehmensgeschichte, Obstkorb,
 * Datenschutzhinweis, „Work hard, play hard". Wer das mit einbettet,
 * misst am Ende die Ähnlichkeit von Werbetexten.
 *
 * Zwei Anzeigen desselben Personaldienstleisters ähneln sich dann
 * stark — auch wenn die eine einen Lageristen und die andere einen
 * Pfleger sucht.
 */
export function jobEinbettungstext(job: {
  titel: string;
  aufgaben: readonly string[];
  anforderungen: readonly string[];
  berufseinordnung?: string | null;
}): string {
  const teile = [
    job.titel.trim(),
    ...job.aufgaben.slice(0, 12).map((a) => a.trim()),
    ...job.anforderungen.slice(0, 12).map((a) => a.trim()),
  ].filter((t) => t.length > 0);
  if (job.berufseinordnung) teile.push(`Berufseinordnung: ${job.berufseinordnung}`);
  return teile.join("\n").slice(0, 2000);
}

/**
 * Der Text einer Person, aus dem ein Vektor entsteht.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier ausdrücklich NICHT hineingeht
 * ══════════════════════════════════════════════════════════════
 *
 * Gesprächsverläufe, private Notizen, Angaben zu Gesundheit oder
 * Familie. Ein Einbettungsvektor geht an einen Anbieter, wird
 * gespeichert und lässt sich nicht zurücknehmen — und man sieht ihm
 * nicht an, was in ihm steckt.
 *
 * Drin sind: gewünschte Tätigkeiten, bestätigte Fähigkeiten,
 * Berufsfelder, weiche Tätigkeitspräferenzen. Also das, was die
 * Person über ihre Arbeit gesagt hat.
 */
export function profilEinbettungstext(profil: {
  taetigkeiten: readonly string[];
  berufsfelder: readonly string[];
  faehigkeiten: readonly string[];
  vorlieben: readonly string[];
}): string {
  const teile = [
    ...profil.taetigkeiten.slice(0, 8),
    ...profil.berufsfelder.slice(0, 6),
    ...profil.faehigkeiten.slice(0, 12),
    ...profil.vorlieben.slice(0, 8),
  ]
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return [...new Set(teile)].join("\n").slice(0, 2000);
}
