import { lookup } from "node:dns/promises";
import {
  KEINE_REGELN,
  Taktgeber,
  adressePruefen,
  darfAbrufen,
  robotsLesen,
  wartezeitMs,
  type Abrufverbot,
  type Robotsregeln,
} from "./abrufregeln.ts";
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
  | {
      ok: true;
      /** Der lesbare Text, gekennzeichnet als Text von Fremden. */
      inhalt: Fremdinhalt;
      /**
       * Das rohe HTML — ausschliesslich für STRUKTUR.
       *
       * Verweise und `mailto:`-Adressen stecken in den Tags und
       * überleben `htmlZuText` nicht. Deshalb kommt es mit.
       *
       * ── Was damit nicht geschehen darf ─────────────────────────
       *
       * Es darf nie in einen Modellkontext. Dafür ist `inhalt` da,
       * und nur der trägt die Kennzeichnung, ohne die ein Satz auf
       * der Seite zur Anweisung wird. Wer HTML an ein Modell gibt,
       * gibt ihm zusätzlich alles, was in Attributen und
       * ausgeblendeten Elementen steht.
       */
      rohHtml: string;
      endgueltigeUrl: string;
      status: number;
    }
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
  /** Warten. In Tests eine leere Zusage, damit sie nicht real warten. */
  warte?: (ms: number) => Promise<void>;
  /**
   * robots.txt ausser Kraft setzen — ausschliesslich für Tests.
   *
   * Es gibt keinen Betriebsfall dafür. Wer eine Sperre umgeht, tut es
   * gegen den ausdrücklichen Willen eines Betreibers, und dieser Wille
   * ist der ganze Sinn der Datei.
   */
  robotsIgnorieren?: boolean;
}

/*
 * ══════════════════════════════════════════════════════════════════
 * Die Höflichkeitsschicht — jetzt tatsächlich angeschlossen
 * ══════════════════════════════════════════════════════════════════
 *
 * `abrufregeln.ts` konnte robots.txt lesen und den Takt halten, seit
 * dem ersten Tag. Nur rief es niemand auf: `seiteHolen` holte die
 * Seite und fragte nicht. Die Fehlerart `robots` stand im Typ und
 * wurde nie erzeugt.
 *
 * Das ist die Sorte Fehler, die man nicht sieht — es funktioniert ja
 * alles, nur eben unhöflich. Aufgefallen ist es beim Blick darauf, ob
 * man den Abruf auf ein echtes Landratsamt richten darf.
 *
 * Beides steht prozessweit, nicht je Aufruf: Eine Wartezeit, die bei
 * jedem Abruf neu beginnt, ist keine.
 */
const robotsJeHost = new Map<string, Robotsregeln>();
let takt = new Taktgeber();

/**
 * Beides zurücksetzen — für Tests und einen Neustart im laufenden Prozess.
 *
 * BEIDES. Die erste Fassung leerte nur die Regeln und liess den Takt
 * stehen; danach wartete der erste Abruf eines Tests auf einen
 * Zeitpunkt, den ein anderer Test gesetzt hatte. Ein Speicher, der
 * halb geleert wird, ist schlimmer als keiner: Er sieht sauber aus.
 */
export function abrufspeicherLeeren(): void {
  robotsJeHost.clear();
  takt = new Taktgeber();
}

async function regelnFuer(
  url: URL,
  holen: typeof fetch,
  aufloesen: (n: string) => Promise<string[]>,
): Promise<Robotsregeln> {
  const bekannt = robotsJeHost.get(url.host);
  if (bekannt) return bekannt;

  let regeln = KEINE_REGELN;
  try {
    /*
     * robots.txt selbst wird nicht von robots.txt geregelt — das wäre
     * zirkulär. Die Adressprüfung gilt trotzdem: Auch diese Datei
     * könnte hinter einer Weiterleitung nach innen zeigen.
     */
    const ziel = `${url.origin}/robots.txt`;
    if (adressePruefen(ziel).erlaubt && (await aufloesungIstSicher(url.hostname, aufloesen))) {
      const antwort = await holen(ziel, {
        redirect: "follow",
        signal: AbortSignal.timeout(8_000),
        headers: { "user-agent": KENNUNG, accept: "text/plain" },
      });
      if (antwort.ok) {
        /*
         * Höchstens 512 KB. Eine robots.txt, die grösser ist, ist
         * keine — und sie ungelesen zu lassen ist besser, als den
         * Speicher eines Servers an sie zu hängen.
         */
        const text = (await antwort.text()).slice(0, 512 * 1024);
        regeln = robotsLesen(text, KENNUNG);
      }
      /*
       * Ein 404 heisst: keine Regeln. Das ist die Auslegung des
       * Verfahrens und nicht Bequemlichkeit — wer keine Datei
       * hinterlegt, hat nichts verboten.
       */
    }
  } catch {
    /* Nicht erreichbar heisst nicht verboten. Aber auch nicht erlaubt,
       schneller zu sein: die Standardwartezeit gilt weiter. */
  }

  robotsJeHost.set(url.host, regeln);
  return regeln;
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
  const warte =
    werkzeuge.warte ?? ((ms: number) => new Promise<void>((w) => setTimeout(w, ms)));

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

    /*
     * Erst fragen, dann holen.
     *
     * In dieser Reihenfolge, und nicht andersherum: Eine Seite, die
     * wir nicht abrufen dürfen, darf auch nicht abgerufen werden, um
     * festzustellen, dass wir sie nicht abrufen dürfen.
     */
    if (!werkzeuge.robotsIgnorieren) {
      const regeln = await regelnFuer(url, holen, aufloesen);
      if (!darfAbrufen(url.pathname, regeln)) {
        return {
          ok: false,
          grund: "robots",
          nachricht: `robots.txt von ${url.host} verbietet ${url.pathname}.`,
        };
      }

      /*
       * Der Takt gilt je Server, über alle Abrufe hinweg.
       *
       * Zwanzig Arbeitgeber nacheinander sind kein Problem; zwanzig
       * Seiten desselben Arbeitgebers in zwei Sekunden sind eine
       * Belastung, die er nicht bestellt hat.
       */
      const wartezeit = wartezeitMs(regeln);
      const rest = takt.wartetNoch(url.host, wartezeit);
      if (rest > 0) await warte(rest);
      takt.vermerkeAbruf(url.host);
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
      rohHtml: roh,
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
