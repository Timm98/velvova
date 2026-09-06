import { inflateRawSync, inflateSync } from "node:zlib";

/**
 * Den Text aus einer Datei holen — ohne neue Abhängigkeit.
 *
 * Drei Formate, drei sehr verschiedene Aufwände, und eine Grenze, die
 * ausdrücklich benannt wird.
 *
 *   **TXT** ist Text. Nichts zu tun.
 *
 *   **DOCX** ist ein ZIP-Archiv mit einer XML-Datei darin. Node kann
 *   ZIP-Einträge entpacken (`inflateRawSync`), und aus dem XML sind die
 *   Textknoten zu holen. Etwa achtzig Zeilen, keine Bibliothek, kein
 *   Risiko.
 *
 *   **PDF** ist die schwierige. Ein PDF ist kein Textdokument, sondern
 *   eine Zeichenanweisung: „setze diese Glyphe an diese Stelle". Der
 *   Text steht in Inhaltsströmen, meist komprimiert, und die Zuordnung
 *   von Glyphe zu Buchstabe hängt an der Schrifttabelle des Dokuments.
 *
 * Was hier für PDF gemacht wird und was nicht:
 *
 *   JA  — Inhaltsströme entpacken, Textoperatoren lesen, Zeichenketten
 *         zusammensetzen. Das deckt PDFs ab, die aus Word, LaTeX oder
 *         einem Browser entstanden sind, und damit die allermeisten
 *         Lebensläufe.
 *
 *   NEIN — eingescannte Seiten. Dort ist der „Text" ein Bild, und es
 *         gibt nichts zu lesen. Dafür bräuchte es Texterkennung, und
 *         eine halbherzige Texterkennung über einem Lebenslauf ist
 *         schlimmer als keine: sie erfindet Namen und Daten.
 *
 *   NEIN — exotische Schriftkodierungen. Kommt Unsinn heraus, wird das
 *         erkannt und als „nicht lesbar" gemeldet, nicht als Text
 *         ausgegeben.
 *
 * Der letzte Punkt ist der wichtige. Aus diesem Text entstehen später
 * Behauptungen über den Werdegang einer Person. Lieber „Ich kann diese
 * Datei nicht lesen, füge den Text ein" als eine Zeichenfolge, die
 * aussieht wie Sprache und keine ist.
 */

export interface Auszug {
  ok: boolean;
  text?: string;
  seiten?: number;
  /** Warum es nicht ging — für die Person, ohne Fachwort. */
  grund?: string;
}

export const EXTRAKTOR = "paycheck-eigenbau";
export const EXTRAKTOR_VERSION = "1";

// ── Text ────────────────────────────────────────────────────
function ausText(daten: Uint8Array): Auszug {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(daten);
  return { ok: text.trim().length > 0, text: aufraeumen(text), grund: text.trim() ? undefined : "Die Datei enthält keinen Text." };
}

// ── DOCX ────────────────────────────────────────────────────

/**
 * Einen Eintrag aus einem ZIP-Archiv holen.
 *
 * Gelesen wird das zentrale Verzeichnis am Ende der Datei, nicht die
 * lokalen Köpfe: nur dort stehen die Grössen zuverlässig. Manche
 * Schreiber setzen im lokalen Kopf Nullen und liefern die echten Werte
 * erst im Data Descriptor nach.
 */
function ausZip(daten: Uint8Array, gesucht: string): Uint8Array | null {
  const dv = new DataView(daten.buffer, daten.byteOffset, daten.byteLength);

  // Das End-of-Central-Directory rückwärts suchen (Signatur 0x06054b50).
  let eocd = -1;
  for (let i = daten.length - 22; i >= 0 && i > daten.length - 65558; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const anzahl = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);

  for (let n = 0; n < anzahl; n++) {
    if (p + 46 > daten.length || dv.getUint32(p, true) !== 0x02014b50) return null;
    const methode = dv.getUint16(p + 10, true);
    const komprimiert = dv.getUint32(p + 20, true);
    const namensLaenge = dv.getUint16(p + 28, true);
    const extraLaenge = dv.getUint16(p + 30, true);
    const kommentarLaenge = dv.getUint16(p + 32, true);
    const lokal = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(daten.subarray(p + 46, p + 46 + namensLaenge));

    if (name === gesucht) {
      // Der lokale Kopf ist unterschiedlich lang — seine Feldlängen
      // stehen an fester Stelle und müssen einzeln gelesen werden.
      const lokalNamen = dv.getUint16(lokal + 26, true);
      const lokalExtra = dv.getUint16(lokal + 28, true);
      const start = lokal + 30 + lokalNamen + lokalExtra;
      const roh = daten.subarray(start, start + komprimiert);
      try {
        // 0 = gespeichert, 8 = deflate. Alles andere kommt in DOCX nicht vor.
        return methode === 0 ? roh : new Uint8Array(inflateRawSync(roh));
      } catch {
        return null;
      }
    }
    p += 46 + namensLaenge + extraLaenge + kommentarLaenge;
  }
  return null;
}

function ausDocx(daten: Uint8Array): Auszug {
  const xml = ausZip(daten, "word/document.xml");
  if (!xml) {
    return { ok: false, grund: "Diese DOCX-Datei lässt sich nicht öffnen. Speichere sie noch einmal." };
  }
  const roh = new TextDecoder("utf-8", { fatal: false }).decode(xml);

  /*
   * Absätze und Zeilenumbrüche erhalten, bevor die Marken fallen.
   *
   * Ohne das wird aus einem Lebenslauf ein einziger Fliesstext, und
   * „Müller GmbH 2019–2022 Disposition" liest sich dann wie ein Satz.
   * Struktur ist bei einem Lebenslauf die halbe Information.
   */
  const text = roh
    .replace(/<w:p\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:br\b[^>]*\/?>/g, "\n")
    .replace(/<w:tab\b[^>]*\/?>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

  const sauber = aufraeumen(text);
  return sauber.length > 0
    ? { ok: true, text: sauber }
    : { ok: false, grund: "In dieser Datei steht kein Text." };
}

// ── PDF ─────────────────────────────────────────────────────

/** Alle Inhaltsströme eines PDF entpacken. */
function pdfStroeme(daten: Uint8Array): string[] {
  const roh = Buffer.from(daten);
  const stroeme: string[] = [];
  let ab = 0;

  for (;;) {
    const start = roh.indexOf("stream", ab);
    if (start < 0) break;
    const ende = roh.indexOf("endstream", start);
    if (ende < 0) break;

    // Nach „stream" folgt CRLF oder LF.
    let d = start + 6;
    if (roh[d] === 0x0d) d++;
    if (roh[d] === 0x0a) d++;

    const inhalt = roh.subarray(d, ende);
    // Der Kopf davor sagt, ob komprimiert wurde.
    const kopf = roh.subarray(Math.max(0, start - 400), start).toString("latin1");

    try {
      if (/FlateDecode/.test(kopf)) {
        stroeme.push(inflateSync(inhalt).toString("latin1"));
      } else if (!/DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode/.test(kopf)) {
        // Bildströme überspringen: darin steht kein Text.
        stroeme.push(inhalt.toString("latin1"));
      }
    } catch {
      // Ein Strom, der sich nicht entpacken lässt, wird übergangen —
      // nicht geraten.
    }
    ab = ende + 9;
  }
  return stroeme;
}

/** Aus einem Inhaltsstrom die Zeichenketten der Textoperatoren holen. */
function pdfText(strom: string): string {
  let aus = "";
  // Tj: (text) Tj      TJ: [(a) -300 (b)] TJ
  const muster = /\((?:\\.|[^\\)])*\)|\bTJ\b|\bTj\b|\bTD\b|\bTd\b|\bT\*\b|\bET\b/g;
  let m: RegExpExecArray | null;
  while ((m = muster.exec(strom)) !== null) {
    const s = m[0];
    if (s.startsWith("(")) {
      aus += entschluessele(s.slice(1, -1));
    } else if (s === "TD" || s === "Td" || s === "T*" || s === "ET") {
      // Positionierung heisst in der Praxis: neue Zeile.
      aus += "\n";
    }
  }
  return aus;
}

/** PDF-Zeichenketten kennen Backslash-Escapes und Oktalcodes. */
function entschluessele(s: string): string {
  return s.replace(/\\(\d{1,3}|.)/g, (_, g: string) => {
    if (/^\d+$/.test(g)) return String.fromCharCode(parseInt(g, 8));
    return { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[g] ?? g;
  });
}

function ausPdf(daten: Uint8Array): Auszug {
  const seiten = (Buffer.from(daten).toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length;
  const text = aufraeumen(pdfStroeme(daten).map(pdfText).join("\n"));

  if (!lesbar(text)) {
    return {
      ok: false,
      seiten: seiten || undefined,
      grund:
        "Aus dieser PDF-Datei bekomme ich keinen lesbaren Text. Das passiert bei eingescannten " +
        "Seiten — dort ist der Text ein Bild. Füge den Text ein oder lade eine Textfassung hoch.",
    };
  }
  return { ok: true, text, seiten: seiten || undefined };
}

/**
 * Sieht das nach Sprache aus?
 *
 * Die Bremse gegen den schlimmsten Ausgang: eine Zeichenfolge, die
 * aussieht wie Text und keine ist. Aus so etwas würden später
 * Behauptungen über den Werdegang einer Person — erfundene Stationen,
 * erfundene Fähigkeiten.
 *
 * Zwei einfache Merkmale genügen: genug Zeichen überhaupt, und ein
 * vernünftiger Anteil an Buchstaben und Leerzeichen. Echte Texte liegen
 * weit über der Schwelle, Glyphensalat weit darunter.
 */
function lesbar(text: string): boolean {
  if (text.trim().length < 80) return false;
  const zeichen = [...text];
  const gut = zeichen.filter((c) => /[\p{L}\p{N}\s.,;:!?()\-–—/&%€$'"]/u.test(c)).length;
  const anteilGut = gut / zeichen.length;
  const buchstaben = zeichen.filter((c) => /\p{L}/u.test(c)).length / zeichen.length;
  return anteilGut > 0.9 && buchstaben > 0.45;
}

function aufraeumen(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    // Nicht druckbare Zeichen raus, Umbrüche und Tabulatoren behalten.
    .replace(/[^\S\n\t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Einstieg ────────────────────────────────────────────────

export function textAuszug(typ: string, daten: Uint8Array): Auszug {
  switch (typ) {
    case "txt":
      return ausText(daten);
    case "docx":
      return ausDocx(daten);
    case "pdf":
      return ausPdf(daten);
    case "doc":
      return {
        ok: false,
        grund:
          "Das alte DOC-Format kann ich nicht lesen. Speichere die Datei als DOCX oder PDF, " +
          "oder füge den Text ein.",
      };
    case "png":
    case "jpeg":
      return {
        ok: false,
        grund:
          "Aus einem Bild kann ich keinen Text lesen. Wenn es eine abfotografierte Seite ist, " +
          "tippe den Text ab oder lade eine Textfassung hoch.",
      };
    default:
      return { ok: false, grund: "Dieses Format kann ich nicht lesen." };
  }
}
