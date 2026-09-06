import { brand } from "@paycheck/config";
import type { Mail } from "./versand";

/**
 * Die Bestätigungsmail.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum diese Mail aus Tabellen besteht
 * ══════════════════════════════════════════════════════════════
 *
 * Outlook auf Windows rendert HTML mit der Word-Engine. Sie kennt kein
 * Flexbox, kein Grid, keine `max-width` auf `div`. Eine Mail, die im
 * Browser gut aussieht und dort zerfällt, erreicht in Deutschland
 * einen erheblichen Teil der Geschäftsempfänger — also genau die
 * Zielgruppe des Arbeitgeberbereichs.
 *
 * Tabellen sind hier kein Rückschritt, sondern das einzige Layout, auf
 * das man sich verlassen kann.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum keine Schriftdatei geladen wird
 * ══════════════════════════════════════════════════════════════
 *
 * Manrope und Chivo Mono tragen die Marke auf der Website. In einer
 * Mail wären sie ein externer Abruf, den Gmail über einen Proxy holt
 * und Outlook gar nicht — und die Schrift, die dann erscheint, ist
 * unvorhersehbar. Eine Systemschriftfolge sieht überall gleich
 * absichtlich aus.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Farben doppelt stehen
 * ══════════════════════════════════════════════════════════════
 *
 * Viele Mailprogramme kehren Farben im dunklen Modus selbst um — ohne
 * zu fragen und ohne unsere Medienabfragen zu lesen. Deshalb zwei
 * Vorkehrungen: `color-scheme` sagt dem Programm, dass die Mail beide
 * Modi kennt, und jede Farbe steht zusätzlich als `style`-Attribut am
 * Element. Was invertiert wird, bleibt so wenigstens lesbar — der
 * Codeblock trägt darum kräftigen Kontrast in beide Richtungen.
 */

export function bestaetigungsmail(opt: { code: string; minuten: number }): Mail {
  const { code, minuten } = opt;

  /* Zwei Dreiergruppen. Sechs Ziffern am Stück tippt man ab, indem man
     zwischendurch nachsieht; in Gruppen merkt man sie sich. */
  const gruppiert = `${code.slice(0, 3)} ${code.slice(3)}`;

  const text = [
    `${brand.name} — Bestätige deine E-Mail-Adresse`,
    "",
    "Mit diesem Code schliesst du die Erstellung deines Kontos ab:",
    "",
    `    ${gruppiert}`,
    "",
    `Der Code ist ${minuten} Minuten gültig.`,
    `Falls du dieses Konto nicht erstellt hast, kannst du diese E-Mail ignorieren.`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${brand.name} — Bestätigungscode</title>
</head>
<body style="margin:0;padding:0;background:#f7f9fc;color:#0b0d16;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Der Vorschautext. Ohne ihn zeigt die Übersicht den Anfang des
       sichtbaren Textes — also den Markennamen, zweimal. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Dein Code: ${gruppiert}. ${minuten} Minuten gültig.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f9fc;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <span style="font-size:26px;font-weight:800;letter-spacing:-0.03em;color:#0b0d16;">${brand.name}</span>
            </td>
          </tr>

          <tr>
            <td style="background:#ffffff;border:1px solid #dce2ec;border-radius:14px;padding:36px 32px;">

              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:600;letter-spacing:-0.02em;color:#0b0d16;">
                Bestätige deine E-Mail-Adresse
              </h1>

              <p style="margin:0 0 28px;font-size:16px;line-height:1.55;color:#454b5c;">
                Mit diesem Code schliesst du die Erstellung deines Kontos ab.
              </p>

              <!-- Der Code. Kräftiger Kontrast in beide Richtungen:
                   Wird die Mail von einem dunklen Client invertiert,
                   bleibt Weiss auf Dunkelblau lesbar. -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background:#0b0d16;border-radius:10px;padding:22px 12px;">
                    <span style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:0.22em;color:#ffffff;white-space:nowrap;">${gruppiert}</span>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:#6b7280;">
                Der Code ist ${minuten} Minuten gültig. Falls du dieses Konto nicht erstellt hast,
                kannst du diese E-Mail ignorieren.
              </p>

            </td>
          </tr>

          <tr>
            <td align="center" style="padding-top:22px;font-size:12px;line-height:1.5;color:#8b93a3;">
              Diese Nachricht wurde automatisch versendet.
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    an: "",
    betreff: `Dein ${brand.name}-Bestätigungscode`,
    html,
    text,
  };
}
