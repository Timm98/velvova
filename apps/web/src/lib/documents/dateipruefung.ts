/**
 * Ist diese Datei das, was sie zu sein behauptet?
 *
 * Der `Content-Type` eines Uploads kommt vom Absender. Er ist eine
 * Behauptung, kein Befund — jeder kann `application/pdf` daraufschreiben
 * und etwas ganz anderes schicken. Wer nur darauf prüft, prüft die
 * Höflichkeit des Angreifers.
 *
 * Die ersten Bytes einer Datei dagegen stehen im Format selbst. Ein PDF
 * beginnt mit `%PDF-`, ein DOCX ist ein ZIP und beginnt mit `PK`, ein
 * PNG trägt eine achtstellige Signatur. Diese Bytes lügen nicht, weil
 * das Leseprogramm am anderen Ende genau sie erwartet.
 *
 * Drei Dinge werden geprüft, und alle drei müssen stimmen:
 *
 *   1. Der behauptete Typ steht auf der Liste.
 *   2. Die ersten Bytes passen zu diesem Typ.
 *   3. Die Datei ist nicht grösser als erlaubt.
 *
 * Was hier NICHT passiert: ein Virenscan. Signaturen zu prüfen sagt
 * „das ist wirklich ein PDF", nicht „dieses PDF ist harmlos". Ein PDF
 * mit eingebettetem JavaScript ist ein gültiges PDF. Deshalb wird die
 * Datei nie ausgeführt, nie im Browser gerendert und nur serverseitig
 * als Text gelesen — und deshalb steht `scanning` als eigener Schritt
 * im Verarbeitungszustand, für den Tag, an dem ein echter Scanner
 * dazukommt.
 */

export type Dateityp = "pdf" | "docx" | "doc" | "txt" | "png" | "jpeg";

interface Signatur {
  typ: Dateityp;
  mimes: string[];
  /** Die erwarteten ersten Bytes. Leer heisst: dieses Format hat keine. */
  bytes: number[];
  endung: string[];
}

const SIGNATUREN: Signatur[] = [
  { typ: "pdf", mimes: ["application/pdf"], bytes: [0x25, 0x50, 0x44, 0x46, 0x2d], endung: [".pdf"] },
  {
    typ: "docx",
    mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    // DOCX ist ein ZIP-Archiv. „PK" sind die Initialen von Phil Katz,
    // der das Format erfunden hat — sie stehen seit 1989 in jeder
    // ZIP-Datei.
    bytes: [0x50, 0x4b, 0x03, 0x04],
    endung: [".docx"],
  },
  {
    typ: "doc",
    mimes: ["application/msword"],
    // Das alte OLE2-Format. Compound File Binary, Signatur seit Word 97.
    bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    endung: [".doc"],
  },
  { typ: "png", mimes: ["image/png"], bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], endung: [".png"] },
  { typ: "jpeg", mimes: ["image/jpeg"], bytes: [0xff, 0xd8, 0xff], endung: [".jpg", ".jpeg"] },
  /*
   * Text hat keine Signatur — jede Bytefolge kann Text sein.
   *
   * Deshalb wird hier andersherum geprüft: NICHT ob es wie Text
   * aussieht, sondern ob es wie etwas anderes aussieht. Eine Datei, die
   * als `text/plain` ankommt und mit `%PDF-` beginnt, ist kein Text —
   * und sie ist auch kein harmloser Irrtum.
   */
  { typ: "txt", mimes: ["text/plain"], bytes: [], endung: [".txt", ".md"] },
];

export const MAX_BYTES = 20 * 1024 * 1024;

export interface Pruefergebnis {
  ok: boolean;
  typ?: Dateityp;
  /** Was der Person gesagt wird. Ohne Fachwort, ohne Schuldzuweisung. */
  grund?: string;
  /** Für das Protokoll. Nie an den Browser. */
  intern?: string;
}

function beginntMit(daten: Uint8Array, bytes: number[]): boolean {
  if (daten.length < bytes.length) return false;
  return bytes.every((b, i) => daten[i] === b);
}

export function pruefeDatei(
  behaupteterMime: string,
  dateiname: string,
  daten: Uint8Array,
): Pruefergebnis {
  if (daten.length === 0) {
    return { ok: false, grund: "Die Datei ist leer." };
  }
  if (daten.length > MAX_BYTES) {
    return {
      ok: false,
      grund: `Die Datei ist zu gross (${Math.round(daten.length / 1024 / 1024)} MB). Höchstens 20 MB.`,
    };
  }

  const mime = behaupteterMime.split(";")[0]!.trim().toLowerCase();
  const eintrag = SIGNATUREN.find((s) => s.mimes.includes(mime));

  if (!eintrag) {
    return {
      ok: false,
      grund: "Diesen Dateityp nehme ich nicht an. Möglich sind PDF, DOCX, DOC, TXT, PNG und JPEG.",
      intern: `abgelehnter mime: ${mime}`,
    };
  }

  /*
   * Der Name ist der schwächste Hinweis und wird trotzdem geprüft.
   *
   * Nicht als Sicherheitsmassnahme — eine Endung lässt sich ändern —,
   * sondern weil ein Widerspruch zwischen Endung, Typ und Inhalt fast
   * immer ein Versehen der Person ist und nicht ein Angriff. Ihr das zu
   * sagen ist hilfreicher, als die Datei stumm anzunehmen.
   */
  const endung = dateiname.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
  const endungPasst = endung === "" || eintrag.endung.includes(endung);

  if (eintrag.bytes.length > 0) {
    if (!beginntMit(daten, eintrag.bytes)) {
      return {
        ok: false,
        grund:
          `Die Datei ist als ${eintrag.typ.toUpperCase()} gekennzeichnet, sieht innen aber nicht so aus. ` +
          "Lade sie noch einmal hoch oder speichere sie neu.",
        intern: `signatur passt nicht: erwartet ${eintrag.typ}, erste bytes ${[...daten.slice(0, 8)].map((b) => b.toString(16)).join(" ")}`,
      };
    }
  } else {
    // Textfall: umgekehrt prüfen — sieht es wie ein anderes Format aus?
    const verkleidet = SIGNATUREN.find(
      (s) => s.bytes.length > 0 && beginntMit(daten, s.bytes),
    );
    if (verkleidet) {
      return {
        ok: false,
        grund: `Das ist als Textdatei gekennzeichnet, innen steht aber ein ${verkleidet.typ.toUpperCase()}.`,
        intern: `als text/plain deklariert, signatur ${verkleidet.typ}`,
      };
    }
    /*
     * Steuerzeichen deuten auf eine Binärdatei ohne bekannte Signatur.
     *
     * Zeilenumbruch, Wagenrücklauf und Tabulator sind erlaubt — alles
     * andere unter 0x20 gehört nicht in einen Anzeigentext. Geprüft
     * werden die ersten viertausend Bytes; wer dort sauber ist, ist es
     * fast immer auch danach.
     */
    const probe = daten.slice(0, 4096);
    const steuerzeichen = [...probe].filter(
      (b) => b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d,
    ).length;
    if (steuerzeichen > 0) {
      return {
        ok: false,
        grund: "Das sieht nicht nach einer Textdatei aus.",
        intern: `${steuerzeichen} steuerzeichen in den ersten 4096 bytes`,
      };
    }
  }

  if (!endungPasst) {
    return {
      ok: false,
      grund: `Der Dateiname endet auf ${endung}, der Inhalt ist aber ein ${eintrag.typ.toUpperCase()}. Benenne die Datei um oder speichere sie neu.`,
      intern: `endung ${endung} passt nicht zu ${eintrag.typ}`,
    };
  }

  return { ok: true, typ: eintrag.typ };
}
