/**
 * Der Hintergrunddienst des Suchauftrags.
 *
 * ══════════════════════════════════════════════════════════════
 * Was er tut, in dieser Reihenfolge
 * ══════════════════════════════════════════════════════════════
 *
 *   1. fällige Aufträge einreihen      (was die Datenbank sagt)
 *   2. Suchrunden abarbeiten           (Vorauswahl, Prüfung, Treffer)
 *   3. Zusammenfassungen bauen         (Auswahl, Entdoppelung)
 *   4. Versand: nur über den Endpunkt, nicht hier
 *
 * Schritt 1 liest `such_auftraege.naechste_faelligkeit` und nicht die
 * Warteschlange. Die Warteschlange ist ein Transportweg, kein
 * Gedächtnis: Geht eine Nachricht verloren, weil ein Worker zwischen
 * Lesen und Löschen stirbt, muss der Auftrag trotzdem wiederkommen.
 *
 * ══════════════════════════════════════════════════════════════
 * Er versendet nicht
 * ══════════════════════════════════════════════════════════════
 *
 * Er macht alles bis zur fertigen Mail im Ausgang. Versendet wird über
 * `POST /api/intern/suchauftrag` — die Begründung steht weiter unten
 * an der Stelle, an der es auffiel.
 *
 * Aufruf:
 *   node --experimental-strip-types scripts/suchauftrag-worker.mjs
 *   SUCHAUFTRAG_STAPEL=20 …   wie viele Aufträge je Lauf
 *   SUCHAUFTRAG_JETZT=… …     mit einem anderen Zeitpunkt rechnen
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const j = await import("../packages/jobs/src/index.ts");

const db = await getDb();
const STAPEL = Number(process.env.SUCHAUFTRAG_STAPEL ?? 20);
const BASIS_URL = process.env.APP_BASE_URL ?? "https://velvova.de";
/*
 * Der Zeitpunkt ist überschreibbar.
 *
 * Nicht als Hintertür, sondern damit ein Trockenlauf ein Versandfenster
 * erreichen kann, ohne bis acht Uhr zu warten. Ohne diese Zeile liesse
 * sich der Weg bis zur Mailvorschau nur einmal am Tag zeigen.
 */
const jetzt = process.env.SUCHAUFTRAG_JETZT ? new Date(process.env.SUCHAUFTRAG_JETZT) : new Date();
if (Number.isNaN(jetzt.getTime())) {
  console.error("SUCHAUFTRAG_JETZT ist kein gültiger Zeitpunkt.");
  process.exit(1);
}

/*
 * ══════════════════════════════════════════════════════════════
 * Dieses Skript versendet nicht und ruft kein Modell.
 * ══════════════════════════════════════════════════════════════
 *
 * Nicht aus Vorsicht, sondern weil es nicht geht: Der Mailversand und
 * der Modellaufruf tragen `import "server-only"`, und das Modul löst
 * sich nur im Next-Build auf — Next liefert es mit. Aus einem
 * gewöhnlichen Node-Prozess ist es nicht auffindbar.
 *
 * Die erste Fassung hatte dafür ein `catch`, das den Importfehler in
 * die Meldung „Anbieter nicht angebunden" verwandelte. Das ist die
 * schlimmste Sorte Fehler: Er sah aus wie ein Betriebszustand. Der
 * Versandweg des Workers war nie erreichbar, und die Ausgabe hat
 * jedes Mal etwas anderes behauptet.
 *
 * Also die ehrliche Arbeitsteilung:
 *
 *   Dieses Skript   sucht, bewertet, baut die Zusammenfassung und
 *                   legt die fertige Mail in den Ausgang.
 *   Der Endpunkt    `POST /api/intern/suchauftrag` tut dasselbe und
 *                   versendet zusätzlich. Ihn ruft der Zeitplan.
 *
 * Das ist genau der Trockenlauf, den die Abnahme verlangt: alles bis
 * zur fertigen Mail, und dort hört es auf.
 */
const bericht = await j.durchlaufAusfuehren(db, {
  jetzt,
  stapel: STAPEL,
  basisUrl: BASIS_URL,
  /* Kein Versender, kein Rufer — siehe oben. */
});

console.log(`Fällige Aufträge: ${bericht.faellig}`);
for (const a of bericht.auftraege) {
  if (a.fehler) {
    console.warn(`  ${a.name}: ${a.fehler}`);
    continue;
  }
  console.log(
    `  ${a.name.slice(0, 32).padEnd(32)} geprüft ${String(a.geprueft).padStart(3)} · ` +
    `empfohlen ${a.empfohlen} · zurückgestellt ${a.zurueckgestellt} · ` +
    `ausgeschlossen ${a.ausgeschlossen}${a.grund ? ` · ${a.grund}` : ""}`,
  );
}
for (const z of bericht.zusammenfassungen) {
  console.log(
    z.uebersprungen
      ? `  Zusammenfassung übersprungen: ${z.uebersprungen} (${z.fenster})`
      : `  Zusammenfassung ${z.fenster}: ${z.posten} Posten${z.mail ? " · Mail vorbereitet" : " · kein Mailkanal"}`,
  );
}
console.log(
  "Kein Versand aus diesem Skript — die fertigen Mails stehen im Ausgang.\n" +
  "  Versendet wird über POST /api/intern/suchauftrag; den ruft der Zeitplan.",
);

const r = bericht.rueckstand;
console.log(
  `Rückstand — Analyse ${r.analyse ?? "unbekannt"}, fällige Aufträge ${r.faellig}, ` +
  `Ausgang ${r.ausgang}, ungewiss ${r.ungewiss} · ${bericht.dauerMs} ms`,
);
if (r.ungewiss > 0) {
  /* Ungewiss heisst: Die Mail kann draussen sein. Das klärt ein
     Webhook oder eine Nachfrage beim Anbieter — nicht ein zweiter
     Versand. */
  console.warn(`Achtung: ${r.ungewiss} Sendungen mit ungewissem Ausgang. Nicht erneut senden.`);
}
process.exit(0);
