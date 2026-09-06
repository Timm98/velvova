/**
 * Die Zusammenfassung als Mail.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Vorlage hier steht und nicht im Modell
 * ══════════════════════════════════════════════════════════════
 *
 * Titel, Arbeitgeber, Gehalt, Ort, Link, Empfänger und Abmeldung
 * kommen aus geprüften Datensätzen. Das Modell schreibt drei Dinge:
 * Betreff, Einleitung, Abschluss — und übernimmt je Stelle einen
 * bereits validierten Grund.
 *
 * Der Grund ist die Trennung von Formulieren und Behaupten. Ein
 * Modell, das die Mail als Ganzes schreibt, schreibt irgendwann auch
 * das Gehalt hinein — und zwar plausibel, gerundet und falsch.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum jeder Modelltext durch `text()` geht
 * ══════════════════════════════════════════════════════════════
 *
 * Weil er Text ist und kein Markup. Eine Stellenanzeige kann
 * `<script>` enthalten, ein Firmenname ein `&`, und ein Modell kann
 * beides wiederholen. In eine HTML-Mail eingesetzt wäre das im besten
 * Fall kaputte Darstellung.
 */

export interface Vorlagenposten {
  jobId: string;
  titel: string;
  arbeitgeber: string;
  ort: string;
  /** Fertig formatiert — die Vorlage rechnet nichts. */
  gehalt: string | null;
  fitScore: number | null;
  grund: string;
  caveat: string | null;
  /** neu · aktualisierung */
  art: string;
  url: string;
}

export interface Vorlagendaten {
  anrede: string | null;
  betreff: string;
  einleitung: string;
  abschluss: string;
  /** „Bestätigter Suchauftrag vom 4. September" — serverseitig erzeugt. */
  basisLabel: string;
  posten: Vorlagenposten[];
  /** Wohin die Person geht, um den Auftrag zu ändern. */
  einstellungenUrl: string;
  abmeldeUrl: string;
  /** Der Absender, wie er sichtbar sein soll. */
  absenderName: string;
}

/** HTML-Fluchtzeichen. Fünf Zeichen, mehr braucht Text im Body nicht. */
export function text(roh: string): string {
  return roh
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Eine Adresse für ein `href`.
 *
 * Nur `https:` und `mailto:`. Ein `javascript:`-Link in einer Mail
 * wäre in den meisten Programmen wirkungslos und in einer Vorschau im
 * Browser nicht — und die Adresse kommt aus einer Stellenanzeige.
 */
export function adresse(roh: string): string {
  const sauber = roh.trim();
  if (!/^https:\/\//i.test(sauber) && !/^mailto:/i.test(sauber)) return "#";
  return text(sauber);
}

export interface Mailfassung {
  betreff: string;
  html: string;
  text: string;
}

export function zusammenfassungRendern(d: Vorlagendaten): Mailfassung {
  const gruss = d.anrede ? `Hallo ${d.anrede},` : "Hallo,";

  const postenHtml = d.posten
    .map((p) => {
      const zeilen: string[] = [];
      zeilen.push(
        `<div style="font-size:16px;font-weight:600;line-height:1.3;margin:0 0 4px">` +
          `<a href="${adresse(p.url)}" style="color:#111827;text-decoration:none">${text(p.titel)}</a></div>`,
      );
      const kopf = [p.arbeitgeber, p.ort].filter(Boolean).map(text).join(" · ");
      zeilen.push(`<div style="font-size:13px;color:#6b7280;margin:0 0 8px">${kopf}</div>`);
      if (p.gehalt) zeilen.push(`<div style="font-size:13px;color:#374151">${text(p.gehalt)}</div>`);
      zeilen.push(`<div style="font-size:14px;color:#111827;margin:8px 0 0">${text(p.grund)}</div>`);
      /*
       * Der Vorbehalt steht nur da, wenn es einen gibt. Ein
       * Platzhalter — „keine Nachteile bekannt" — wäre eine Aussage
       * über etwas, das niemand geprüft hat.
       */
      if (p.caveat)
        zeilen.push(
          `<div style="font-size:13px;color:#92400e;margin:6px 0 0">Offen: ${text(p.caveat)}</div>`,
        );
      if (p.art === "aktualisierung")
        zeilen.push(
          `<div style="font-size:12px;color:#6b7280;margin:6px 0 0">Diese Stelle kennst du schon — die Angaben haben sich geändert.</div>`,
        );
      return (
        `<td style="padding:16px 0;border-bottom:1px solid #e5e7eb">${zeilen.join("")}</td>`
      );
    })
    .map((td) => `<tr>${td}</tr>`)
    .join("");

  const html = [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:24px 0">`,
    `<tr><td align="center">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827">`,
    `<tr><td style="font-size:15px;line-height:1.5">${text(gruss)}</td></tr>`,
    `<tr><td style="font-size:15px;line-height:1.6;padding:8px 0 0">${text(d.einleitung)}</td></tr>`,
    `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${postenHtml}</table></td></tr>`,
    `<tr><td style="font-size:14px;line-height:1.6;color:#374151;padding:20px 0 0">${text(d.abschluss)}</td></tr>`,
    `<tr><td style="font-size:12px;color:#6b7280;padding:20px 0 0;border-top:1px solid #e5e7eb">`,
    `${text(d.basisLabel)}<br>`,
    `<a href="${adresse(d.einstellungenUrl)}" style="color:#6b7280">Suchauftrag ändern</a> · `,
    `<a href="${adresse(d.abmeldeUrl)}" style="color:#6b7280">Keine Mails mehr</a>`,
    `</td></tr>`,
    `</table></td></tr></table>`,
  ].join("");

  /*
   * Die Nur-Text-Fassung ist Pflicht, kein Zusatz.
   *
   * Spamfilter bewerten eine Mail ohne Textteil schlechter, und
   * Vorlesegeräte sowie Benachrichtigungsvorschauen lesen sie statt
   * des HTML. Bei einer Mail, die jemand auf dem Sperrbildschirm
   * überfliegt, ist die Vorschau oft alles, was gelesen wird.
   */
  const reinerText = [
    gruss,
    "",
    d.einleitung,
    "",
    ...d.posten.flatMap((p) => {
      const zeilen = [
        p.titel,
        [p.arbeitgeber, p.ort].filter(Boolean).join(" · "),
        ...(p.gehalt ? [p.gehalt] : []),
        p.grund,
        ...(p.caveat ? [`Offen: ${p.caveat}`] : []),
        ...(p.art === "aktualisierung" ? ["Diese Stelle kennst du schon — die Angaben haben sich geändert."] : []),
        p.url,
        "",
      ];
      return zeilen;
    }),
    d.abschluss,
    "",
    d.basisLabel,
    `Suchauftrag ändern: ${d.einstellungenUrl}`,
    `Keine Mails mehr: ${d.abmeldeUrl}`,
  ].join("\n");

  return { betreff: d.betreff, html, text: reinerText };
}

/**
 * Der deterministische Ersatz, wenn der Modelltext nicht taugt.
 *
 * ── Warum es ihn gibt ─────────────────────────────────────────
 *
 * Ein Modellaufruf kann scheitern, abgeschnitten ankommen oder eine
 * falsche Zahl in den Betreff schreiben. Die naheliegende Reaktion —
 * es noch einmal versuchen und sonst nichts schicken — bestraft die
 * Person für einen technischen Fehler.
 *
 * Diese Fassung nennt dieselben geprüften Zahlen und behauptet nichts
 * darüber hinaus. Sie ist nüchterner und stimmt.
 */
export function ersatztexte(anzahl: number, auftragsname: string): {
  betreff: string;
  einleitung: string;
  abschluss: string;
} {
  const wort = anzahl === 1 ? "Stelle" : "Stellen";
  return {
    /*
     * „für deinen Suchauftrag“, nicht „passend“.
     *
     * Die Einleitung sagt es genau: „die zu deinen ANGABEN passt“.
     * Der Betreff stand allein im Postfach und sagte „passende
     * Stelle“ — ohne den Zusatz liest sich das als Aussage über die
     * Person, und die können wir ohne Ninas Gespräch nicht treffen.
     *
     * Eine Stelle kann die Kriterien erfüllen, ohne dass irgendjemand
     * weiss, ob sie zu diesem Menschen passt.
     */
    betreff: `${anzahl} ${wort} für deinen Suchauftrag`,
    einleitung:
      anzahl === 1
        ? `Für deinen Suchauftrag „${auftragsname}" ist eine Stelle dazugekommen, die zu deinen Angaben passt.`
        : `Für deinen Suchauftrag „${auftragsname}" sind ${anzahl} Stellen dazugekommen, die zu deinen Angaben passen.`,
    abschluss: "Du kannst deinen Suchauftrag jederzeit ändern oder pausieren.",
  };
}


/**
 * Die Kopfzeilen für den Ein-Klick-Abmeldeweg.
 *
 * Beide zusammen, sonst wirkt keine: Ohne `List-Unsubscribe-Post`
 * behandeln Anbieter den Link als gewöhnlichen Verweis und rufen ihn
 * per GET ab — dann meldet ein Virenscanner Menschen ab, die nie
 * geklickt haben.
 *
 * Steht hier und nicht in der Webschicht, weil der Versand auch aus
 * einem Skript heraus laufen können muss und `server-only` sich dort
 * nicht auflösen lässt.
 */
export function abmeldeKopfzeilen(abmeldeUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${abmeldeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
