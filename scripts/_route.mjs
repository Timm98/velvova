import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { geokodieren, wegBerechnen } = await import("../apps/web/src/lib/geo/anbieter.ts");
console.log("Geocoding …");
const a = await geokodieren("Karlsruhe");
const b = await geokodieren("Stuttgart");
console.log("  Karlsruhe:", a && `${a.lat.toFixed(3)}, ${a.lon.toFixed(3)}`);
console.log("  Stuttgart:", b && `${b.lat.toFixed(3)}, ${b.lon.toFixed(3)}`);
if (a && b) {
  for (const m of ["auto", "rad", "fuss"]) {
    const w = await wegBerechnen(a, b, m);
    console.log(`  ${m.padEnd(5)} ${w ? `${w.minuten} Min., ${w.kilometer} km` : "nicht ermittelbar"}`);
  }
}
process.exit(0);
