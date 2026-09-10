import { z } from "zod";

/**
 * Woher eine Stelle wirklich kommt — und wie der Link deshalb heissen darf.
 *
 * ── Warum das eine eigene Achse ist ────────────────────────────
 *
 * `JobSource.kind` beschreibt, wie wir an die Daten kommen (lizenzierte
 * API, Arbeitgeber-Feed, Partner). Das ist eine Frage des Vertrags. Für
 * die Person, die den Link drückt, zählt aber etwas anderes: lande ich
 * beim Arbeitgeber oder bei einem weiteren Vermittler?
 *
 * Die beiden Fragen fielen bisher zusammen, und deshalb stand über einem
 * Link zu einem Aggregator „Original ansehen". Wer „Original" liest,
 * erwartet die Quelle — und landet auf einer Seite, die die Anzeige
 * ihrerseits von woanders hat. Das ist kein Wortproblem: genau dort
 * will jemand die Angaben nachprüfen, die wir ihm gezeigt haben.
 *
 * ── Die Rangfolge ─────────────────────────────────────────────
 *
 * Je weiter oben, desto näher am Arbeitgeber. Kennen wir zu einer
 * Stelle mehrere Quellen, gewinnt die oberste — nicht die, die wir
 * zuerst gesehen haben.
 */
export const HerkunftSchema = z.enum([
  /** Die Karriereseite des Arbeitgebers selbst. */
  "employer_direct",
  /** Das Bewerbersystem des Arbeitgebers (Greenhouse, Lever, …). Faktisch seine Anzeige. */
  "ats",
  /** Ein Anbieter, mit dem ein Vertrag besteht und der die Anzeige weitergeben darf. */
  "licensed_partner",
  /** Eine Sammelstelle. Hat die Anzeige selbst von woanders. */
  "aggregator",
  /** Eine Programmierschnittstelle ohne eigene Aussage zur Herkunft. */
  "external_api",
  /** Von der Person selbst eingefügt. */
  "user_import",
]);
export type Herkunft = z.infer<typeof HerkunftSchema>;

/** Kleiner heisst näher am Arbeitgeber. */
const RANG: Record<Herkunft, number> = {
  employer_direct: 0,
  ats: 1,
  licensed_partner: 2,
  aggregator: 4,
  external_api: 3,
  user_import: 5,
};

/** Die beste bekannte Herkunft gewinnt. */
export function besteHerkunft(alle: Herkunft[]): Herkunft | null {
  if (alle.length === 0) return null;
  return [...alle].sort((a, b) => RANG[a] - RANG[b])[0]!;
}

/** Führt dieser Link zum Arbeitgeber selbst? */
export function istArbeitgeberquelle(h: Herkunft): boolean {
  return h === "employer_direct" || h === "ats";
}

/**
 * Die Beschriftung des Links.
 *
 * Sie verspricht nie mehr, als die Herkunft hergibt. Beim Aggregator
 * steht sein Name da — „Weiter zu Arbeitnow" —, damit niemand
 * überrascht ist, wo er landet.
 */
/**
 * Der Name der Seite, auf der man tatsächlich landet.
 *
 * Ein Anbieter reicht Links weiter, die anderswohin führen: TheirStack
 * liefert Anzeigen mit einer LinkedIn-Adresse, JSearch mit der Adresse
 * des Portals, das die Anzeige veröffentlicht hat. Über einem solchen
 * Link „Weiter zu TheirStack" zu schreiben, wäre dieselbe Falschaussage
 * wie „Original ansehen" — nur eine Ebene tiefer.
 *
 * Bekannte Hosts bekommen ihren üblichen Namen, alles andere die nackte
 * Domain. Sie ist unschön und stimmt.
 */
const HOSTNAMEN: Record<string, string> = {
  "linkedin.com": "LinkedIn",
  "indeed.com": "Indeed",
  "de.indeed.com": "Indeed",
  "stepstone.de": "StepStone",
  "xing.com": "XING",
  "glassdoor.com": "Glassdoor",
  "monster.de": "Monster",
  "arbeitnow.com": "Arbeitnow",
  "adzuna.de": "Adzuna",
  "jooble.org": "Jooble",
  "boards.greenhouse.io": "Greenhouse",
  "jobs.lever.co": "Lever",
  "jobs.ashbyhq.com": "Ashby",
  "careers.smartrecruiters.com": "SmartRecruiters",
};

/**
 * Der Hostname aus einer Adresse — ohne `URL`.
 *
 * Dieses Paket beschreibt Formen und Regeln und hängt bewusst an keiner
 * Laufzeitumgebung: keine DOM-Typen, keine Node-Typen. `URL` ist zwar
 * in beiden vorhanden, aber nicht in der Typbibliothek dieses Pakets —
 * und die dafür zu erweitern hiesse, wegen einer Zeile eine
 * Abhängigkeit einzuführen, die alles andere hier nicht braucht.
 *
 * Hostnamen aus einer Adresse zu lesen ist der eine Teil des Parsens,
 * der wirklich einfach ist: nach dem Schema, vor dem ersten Schrägstrich,
 * ohne Anmeldedaten und ohne Port.
 */
function hostAus(url: string): string | null {
  const ohneSchema = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const bisPfad = ohneSchema.split(/[/?#]/)[0] ?? "";
  const ohneAnmeldung = bisPfad.includes("@") ? bisPfad.slice(bisPfad.lastIndexOf("@") + 1) : bisPfad;
  const ohnePort = ohneAnmeldung.replace(/:\d+$/, "");
  const host = ohnePort.toLowerCase().replace(/^www\./, "");
  // Ohne Punkt ist es kein Hostname, sondern Text.
  return host.includes(".") ? host : null;
}

export function zielName(url: string | null | undefined): string | null {
  if (!url) return null;
  const host = hostAus(url);
  if (!host) return null;
  if (HOSTNAMEN[host]) return HOSTNAMEN[host]!;
  // Auch Unterdomains erkennen: `de.linkedin.com` ist LinkedIn.
  for (const [h, name] of Object.entries(HOSTNAMEN)) {
    if (host.endsWith(`.${h}`) || host === h) return name;
  }
  return host;
}

export function linkText(h: Herkunft, quellenName: string | null): string {
  switch (h) {
    case "employer_direct":
      return "Zur Arbeitgeberseite";
    case "ats":
      return "Zur Bewerbungsseite des Arbeitgebers";
    case "licensed_partner":
    case "aggregator":
    case "external_api":
      return quellenName ? `Weiter zu ${quellenName}` : "Zur Quelle";
    case "user_import":
      return "Zur eingefügten Anzeige";
  }
}

/**
 * Die Beschriftung, wenn wir wissen, wohin der Link wirklich führt.
 *
 * Vorrang hat das tatsächliche Ziel. Wer auf „Weiter zu TheirStack"
 * drückt und auf LinkedIn landet, hat unsere Angabe einmal überprüft
 * und für falsch befunden — und wird der nächsten weniger glauben.
 */
export function linkTextMitZiel(
  h: Herkunft,
  quellenName: string | null,
  url: string | null | undefined,
): string {
  if (istArbeitgeberquelle(h)) return linkText(h, quellenName);
  const ziel = zielName(url);
  if (ziel && ziel !== quellenName) return `Weiter zu ${ziel}`;
  return linkText(h, quellenName);
}

/** Ein Satz für die Anzeige daneben. Sagt, was der Link ist und was nicht. */
export function herkunftText(h: Herkunft, quellenName: string | null): string {
  const q = quellenName ?? "der Quelle";
  switch (h) {
    case "employer_direct":
      return `Diese Anzeige steht auf der Karriereseite des Arbeitgebers.`;
    case "ats":
      return `Diese Anzeige kommt aus dem Bewerbersystem des Arbeitgebers.`;
    case "licensed_partner":
      return `Diese Anzeige haben wir über ${q} lizenziert. Der Arbeitgeber hat sie dort eingestellt.`;
    case "aggregator":
      return `Diese Anzeige haben wir über ${q} gefunden. ${q} sammelt Anzeigen und ist nicht der Arbeitgeber — wo sie ursprünglich stand, wissen wir nicht.`;
    case "external_api":
      return `Diese Anzeige kam über die Schnittstelle von ${q}. Ob der Arbeitgeber sie dort selbst eingestellt hat, geht daraus nicht hervor.`;
    case "user_import":
      return `Diese Anzeige hast du selbst eingefügt.`;
  }
}

/**
 * Aus der Vertragsart die Herkunft ableiten.
 *
 * Für die Quellen, die es vor dieser Unterscheidung schon gab. Bewusst
 * vorsichtig: was nicht nachweislich vom Arbeitgeber kommt, gilt als
 * Aggregator. Die andere Richtung — im Zweifel „direkt vom
 * Arbeitgeber" — wäre genau die Behauptung, die hier abgeschafft wird.
 */
export function herkunftAusArt(
  kind: "licensed_api" | "employer_feed" | "partner" | "user_url" | "user_text" | "seed",
): Herkunft {
  switch (kind) {
    case "employer_feed":
      return "ats";
    case "partner":
      return "licensed_partner";
    case "user_url":
    case "user_text":
      return "user_import";
    case "licensed_api":
    case "seed":
      return "aggregator";
  }
}

/* ══════════════════════════════════════════════════════════════════
   Welcher Link die Bewerbung trägt
   ══════════════════════════════════════════════════════════════════

   Dieselbe Stelle steht auf mehreren Portalen. `job_source_links` hält
   jede Fundstelle, aber angeklickt wird genau eine — und `rank`
   entscheidet welche: die niedrigste Zahl gewinnt.

   ── Warum das überhaupt eine Entscheidung ist ────────────────────

   Weil sie sonst zufällig fällt. Bis hierher stand jede der 3,68 Mio.
   Verknüpfungen auf dem Standardwert 100, und die Oberfläche zeigte
   `jobs.original_url` — also die Adresse der Quelle, die zuerst
   importiert hat. Bei 221.863 zusammengeführten Stellen entschied
   damit die Reihenfolge des Abrufs, wohin ein Mensch geschickt wird.

   ── Woher die Reihenfolge kommt ──────────────────────────────────

   Nicht von hier. Sie steht seit jeher an `HerkunftSchema`, als Satz:
   „Je weiter oben, desto näher am Arbeitgeber. Kennen wir zu einer
   Stelle mehrere Quellen, gewinnt die oberste — nicht die, die wir
   zuerst gesehen haben."

   Genau das ist nie passiert, weil niemand den Satz in eine Zahl
   übersetzt hat. Die Übersetzung steht unten und liest die Reihenfolge
   direkt aus dem Enum.

   ── Die Grenze, die diese Reihenfolge nicht überschreiten darf ───

   Der Partnerrang steht hinter Arbeitgeberseite und ATS, und das ist
   die eigentliche Aussage: Zwischen zwei Portalen ist es für den
   Menschen gleich, wo er klickt — dort darf eine vertragliche
   Beziehung entscheiden. Zwischen Portal und Arbeitgeberseite ist es
   NICHT gleich, und dort darf sie es nicht.

   Wer diese Reihenfolge ändert, ändert, wohin Menschen geschickt
   werden. Deshalb ist sie eine Aussage der Domäne und keine des
   Importers. */

/**
 * Die Rangwerte je Herkunft. Niedriger heisst: trägt die Bewerbung.
 *
 * Abgeleitet aus der Reihenfolge von `HerkunftSchema` und nicht daneben
 * geschrieben. Dort steht die Rangfolge bereits als Satz — „je weiter
 * oben, desto näher am Arbeitgeber" — und eine zweite, handgepflegte
 * Tabelle wäre genau die Art von Duplikat, das irgendwann auseinander
 * läuft: Jemand schiebt eine Herkunft im Enum nach oben, die Zahlen
 * bleiben, und ab da widerspricht der Code seiner eigenen Erklärung.
 *
 * Schrittweite zehn, damit sich eine neue Herkunft dazwischenschieben
 * lässt, ohne bestehende Zeilen neu zu schreiben.
 */
export const LINKRANG: Record<Herkunft, number> = Object.fromEntries(
  HerkunftSchema.options.map((h, i) => [h, (i + 1) * 10]),
) as Record<Herkunft, number>;

/**
 * Der Rang einer Fundstelle, aus der Art ihrer Quelle.
 *
 * `100` bleibt der Wert für alles, was diese Funktion nicht kennt —
 * derselbe Standardwert wie in der Spalte. Eine unbekannte Art bekommt
 * damit den letzten Platz und nicht den ersten: Sie verdrängt nichts,
 * was begründet vorn steht.
 */
export function linkrangFuerArt(
  kind: "licensed_api" | "employer_feed" | "partner" | "user_url" | "user_text" | "seed",
): number {
  return LINKRANG[herkunftAusArt(kind)] ?? 100;
}
