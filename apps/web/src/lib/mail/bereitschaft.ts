import { loadRuntimeConfig } from "@paycheck/config";

/**
 * Ob ein echter Versand möglich ist — und was sonst fehlt.
 *
 * ── Warum getrennt von `versand.ts` ───────────────────────────
 *
 * Diese Prüfung liest nur Konfiguration. `versand.ts` trägt
 * `server-only` und zieht das Resend-SDK mit; beides zusammen hiesse,
 * dass eine reine Ja-Nein-Frage nur dort beantwortbar wäre, wo der
 * ganze Versand verfügbar ist — auch im Test, der ihn nicht braucht.
 *
 * ── Warum sie vor dem Anlegen eines Codes gestellt wird ───────
 *
 * Erst einen Code schreiben und dann am fehlenden Schlüssel scheitern
 * hiesse, einen Code zu erzeugen, den niemand je bekommt — und die
 * Sperre gegen zu viele Codes zählt ihn trotzdem mit.
 */
export function mailBereit(): { bereit: boolean; entwurf: boolean; fehlt: string[] } {
  const cfg = loadRuntimeConfig();
  const entwurf = cfg.mail.provider === "draft";

  if (entwurf) {
    /*
     * Im Entwurfsmodus ist alles bereit — es geht ja nichts hinaus.
     *
     * Ausser in der Produktion: Dort ist der Modus selbst der Mangel.
     * Er sieht aus wie Betrieb — die Oberfläche meldet „Code
     * gesendet", niemand bekommt etwas, und im Protokoll steht nichts
     * Auffälliges. Das ist der teuerste Ausfall, weil er sich nicht
     * meldet.
     */
    return cfg.nodeEnv === "production"
      ? { bereit: false, entwurf: false, fehlt: ["MAIL_PROVIDER (steht auf „draft“)"] }
      : { bereit: true, entwurf: true, fehlt: [] };
  }

  const fehlt: string[] = [];
  if (cfg.mail.provider === "resend" && !cfg.mail.resendKey) fehlt.push("RESEND_API_KEY");
  if (!cfg.mail.from) fehlt.push("MAIL_FROM");

  return { bereit: fehlt.length === 0, entwurf: false, fehlt };
}
