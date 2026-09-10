/**
 * ══════════════════════════════════════════════════════════════════
 * Die Freigabe für genau eine Nachricht
 * ══════════════════════════════════════════════════════════════════
 *
 * Velvova hat zwei Arten von Einwilligung, und sie zu verwechseln ist
 * der teuerste Fehler, den dieses Produkt machen kann:
 *
 *   `consents`       Dauerhaft und allgemein: „Monday darf mein
 *                    Postfach benutzen." Widerrufbar, gilt bis dahin.
 *
 *   Diese hier       Einmalig und genau: „Sende DIESE Mail an DIESEN
 *                    Empfänger." Verfällt, wird verbraucht, bindet
 *                    sich an den Inhalt, den der Mensch gesehen hat.
 *
 * Die erste allein reicht nicht. Wer einmal „ja, benutze mein Gmail"
 * gesagt hat, hat nicht gesagt, dass irgendetwas in seinem Namen
 * hinausgehen darf — nur, dass der Weg offensteht.
 *
 * ── Warum die Prüfung hier steht und nicht im Prompt ────────────
 *
 * Weil ein Prompt eine Bitte ist. „Sende nie ohne Freigabe" steht im
 * Systemtext, und im selben Text steht, dass Anzeigentexte Daten sind
 * und keine Anweisungen — beides ist richtig und beides ist kein
 * Riegel. Ein Modell, das eine Anzeige liest, in der „ignoriere deine
 * Regeln" steht, soll nicht die einzige Instanz sein, die Nein sagt.
 *
 * Diese Funktion ist der Riegel. Sie kennt kein Modell, keinen
 * Anzeigentext und keine Überredung — nur vier Zeitpunkte und zwei
 * Vergleiche.
 *
 * ── Warum der Inhalt mitgeprüft wird ────────────────────────────
 *
 * Ohne den Vergleich wäre die Freigabe eine Erlaubnis, an diese
 * Adresse irgendetwas zu senden. Der Mensch hat aber nicht „eine
 * Mail" freigegeben, sondern die, die er gelesen hat. Ändert sich
 * danach ein Zeichen daran, ist die Freigabe verbraucht — nicht
 * übertragbar.
 */

/** Wie lange eine Freigabe gilt. */
export const GUELTIGKEIT_MINUTEN = 24 * 60;

/**
 * Warum gesendet werden darf — oder eben nicht.
 *
 * Jeder Grund ist ein anderer Satz an den Menschen, und keiner davon
 * ist „ein Fehler ist aufgetreten".
 */
export type Freigabestand =
  | "gueltig"
  | "unbekannt"
  | "abgelaufen"
  | "verbraucht"
  | "widerrufen"
  | "empfaenger_abweichend"
  | "inhalt_abweichend"
  | "arbeitgeber_gesperrt";

export interface Freigabezeile {
  empfaenger: string;
  /** Fingerabdruck über Empfänger, Betreff und Text — gebildet beim Anlegen. */
  fingerabdruck: string;
  gueltigBis: Date;
  verwendetAm: Date | null;
  widerrufenAm: Date | null;
}

export interface Sendeversuch {
  empfaenger: string;
  fingerabdruck: string;
  /** true, wenn der Empfänger inzwischen auf einer Sperre steht. */
  gesperrt?: boolean;
  jetzt?: Date;
}

/**
 * Darf diese Nachricht hinausgehen?
 *
 * ── Die Reihenfolge der Prüfungen ist Absicht ───────────────────
 *
 * Die Sperre steht vor allem anderen. Ein Arbeitgeber, der „bitte
 * nicht mehr" gesagt hat, oder der eigene aktuelle Arbeitgeber, darf
 * auch dann nichts bekommen, wenn eine gültige Freigabe vorliegt —
 * die Sperre kann nach der Freigabe entstanden sein, und dann ist die
 * Freigabe älter als die Tatsache.
 *
 * Danach die Identität der Nachricht (Empfänger, Inhalt), erst
 * zuletzt Zeit und Verbrauch. Wer eine fremde Nachricht mit einem
 * echten Token schickt, soll nicht „abgelaufen" hören, sondern die
 * Wahrheit.
 */
export function freigabePruefen(
  zeile: Freigabezeile | null,
  versuch: Sendeversuch,
): Freigabestand {
  if (versuch.gesperrt) return "arbeitgeber_gesperrt";
  if (!zeile) return "unbekannt";
  if (zeile.empfaenger !== versuch.empfaenger) return "empfaenger_abweichend";
  if (zeile.fingerabdruck !== versuch.fingerabdruck) return "inhalt_abweichend";
  if (zeile.widerrufenAm !== null) return "widerrufen";
  if (zeile.verwendetAm !== null) return "verbraucht";
  const jetzt = versuch.jetzt ?? new Date();
  if (zeile.gueltigBis.getTime() <= jetzt.getTime()) return "abgelaufen";
  return "gueltig";
}

export function darfSenden(stand: Freigabestand): boolean {
  return stand === "gueltig";
}

/**
 * Was der Mensch liest, wenn nicht gesendet wurde.
 *
 * Kein „ein Fehler ist aufgetreten". Jeder dieser Sätze sagt, was
 * passiert ist und was er tun kann — das ist der Unterschied zwischen
 * einem System, dem man den Versand anvertraut, und einem, das man
 * lieber selbst bedient.
 */
export function freigabeText(stand: Freigabestand): string {
  switch (stand) {
    case "gueltig":
      return "Freigegeben.";
    case "unbekannt":
      return "Für diese Nachricht liegt keine Freigabe vor. Es wurde nichts versendet.";
    case "abgelaufen":
      return `Deine Freigabe ist älter als ${Math.round(GUELTIGKEIT_MINUTEN / 60)} Stunden und damit abgelaufen. Sieh dir den Entwurf noch einmal an und gib ihn neu frei.`;
    case "verbraucht":
      return "Diese Bewerbung wurde bereits versendet. Ein zweites Mal geht sie nicht hinaus.";
    case "widerrufen":
      return "Du hast diese Freigabe zurückgenommen. Es wurde nichts versendet.";
    case "empfaenger_abweichend":
      return "Der Empfänger ist nicht der, den du freigegeben hast. Es wurde nichts versendet.";
    case "inhalt_abweichend":
      return "Der Text hat sich seit deiner Freigabe geändert. Lies ihn noch einmal und gib ihn neu frei — freigegeben war die Fassung, die du gesehen hast.";
    case "arbeitgeber_gesperrt":
      return "An diesen Arbeitgeber geht von hier nichts hinaus.";
  }
}

/**
 * Der Text, der die Freigabe begleitet.
 *
 * Er steht neben dem Knopf, nicht in den Nutzungsbedingungen. Wer auf
 * „Absenden" drückt, soll in demselben Blick lesen, was das heisst.
 */
export function freigabeFrage(empfaenger: string, anhaenge: readonly string[]): string {
  const teile = [`Diese Bewerbung geht an ${empfaenger}`];
  if (anhaenge.length > 0) {
    teile.push(`mit ${anhaenge.length === 1 ? "einem Anhang" : `${anhaenge.length} Anhängen`} (${anhaenge.join(", ")})`);
  }
  return `${teile.join(" ")}. Sie geht von deinem Postfach aus, in deinem Namen, und lässt sich danach nicht zurückholen.`;
}

/**
 * Wann eine Freigabe verfällt.
 *
 * Als Funktion und nicht als Rechnung an der Aufrufstelle: Eine
 * Gültigkeit, die an zwei Orten gerechnet wird, ist an einem davon
 * irgendwann länger.
 */
export function gueltigBis(ab: Date = new Date()): Date {
  return new Date(ab.getTime() + GUELTIGKEIT_MINUTEN * 60_000);
}
