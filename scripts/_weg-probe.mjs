import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { geokodieren, wegBerechnen, verfuegbareModi, fehlendeModiGrund } = await import("../apps/web/src/lib/geo/anbieter.ts");
console.log("verfügbare Modi:", verfuegbareModi().join(", ") || "—");
console.log("Grund für fehlende:", fehlendeModiGrund() ?? "—");
for (const ort of ["Karlsruhe", "Bonn, Nordrhein-Westfalen"]) {
  const k = await geokodieren(ort);
  console.log(`geokodieren("${ort}") →`, k ? JSON.stringify(k) : "null");
}
const a = await geokodieren("Karlsruhe");
const b = await geokodieren("Bonn, Nordrhein-Westfalen");
if (a && b) {
  for (const m of ["auto", "rad"]) {
    const w = await wegBerechnen(a, b, m).catch((e) => ({ fehler: String(e).slice(0, 60) }));
    console.log(`wegBerechnen(${m}) →`, JSON.stringify(w));
  }
}
process.exit(0);
