/**
 * robots.txt lesen und befolgen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das hier steht
 * ══════════════════════════════════════════════════════════════
 *
 * Beim Anzeigenimport entscheidet eine Erlaubnisliste, welche Seiten
 * abgerufen werden dürfen — dort ist die Menge der Quellen bekannt.
 * Hier ist sie es nicht: Die Adresse kommt vom Arbeitgeber und zeigt
 * auf irgendeine Website.
 *
 * Dann ist robots.txt die Schranke. Sie zu übergehen wäre auch dann
 * nicht in Ordnung, wenn der Abruf technisch gelänge und die Seite
 * dem Menschen gehört, der sie eingibt: Die Datei richtet sich an
 * Maschinen, und dieses Programm ist eine.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Fehler beim Abruf „erlaubt“ heisst
 * ══════════════════════════════════════════════════════════════
 *
 * Eine fehlende robots.txt bedeutet nach der Vereinbarung: keine
 * Einschränkung. Ein Zeitfehler beim Abruf ist davon nicht zu
 * unterscheiden — und eine Website, deren robots.txt gerade nicht
 * antwortet, ganz zu sperren hiesse, aus einer Störung ein Verbot zu
 * machen. Ein 5xx ist etwas anderes: Da antwortet der Server und sagt,
 * dass er es gerade nicht kann. Das wird als Sperre gewertet.
 */

export const AGENT = "VelvovaOnboarding";

export type RobotsUrteil = {
  erlaubt: boolean;
  /** Warum nicht — für den Menschen, ohne Fachwort. */
  grund?: string;
};

type Regel = { pfad: string; erlaubt: boolean };

/**
 * Die Gruppen für uns und für alle.
 *
 * Eine Gruppe für den eigenen Namen ersetzt die Sternchengruppe
 * vollständig — so steht es in der Vereinbarung. Wer beide mischte,
 * bekäme bei einer Seite, die uns ausdrücklich etwas erlaubt, die
 * allgemeine Sperre obendrauf.
 */
export function regelnLesen(robots: string): Regel[] {
  const zeilen = robots.split(/\r?\n/).map((z) => z.replace(/#.*$/, "").trim());

  const gruppen = new Map<string, Regel[]>();
  let aktuell: string[] = [];
  let neueGruppe = true;

  for (const zeile of zeilen) {
    const treffer = zeile.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!treffer) continue;
    const feld = treffer[1]!.toLowerCase();
    const wert = treffer[2]!.trim();

    if (feld === "user-agent") {
      if (!neueGruppe) {
        aktuell = [];
        neueGruppe = true;
      }
      aktuell.push(wert.toLowerCase());
      if (!gruppen.has(wert.toLowerCase())) gruppen.set(wert.toLowerCase(), []);
      continue;
    }

    if (feld !== "disallow" && feld !== "allow") continue;
    neueGruppe = false;
    for (const a of aktuell) {
      gruppen.get(a)!.push({ pfad: wert, erlaubt: feld === "allow" });
    }
  }

  return gruppen.get(AGENT.toLowerCase()) ?? gruppen.get("*") ?? [];
}

/**
 * Passt eine Regel auf den Pfad?
 *
 * `*` steht für beliebig viele Zeichen, `$` für das Ende. Mehr braucht
 * die Vereinbarung nicht, und mehr zu bauen hiesse, Muster zu deuten,
 * die niemand geschrieben hat.
 */
function passt(muster: string, pfad: string): boolean {
  if (muster === "") return false;
  const endet = muster.endsWith("$");
  const kern = endet ? muster.slice(0, -1) : muster;

  const teile = kern.split("*").map((t) => t.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp("^" + teile.join(".*") + (endet ? "$" : ""));
  return regex.test(pfad);
}

/** Die längste passende Regel gewinnt; bei gleicher Länge das Erlauben. */
export function darfAbrufen(regeln: Regel[], pfad: string): boolean {
  let beste: Regel | null = null;
  for (const r of regeln) {
    if (!passt(r.pfad, pfad)) continue;
    if (
      beste === null ||
      r.pfad.length > beste.pfad.length ||
      (r.pfad.length === beste.pfad.length && r.erlaubt)
    ) {
      beste = r;
    }
  }
  return beste ? beste.erlaubt : true;
}

/** robots.txt holen und die Adresse prüfen. */
export async function robotsPruefen(ziel: URL): Promise<RobotsUrteil> {
  const robotsUrl = new URL("/robots.txt", ziel.origin);
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), 5_000);

  try {
    const antwort = await fetch(robotsUrl, {
      redirect: "follow",
      signal: abbruch.signal,
      headers: { "user-agent": `${AGENT}/1.0`, accept: "text/plain" },
    });

    /* 404 und 410: keine robots.txt, also keine Einschränkung. */
    if (antwort.status === 404 || antwort.status === 410) return { erlaubt: true };

    if (antwort.status >= 500) {
      return {
        erlaubt: false,
        grund:
          "Die Website antwortet gerade nicht auf die Frage, ob ich sie lesen darf. " +
          "Versuch es später noch einmal, oder füge den Text von Hand ein.",
      };
    }

    if (!antwort.ok) return { erlaubt: true };

    /* Eine „robots.txt“, die HTML zurückgibt, ist keine. Das passiert
       bei Seiten, die alles auf die Startseite umlenken. */
    const typ = antwort.headers.get("content-type") ?? "";
    if (typ.includes("html")) return { erlaubt: true };

    const roh = (await antwort.text()).slice(0, 512 * 1024);
    const regeln = regelnLesen(roh);

    if (darfAbrufen(regeln, ziel.pathname)) return { erlaubt: true };
    return {
      erlaubt: false,
      grund:
        "Die Website erlaubt maschinelles Lesen dieser Seite nicht. " +
        "Kopier mir den Text, dann arbeite ich damit.",
    };
  } catch {
    /* Zeitfehler, DNS, Netz — nicht unterscheidbar von „gibt es
       nicht“. Siehe oben. */
    return { erlaubt: true };
  } finally {
    clearTimeout(uhr);
  }
}
