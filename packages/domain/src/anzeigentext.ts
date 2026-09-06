/**
 * Anzeigentext in lesbare Blöcke zerlegen.
 *
 * ── Das Problem ───────────────────────────────────────────────
 *
 * Stellenanzeigen kommen aus Dutzenden Systemen, und viele davon
 * schreiben Markdown oder HTML in ein Feld, das als reiner Text
 * ausgeliefert wird. Gemessen an einer Stichprobe von 66.052 Anzeigen:
 *
 *   **fett**            13,6 %
 *   # Überschrift        9,8 %
 *   Listenzeichen       23,7 %
 *   HTML-Tags            0,2 %
 *
 * Auf der Seite stand das roh da — „**WHY DASH?**" mitten im Absatz.
 * Das sieht nach einem kaputten Produkt aus, und es macht den Text
 * schwerer lesbar als der unformatierte Rohtext es wäre.
 *
 * ── Warum kein Markdown-Renderer ──────────────────────────────
 *
 * Weil es kein Markdown ist. Es ist Text, in dem Markdown-Zeichen
 * vorkommen — teils vollständig, teils halb, teils vermischt mit HTML
 * und mit Aufzählungszeichen aus dem Textverarbeitungsprogramm eines
 * Personalers. Ein Renderer würde daraus HTML bauen, das wir dann in
 * die Seite einsetzen müssten: fremder Text, der zu Markup wird.
 *
 * Hier entstehen stattdessen Blöcke mit einer Art. Was daraus wird,
 * entscheidet die Oberfläche — es gibt nichts einzusetzen und damit
 * nichts einzuschleusen.
 */

export type Blockart = "ueberschrift" | "absatz" | "punkt";

export interface Textblock {
  art: Blockart;
  text: string;
}

/*
 * Aufzählungszeichen, wie sie tatsächlich vorkommen.
 *
 * Neben `-` und `*` stehen in Anzeigen regelmässig die Zeichen, die
 * Word und PowerPoint einsetzen: •, ‣, ▪, ●, ○, ✓, ✔, →, ». Ohne sie
 * bliebe ein Viertel der Listen unerkannt.
 */
const PUNKTZEICHEN = /^\s*([-*+•‣▪●○◦·✓✔✅★→»–—]|\d{1,2}[.)])\s+/;

/** Eine Überschrift: `#`, `##` … oder eine Zeile, die auf `:` endet. */
const RAUTE = /^\s*#{1,6}\s+/;

/**
 * HTML entfernen — und dabei die Absätze behalten.
 *
 * ── Warum `<br>` ein Absatz wird und nicht eine Zeile ─────────
 *
 * Ein einfacher Zeilenumbruch im Rohtext ist fast immer ein harter
 * Umbruch auf 80 Zeichen — dort gehören die Zeilen zusammen. Ein
 * `<br>` dagegen hat jemand geschrieben, weil er einen Bruch wollte;
 * in HTML gibt es keinen Zeilenumbruch aus Versehen.
 *
 * Deshalb werden HTML-Brüche zu Absatzgrenzen. Sie einfach zu
 * streichen klebte zwei Sätze aneinander, sie zu einfachen Umbrüchen
 * zu machen liesse sie wieder verschmelzen.
 */
function ohneHtml(text: string): string {
  return text
    .replace(/<\s*br\s*\/?\s*>/gi, "\n\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<[^>]{1,200}>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

/**
 * Die Auszeichnungszeichen entfernen, den Text behalten.
 *
 * `**fett**` wird `fett`, nicht `fett` in Fettschrift: In einer
 * Stellenanzeige ist die Fettung fast immer eine Betonung, die der
 * Verfasser gesetzt hat, und keine Struktur. Sie hier nachzubauen
 * hiesse, die Gestaltung eines fremden Systems in unsere zu holen.
 */
function ohneAuszeichnung(text: string): string {
  return text
    /* Verlinkungen: `[Text](Adresse)` → `Text`. Die Adresse steht
       ohnehin als Originallink an der Anzeige. */
    .replace(/\[([^\]]{1,200})\]\((?:[^)]{1,500})\)/g, "$1")
    .replace(/(\*\*\*|___)(.+?)\1/g, "$2")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(?<![\w*])(\*|_)(?!\s)([^*_\n]{1,200}?)(?<!\s)\1(?![\w*])/g, "$2")
    .replace(/`{1,3}([^`]{1,400})`{1,3}/g, "$1")
    /* Übrig gebliebene Sterne, die zu keinem Paar gehören. Sie sind
       häufiger als vollständige Auszeichnung — halb kopierte Anzeigen. */
    .replace(/\*{2,}/g, "")
    .replace(/^\s*[-=_]{3,}\s*$/gm, "");
}

/**
 * Aus rohem Anzeigentext lesbare Blöcke machen.
 *
 * Gibt eine leere Liste zurück, wenn nichts übrig bleibt — das ist ein
 * Ergebnis und kein Fehler, und die Oberfläche sagt dann, dass die
 * Anzeige keine Beschreibung enthält.
 */
export function anzeigenblöcke(roh: string | null | undefined): Textblock[] {
  if (!roh) return [];
  const text = ohneAuszeichnung(ohneHtml(roh));

  const blöcke: Textblock[] = [];
  let absatz: string[] = [];

  const absatzSchliessen = () => {
    if (absatz.length === 0) return;
    const zusammen = absatz.join(" ").replace(/\s{2,}/g, " ").trim();
    if (zusammen) blöcke.push({ art: "absatz", text: zusammen });
    absatz = [];
  };

  for (const rohzeile of text.split(/\r?\n/)) {
    const zeile = rohzeile.trim();

    if (!zeile) {
      absatzSchliessen();
      continue;
    }

    if (RAUTE.test(zeile)) {
      absatzSchliessen();
      const t = zeile.replace(RAUTE, "").replace(/\s*#+\s*$/, "").trim();
      if (t) blöcke.push({ art: "ueberschrift", text: t });
      continue;
    }

    if (PUNKTZEICHEN.test(zeile)) {
      absatzSchliessen();
      const t = zeile.replace(PUNKTZEICHEN, "").trim();
      if (t) blöcke.push({ art: "punkt", text: t });
      continue;
    }

    /*
     * Eine kurze Zeile, die auf Doppelpunkt endet, ist eine
     * Überschrift — „Deine Aufgaben:", „Das bringst du mit:". So
     * schreiben Personalabteilungen, und ohne diese Regel bliebe die
     * Hälfte der Struktur unerkannt.
     *
     * Die Längengrenze ist nötig: Ein ganzer Satz, der zufällig auf
     * einen Doppelpunkt endet, ist keine Überschrift.
     */
    if (zeile.endsWith(":") && zeile.length <= 60 && !zeile.includes(". ")) {
      absatzSchliessen();
      blöcke.push({ art: "ueberschrift", text: zeile.slice(0, -1).trim() });
      continue;
    }

    absatz.push(zeile);
  }
  absatzSchliessen();

  return blöcke;
}

/** Derselbe Text ohne Struktur — für Vorschauen und Zusammenfassungen. */
export function anzeigenklartext(roh: string | null | undefined): string {
  return anzeigenblöcke(roh)
    .map((b) => b.text)
    .join("\n")
    .trim();
}
