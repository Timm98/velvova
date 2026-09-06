import { describe, expect, it } from "vitest";
import { deflateRawSync, deflateSync } from "node:zlib";
import { textAuszug } from "./textauszug.ts";

/**
 * Aus einer Datei Text machen — und wissen, wann es nicht geht.
 *
 * Der wichtigste Test ist der über das eingescannte PDF: eine Datei, aus
 * der nur Zeichensalat kommt, muss als „nicht lesbar" durchfallen. Aus
 * diesem Text entstehen später Behauptungen über den Werdegang einer
 * Person; eine Zeichenfolge, die aussieht wie Sprache und keine ist,
 * würde zu erfundenen Stationen führen.
 */

/** Ein minimales, gültiges DOCX bauen — ZIP mit word/document.xml. */
function docx(text: string): Uint8Array {
  const name = "word/document.xml";
  const absaetze = text
    .split("\n")
    .map((z) => `<w:p><w:r><w:t>${z}</w:t></w:r></w:p>`)
    .join("");
  const xml = Buffer.from(
    `<?xml version="1.0"?><w:document><w:body>${absaetze}</w:body></w:document>`,
    "utf8",
  );
  const komprimiert = deflateRawSync(xml);
  const nameBuf = Buffer.from(name, "utf8");

  const lokal = Buffer.alloc(30);
  lokal.writeUInt32LE(0x04034b50, 0);
  lokal.writeUInt16LE(20, 4);
  lokal.writeUInt16LE(8, 8); // deflate
  lokal.writeUInt32LE(0, 14);
  lokal.writeUInt32LE(komprimiert.length, 18);
  lokal.writeUInt32LE(xml.length, 22);
  lokal.writeUInt16LE(nameBuf.length, 26);

  const zentral = Buffer.alloc(46);
  zentral.writeUInt32LE(0x02014b50, 0);
  zentral.writeUInt16LE(20, 6);
  zentral.writeUInt16LE(8, 10);
  zentral.writeUInt32LE(komprimiert.length, 20);
  zentral.writeUInt32LE(xml.length, 24);
  zentral.writeUInt16LE(nameBuf.length, 28);
  zentral.writeUInt32LE(0, 42); // Versatz des lokalen Kopfes

  const eocdVersatz = lokal.length + nameBuf.length + komprimiert.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(zentral.length + nameBuf.length, 12);
  eocd.writeUInt32LE(eocdVersatz, 16);

  return new Uint8Array(Buffer.concat([lokal, nameBuf, komprimiert, zentral, nameBuf, eocd]));
}

/** Ein minimales PDF mit einem komprimierten Textstrom. */
function pdf(zeilen: string[]): Uint8Array {
  const inhalt = zeilen.map((z) => `BT (${z}) Tj ET`).join("\n");
  const strom = deflateSync(Buffer.from(inhalt, "latin1"));
  const kopf = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n2 0 obj\n" +
      `<< /Filter /FlateDecode /Length ${strom.length} >>\nstream\n`,
    "latin1",
  );
  const fuss = Buffer.from("\nendstream\nendobj\n%%EOF", "latin1");
  return new Uint8Array(Buffer.concat([kopf, strom, fuss]));
}

const LEBENSLAUF = [
  "Lebenslauf von Beispielperson",
  "Berufserfahrung: Disposition bei einer Spedition, 2019 bis 2022.",
  "Aufgaben waren Tourenplanung, Kundenkontakt und Reklamationen.",
  "Kenntnisse: Excel, SAP, Englisch in Wort und Schrift.",
];

describe("Text", () => {
  it("liest eine Textdatei", () => {
    const r = textAuszug("txt", new TextEncoder().encode(LEBENSLAUF.join("\n")));
    expect(r.ok).toBe(true);
    expect(r.text).toContain("Disposition");
  });

  it("meldet eine leere Datei", () => {
    expect(textAuszug("txt", new TextEncoder().encode("   \n\n")).ok).toBe(false);
  });
});

describe("DOCX", () => {
  it("liest Text aus einem echten ZIP-Archiv", () => {
    const r = textAuszug("docx", docx(LEBENSLAUF.join("\n")));
    expect(r.ok).toBe(true);
    expect(r.text).toContain("Tourenplanung");
  });

  it("erhält die Absatzstruktur", () => {
    /*
     * Bei einem Lebenslauf ist Struktur die halbe Information. Ohne
     * Umbrüche wird „Müller GmbH 2019 bis 2022 Disposition" zu einem
     * Satz, und die Zuordnung von Station zu Zeitraum geht verloren.
     */
    const r = textAuszug("docx", docx("Erste Zeile\nZweite Zeile"));
    expect(r.text).toBe("Erste Zeile\nZweite Zeile");
  });

  it("meldet ein kaputtes Archiv, statt zu raten", () => {
    const r = textAuszug("docx", new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]));
    expect(r.ok).toBe(false);
    expect(r.grund).toBeDefined();
  });
});

describe("PDF", () => {
  it("liest Text aus einem komprimierten Inhaltsstrom", () => {
    const r = textAuszug("pdf", pdf(LEBENSLAUF));
    expect(r.ok).toBe(true);
    expect(r.text).toContain("Disposition");
    expect(r.text).toContain("Excel");
  });

  it("zählt die Seiten", () => {
    expect(textAuszug("pdf", pdf(LEBENSLAUF)).seiten).toBe(1);
  });

  it("meldet ein eingescanntes PDF als nicht lesbar", () => {
    /*
     * Die Bremse.
     *
     * Ein Scan enthält keinen Text, sondern ein Bild. Was die
     * Stromsuche dort findet, ist Zeichensalat — und der darf niemals
     * als Lebenslauftext durchgehen. Lieber „kann ich nicht lesen" als
     * eine erfundene Biografie.
     */
    const salat = pdf([
      "¾¿ÀÁÂ ¶·¸¹ ÃÄÅ",
      "ÆÇÈÉÊ ËÌÍÎÏ ÐÑÒÓ",
    ]);
    const r = textAuszug("pdf", salat);
    expect(r.ok).toBe(false);
    expect(r.grund).toMatch(/eingescannt/i);
  });

  it("hält einen zu kurzen Auszug für nicht lesbar", () => {
    // Drei Wörter aus einem mehrseitigen PDF heissen: es hat nicht
    // geklappt, nicht „das Dokument ist kurz".
    expect(textAuszug("pdf", pdf(["Hallo Welt"])).ok).toBe(false);
  });
});

describe("Was nicht geht, sagt es", () => {
  it("nennt DOC beim Namen", () => {
    const r = textAuszug("doc", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]));
    expect(r.ok).toBe(false);
    expect(r.grund).toMatch(/DOCX|PDF/);
  });

  it("erklärt bei Bildern, warum nicht", () => {
    const r = textAuszug("png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    expect(r.ok).toBe(false);
    expect(r.grund).toMatch(/Bild/);
  });
});
