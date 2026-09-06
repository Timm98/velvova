import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";

/**
 * Hält die Ernte über Nacht am Laufen.
 *
 * ── Warum ein Aufseher und keine Einzelprozesse ───────────────
 *
 * Einzeln gestartete Läufe sterben still: an einer Drosselung, an
 * einer Zeitgrenze der Datenbank, am Ende ihrer Länderliste. Am
 * nächsten Morgen läuft nichts mehr, und niemand hat es gemerkt —
 * genau das ist heute Nacht passiert, fünf Prozesse waren auf zwei
 * geschrumpft.
 *
 * Der Aufseher hält eine feste Zahl gleichzeitiger Ströme, nimmt beim
 * Ende eines Laufs das nächste Land aus der Liste und beginnt von
 * vorn, wenn die Liste durch ist. Ein Absturz kostet damit einen Lauf,
 * nicht die Nacht.
 *
 * ── Warum nur wenige gleichzeitig ─────────────────────────────
 *
 * Gemessen: Fünfzehn gleichzeitige Läufe drosseln sich gegenseitig zu
 * Tode — nach 250 Anzeigen kommt nur noch 429. Vier bis fünf laufen
 * sauber. Mehr Ströme holen nicht mehr Stellen, sondern weniger.
 *
 * Aufruf: node --experimental-strip-types scripts/ernte-aufseher.mjs
 */

/*
 * Die Reihenfolge ist die Nutzenreihenfolge.
 *
 * DACH zuerst, weil es der eigentliche Markt ist — auch wenn dort
 * gerade wenig Neues kommt (DE 89 neue in sechs Läufen, der Bestand
 * ist über die Städteachse weitgehend abgeerntet). Danach die
 * grossen Märkte, die noch Luft haben.
 */
const LAENDER = ["de", "at", "ch", "fr", "it", "es", "ca", "au", "sg", "nz", "be", "br", "za", "nl", "pl", "gb"];
const GLEICHZEITIG = 4;
const PROTOKOLL = "logs/aufseher.log";

mkdirSync("logs", { recursive: true });
const merke = (t) => {
  const z = `${new Date().toLocaleTimeString("de-DE")}  ${t}\n`;
  process.stdout.write(z);
  try { appendFileSync(PROTOKOLL, z); } catch {}
};

let naechstes = 0;
let runden = 0;
const laeuft = new Set();
const kinder = new Set();

/*
 * Beim eigenen Ende die Kinder mitnehmen.
 *
 * Ohne das entstehen Waisen: Wird der Aufseher beendet, feuern seine
 * Kinder noch ihre `exit`-Behandlung, starten Nachrücker — und die
 * hängen dann an niemandem mehr. Beobachtet nach einem Neustart:
 * sieben Ströme statt vier, drei davon ohne Aufseher, alle auf
 * dieselbe Taktgrenze.
 */
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    merke(`${signal} — beende ${kinder.size} Ströme`);
    beendet = true;
    for (const k of kinder) k.kill("SIGTERM");
    /*
     * Erst warten, dann hart beenden, dann selbst gehen.
     *
     * ── Warum das nötig ist ───────────────────────────────
     *
     * Der Aufseher hat vorher sofort `process.exit(0)` gerufen. Ein
     * Kind, das gerade auf eine Netzantwort wartet, verarbeitet sein
     * SIGTERM erst danach — und wenn der Elternprozess bis dahin weg
     * ist, wird es zur Waise und läuft weiter.
     *
     * Beobachtet: nach einem Neustart liefen sechs Ströme statt vier,
     * zwei davon mit einer Eltern-Kennung, die es nicht mehr gab. Sie
     * belasteten die Datenbank weiter, und niemand hat sie verwaltet.
     *
     * Drei Sekunden reichen für ein sauberes Ende; wer dann noch
     * lebt, bekommt SIGKILL.
     */
    setTimeout(() => {
      for (const k of kinder) k.kill("SIGKILL");
      merke("Ströme beendet");
      process.exit(0);
    }, 3000);
  });
}
let beendet = false;

function starte() {
  if (beendet) return;
  /*
   * Die Obergrenze hier prüfen, nicht beim Planen.
   *
   * Vorher war sie nur eine Annahme: vier Starts am Anfang, je ein
   * Nachrücker bei jedem Ende. Das stimmt, solange nichts
   * dazwischenkommt — und dann kam etwas dazwischen. Nach einem
   * Sammel-Abbruch liefen sieben Ströme statt vier, einer davon
   * doppelt auf demselben Land. Adzuna drosselt daraufhin beide.
   *
   * Eine Zusicherung, die nur aus dem Ablauf folgt, ist keine.
   */
  if (laeuft.size >= GLEICHZEITIG) {
    merke(`nicht gestartet: ${laeuft.size} Ströme laufen bereits`);
    return;
  }

  if (naechstes >= LAENDER.length) {
    naechstes = 0;
    runden++;
    merke(`── Runde ${runden} beendet, beginne von vorn ──`);
  }
  /*
   * Dasselbe Land nie zweimal gleichzeitig.
   *
   * Zwei Ströme auf einem Land holen dieselben Anzeigen und
   * verbrauchen die Taktgrenze doppelt — der Ertrag sinkt, statt zu
   * steigen. Weitersuchen statt abwarten: Ein anderes Land ist frei.
   */
  let land = LAENDER[naechstes++];
  for (let versuche = 0; laeuft.has(land) && versuche < LAENDER.length; versuche++) {
    if (naechstes >= LAENDER.length) naechstes = 0;
    land = LAENDER[naechstes++];
  }
  if (laeuft.has(land)) {
    merke("alle Länder belegt — warte");
    setTimeout(starte, 60_000);
    return;
  }

  const kind = spawn("node", ["--experimental-strip-types", "scripts/adzuna-orte.mjs", land], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  laeuft.add(land);
  kinder.add(kind);
  merke(`start ${land.toUpperCase()} (${laeuft.size} Ströme)`);

  let letzte = "";
  kind.stdout.on("data", (d) => {
    for (const z of String(d).split("\n")) {
      const t = z.trim();
      /* Nur die Zeilen mit Ertrag ins Protokoll — der Rest ist Rauschen. */
      if (/neu\s+\d/.test(t) || /^Fertig/.test(t)) { letzte = t; merke(`  ${land} · ${t}`); }
    }
  });
  kind.stderr.on("data", (d) => {
    const t = String(d).split("\n")[0]?.trim();
    if (t) merke(`  ${land} ! ${t.slice(0, 120)}`);
  });

  kind.on("exit", (code) => {
    laeuft.delete(land);
    kinder.delete(kind);
    merke(`ende  ${land.toUpperCase()} (Code ${code}) ${letzte ? "— " + letzte.slice(0, 60) : ""}`);
    /*
     * Kurze Pause vor dem Nachrücken.
     *
     * Endet ein Lauf an einer Drosselung, hilft sofortiges Nachlegen
     * nicht — es trifft dieselbe Grenze.
     */
    setTimeout(starte, 20_000);
  });
}

merke(`Aufseher gestartet · ${LAENDER.length} Länder · ${GLEICHZEITIG} Ströme`);
for (let i = 0; i < GLEICHZEITIG; i++) setTimeout(starte, i * 15_000);

/* Nie von selbst enden. */
setInterval(() => {}, 1 << 30);
