import "server-only";

import { Resend } from "resend";
import { loadRuntimeConfig } from "@paycheck/config";
import { mailBereit } from "./bereitschaft";

/* Re-Export, damit serverseitige Aufrufer aus einer Datei importieren. */
export { mailBereit };

/**
 * E-Mail-Versand.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Entwurfsmodus bleibt — und wo er endet
 * ══════════════════════════════════════════════════════════════
 *
 * `draft` heisst: Es geht nichts hinaus, der Inhalt landet auf der
 * Serverkonsole. Das ist für die lokale Entwicklung richtig — ein
 * Entwicklungsstand, der bei jedem Ausprobieren echte Mails an echte
 * Adressen schickt, ist ein Zustellwerkzeug mit Nebenwirkungen.
 *
 * In der Produktion ist derselbe Modus ein Ausfall, der wie Betrieb
 * aussieht: Die Oberfläche meldet „Code gesendet", niemand bekommt
 * etwas, und im Protokoll steht nichts Auffälliges. Deshalb bricht
 * `versendeMail` dort ab, statt still auf die Konsole auszuweichen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Fehler den Grund nennt
 * ══════════════════════════════════════════════════════════════
 *
 * „Versand fehlgeschlagen" schickt jemanden in die falsche Richtung —
 * er sucht beim Anbieter, während der Schlüssel fehlt. Der
 * Konfigurationsfehler sagt deshalb, welche Variable fehlt. Er geht
 * ins Serverprotokoll, nicht an den Browser: Welche Variable auf
 * einem Server fehlt, ist keine Auskunft für Besucher.
 */

export type Versandergebnis =
  | { ok: true; entwurf: boolean; id?: string }
  | { ok: false; grund: "konfiguration" | "anbieter"; text: string };

export type Mail = {
  an: string;
  betreff: string;
  html: string;
  /** Die Nur-Text-Fassung. Kein Zusatz, sondern Pflicht — siehe unten. */
  text: string;
  /**
   * Zusätzliche Kopfzeilen.
   *
   * Gebraucht für `List-Unsubscribe` und `List-Unsubscribe-Post` nach
   * RFC 8058: Damit zeigen Postfachanbieter ihren eigenen
   * Abmeldeknopf. Ohne die zweite Zeile behandeln sie den Link als
   * gewöhnlichen Verweis und rufen ihn per GET ab — dann meldet ein
   * Virenscanner Menschen ab, die nie geklickt haben.
   */
  kopfzeilen?: Record<string, string>;
};

let client: Resend | null = null;

export async function versendeMail(mail: Mail): Promise<Versandergebnis> {
  const cfg = loadRuntimeConfig();
  const stand = mailBereit();

  if (!stand.bereit) {
    console.error(`[mail] Nicht versandbereit. Es fehlt: ${stand.fehlt.join(", ")}`);
    return {
      ok: false,
      grund: "konfiguration",
      text: "Der E-Mail-Versand ist auf diesem Server nicht eingerichtet.",
    };
  }

  if (stand.entwurf) {
    /*
     * Nur ausserhalb der Produktion erreichbar — `mailBereit` lässt
     * den Modus dort nicht durch.
     */
    console.info(`[mail:entwurf] an ${mail.an} · ${mail.betreff}\n${mail.text}`);
    return { ok: true, entwurf: true };
  }

  if (cfg.mail.provider !== "resend") {
    console.error(`[mail] Anbieter „${cfg.mail.provider}“ ist nicht angebunden.`);
    return {
      ok: false,
      grund: "konfiguration",
      text: "Der eingestellte E-Mail-Anbieter ist nicht angebunden.",
    };
  }

  client ??= new Resend(cfg.mail.resendKey!);

  try {
    const { data, error } = await client.emails.send({
      from: cfg.mail.from!,
      to: mail.an,
      subject: mail.betreff,
      html: mail.html,
      /*
       * Die Nur-Text-Fassung geht immer mit.
       *
       * Nicht aus Nostalgie: Spamfilter bewerten eine Mail ohne
       * Textteil schlechter, und Vorlesegeräte sowie
       * Benachrichtigungsvorschauen lesen sie statt des HTML. Bei
       * einer Mail, die aus einem sechsstelligen Code besteht, ist die
       * Vorschau oft das Einzige, was jemand liest.
       */
      text: mail.text,
      headers: mail.kopfzeilen,
    });

    if (error) {
      /* Die Meldung des Anbieters geht ins Protokoll, nicht an den
         Browser — sie enthält regelmässig die Empfängeradresse. */
      console.error(`[mail] Resend hat abgelehnt: ${error.name}`);
      return {
        ok: false,
        grund: "anbieter",
        text: "Die E-Mail konnte gerade nicht zugestellt werden.",
      };
    }

    return { ok: true, entwurf: false, id: data?.id };
  } catch (fehler) {
    console.error("[mail] Resend nicht erreichbar:", fehler instanceof Error ? fehler.message : "unbekannt");
    return {
      ok: false,
      grund: "anbieter",
      text: "Der E-Mail-Dienst ist gerade nicht erreichbar.",
    };
  }
}
