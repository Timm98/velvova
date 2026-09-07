/**
 * Hält die Entwicklungsseiten übersetzt.
 *
 * ══════════════════════════════════════════════════════════════
 * Wogegen das hilft
 * ══════════════════════════════════════════════════════════════
 *
 * Turbopack übersetzt eine Route beim ERSTEN Aufruf nach jeder
 * Änderung neu. Gemessen an dieser Anwendung:
 *
 *     erster Aufruf nach einer Änderung   5–9 Sekunden
 *     jeder weitere                       0,7 Sekunden
 *
 * Wer während der Arbeit an den Dateien im Browser klickt, zahlt
 * diese Sekunden — und hält die Anwendung für langsam, obwohl sie es
 * nicht ist. Das ist in dieser Sitzung mehrfach passiert.
 *
 * Dieses Skript sieht dem Quelltext zu und ruft die Hauptseiten kurz
 * nach jeder Änderung selbst auf. Die Übersetzung ist damit bezahlt,
 * bevor ein Mensch klickt.
 *
 * ══════════════════════════════════════════════════════════════
 * Was es NICHT ist
 * ══════════════════════════════════════════════════════════════
 *
 * Kein Leistungswerkzeug. Es macht nichts schneller — es verschiebt
 * nur, WER wartet. Im Betrieb gibt es diese Wartezeit gar nicht, dort
 * ist alles vorher gebaut.
 *
 * Aufruf:  node scripts/warmhalten.mjs
 * Beenden: Strg-C
 */

import { watch } from "node:fs";
import { join } from "node:path";

const BASIS = process.env.WARM_BASIS ?? "http://localhost:3000";
const WURZEL = new URL("../apps/web/src", import.meta.url).pathname;

/*
 * Die Seiten, die im Alltag angeklickt werden. Mehr wäre
 * verschwendete Arbeit: Jede kostet beim Aufwärmen dieselbe
 * Übersetzungszeit, die sie sonst jemand anderem gekostet hätte.
 */
const SEITEN = ["/", "/app/monday", "/app/jobs", "/app/settings"];

/* Eine Sitzung, damit die angemeldeten Seiten nicht auf die
   Anmeldung umleiten. Nur in der Entwicklung möglich und nur, wenn
   DEV_LOGIN_ENABLED gesetzt ist. */
let keks = "";

async function anmelden() {
  try {
    const a = await fetch(`${BASIS}/api/dev/login`, { redirect: "manual" });
    const roh = a.headers.getSetCookie?.() ?? [];
    keks = roh.map((k) => k.split(";")[0]).join("; ");
  } catch {
    /* Ohne Anmeldung wärmen wir eben nur die öffentlichen Seiten. */
  }
}

let laeuft = false;
let nochmal = false;

async function waermen(grund) {
  if (laeuft) {
    nochmal = true;
    return;
  }
  laeuft = true;
  const t0 = Date.now();
  const zeiten = [];
  for (const seite of SEITEN) {
    const t = Date.now();
    try {
      await fetch(BASIS + seite, { headers: keks ? { cookie: keks } : {} });
      zeiten.push(`${seite} ${Date.now() - t} ms`);
    } catch {
      zeiten.push(`${seite} nicht erreichbar`);
    }
  }
  console.log(`[warm] ${grund} → ${Date.now() - t0} ms   ${zeiten.join(" · ")}`);
  laeuft = false;
  if (nochmal) {
    nochmal = false;
    void waermen("nachgezogen");
  }
}

await anmelden();
await waermen("Start");

/*
 * Eine Ruhezeit von 800 ms.
 *
 * Ein Speichern löst oft mehrere Ereignisse aus — Datei, Verzeichnis,
 * Zwischendatei des Editors. Ohne Ruhezeit liefen vier Aufwärmläufe
 * für eine Änderung.
 */
let uhr = null;
watch(WURZEL, { recursive: true }, (_art, datei) => {
  if (!datei || /\.(tsx?|css)$/.test(datei) === false) return;
  clearTimeout(uhr);
  uhr = setTimeout(() => void waermen(String(datei)), 800);
});

console.log(`[warm] sehe ${WURZEL} zu — Strg-C beendet.`);
