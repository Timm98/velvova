import { readFileSync } from "node:fs";
import { anforderungenExtrahieren } from "../anforderungsextraktion.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Extraktion gegen eine geprüfte Referenz
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Was diese Referenz ist und was nicht ────────────────────────
 *
 * `bestand.json` enthält 100 reale, anonymisierte Logistikanzeigen —
 * Links, Adressen, Telefonnummern und Postleitzahlen sind ersetzt.
 * `korrekturen.json` hält für eine Stichprobe von 120 Einträgen fest,
 * wo die Maschine falsch lag. Ich habe sie Zeile für Zeile geprüft;
 * ein Dritter hat sie nicht gegengelesen. Das gehört zur Zahl dazu.
 *
 * ── Warum nicht eine Genauigkeit ────────────────────────────────
 *
 * Weil die Fehler verschieden teuer sind. Ein Eintrag, der gar keiner
 * sein sollte, füllt eine Liste. Eine falsche Kategorie verschiebt
 * eine Zeile in die falsche Kette. Ein Wunsch, der zur Pflicht wird,
 * hält jemanden von einer Bewerbung ab — das ist der teuerste Fehler
 * und steht deshalb einzeln da.
 */

interface Korrektur {
  drop?: boolean;
  kategorie?: string;
  verbindlichkeit?: string;
}

export interface Messung {
  stichprobe: number;
  /** Einträge, die gar keine hätten sein dürfen. */
  ueberfluessig: number;
  kategorieRichtig: number;
  verbindlichkeitRichtig: number;
  /** Aus einem Wunsch wurde eine Pflicht. Der teuerste Fehler. */
  falscheMuss: number;
  /** Aus einer Pflicht wurde ein Wunsch. */
  verpassteMuss: number;
}

export function messen(wurzel = "packages/jobs/src/goldset"): Messung {
  const bestand = JSON.parse(readFileSync(`${wurzel}/bestand.json`, "utf8")) as
    { nr: number; titel: string; text: string }[];
  const { korrekturen } = JSON.parse(readFileSync(`${wurzel}/korrekturen.json`, "utf8")) as
    { korrekturen: Record<string, Korrektur> };

  const alle: { kat: string; verb: string; zeile: string }[] = [];
  for (const a of bestand) {
    for (const x of anforderungenExtrahieren(a.text).eintraege) {
      alle.push({ kat: x.kategorie, verb: x.verbindlichkeit, zeile: x.original });
    }
  }
  const schritt = Math.max(1, Math.floor(alle.length / 120));
  const probe = alle.filter((_, i) => i % schritt === 0).slice(0, 120);

  const m: Messung = {
    stichprobe: probe.length,
    ueberfluessig: 0,
    kategorieRichtig: 0,
    verbindlichkeitRichtig: 0,
    falscheMuss: 0,
    verpassteMuss: 0,
  };

  probe.forEach((p, i) => {
    const k = korrekturen[String(i + 1)];
    if (k?.drop) {
      m.ueberfluessig++;
      /* Ein überflüssiger Eintrag mit „muss" ist eine erfundene Pflicht. */
      if (p.verb === "muss") m.falscheMuss++;
      return;
    }
    const sollKat = k?.kategorie ?? p.kat;
    const sollVerb = k?.verbindlichkeit ?? p.verb;
    if (p.kat === sollKat) m.kategorieRichtig++;
    if (p.verb === sollVerb) m.verbindlichkeitRichtig++;
    if (p.verb === "muss" && sollVerb !== "muss") m.falscheMuss++;
    if (p.verb !== "muss" && sollVerb === "muss") m.verpassteMuss++;
  });

  return m;
}
