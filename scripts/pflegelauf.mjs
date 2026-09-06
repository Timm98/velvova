import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";

/**
 * Was regelmässig nachgerechnet werden muss.
 *
 * ── Warum ein eigener Lauf ────────────────────────────────────
 *
 * Zwei Zahlen im Produkt entstehen aus Vollzählungen über den ganzen
 * Bestand: die Bestandskennzahlen der Stellenseite und die
 * Standzeit-Vergleichswerte je Berufsgruppe. Beide standen einmal in
 * der Seite selbst — die Stellenseite antwortete deshalb mit 500,
 * sobald der Bestand gross genug war.
 *
 * Ausserhalb gerechnet stört es niemanden, wenn es Minuten dauert.
 * Stündlich reicht: Die Zahlen bewegen sich über Stunden, nicht über
 * Sekunden, und beide tragen ihren Zeitpunkt mit.
 *
 * Aufruf: node --experimental-strip-types scripts/pflegelauf.mjs
 */
const AUFGABEN = [
  ["Bestandskennzahlen", "scripts/kennzahlen-berechnen.mjs"],
  ["Standzeit je Gruppe", "scripts/standzeit-berechnen.mjs"],
  ["Ortsliste", "scripts/ba-ortsliste-bauen.mjs"],
  ["Verlaufsbelege", "scripts/verlaufsbelege.mjs"],
  ["Planerstatistik", "scripts/analyze.mjs"],
  ["Entgelt je Kennung", "scripts/entgelt-kldb-bauen.mjs"],
  ["Berufsfelder zählen", "scripts/berufsfelder-zaehlen.mjs"],
  ["Stellen je Land", "scripts/laender-zaehlen.mjs"],
  ["Bestandsverlauf", "scripts/bestandsverlauf-schreiben.mjs"],
  ["Bestandsbefund", "scripts/bestandsbefund-berechnen.mjs"],
  /*
   * Der Suchlauf steht am Ende.
   *
   * Er ist der einzige Punkt in dieser Liste, der etwas erzeugt, das
   * Menschen zu sehen bekommen — die übrigen rechnen Kennzahlen nach.
   * Am Ende ausgeführt läuft er auf dem frischesten Bestand.
   */
  ["Vorschläge zu Stellen", "scripts/matches-lauf.mjs"],
];
const STUNDE = 60 * 60 * 1000;

mkdirSync("logs", { recursive: true });
const merke = (t) => {
  const z = `${new Date().toLocaleTimeString("de-DE")}  ${t}\n`;
  process.stdout.write(z);
  try { appendFileSync("logs/pflege.log", z); } catch {}
};

/*
 * Eine Zeitgrenze je Aufgabe.
 *
 * Ohne sie hält eine einzige hängende Aufgabe die ganze Schleife an,
 * und zwar unbemerkt: Gemessen am 4.9.2026 stand
 * `kennzahlen-berechnen.mjs` zwei Stunden lang mit 0,44 Sekunden
 * Rechenzeit — es wartete auf eine Verbindung, die nie zustande kam.
 * Serverseitig lief dazu keine Abfrage. Der Pflegelauf wartete
 * mit, alle folgenden Aufgaben kamen nicht mehr dran, und die
 * Bestandszahlen im Produkt blieben auf dem Stand von 18:15 stehen.
 *
 * Eine Aufgabe, die nicht fertig wird, darf die anderen nicht
 * mitnehmen. Nach der Grenze erst SIGTERM, damit sie sich sauber
 * abmelden kann, nach drei Sekunden SIGKILL.
 *
 * 40 Minuten sind grosszügig: Die längste Aufgabe („Berufsfelder
 * zählen") brauchte gemessen 20,4 Minuten. Wer länger braucht,
 * hängt.
 */
const GRENZE = 40 * 60 * 1000;

function lauf(name, datei) {
  return new Promise((fertig) => {
    const t0 = Date.now();
    const kind = spawn("node", ["--experimental-strip-types", datei], {
      cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"],
    });
    let letzte = "";
    let beendet = false;

    const uhr = setTimeout(() => {
      merke(`${name}: Zeitgrenze von ${GRENZE / 60000} min überschritten — wird beendet`);
      kind.kill("SIGTERM");
      setTimeout(() => { if (!beendet) kind.kill("SIGKILL"); }, 3000);
    }, GRENZE);

    kind.stdout.on("data", (d) => {
      for (const z of String(d).split("\n")) if (z.trim()) letzte = z.trim();
    });
    kind.stderr.on("data", (d) => {
      const t = String(d).split("\n")[0]?.trim();
      if (t) merke(`  ${name} ! ${t.slice(0, 110)}`);
    });
    kind.on("exit", (code, signal) => {
      beendet = true;
      clearTimeout(uhr);
      const wie = signal ? `Signal ${signal}` : `Code ${code}`;
      merke(`${name}: ${wie} nach ${((Date.now() - t0) / 60000).toFixed(1)} min — ${letzte.slice(0, 90)}`);
      fertig();
    });
    kind.on("error", (e) => {
      beendet = true;
      clearTimeout(uhr);
      merke(`${name}: konnte nicht starten — ${String(e.message).slice(0, 90)}`);
      fertig();
    });
  });
}

for (;;) {
  merke("── Pflegerunde ──");
  for (const [name, datei] of AUFGABEN) await lauf(name, datei);
  merke(`Runde fertig, nächste in einer Stunde`);
  await new Promise((r) => setTimeout(r, STUNDE));
}
