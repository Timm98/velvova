import { cookies, headers } from "next/headers";
import {
  accepteSprachen,
  getTranslator,
  isLocale,
  spracheAufloesen,
  SPRACHEN_MIT_TEXTEN,
  type Locale,
  type Translator,
} from "@paycheck/i18n";
import { brand, flags, integrationStatus, loadRuntimeConfig } from "@paycheck/config";

/**
 * Sprache und Laufzeitzustand für eine Serverkomponente an einer Stelle.
 * Jede Seite ruft das auf, statt sich Konfiguration einzeln zusammenzusuchen.
 */

/** Der Name des Cookies, in dem eine getroffene Sprachwahl steht. */
export const SPRACH_COOKIE = "paycheck_locale";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Sprache einer Anfrage
 * ══════════════════════════════════════════════════════════════════
 *
 * Hier standen zwei Zeilen: Cookie lesen, sonst Deutsch. Damit bekam
 * jeder Deutsch — auch wer aus Lissabon kam, auch wer einen englischen
 * Browser hatte.
 *
 * Jetzt fragt diese Funktion drei Dinge ab und übergibt sie an
 * `spracheAufloesen`, das die Rangfolge kennt und nichts von Cookies
 * oder Kopfzeilen weiss. Die Aufteilung ist der Punkt: Das Lesen
 * gehört zum Server, die Entscheidung gehört an eine Stelle, die man
 * ohne Server prüfen kann.
 *
 * ── Warum alles serverseitig ────────────────────────────────────
 *
 * Damit es nicht flackert. Würde die Sprache erst im Browser bestimmt,
 * käme die Seite auf Englisch an und spränge eine Sekunde später auf
 * Deutsch. Cookie, `Accept-Language` und der Ländercode des CDN liegen
 * alle schon vor dem ersten Zeichnen vor — es gibt keinen Grund, damit
 * zu warten.
 *
 * ── Warum das Konto hier nicht abgefragt wird ───────────────────
 *
 * Weil `getPageContext()` auf jeder Seite läuft und ein Datenbankzugriff
 * je Seitenaufruf teuer ist. Die Kontosprache steht stattdessen im
 * Cookie: Sie wird beim Anmelden und beim Ändern dorthin geschrieben.
 * Beide Wege führen zum selben Ergebnis, nur ohne Abfrage.
 *
 * Der Preis, ehrlich benannt: Ändert jemand die Sprache auf einem
 * anderen Gerät, folgt dieses hier erst beim nächsten Anmelden. Das
 * ist der richtige Tausch — die Alternative wäre eine Datenbankabfrage
 * auf jeder öffentlichen Seite, auch für Besucher ohne Konto.
 */
export async function getLocale(): Promise<Locale> {
  const [store, kopf] = await Promise.all([cookies(), kopfzeilen()]);

  const gewaehlt = spracheAufloesen(
    {
      cookie: store.get(SPRACH_COOKIE)?.value,
      browsersprachen: accepteSprachen(kopf?.get("accept-language")),
      land: landAusKopfzeilen(kopf),
    },
    SPRACHEN_MIT_TEXTEN,
  );

  /*
   * Die Prüfung bleibt stehen, obwohl `spracheAufloesen` nur Sprachen
   * aus `SPRACHEN_MIT_TEXTEN` zurückgibt. Sie kostet nichts und ist
   * die Grenze zwischen einer Zeichenkette und dem Typ `Locale` —
   * ohne sie wäre die Zusicherung nur ein Kommentar.
   */
  return isLocale(gewaehlt) ? gewaehlt : "en";
}

/**
 * Kopfzeilen holen, ohne bei einem Hintergrundlauf zu stürzen.
 *
 * `headers()` wirft ausserhalb einer Anfrage — im Skript, im Test, im
 * getakteten Lauf. Dort gibt es niemanden, dessen Sprache gemeint sein
 * könnte, und `null` ist die richtige Antwort.
 */
async function kopfzeilen(): Promise<Headers | null> {
  try {
    return await headers();
  } catch {
    return null;
  }
}

/**
 * Der Ländercode aus dem, was das CDN mitschickt.
 *
 * Dieselben Kopfzeilen wie in `lib/herkunft.ts`, und derselbe Grund:
 * Für die Sprachwahl genügt „DE". Die vollständige IP wird dafür
 * weder gebraucht noch gespeichert — sie kommt hier gar nicht erst an.
 */
const NETZ_HEADER = [
  "x-vercel-ip-country",
  "cf-ipcountry",
  "x-country-code",
  "fastly-client-country",
  "x-appengine-country",
];

function landAusKopfzeilen(kopf: Headers | null): string | null {
  if (!kopf) return null;
  for (const name of NETZ_HEADER) {
    const wert = kopf.get(name)?.trim().toUpperCase();
    /* `XX` steht bei Cloudflare für „unbekannt", `T1` für Tor. Beides
       ist eine Auskunft über die Verbindung, nicht über den Menschen. */
    if (wert && /^[A-Z]{2}$/.test(wert) && wert !== "XX" && wert !== "T1") return wert;
  }
  return null;
}

export interface PageContext {
  locale: Locale;
  t: Translator["t"];
  brand: typeof brand;
  flags: typeof flags;
  /** Ehrlicher Zustand der Anbindungen. Grundlage für "nicht verbunden". */
  integrations: ReturnType<typeof integrationStatus>;
  isDemoMode: boolean;
}

export async function getPageContext(): Promise<PageContext> {
  const locale = await getLocale();
  const cfg = loadRuntimeConfig();
  const { t } = getTranslator(locale);

  return {
    locale,
    t,
    brand,
    flags,
    integrations: integrationStatus(cfg),
    isDemoMode: cfg.mode === "demo",
  };
}
