import type { BoardKind } from "./board.ts";

/**
 * Gehört dieses Board wirklich diesem Arbeitgeber?
 *
 * ── Die Frage, an der alles hängt ─────────────────────────────
 *
 * Arbeitgeberboards antworten jedem, der den Bezeichner errät.
 * `boards.greenhouse.io/muster` gibt Stellen zurück, ob wir dürfen oder
 * nicht. Genau darin liegt die Versuchung: ein Skript, das Firmennamen
 * durchprobiert, baut aus Arbeitgeberboards ein Verzeichnis, das kein
 * Anbieter je angeboten hat — und das wäre Aufzählung fremder Systeme,
 * nicht Nutzung einer Quelle.
 *
 * Die Rechtsgrundlage dieser Quellenart heisst deshalb
 * `employer_authorization`: die Erlaubnis kommt vom Arbeitgeber, nicht
 * vom Bewerbersystem. Nur — wie weist man sie nach, ohne jeden
 * Arbeitgeber anzuschreiben?
 *
 * ── Der Nachweis, den der Arbeitgeber selbst führt ────────────
 *
 * Indem er sein Board auf seiner eigenen Karriereseite verlinkt.
 *
 * Wer auf `muster.de/karriere` einen Link nach
 * `boards.greenhouse.io/muster` setzt, hat öffentlich erklärt: das ist
 * mein Stellenverzeichnis, hier sollen Bewerber hin. Das ist keine
 * Auslegung, sondern eine Veröffentlichung — und sie ist prüfbar,
 * wiederholbar und dokumentierbar.
 *
 * Was hier NICHT passiert: aus einem Firmennamen einen Bezeichner
 * bauen und ausprobieren. Diese Datei prüft eine Behauptung, die
 * jemand aufgestellt hat. Sie sucht keine Boards.
 */

export interface Verifizierung {
  ok: boolean;
  /** Die Seite, auf der der Beleg gefunden wurde. */
  fundstelle: string | null;
  /** Der Satz, der in `authorizationReference` landet. */
  beleg: string;
  /** Warum es nicht gereicht hat. */
  grund: string | null;
}

/** Wo die Boards liegen — dieselben Hosts, die der Abrufpfad benutzt. */
const HOSTS: Record<BoardKind, string[]> = {
  greenhouse: ["boards.greenhouse.io", "job-boards.greenhouse.io", "greenhouse.io"],
  lever: ["jobs.lever.co", "lever.co"],
  ashby: ["jobs.ashbyhq.com", "ashbyhq.com"],
  smartrecruiters: ["careers.smartrecruiters.com", "jobs.smartrecruiters.com", "smartrecruiters.com"],
  recruitee: ["recruitee.com"],
};

/**
 * Wo der Bezeichner im Link steht.
 *
 * ── Warum das eine eigene Tabelle braucht ─────────────────────
 *
 * Vier der fünf Anbieter hängen den Arbeitgeber hinten an:
 *
 *     boards.greenhouse.io/musterfirma
 *                          ^^^^^^^^^^^ erstes Pfadsegment
 *
 * Recruitee stellt ihn davor:
 *
 *     musterfirma.recruitee.com/o/stelle-123
 *     ^^^^^^^^^^^                 Subdomäne
 *
 * Das ist kein Schönheitsunterschied. Der Pfadleser findet auf
 * `musterfirma.recruitee.com/o/…` den Bezeichner `o` — ein Treffer,
 * der nach Verifizierung aussieht und keine ist. Und die Prüfung
 * „steht Host und Bezeichner beieinander?" ginge ins Leere, weil der
 * Bezeichner VOR dem Host steht, nicht dahinter.
 *
 * Deshalb steht die Lage hier ausdrücklich und nicht als Sonderfall
 * in einer Verzweigung: Wer den sechsten Anbieter einträgt, muss sich
 * die Frage stellen.
 */
const BEZEICHNERLAGE: Record<BoardKind, "pfad" | "subdomaene"> = {
  greenhouse: "pfad",
  lever: "pfad",
  ashby: "pfad",
  smartrecruiters: "pfad",
  recruitee: "subdomaene",
};

/** Der Host-Teil eines Musters, für den Einsatz in einem RegExp. */
function hostMuster(h: string): string {
  return h.replace(/\./g, "\\.");
}

/**
 * Das Muster, das „dieser Arbeitgeber verlinkt dieses Board" belegt.
 *
 * Beide Formen verlangen Host UND Bezeichner im selben Vorkommen.
 * Nur der Host reichte nicht — eine Seite kann Recruitee für ein
 * Bewerbungsformular einbinden. Nur der Bezeichner erst recht nicht:
 * er ist meistens der Firmenname und steht überall auf der Seite.
 */
function belegMuster(board: BoardKind, host: string, token: string): RegExp {
  const t = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return BEZEICHNERLAGE[board] === "subdomaene"
    // Der Bezeichner unmittelbar vor dem Host, mit einer Wache davor:
    // ohne sie belegte `muster` auch `nichtmuster.recruitee.com`.
    ? new RegExp(`(?:^|[^a-z0-9.-])${t}\\.${hostMuster(host)}`, "i")
    : new RegExp(`${hostMuster(host)}[/a-z0-9._~-]*\\b${t}\\b`, "i");
}

/** Das Muster, das Bezeichner aus einer Seite LIEST. */
function fundMuster(board: BoardKind, host: string): RegExp {
  return BEZEICHNERLAGE[board] === "subdomaene"
    ? new RegExp(`(?:^|[^a-z0-9.-])([a-z0-9][a-z0-9-]{1,60})\\.${hostMuster(host)}`, "gi")
    : new RegExp(`${hostMuster(host)}/([a-z0-9][a-z0-9._~-]{1,60})`, "gi");
}

/**
 * Wo Karriereseiten üblicherweise liegen.
 *
 * Bewusst kurz und bewusst deutsch/englisch gemischt. Es geht nicht
 * darum, jede denkbare Adresse zu treffen — wer sein Board nirgends
 * verlinkt, soll durch diese Prüfung fallen. Eine lange Liste würde nur
 * die Zahl der Abrufe erhöhen und die Aussage verwässern.
 */
const PFADE = ["", "/karriere", "/jobs", "/careers", "/stellenangebote", "/career", "/jobs/"];

export interface PruefOptionen {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Millisekunden zwischen zwei Seitenabrufen. */
  pauseMs?: number;
}

export async function pruefeArbeitgeberBoard(
  board: BoardKind,
  boardToken: string,
  employerDomain: string,
  o: PruefOptionen = {},
): Promise<Verifizierung> {
  const f = o.fetchImpl ?? fetch;
  const domain = employerDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain.includes(".")) {
    return { ok: false, fundstelle: null, beleg: "", grund: "Keine gültige Domäne angegeben." };
  }

  const hosts = HOSTS[board];
  const token = boardToken.toLowerCase();
  const geprueft: string[] = [];

  for (const pfad of PFADE) {
    const url = `https://${domain}${pfad}`;
    geprueft.push(url);

    const html = await holText(f, url, o.timeoutMs ?? 12_000).catch(() => null);
    if (o.pauseMs) await warte(o.pauseMs);
    if (!html) continue;

    /*
     * Host UND Bezeichner müssen zusammen vorkommen.
     *
     * Nur der Host reichte nicht: eine Seite kann Greenhouse für etwas
     * anderes einbinden. Nur der Bezeichner reichte erst recht nicht —
     * er ist meistens der Firmenname und steht überall.
     */
    const treffer = hosts.find((h) => belegMuster(board, h, token).test(html));

    if (treffer) {
      return {
        ok: true,
        fundstelle: url,
        beleg:
          `Der Arbeitgeber verlinkt sein ${board}-Board (${boardToken}) selbst auf ${url}. ` +
          `Geprüft am ${new Date().toISOString().slice(0, 10)}.`,
        grund: null,
      };
    }
  }

  return {
    ok: false,
    fundstelle: null,
    beleg: "",
    grund:
      `Auf ${geprueft.length} Seiten von ${domain} war kein Verweis auf ${board}/${boardToken} zu finden ` +
      `(${geprueft.slice(0, 4).join(", ")} …). Ohne diesen Verweis gibt es keinen Nachweis, dass der ` +
      `Arbeitgeber dieses Board veröffentlicht hat — und ohne Nachweis wird nichts abgerufen.`,
  };
}

async function holText(f: typeof fetch, url: string, timeoutMs: number): Promise<string | null> {
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), timeoutMs);
  try {
    const r = await f(url, {
      signal: abbruch.signal,
      redirect: "follow",
      headers: {
        // Wir sagen, wer wir sind. Eine Prüfung, die sich als Browser
        // ausgibt, wäre schon der erste Schritt in die falsche Richtung.
        "user-agent": "VelvovaJobs/1.0 (+https://paycheck.example/bot)",
        accept: "text/html",
      },
    });
    if (!r.ok) return null;
    const typ = r.headers.get("content-type") ?? "";
    if (!typ.includes("html")) return null;
    // 500 kB reichen: ein Link zur Karriereseite steht nicht in Zeile 40.000.
    return (await r.text()).slice(0, 500_000);
  } catch {
    return null;
  } finally {
    clearTimeout(uhr);
  }
}

function warte(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}


/**
 * Welches Board verlinkt dieser Arbeitgeber?
 *
 * ── Warum das die bessere Richtung ist ────────────────────────
 *
 * `pruefeArbeitgeberBoard` beantwortet: „stimmt diese Behauptung?" Man
 * muss den Bezeichner also schon kennen — und woher? Im schlechtesten
 * Fall geraten, und genau das soll nicht passieren.
 *
 * Diese Funktion dreht es um: sie liest die Karriereseite und nimmt,
 * was dort steht. Der Bezeichner kommt damit vom Arbeitgeber selbst,
 * nicht von uns. Wer nichts verlinkt, liefert nichts — und das ist die
 * richtige Antwort, keine Lücke.
 *
 * ── Was sie nicht kann ────────────────────────────────────────
 *
 * Karriereseiten, die ihre Inhalte erst im Browser zusammensetzen. Der
 * Link steht dann in keinem HTML, das wir abrufen. Ein Kopf-loser
 * Browser wäre technisch möglich und wäre die falsche Antwort: er
 * würde denselben Nachweis erzwingen, wo der Arbeitgeber ihn nicht
 * öffentlich gemacht hat. In dem Fall bleibt der Weg über eine
 * schriftliche Freigabe — `written_authorization`.
 */
export interface Fund {
  board: BoardKind;
  boardToken: string;
  fundstelle: string;
}

export async function findeArbeitgeberBoards(
  employerDomain: string,
  o: PruefOptionen = {},
): Promise<Fund[]> {
  const f = o.fetchImpl ?? fetch;
  const domain = employerDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain.includes(".")) return [];

  const funde = new Map<string, Fund>();

  for (const pfad of PFADE) {
    const url = `https://${domain}${pfad}`;
    const html = await holText(f, url, o.timeoutMs ?? 12_000).catch(() => null);
    if (o.pauseMs) await warte(o.pauseMs);
    if (!html) continue;

    for (const [board, hosts] of Object.entries(HOSTS) as [BoardKind, string[]][]) {
      for (const h of hosts) {
        /*
         * Der Bezeichner ist das erste Pfadsegment nach dem Host.
         *
         * `boards.greenhouse.io/musterfirma/jobs/123` → `musterfirma`.
         * Segmente wie `embed` oder `job_board.js` sind kein Bezeichner,
         * sondern Einbindungscode — sie fliegen unten raus.
         */
        for (const t of html.matchAll(fundMuster(board, h))) {
          const token = (t[1] ?? "").toLowerCase();
          if (!token || KEIN_BEZEICHNER.has(token)) continue;
          const schluessel = `${board}:${token}`;
          if (!funde.has(schluessel)) funde.set(schluessel, { board, boardToken: token, fundstelle: url });
        }
      }
    }
    // Ein Fund genügt; weitere Seiten kosten nur fremde Bandbreite.
    if (funde.size > 0) break;
  }

  return [...funde.values()];
}

/** Pfadsegmente, die technisch sind und kein Arbeitgeber-Bezeichner. */
const KEIN_BEZEICHNER = new Set([
  "embed",
  "assets",
  "static",
  "js",
  "css",
  "images",
  "img",
  "api",
  "v1",
  "v0",
  "boards",
  "jobs",
  "job",
  "postings",
  "companies",
  "job_board.js",
  "job_board",
  /*
   * Die folgenden gelten der Subdomänen-Form.
   *
   * `www.recruitee.com` und `help.recruitee.com` sind Seiten des
   * ANBIETERS, keine Arbeitgeberboards. Ohne diese Einträge würde
   * jede Seite, die auf Recruitees eigene Hilfe verlinkt, als
   * Arbeitgeber „www" registriert.
   */
  "www",
  "careers",
  "help",
  "support",
  "blog",
  "app",
  "status",
  "docs",
]);
