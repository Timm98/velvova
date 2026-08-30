import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

/**
 * Die Quellendokumentation aus dem Verzeichnis erzeugen.
 *
 * Von Hand gepflegte Compliance-Tabellen laufen auseinander — und dann
 * beschreibt das Dokument etwas anderes, als der Code tut. Genau das
 * darf hier nicht passieren: was in LEGAL_SOURCE_REGISTER.md steht, ist
 * dasselbe, was die Policy Engine durchsetzt.
 *
 *   node scripts/generate-source-docs.mjs
 */

// Die Registry ist TypeScript; sie wird über Node mit Typstripping
// geladen. Ein zweiter Datenbestand in JSON wäre genau die Dopplung,
// die dieses Skript verhindern soll.
const script = `
import { SOURCE_REGISTRY } from "./apps/web/src/lib/sources/source-registry.ts";
import { decideForEntry } from "./apps/web/src/lib/sources/policy-engine.ts";
const now = new Date();
console.log(JSON.stringify(
  SOURCE_REGISTRY.map((entry) => ({ entry, decision: decideForEntry(entry, now) })),
));
`;
writeFileSync(".source-docs.tmp.ts", script);

let rows;
try {
  const out = execFileSync("node", ["--experimental-strip-types", ".source-docs.tmp.ts"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  rows = JSON.parse(out.trim().split("\n").at(-1));
} finally {
  execFileSync("rm", ["-f", ".source-docs.tmp.ts"]);
}

const stamp = new Date().toISOString().slice(0, 10);

const DECISION_DE = {
  approved: "freigegeben",
  link_only: "nur Verweis",
  private_import: "privat",
  pending_review: "ungeprüft",
  blocked: "gesperrt",
};

const header = `<!--
  ERZEUGT — nicht von Hand bearbeiten.

  Quelle: apps/web/src/lib/sources/source-registry.ts
  Neu erzeugen: node scripts/generate-source-docs.mjs

  Von Hand gepflegte Compliance-Tabellen laufen auseinander. Dieses
  Dokument kann das nicht: es wird aus derselben Datei erzeugt, die die
  Policy Engine benutzt.
-->

`;

const disclaimer = `> **Technische Risikosteuerung, keine Rechtsberatung.**
> Diese Tabelle bildet ab, was der Code durchsetzt. Vor einem öffentlichen
> Betrieb, großflächiger Metasuche, Bewertungsaggregation oder nativer
> Bewerbung muss eine auf Datenbank-, Wettbewerbs-, Urheber-, Datenschutz-
> und Plattformrecht spezialisierte Kanzlei die konkreten Verträge, Länder
> und Datenflüsse prüfen.

`;

// ── LEGAL_SOURCE_REGISTER.md ────────────────────────────────────
let register = `${header}# Rechtliches Quellenverzeichnis

Stand: ${stamp}

${disclaimer}`;

for (const { entry, decision } of rows) {
  register += `## ${entry.displayName}

\`${entry.providerKey}\`

| | |
|---|---|
| **Zweck** | ${entry.sourceType} |
| **Rechts-/Vertragsgrundlage** | \`${entry.legalBasis}\` |
| **Zugangsart** | \`${entry.accessMode}\` |
| **Entscheidung** | **${DECISION_DE[decision.decision]}** |
| **Erlaubte Vorgänge** | ${decision.allowedOperations.length ? decision.allowedOperations.map((o) => `\`${o}\``).join(", ") : "keine"} |
| **Erlaubte Felder** | ${decision.allowedFields.length ? decision.allowedFields.map((f) => `\`${f}\``).join(", ") : "keine"} |
| **Volltext** | ${entry.fullTextAllowed ? "erlaubt" : "nicht erlaubt"} |
| **Logo** | ${entry.logoUsageAllowed ? "erlaubt" : "nicht erlaubt"} |
| **Zwischenspeicherung** | ${entry.maxCacheHours === null ? "—" : `höchstens ${entry.maxCacheHours} h`} |
| **Attribution** | ${entry.attributionText ?? "—"} |
| **Original-Link Pflicht** | ${entry.requiresOriginalLink ? "ja" : "nein"} |
| **Native Bewerbung** | ${entry.nativeApplyAllowed ? "erlaubt" : "nicht erlaubt"} |
| **Länder** | ${entry.countriesAllowed.length ? entry.countriesAllowed.join(", ") : "—"} |
| **Bedingungen** | ${entry.termsUrl ? `[${entry.termsUrl}](${entry.termsUrl})` : "—"} |
| **Fassung** | ${entry.termsVersion ?? "—"} |
| **Zuletzt geprüft** | ${entry.termsCheckedAt ?? "**nie**"} |
| **Nächste Prüfung** | ${entry.nextLegalReviewAt ?? "—"} |
| **Verantwortlich** | ${entry.reviewOwner} |
| **In Betrieb** | ${entry.enabled ? "ja" : `nein — ${entry.killSwitchReason ?? "ohne Angabe"}`} |
| **Entfernungsweg** | ${entry.removalEndpoint ?? "—"} |

${entry.note}

`;
}

writeFileSync("docs/LEGAL_SOURCE_REGISTER.md", register);

// ── SOURCE_COMPLIANCE_MATRIX.md ─────────────────────────────────
let matrix = `${header}# Quellen-Compliance-Matrix

Stand: ${stamp}

${disclaimer}| Quelle | Grundlage | Entscheidung | Suchen | Abrufen | Cachen | Anzeigen | Zusammenfassen | Einbetten | Ranken | Native Apply |
|---|---|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
`;

const ops = ["Search", "FetchDetails", "Cache", "PublicDisplay", "Summarize", "Embed", "Rank"];
for (const { entry, decision } of rows) {
  const cells = ops.map((op) => (decision.allowedOperations.includes(op) ? "✓" : "—"));
  matrix += `| ${entry.displayName} | \`${entry.legalBasis}\` | ${DECISION_DE[decision.decision]} | ${cells.join(" | ")} | ${entry.nativeApplyAllowed ? "✓" : "—"} |\n`;
}

matrix += `
## Was die Engine erzwingt

- Eine Quelle **ohne Eintrag** ist \`ungeprüft\` — nicht „vermutlich in Ordnung".
- Eine Quelle **ohne Freigabe** wird nicht abgerufen. Auch nicht, um sie
  anschließend umzuformulieren: *Umformulieren ist keine Rechtsgrundlage.*
- **Kein \`Summarize\` ohne \`FetchDetails\`.** Wer nicht lesen darf, darf auch
  nicht zusammenfassen.
- Eine Stelle **ohne Verweis auf das Original** wird nicht veröffentlicht.
- Eine **abgelaufene Prüfung** setzt die Quelle selbsttätig auf \`ungeprüft\`.
- Der **Kill Switch** wirkt vor dem ersten Netzzugriff, nicht danach.

Durchgesetzt in \`apps/web/src/lib/sources/policy-engine.ts\`, geprüft in
\`apps/web/src/lib/sources/policy-engine.test.ts\`.
`;

writeFileSync("docs/SOURCE_COMPLIANCE_MATRIX.md", matrix);

const approved = rows.filter((r) => r.decision.decision === "approved").length;
console.log(
  `LEGAL_SOURCE_REGISTER.md und SOURCE_COMPLIANCE_MATRIX.md erzeugt: ` +
    `${approved} von ${rows.length} Quellen freigegeben.`,
);
