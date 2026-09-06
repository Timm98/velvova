import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { arbeitswegBerechnen } = await import("../apps/web/src/lib/geo/arbeitsweg.ts");
for (const [ort, land] of [["Hamburg, Hamburg", "DE"], ["Springfield", "US"], ["Springfield", "DE"], ["Bonn, Nordrhein-Westfalen", "DE"]]) {
  const b = await arbeitswegBerechnen("Karlsruhe", ort, land);
  const auto = b.strecken.find((s) => s.modus === "auto");
  console.log(`${(ort + " [" + land + "]").padEnd(34)} ${auto ? `${auto.minuten} Min · ${auto.kilometer} km` : b.grund} — ${String(b.zielname ?? "").slice(0, 46)}`);
}
process.exit(0);
