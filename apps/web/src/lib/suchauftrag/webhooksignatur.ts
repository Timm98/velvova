import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Die Signatur eines Zustellereignisses prüfen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein unsignierter Webhook nicht in Frage kommt
 * ══════════════════════════════════════════════════════════════
 *
 * Die Adresse eines Webhooks ist öffentlich — sie steht in der
 * Konfiguration des Anbieters, in Protokollen, manchmal in einer
 * Fehlermeldung. Wer sie kennt, könnte sonst schicken, was er will:
 *
 *   ein gefälschtes `bounced` sperrt eine fremde Adresse
 *   ein gefälschtes `delivered` verdeckt einen echten Fehler
 *
 * Beides ist still. Niemand merkt es, bis jemand fragt, warum er
 * nichts mehr bekommt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Zeitstempel mitgeprüft wird
 * ══════════════════════════════════════════════════════════════
 *
 * Eine gültige Signatur bleibt gültig. Ohne Zeitfenster liesse sich
 * ein einmal mitgeschnittenes Ereignis beliebig oft wiedereinspielen.
 * Die Entdoppelung über die Ereigniskennung fängt das zwar auch ab —
 * aber sie ist die zweite Linie, nicht die erste.
 */

/** Wie alt ein Ereignis höchstens sein darf. */
export const TOLERANZ_SEKUNDEN = 300;

export type Signaturbefund =
  | { ok: true }
  | { ok: false; grund: "kein_geheimnis" | "kopfzeilen_fehlen" | "zu_alt" | "falsch" };

/**
 * Prüft nach dem Verfahren, das Resend und andere über Svix
 * verwenden: signiert wird `id.zeitstempel.rumpf`, das Geheimnis ist
 * Base64 hinter dem Präfix `whsec_`.
 */
export function signaturPruefen(
  rumpf: string,
  kopfzeilen: { id: string | null; zeitstempel: string | null; signatur: string | null },
  geheimnis: string | undefined,
  jetzt = new Date(),
): Signaturbefund {
  if (!geheimnis) return { ok: false, grund: "kein_geheimnis" };
  const { id, zeitstempel, signatur } = kopfzeilen;
  if (!id || !zeitstempel || !signatur) return { ok: false, grund: "kopfzeilen_fehlen" };

  const sekunden = Number(zeitstempel);
  if (!Number.isFinite(sekunden)) return { ok: false, grund: "kopfzeilen_fehlen" };
  const abstand = Math.abs(jetzt.getTime() / 1000 - sekunden);
  if (abstand > TOLERANZ_SEKUNDEN) return { ok: false, grund: "zu_alt" };

  const roh = geheimnis.startsWith("whsec_") ? geheimnis.slice(6) : geheimnis;
  let schluessel: Buffer;
  try {
    schluessel = Buffer.from(roh, "base64");
  } catch {
    return { ok: false, grund: "kein_geheimnis" };
  }
  if (schluessel.length === 0) return { ok: false, grund: "kein_geheimnis" };

  const erwartet = createHmac("sha256", schluessel)
    .update(`${id}.${zeitstempel}.${rumpf}`)
    .digest("base64");

  /*
   * Die Kopfzeile trägt mehrere Signaturen, je „v1,<sig>".
   *
   * Der Anbieter schickt bei einem Schlüsselwechsel eine Weile beide.
   * Wer nur die erste prüft, verwirft in dieser Zeit gültige
   * Ereignisse — und merkt es an nichts, weil Webhooks stumm sind.
   */
  const kandidaten = signatur
    .split(" ")
    .map((teil) => teil.trim())
    .filter((teil) => teil.startsWith("v1,"))
    .map((teil) => teil.slice(3));

  const passt = kandidaten.some((k) => gleichLang(k, erwartet));
  return passt ? { ok: true } : { ok: false, grund: "falsch" };
}

/**
 * Vergleich in konstanter Zeit.
 *
 * Ein gewöhnlicher Vergleich bricht beim ersten abweichenden Zeichen
 * ab. Über viele Versuche lässt sich daraus die richtige Signatur
 * ablesen — langsam, aber zuverlässig.
 */
function gleichLang(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}
