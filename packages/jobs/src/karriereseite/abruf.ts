import { lookup } from "node:dns/promises";
import { adressePruefen, type Abrufverbot } from "./abrufregeln.ts";
import { fremdinhalt, htmlZuText, type Fremdinhalt } from "./fremdinhalt.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Der Abruf
 * ══════════════════════════════════════════════════════════════════
 *
 * `abrufregeln.ts` sagt, ob eine Adresse erlaubt ist.
 * `fremdinhalt.ts` sagt, wie mit dem Ergebnis umzugehen ist. Diese
 * Datei liegt dazwischen und macht die Dinge, die man beim Abrufen
 * fremder Seiten vergisst.
 *
 * ── Die Weiterleitung ist der eigentliche Angriff ───────────────
 *
 * `fetch` folgt Weiterleitungen von selbst. Damit ist jede Prüfung
 * der Adresse wirkungslos: `https://karriere.example/` darf abgerufen
 * werden, antwortet mit `302 → http://169.254.169.254/`, und der
 * eingebaute Folger geht dorthin, ohne jemanden zu fragen.
 *
 * Deshalb `redirect: "manual"` und jede Station einzeln geprüft. Das
 * ist der Grund, warum diese Datei überhaupt eine Schleife hat.
 *
 * ── Die Auflösung ist der zweite ────────────────────────────────
 *
 * Die Adressprüfung sieht den Namen, nicht die Adresse dahinter.
 * `karriere.example.com` kann auf 127.0.0.1 zeigen. Deshalb wird der
 * Name aufgelöst und JEDE zurückgegebene Adresse geprüft.
 *
 * Ehrlich: Auch das ist nicht vollständig. Zwischen unserer Auflösung
 * und der des Netzwerkstapels liegt ein Moment, in dem sich die
 * Antwort ändern kann. Dagegen hilft nur eine Sperre am Netzübergang,
 * und die gehört in den Betrieb, nicht in diese Datei. Was hier steht,
 * schliesst den Fall, der ohne Aufwand ausnutzbar ist.
 */

export type Abrufergebnis =
  | { ok: true; inhalt: Fremdinhalt; endgueltigeUrl: string; status: number }
  | { ok: false; grund: Abruffehler; nachricht: string };

export type Abruffehler =
  | Abrufverbot
  | "robots"
  | "zu_gross"
  | "falscher_typ"
  | "zu_viele_weiterleitungen"
  | "netzfehler"
  | "status";

/** Zwei Megabyte. Eine Karriereseite, die mehr braucht, ist keine. */
export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_WEITERLEITUNGEN = 5;
export const FRIST_MS = 15_000;

/**
 * Wie wir uns vorstellen.
 *
 * Mit Namen und Adresse, unter der man uns erreicht. Ein Betreiber,
 * dem der Abruf nicht passt, soll uns aussperren können, ohne uns
 * suchen zu müssen — das ist der Sinn dieser Zeile und der Grund,
 * warum sie nicht nach einem Browser aussieht.
 */
export const KENNUNG = "VelvovaBot/1.0 (+https://velvova.com/bot)";

/** Zum Einhängen in Tests. Standardmässig das echte Netz. */
export interface Abrufwerkzeuge {
  holen?: typeof fetch;
  aufloesen?: (name: string) => Promise<string[]>;
  jetzt?: () => Date;
}

async function echteAufloesung(name: string): Promise<string[]> {
  const treffer = await lookup(name, { all: true });
  return treffer.map((t) => t.address);
}

/**
 * Zeigt dieser Name nach innen, wenn man ihn auflöst?
 *
 * Geprüft wird JEDE zurückgegebene Adresse, nicht die erste. Ein Name
 * mit zwei A-Einträgen — einer öffentlich, einer auf 127.0.0.1 —
 * liefert sie in wechselnder Reihenfolge, und eine Prüfung der ersten
 * wäre eine Prüfung, die manchmal stimmt.
 */
async function aufloesungIstSicher(
  hostname: string,
  aufloesen: (name: string) => Promise<string[]>,
): Promise<boolean> {
  let adressen: string[];
  try {
    adressen = await aufloesen(hostname);
  } catch {
    /* Kein Name, kein Abruf. Der Fehler kommt gleich beim Holen. */
    return true;
  }
  return adressen.every((a) => {
    /* Über dieselbe Prüfung wie eine eingetippte Adresse — eine zweite
       Liste privater Bereiche liefe irgendwann auseinander. */
    const klammer = a.includes(":") ? `[${a}]` : a;
    return adressePruefen(`http://${klammer}/`).erlaubt;
  });
}

/**
 * Eine Seite holen.
 *
 * Prüft die Adresse, folgt Weiterleitungen selbst und einzeln,
 * begrenzt Grösse und Zeit, und gibt den Inhalt als gekennzeichneten
 * Fremdtext zurück — nie als blosse Zeichenkette.
 */
export async function seiteHolen(
  adresse: string,
  werkzeuge: Abrufwerkzeuge = {},
): Promise<Abrufergebnis> {
  const holen = werkzeuge.holen ?? fetch;
  const aufloesen = werkzeuge.aufloesen ?? echteAufloesung;
  const jetzt = werkzeuge.jetzt ?? (() => new Date());

  let ziel = adresse;

  for (let sprung = 0; sprung <= MAX_WEITERLEITUNGEN; sprung += 1) {
    const urteil = adressePruefen(ziel);
    if (!urteil.erlaubt || !urteil.adresse) {
      return {
        ok: false,
        grund: urteil.grund ?? "kein_hostname",
        nachricht: `Diese Adresse wird nicht abgerufen (${urteil.grund}).`,
      };
    }
    ziel = urteil.adresse;
    const url = new URL(ziel);

    if (!(await aufloesungIstSicher(url.hostname, aufloesen))) {
      return {
        ok: false,
        grund: "zeigt_nach_innen",
        nachricht: "Der Name löst auf eine interne Adresse auf.",
      };
    }

    let antwort: Response;
    try {
      antwort = await holen(ziel, {
        redirect: "manual",
        signal: AbortSignal.timeout(FRIST_MS),
        headers: {
          "user-agent": KENNUNG,
          accept: "text/html,application/xhtml+xml",
          /*
           * Kein Cookie, kein Referer.
           *
           * Wir sind kein Browser und sollen keiner sein. Ein Referer
           * verriete, von welcher unserer Seiten der Abruf ausging.
           */
        },
      });
    } catch (fehler) {
      return {
        ok: false,
        grund: "netzfehler",
        nachricht: fehler instanceof Error ? fehler.message : String(fehler),
      };
    }

    /* Weiterleitung: nächste Runde, mit voller Prüfung. */
    if (antwort.status >= 300 && antwort.status < 400) {
      const nach = antwort.headers.get("location");
      if (!nach) {
        return { ok: false, grund: "status", nachricht: `Weiterleitung ohne Ziel (${antwort.status}).` };
      }
      ziel = new URL(nach, ziel).toString();
      continue;
    }

    if (!antwort.ok) {
      return { ok: false, grund: "status", nachricht: `Die Seite antwortete mit ${antwort.status}.` };
    }

    const typ = antwort.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml|text\/plain/i.test(typ)) {
      /*
       * Ein PDF oder Bild wäre kein Fehler der Seite — aber wir lesen
       * hier Text und würden sonst Binärdaten in einen Modellkontext
       * geben.
       */
      return { ok: false, grund: "falscher_typ", nachricht: `Kein lesbarer Text (${typ || "ohne Angabe"}).` };
    }

    /*
     * Die angekündigte Grösse prüfen — und die tatsächliche.
     *
     * `content-length` kann fehlen oder lügen. Deshalb wird beim Lesen
     * mitgezählt und abgebrochen, statt dem Kopf zu glauben.
     */
    const angekuendigt = Number(antwort.headers.get("content-length") ?? "0");
    if (angekuendigt > MAX_BYTES) {
      return { ok: false, grund: "zu_gross", nachricht: `Die Seite ist ${angekuendigt} Byte gross.` };
    }

    const roh = await mitGrenzeLesen(antwort, MAX_BYTES);
    if (roh === null) {
      return { ok: false, grund: "zu_gross", nachricht: `Die Seite ist grösser als ${MAX_BYTES} Byte.` };
    }

    return {
      ok: true,
      status: antwort.status,
      endgueltigeUrl: ziel,
      inhalt: fremdinhalt(ziel, htmlZuText(roh), jetzt()),
    };
  }

  return {
    ok: false,
    grund: "zu_viele_weiterleitungen",
    nachricht: `Mehr als ${MAX_WEITERLEITUNGEN} Weiterleitungen.`,
  };
}

/** Liest bis zur Grenze und gibt `null` zurück, wenn sie überschritten wird. */
async function mitGrenzeLesen(antwort: Response, grenze: number): Promise<string | null> {
  const leser = antwort.body?.getReader();
  if (!leser) return await antwort.text();

  const dekoder = new TextDecoder();
  let gelesen = 0;
  let text = "";

  while (true) {
    const { done, value } = await leser.read();
    if (done) break;
    gelesen += value.byteLength;
    if (gelesen > grenze) {
      /* Nicht weiterlesen — und die Verbindung schliessen, damit die
         Gegenseite nicht weiter sendet. */
      await leser.cancel().catch(() => {});
      return null;
    }
    text += dekoder.decode(value, { stream: true });
  }
  return text + dekoder.decode();
}
