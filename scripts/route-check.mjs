import { chromium } from "@playwright/test";

/**
 * Was auf der echten Route wirklich steht.
 *
 * Kein Test einer Komponente, sondern der Abgleich der gerenderten
 * Seite gegen eine Liste von Zeichenketten, die dort stehen MÜSSEN, und
 * eine, die dort NICHT MEHR stehen darf.
 *
 * Der Anlass: mehrere Berichte meldeten „umgesetzt", während der
 * Browser die alte Oberfläche zeigte — geändert war eine Komponente,
 * gerendert wurde eine andere.
 *
 *   node scripts/route-check.mjs [basis-url]
 */

const B = process.argv[2] ?? "http://localhost:3000";

/** Was auf einer Route stehen muss und was verschwunden sein muss. */
const PRUEFUNGEN = [
  {
    name: "Jobs — geteilte Ansicht",
    pfad: (id) => `/app/jobs?job=${id}`,
    muss: ["Warum", "Bewerbung vorbereiten", "Illustration", "Gehalt"],
    darfNicht: [
      "das ist keine schlechte Angabe",
      "wichtige Punkte stehen nicht in der Anzeige",
    ],
  },
  {
    name: "Jobdetail — eigene Seite",
    pfad: (id) => `/app/jobs/${id}`,
    muss: ["Warum", "Bewerbung vorbereiten", "Illustration", "geprüft"],
    darfNicht: ["das ist keine schlechte Angabe"],
  },
  {
    name: "Nina",
    pfad: () => "/app/nina",
    muss: ["Live sprechen", "Was ich über dich weiß"],
    darfNicht: [],
  },
];

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const p = await ctx.newPage();
const seitenfehler = [];
p.on("pageerror", (e) => seitenfehler.push(e.message.slice(0, 160)));

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`route-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 40000 });

await p.goto(`${B}/app/jobs`, { waitUntil: "networkidle" });
const id = await p.locator("[data-job-id]").first().getAttribute("data-job-id");
if (!id) {
  console.log("Keine Stelle in der Liste — Prüfung nicht möglich.");
  await b.close();
  process.exit(1);
}

let fehler = 0;
for (const pr of PRUEFUNGEN) {
  seitenfehler.length = 0;
  const pfad = pr.pfad(id);
  await p.goto(`${B}${pfad}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  /*
   * Kleingeschrieben vergleichen.
   *
   * `innerText` liefert den GERENDERTEN Text — und CSS `uppercase`
   * schlägt darauf durch. Eine Überschrift „Warum Nina sie zeigt" kommt
   * als „WARUM NINA SIE ZEIGT" zurück. Der erste Anlauf dieses Skripts
   * meldete deshalb zwei Routen als fehlerhaft, die in Ordnung waren.
   */
  const text = (await p.locator("body").innerText()).replace(/\s+/g, " ").toLowerCase();

  const fehlend = pr.muss.filter((m) => !text.includes(m.toLowerCase()));
  const uebrig = pr.darfNicht.filter((d) => text.includes(d.toLowerCase()));
  const kaputt = /schiefgegangen/i.test(text);

  const ok = fehlend.length === 0 && uebrig.length === 0 && !kaputt;
  if (!ok) fehler++;
  console.log(`${ok ? "  ok " : "  !! "} ${pr.name.padEnd(26)} ${pfad}`);
  if (kaputt) console.log("        FEHLERSEITE");
  if (fehlend.length) console.log(`        fehlt:  ${fehlend.join(" | ")}`);
  if (uebrig.length) console.log(`        übrig:  ${uebrig.join(" | ")}`);
  if (seitenfehler.length) console.log(`        JS:     ${seitenfehler[0]}`);
}

console.log(fehler === 0 ? "\nAlle Routen zeigen den erwarteten Stand." : `\n${fehler} Route(n) weichen ab.`);
await b.close();
process.exit(fehler === 0 ? 0 : 1);
