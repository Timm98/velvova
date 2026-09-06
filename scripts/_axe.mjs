import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "de-DE" }).then((c) => c.newPage());
await p.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2000);
const r = await new AxeBuilder({ page: p }).analyze();
for (const v of r.violations.filter((x) => ["serious", "critical"].includes(x.impact))) {
  console.log(v.id, "—", v.help);
  for (const n of v.nodes) {
    console.log("   ", n.target.join(" "));
    console.log("   ", (n.failureSummary ?? "").split("\n").slice(0, 4).join(" | "));
  }
}
await b.close();
