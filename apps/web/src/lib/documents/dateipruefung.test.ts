import { describe, expect, it } from "vitest";
import { pruefeDatei, MAX_BYTES } from "./dateipruefung.ts";

/**
 * Die Prüfung, die zwischen einem Lebenslauf und einem Angriff steht.
 *
 * Der `Content-Type` kommt vom Absender und ist eine Behauptung. Diese
 * Tests prüfen vor allem eines: dass eine Lüge darin auffällt.
 */

const b = (...bytes: number[]) => new Uint8Array([...bytes, ...new Array(64).fill(0x41)]);
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const DOCX = [0x50, 0x4b, 0x03, 0x04];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const text = (s: string) => new TextEncoder().encode(s);

describe("Echte Dateien", () => {
  it("nimmt ein PDF an", () => {
    expect(pruefeDatei("application/pdf", "lebenslauf.pdf", b(...PDF))).toMatchObject({
      ok: true,
      typ: "pdf",
    });
  });

  it("nimmt ein DOCX an", () => {
    expect(pruefeDatei(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "anschreiben.docx",
      b(...DOCX),
    )).toMatchObject({ ok: true, typ: "docx" });
  });

  it("nimmt Bilder an", () => {
    expect(pruefeDatei("image/png", "zeugnis.png", b(...PNG)).ok).toBe(true);
    expect(pruefeDatei("image/jpeg", "zeugnis.jpg", b(...JPEG)).ok).toBe(true);
  });

  it("nimmt echten Text an", () => {
    const r = pruefeDatei("text/plain", "anzeige.txt", text("Wir suchen eine Fachkraft.\nAufgaben:\n- Disposition\n"));
    expect(r).toMatchObject({ ok: true, typ: "txt" });
  });

  it("nimmt eine Datei ohne Endung an, wenn der Inhalt stimmt", () => {
    // Eine fehlende Endung ist kein Verdacht — manche Systeme geben
    // keine mit. Der Inhalt entscheidet.
    expect(pruefeDatei("application/pdf", "lebenslauf", b(...PDF)).ok).toBe(true);
  });
});

describe("Verkleidete Dateien", () => {
  it("erkennt ein PDF, das als Text ankommt", () => {
    /*
     * Der Fall, um den es geht.
     *
     * Wer eine Prüfung nur auf `Content-Type` baut, nimmt hier klaglos
     * an — und liest danach eine Binärdatei als Anzeigentext ein.
     */
    const r = pruefeDatei("text/plain", "anzeige.txt", b(...PDF));
    expect(r.ok).toBe(false);
    expect(r.grund).toMatch(/PDF/);
  });

  it("erkennt ein ZIP, das als PDF ankommt", () => {
    const r = pruefeDatei("application/pdf", "lebenslauf.pdf", b(...DOCX));
    expect(r.ok).toBe(false);
    expect(r.grund).toMatch(/sieht innen aber nicht so aus/);
  });

  it("lehnt eine Binärdatei ohne bekannte Signatur als Text ab", () => {
    const r = pruefeDatei("text/plain", "x.txt", new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]));
    expect(r.ok).toBe(false);
  });

  it("lehnt einen nicht erlaubten Typ ab", () => {
    for (const mime of ["application/x-msdownload", "text/html", "application/zip", "image/svg+xml"]) {
      expect(pruefeDatei(mime, "datei", b(0x41)).ok, mime).toBe(false);
    }
  });

  it("meldet einen Widerspruch zwischen Endung und Inhalt", () => {
    // Kein Angriff, meistens ein Versehen — aber eines, das man sagen
    // sollte, statt die Datei stumm anzunehmen.
    const r = pruefeDatei("application/pdf", "lebenslauf.docx", b(...PDF));
    expect(r.ok).toBe(false);
    expect(r.grund).toMatch(/\.docx/);
  });
});

describe("Grenzen", () => {
  it("lehnt eine leere Datei ab", () => {
    expect(pruefeDatei("application/pdf", "leer.pdf", new Uint8Array(0)).ok).toBe(false);
  });

  it("lehnt eine zu grosse Datei ab", () => {
    const gross = new Uint8Array(MAX_BYTES + 1);
    gross.set(PDF);
    expect(pruefeDatei("application/pdf", "gross.pdf", gross).ok).toBe(false);
  });

  it("verrät im Grund keine internen Angaben", () => {
    /*
     * Die Fehlermeldung geht an den Browser. Bytefolgen und
     * Signaturnamen gehören ins Protokoll, nicht dorthin — sie helfen
     * nur jemandem, der die Prüfung umgehen will.
     */
    const r = pruefeDatei("text/plain", "x.txt", b(...PDF));
    expect(r.grund).toBeDefined();
    expect(r.grund).not.toMatch(/0x|byte|signatur/i);
    expect(r.intern).toBeDefined();
  });

  it("lässt sich nicht durch Parameter im Content-Type täuschen", () => {
    expect(pruefeDatei("application/pdf; charset=utf-8", "l.pdf", b(...PDF)).ok).toBe(true);
    expect(pruefeDatei("APPLICATION/PDF", "l.pdf", b(...PDF)).ok).toBe(true);
  });
});
