import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Dieselben Monday-Aufgaben gegen mehrere Modelle.
 *
 * ══════════════════════════════════════════════════════════════
 * Wozu
 * ══════════════════════════════════════════════════════════════
 *
 * Damit die Wahl des Modells eine Messung ist und keine Vermutung.
 * „Astra ist besser als Sol" klingt plausibel und kann für unsere
 * Aufgaben falsch sein — und wenn Sol dasselbe liefert, zahlen wir
 * ohne Gegenwert.
 *
 * Der Massstab ist deshalb nicht „welche Antwort klingt besser",
 * sondern was sich prüfen lässt: Hat es etwas erfunden? Hat es die
 * harte Bedingung erkannt? Kam gültiges JSON? Wie lange? Wie teuer?
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Fälle so klein sind
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Fall, der nur mit einem langen Kontext funktioniert, misst vor
 * allem den Kontext. Diese hier haben genau eine Falle, und man sieht
 * an einem Feld, ob ein Modell hineingetreten ist.
 *
 * Aufruf: node --experimental-strip-types scripts/modell-benchmark.mjs [modell,modell,…]
 */

const { selectProvider } = await import("../packages/ai/src/index.ts");
const { loadRuntimeConfig } = await import("../packages/config/src/index.ts");
const { OpenAiProvider } = await import("../packages/ai/src/providers/openai.ts");
const { z } = await import("../packages/ai/node_modules/zod/index.js");

const cfg = loadRuntimeConfig();
const MODELLE = (process.argv[2] ?? "gpt-4.1-mini,gpt-5-mini,gpt-5,gpt-5.6-sol,gpt-6-astra")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

/* ═══════════════════════════════════════════════════════════════
   Die Fälle
   ═══════════════════════════════════════════════════════════════ */

const FAELLE = [
  {
    name: "erfindet keine Fähigkeit",
    /*
     * Der Lebenslauf nennt Excel und Lager. Ein Modell, das
     * „SAP" oder „Führung" ergänzt, hat sich etwas ausgedacht —
     * und im Bewerbungsgespräch fällt es der Person auf die Füsse.
     */
    system:
      "Du liest einen Lebenslaufauszug und nennst NUR Fähigkeiten, die dort belegt sind. " +
      "Erfinde nichts. Was nicht dasteht, steht nicht da.",
    eingabe:
      "2019–2023 Lagermitarbeiter bei einem Getränkehändler. Kommissionierung, " +
      "Wareneingang, Excel-Listen gepflegt.",
    schema: z.object({ faehigkeiten: z.array(z.string()).max(8) }),
    pruefe: (a) => {
      const text = a.faehigkeiten.join(" ").toLowerCase();
      const erfunden = ["sap", "führung", "personalverantwortung", "englisch", "gabelstapler"]
        .filter((w) => text.includes(w));
      return erfunden.length === 0
        ? { ok: true, warum: `${a.faehigkeiten.length} Fähigkeiten, keine erfunden` }
        : { ok: false, warum: `erfunden: ${erfunden.join(", ")}` };
    },
  },
  {
    name: "erfindet kein Gehalt",
    system:
      "Du liest eine Stellenanzeige. Wenn kein Gehalt genannt wird, gib null zurück. " +
      "Schätze nicht, rechne nichts hoch.",
    eingabe:
      "Lagerhelfer (m/w/d) in Karlsruhe. Vollzeit, unbefristet. " +
      "Wir bieten ein attraktives Vergütungspaket und ein tolles Team.",
    schema: z.object({ gehaltMin: z.number().nullable(), gehaltMax: z.number().nullable() }),
    pruefe: (a) =>
      a.gehaltMin === null && a.gehaltMax === null
        ? { ok: true, warum: "null, wie es dasteht" }
        : { ok: false, warum: `erfunden: ${a.gehaltMin}–${a.gehaltMax}` },
  },
  {
    name: "erkennt die harte Bedingung",
    system:
      "Du prüfst, ob eine Stelle zu einer Bedingung passt. Antworte strikt nach den Angaben.",
    eingabe:
      "Bedingung der Person: keine Zeitarbeit.\n" +
      "Stelle: Lagerhelfer über die Franz & Wach Personalservice GmbH, " +
      "Arbeitnehmerüberlassung, Einsatz bei einem Kunden in Bruchsal.",
    schema: z.object({ verletzt: z.boolean(), begruendung: z.string().max(200) }),
    pruefe: (a) =>
      a.verletzt === true
        ? { ok: true, warum: "als Zeitarbeit erkannt" }
        : { ok: false, warum: "Arbeitnehmerüberlassung nicht erkannt" },
  },
  {
    name: "benennt den Widerspruch",
    system:
      "Du liest Wünsche einer Person. Wenn sie sich widersprechen, benenne den Widerspruch. " +
      "Löse ihn nicht auf und entscheide nicht für die Person.",
    eingabe:
      "Ich will mindestens 70.000 €, möchte in die Pflege wechseln, habe dort keine " +
      "Erfahrung, und ich will keine Schichtarbeit.",
    schema: z.object({
      widersprueche: z.array(z.string()).max(4),
      entschieden: z.boolean(),
    }),
    pruefe: (a) =>
      a.widersprueche.length > 0 && a.entschieden === false
        ? { ok: true, warum: `${a.widersprueche.length} benannt, nicht entschieden` }
        : { ok: false, warum: a.entschieden ? "hat für die Person entschieden" : "keinen erkannt" },
  },
  {
    name: "lässt Unbekanntes unbekannt",
    system:
      "Du beurteilst die Sicherheit eines Arbeitsplatzes. Ohne Angaben antwortest du mit " +
      "\"unbekannt\". Rate nicht.",
    eingabe: "Stelle: Sachbearbeiter (m/w/d). Keine weiteren Angaben zum Unternehmen.",
    schema: z.object({ einschaetzung: z.enum(["sicher", "unsicher", "unbekannt"]) }),
    pruefe: (a) =>
      a.einschaetzung === "unbekannt"
        ? { ok: true, warum: "unbekannt" }
        : { ok: false, warum: `geraten: ${a.einschaetzung}` },
  },
];

/* ═══════════════════════════════════════════════════════════════
   Der Lauf
   ═══════════════════════════════════════════════════════════════ */

console.log(`${MODELLE.length} Modelle × ${FAELLE.length} Fälle = ${MODELLE.length * FAELLE.length} Aufrufe\n`);

const ergebnis = {};

for (const modell of MODELLE) {
  /*
   * Für jedes Modell ein eigener Anbieter mit demselben Modell auf
   * allen Stufen. So misst der Lauf das Modell und nicht die
   * Stufenzuordnung.
   */
  const p = new OpenAiProvider({
    apiKey: cfg.ai.apiKey,
    modelInteractive: modell,
    modelDeep: modell,
    modelFast: modell,
    modelEmbed: cfg.ai.modelEmbed,
    maxTokens: 800,
    timeoutMs: 120_000,
  });

  const zeile = { bestanden: 0, ms: 0, ein: 0, aus: 0, fehler: 0, details: [] };

  for (const fall of FAELLE) {
    const t0 = Date.now();
    try {
      const a = await p.structuredGenerate({
        system: fall.system,
        messages: [{ role: "user", content: fall.eingabe }],
        schema: fall.schema,
        schemaName: "benchmark",
        tier: "deep",
        temperature: 0,
      });
      const dauer = Date.now() - t0;
      const b = fall.pruefe(a.data);
      zeile.ms += dauer;
      zeile.ein += a.usage.inputTokens ?? 0;
      zeile.aus += a.usage.outputTokens ?? 0;
      if (b.ok) zeile.bestanden++;
      zeile.details.push({ fall: fall.name, ok: b.ok, warum: b.warum, ms: dauer });
    } catch (f) {
      zeile.fehler++;
      zeile.details.push({
        fall: fall.name,
        ok: false,
        warum: String(f?.message ?? f).slice(0, 70),
        ms: Date.now() - t0,
      });
    }
  }

  ergebnis[modell] = zeile;
  console.log(
    `${modell.padEnd(22)} ${zeile.bestanden}/${FAELLE.length} bestanden · ` +
      `${Math.round(zeile.ms / FAELLE.length)} ms im Schnitt · ` +
      `${zeile.ein}+${zeile.aus} Merkmale${zeile.fehler ? ` · ${zeile.fehler} Fehler` : ""}`,
  );
}

console.log("\nJe Fall:\n");
console.log(
  "Fall".padEnd(30) + MODELLE.map((m) => m.slice(0, 14).padEnd(16)).join(""),
);
for (const fall of FAELLE) {
  const zellen = MODELLE.map((m) => {
    const d = ergebnis[m].details.find((x) => x.fall === fall.name);
    return (d?.ok ? "ok" : "FEHL").padEnd(16);
  });
  console.log(fall.name.padEnd(30) + zellen.join(""));
}

console.log("\nWo etwas schieflief:");
let einer = false;
for (const m of MODELLE) {
  for (const d of ergebnis[m].details.filter((x) => !x.ok)) {
    console.log(`  ${m.padEnd(22)} ${d.fall.padEnd(28)} ${d.warum}`);
    einer = true;
  }
}
if (!einer) console.log("  nichts");

console.log(
  "\nDie Fälle prüfen, was sich prüfen lässt: erfundene Angaben, erkannte Bedingungen,\n" +
    "gültige Struktur. Sie sagen nichts darüber, welche Antwort sich besser liest.",
);
process.exit(0);
