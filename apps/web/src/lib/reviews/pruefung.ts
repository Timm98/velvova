/**
 * Was eine Bewertung erfüllen muss, bevor sie in die Datenbank darf.
 *
 * Diese Datei läuft auf dem SERVER. Dieselben Regeln stehen zusätzlich
 * im Formular, damit jemand nicht erst nach dem Absenden erfährt, dass
 * sein Text zu kurz war — aber die Prüfung im Browser ist Höflichkeit,
 * diese hier ist die Prüfung. Wer das Formular umgeht, kommt hier an.
 *
 * Der Rest — Länge, Sternebereich, Zustimmung — steht zusätzlich als
 * `CHECK` in der Datenbank. Drei Ebenen für dieselbe Regel klingt nach
 * zu viel und ist es nicht: die unterste ist die einzige, die auch dann
 * noch gilt, wenn jemand mit einem SQL-Werkzeug danebengreift.
 */

export interface Eingabe {
  displayName?: unknown;
  roleOrCompany?: unknown;
  contactEmail?: unknown;
  rating?: unknown;
  headline?: unknown;
  body?: unknown;
  consentPublish?: unknown;
  consentPrivacy?: unknown;
  /** Das Honigtopf-Feld. Für Menschen unsichtbar, für Automaten verlockend. */
  website?: unknown;
}

export interface Fehler {
  feld: string;
  text: string;
}

export interface Geprueft {
  displayName: string;
  roleOrCompany: string | null;
  contactEmail: string | null;
  rating: number;
  headline: string | null;
  body: string;
  consentPublish: boolean;
  consentPrivacy: boolean;
}

export const MIN_TEXT = 30;
export const MAX_TEXT = 5000;

function alsText(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Steuerzeichen und unsichtbare Zeichen entfernen.
 *
 * Nicht gegen Cross-Site-Scripting — dagegen hilft React, das jeden
 * Text als Text ausgibt und niemals als Markup. Sondern gegen etwas
 * Schlichteres: Zeichen von rechts nach links, Nullbreiten-Leerzeichen
 * und Steuerzeichen lassen sich benutzen, um in einer Liste von
 * Bewertungen die Darstellung der anderen zu zerlegen.
 */
function saeubern(text: string): string {
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    // Nullbreiten- und Richtungssteuerzeichen: unsichtbar im Text,
    // sichtbar in der Wirkung — sie kippen die Leserichtung einer
    // ganzen Liste.
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function pruefeBewertung(eingabe: Eingabe): { ok: true; wert: Geprueft } | { ok: false; fehler: Fehler[] } {
  const fehler: Fehler[] = [];

  /*
   * Der Honigtopf zuerst.
   *
   * Ein Feld, das im Formular versteckt ist und das kein Mensch
   * ausfüllen kann. Ist es gefüllt, war es ein Automat — und dann wird
   * nicht diskutiert, sondern abgelehnt.
   *
   * Bewusst kein Captcha: das kostet jeden ehrlichen Menschen Zeit und
   * scheitert bei genau den Leuten am häufigsten, die ohnehin Mühe
   * haben. Ein Honigtopf kostet niemanden etwas.
   */
  if (alsText(eingabe.website).length > 0) {
    return { ok: false, fehler: [{ feld: "website", text: "Abgelehnt." }] };
  }

  const displayName = saeubern(alsText(eingabe.displayName));
  if (displayName.length < 2) {
    fehler.push({ feld: "displayName", text: "Bitte gib deinen Namen an." });
  } else if (displayName.length > 80) {
    fehler.push({ feld: "displayName", text: "Der Name ist zu lang (höchstens 80 Zeichen)." });
  }

  const rating = Number(eingabe.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    fehler.push({ feld: "rating", text: "Bitte wähle zwischen einem und fünf Sternen." });
  }

  const body = saeubern(alsText(eingabe.body));
  if (body.length < MIN_TEXT) {
    fehler.push({
      feld: "body",
      text: `Bitte schreib etwas mehr — mindestens ${MIN_TEXT} Zeichen (aktuell ${body.length}).`,
    });
  } else if (body.length > MAX_TEXT) {
    fehler.push({ feld: "body", text: `Der Text ist zu lang (höchstens ${MAX_TEXT} Zeichen).` });
  }

  const headline = saeubern(alsText(eingabe.headline));
  if (headline.length > 120) {
    fehler.push({ feld: "headline", text: "Die Überschrift ist zu lang (höchstens 120 Zeichen)." });
  }

  const roleOrCompany = saeubern(alsText(eingabe.roleOrCompany));
  if (roleOrCompany.length > 120) {
    fehler.push({ feld: "roleOrCompany", text: "Bitte kürzer (höchstens 120 Zeichen)." });
  }

  const contactEmail = alsText(eingabe.contactEmail).toLowerCase();
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail)) {
    fehler.push({ feld: "contactEmail", text: "Diese E-Mail-Adresse sieht nicht richtig aus." });
  }

  /*
   * Die Zustimmung ist keine Formsache.
   *
   * Ohne sie wird nichts veröffentlicht — das steht zusätzlich als
   * Bedingung in der Datenbank. Hier steht es, damit die Person es an
   * dem Feld erfährt, an dem sie es übersehen hat.
   */
  if (eingabe.consentPublish !== true && eingabe.consentPublish !== "on") {
    fehler.push({
      feld: "consentPublish",
      text: "Ohne deine Zustimmung veröffentlichen wir nichts.",
    });
  }
  if (eingabe.consentPrivacy !== true && eingabe.consentPrivacy !== "on") {
    fehler.push({ feld: "consentPrivacy", text: "Bitte bestätige die Datenschutzerklärung." });
  }

  if (fehler.length > 0) return { ok: false, fehler };

  return {
    ok: true,
    wert: {
      displayName,
      roleOrCompany: roleOrCompany || null,
      contactEmail: contactEmail || null,
      rating,
      headline: headline || null,
      body,
      consentPublish: true,
      consentPrivacy: true,
    },
  };
}

/**
 * Initialen für die Anzeige ohne Bild.
 *
 * Zwei Buchstaben aus dem Namen — keine erfundene Fotografie, kein
 * Stockbild. Ein Gesicht neben einer Bewertung, das nicht der Person
 * gehört, ist eine kleine Fälschung.
 */
export function initialen(name: string): string {
  const teile = name.split(/\s+/).filter(Boolean);
  if (teile.length === 0) return "?";
  if (teile.length === 1) return teile[0]!.slice(0, 2).toUpperCase();
  return (teile[0]![0]! + teile[teile.length - 1]![0]!).toUpperCase();
}
