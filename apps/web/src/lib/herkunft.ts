import { cookies, headers } from "next/headers";

/**
 * Woher jemand kommt — soweit es das Netz ohnehin schon weiss.
 *
 * ── Ja, das geht. Und zwar ohne Abfrage ───────────────────────
 *
 * Nicht über die Browser-Standortabfrage: Die braucht eine
 * ausdrückliche Erlaubnis, öffnet einen Dialog und liefert Koordinaten
 * auf zehn Meter genau. Für „welches Land?" ist das
 * unverhältnismässig — und der Dialog auf einer Landingpage kostet mehr
 * Besucher, als die Anpassung bringt.
 *
 * Stattdessen der Ländercode, den das CDN ohnehin berechnet und als
 * Kopfzeile mitschickt. Er kommt vor unserem Code an, kostet nichts,
 * braucht kein JavaScript und keinen Dialog.
 *
 * ── Was hier NICHT passiert ───────────────────────────────────
 *
 * Die IP-Adresse wird nicht gelesen, nicht gespeichert und nicht
 * protokolliert. Was ankommt, ist ein zweibuchstabiger Ländercode, und
 * er wird für genau eine Sache benutzt: welche Sätze auf der Seite
 * stehen. Nichts davon verlässt die Anfrage.
 *
 * Keine Stadt, keine Region, keine Koordinaten — obwohl manche Anbieter
 * sie mitschicken. Ein Land beantwortet die Frage, die dieses Produkt
 * hat („gibt es hier Stellen und ein Steuerregelwerk?"). Eine Stadt
 * beantwortet sie nicht besser und wäre erheblich aufdringlicher.
 *
 * ── Warum die Wahl der Person Vorrang hat ─────────────────────
 *
 * Ein Ländercode aus dem Netz ist eine Vermutung. Wer über ein
 * Firmen-VPN kommt, im Urlaub ist oder umziehen will, bekommt die
 * falsche. Deshalb steht die eigene Wahl an erster Stelle, und die
 * Seite zeigt sichtbar, worauf sie sich stützt — eine unsichtbare
 * Anpassung ist schlimmer als gar keine: Man kann sie nicht korrigieren.
 */

export type Herkunftsquelle = "gewaehlt" | "netz" | "sprache" | "unbekannt";

export interface Herkunft {
  /** ISO-3166-1 alpha-2, gross. `null`, wenn nichts bekannt ist. */
  code: string | null;
  quelle: Herkunftsquelle;
}

/** Der Name des Cookies, in dem eine getroffene Wahl steht. */
export const LAND_COOKIE = "pc_land";

/*
 * Die Kopfzeilen der üblichen Anbieter.
 *
 * Bewusst mehrere: Der Hoster kann wechseln, und ein Umzug soll keine
 * stille Verschlechterung sein. Wo keine davon ankommt — im lokalen
 * Betrieb etwa —, greift die Sprache und danach der Standard.
 */
const NETZ_HEADER = [
  "x-vercel-ip-country", // Vercel
  "cf-ipcountry", // Cloudflare
  "x-country-code", // Fly, Netlify
  "fastly-client-country", // Fastly
  "x-appengine-country", // Google
];

function gueltig(wert: string | null | undefined): string | null {
  if (!wert) return null;
  const c = wert.trim().toUpperCase();
  /*
   * Genau zwei Buchstaben — und `XX` zählt nicht.
   *
   * Cloudflare schickt `XX` für Anfragen, denen es kein Land zuordnen
   * kann, und `T1` für Tor. Beides ist eine Auskunft über die
   * Verbindung, nicht über den Menschen — und beides würde als
   * Ländercode durch jede naive Prüfung rutschen.
   */
  if (!/^[A-Z]{2}$/.test(c)) return null;
  if (c === "XX" || c === "T1") return null;
  return c;
}

/**
 * Das Land des Besuchers, in dieser Reihenfolge:
 *
 *   1. was die Person selbst gewählt hat
 *   2. was das CDN als Ländercode mitschickt
 *   3. die Region aus der Sprachpräferenz (`de-AT` → `AT`)
 *   4. nichts
 */
export async function besucherHerkunft(): Promise<Herkunft> {
  const [c, h] = await Promise.all([cookies(), headers()]);

  const gewaehlt = gueltig(c.get(LAND_COOKIE)?.value);
  if (gewaehlt) return { code: gewaehlt, quelle: "gewaehlt" };

  for (const name of NETZ_HEADER) {
    const aus = gueltig(h.get(name));
    if (aus) return { code: aus, quelle: "netz" };
  }

  /*
   * Die Sprache ist der schwächste Hinweis und steht deshalb zuletzt.
   *
   * `de-CH` sagt etwas über die Spracheinstellung eines Geräts, nicht
   * darüber, wo es steht. Sie ist trotzdem besser als nichts: Wer sein
   * System auf Schweizerdeutsch gestellt hat, sitzt selten in Portugal.
   */
  const sprachen = h.get("accept-language") ?? "";
  for (const teil of sprachen.split(",")) {
    const tag = teil.split(";")[0]?.trim() ?? "";
    const region = tag.split("-")[1];
    const aus = gueltig(region);
    if (aus) return { code: aus, quelle: "sprache" };
  }

  return { code: null, quelle: "unbekannt" };
}

/* ═══════════════════════════════════════════════════════════════
   Die Sprache
   ═══════════════════════════════════════════════════════════════ */

/**
 * Länder, in denen dieses Produkt deutsch spricht.
 *
 * ── Warum eine Liste und keine Ableitung ──────────────────────
 *
 * Weil „deutschsprachig" keine Eigenschaft eines Ländercodes ist.
 * Belgien hat eine deutschsprachige Gemeinschaft und spricht hier
 * trotzdem englisch, weil die Sätze, die wir schreiben, sich an
 * Menschen mit deutschem Arbeitsmarkt richten.
 */
const DEUTSCHSPRACHIG = new Set(["DE", "AT", "CH", "LI"]);

/**
 * Welche Sprache jemand vermutlich lesen will.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Reihenfolge — und was sie NICHT tut
 * ══════════════════════════════════════════════════════════════
 *
 * Zuerst die Sprache, die der Browser nennt. Sie ist die
 * ausdrücklichste Angabe, die eine Anfrage mitbringt: Jemand hat sie
 * einmal in seinem Gerät eingestellt.
 *
 * Danach das Land. Wer aus Wien kommt und nichts sagt, bekommt
 * deutsch.
 *
 * Diese Funktion überschreibt NICHTS. Sie wird nur dort gefragt, wo
 * bisher „de" als Vorgabe stand — bei einem Konto ohne eigene
 * Einstellung. Wer eine gewählt hat, behält sie, auch im Urlaub.
 */
export async function besucherSprache(): Promise<{
  sprache: "de" | "en";
  quelle: Herkunftsquelle;
}> {
  let h: Headers;
  try {
    h = await headers();
  } catch {
    /*
     * Ausserhalb einer Anfrage — Hintergrundlauf, Skript, Test.
     * Dann gibt es niemanden, dessen Sprache gemeint sein könnte.
     */
    return { sprache: "de", quelle: "unbekannt" };
  }

  const sprachen = h.get("accept-language") ?? "";
  for (const teil of sprachen.split(",")) {
    const tag = teil.split(";")[0]?.trim().toLowerCase() ?? "";
    if (tag.startsWith("de")) return { sprache: "de", quelle: "sprache" };
    if (tag.startsWith("en")) return { sprache: "en", quelle: "sprache" };
  }

  const herkunft = await besucherHerkunft();
  if (herkunft.code) {
    return {
      sprache: DEUTSCHSPRACHIG.has(herkunft.code) ? "de" : "en",
      quelle: herkunft.quelle,
    };
  }

  /*
   * Nichts bekannt heisst deutsch.
   *
   * Nicht, weil deutsch neutraler wäre, sondern weil der Bestand es
   * ist: 1,05 Mio. von 2,6 Mio. Anzeigen stehen in Deutschland, und
   * die Sätze dieses Produkts sind für diesen Arbeitsmarkt
   * geschrieben.
   */
  return { sprache: "de", quelle: "unbekannt" };
}

