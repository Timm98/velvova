import { decideForUrl } from "./policy-engine.ts";
import { findByUrl } from "./source-registry.ts";

/**
 * Was mit einem eingefügten Stellenlink überhaupt passieren darf.
 *
 * Jemand kopiert eine Adresse von LinkedIn, Indeed, StepStone oder
 * Monster und erwartet eine Analyse. Die naheliegende Antwort — die
 * Seite abrufen und auswerten — ist genau die, die wir nicht geben:
 * diese Plattformen stehen als `link_only` in der Quellenliste, mit
 * leeren `allowedOperations`. Kein Abruf, kein Zwischenspeichern, kein
 * Umformulieren.
 *
 * Die zweitnaheliegende Antwort wäre, die offizielle Stelle beim
 * Arbeitgeber zu SUCHEN: aus „Thermondo" einen Board-Bezeichner raten
 * und `boards.greenhouse.io/thermondo` probieren. Auch das nicht — und
 * das ist die interessantere Grenze. Die Quellenliste sagt zu jedem
 * ATS-Eintrag ausdrücklich: „Der Board-Bezeichner kommt aus einer
 * Registrierung mit verifizierter Domäne, nie aus einer Suche." Wer
 * Bezeichner errät und durchprobiert, betreibt Aufzählung fremder
 * Systeme — auch dann, wenn jeder einzelne Treffer öffentlich wäre.
 *
 * Bleibt der ehrliche Weg, und er ist besser als er klingt:
 *
 *   1. Die Adresse ANSEHEN, nicht abrufen. In den meisten
 *      Plattform-URLs stehen Titel und Arbeitgeber im Pfad. Das zu
 *      lesen ist kein Zugriff auf die Plattform — es ist das Lesen
 *      dessen, was die Person selbst eingefügt hat.
 *
 *   2. Den Arbeitgeber in den REGISTRIERTEN Boards nachschlagen. Ist er
 *      dabei, gibt es eine freigegebene Originalquelle, und die darf
 *      vollständig analysiert werden.
 *
 *   3. Ist er nicht dabei, das sagen — und den Weg anbieten, der immer
 *      funktioniert: die Person fügt den Text selbst ein oder lädt die
 *      Anzeige als Datei hoch. Ihre eigene Kopie, ihre eigene Analyse,
 *      nichts davon wird veröffentlicht.
 *
 * Schritt 3 ist kein Notbehelf. Er ist der einzige Weg, der bei jeder
 * Plattform funktioniert, ohne dass jemand einen Vertrag unterschreiben
 * muss — und er ist der einzige, bei dem die Person sieht, was
 * analysiert wird.
 */

/** Was mit diesem Link geht. */
export type LinkModus =
  /** Freigegebene Quelle: vollständig abrufen und analysieren. */
  | "approved_source"
  /** Plattform gesperrt, aber der Arbeitgeber hat ein registriertes Board. */
  | "canonical_employer_source"
  /** Plattform gesperrt, keine Originalquelle bekannt: nur Verweis. */
  | "link_only"
  /** Unbekannte Adresse — weder freigegeben noch als Plattform erfasst. */
  | "unknown_source";

export interface LinkAnalyse {
  modus: LinkModus;
  /** Der Anzeigename der erkannten Quelle, falls bekannt. */
  quelle: string | null;
  /** Aus dem Pfad gelesen — nie abgerufen. Kann leer sein. */
  vermuteterTitel: string | null;
  vermuteterArbeitgeber: string | null;
  /** Was der Person gesagt wird. Ein Satz, ohne Fachwort. */
  hinweis: string;
  /** Darf die Person den Text selbst beisteuern? */
  eigenerImportMöglich: boolean;
}

/*
 * Wie die vier Plattformen ihre Adressen bauen.
 *
 * Bewusst keine allgemeine Heuristik über beliebige URLs: geraten wird
 * hier nichts. Erkennt ein Muster nichts, bleibt das Feld leer, und die
 * Person wird gefragt. Ein falsch geratener Arbeitgeber wäre schlimmer
 * als eine offene Frage — er würde in die Analyse einfliessen.
 */
const PFADMUSTER: { host: RegExp; muster: RegExp; titel: number; firma: number | null }[] = [
  // linkedin.com/jobs/view/senior-product-manager-at-thermondo-4021…
  {
    host: /linkedin\.com$/i,
    muster: /\/jobs\/view\/([a-z0-9-]+?)-at-([a-z0-9-]+?)-\d+/i,
    titel: 1,
    firma: 2,
  },
  // stepstone.de/stellenangebote--Titel-Ort-Firma--123456-inline.html
  {
    host: /stepstone\.(de|com)$/i,
    muster: /\/stellenangebote--([^-]+(?:-[^-]+)*?)--\d+/i,
    titel: 1,
    firma: null,
  },
  // indeed: der Titel steht nicht im Pfad, nur eine Kennung.
  { host: /indeed\.(com|de)$/i, muster: /\/(?:viewjob|jobs)/i, titel: 0, firma: null },
  // monster.de/job-openings/titel-ort--kennung
  {
    host: /monster\.(de|com)$/i,
    muster: /\/job-openings\/([a-z0-9-]+?)-[a-z]+--/i,
    titel: 1,
    firma: null,
  },
];

/** Aus „senior-product-manager" wird „Senior Product Manager". */
function ausSlug(slug: string): string | null {
  const w = slug
    .split("-")
    .filter(Boolean)
    .map((t) => (t.length <= 2 ? t : t[0]!.toUpperCase() + t.slice(1)));
  const text = w.join(" ").trim();
  // Ein einzelnes Wort oder eine Zahlenfolge ist kein Titel.
  return text.length >= 4 && /[a-zäöü]/i.test(text) ? text : null;
}

/**
 * Was in der Adresse steht — ohne sie abzurufen.
 */
export function ausAdresseLesen(url: URL): {
  titel: string | null;
  arbeitgeber: string | null;
} {
  for (const p of PFADMUSTER) {
    if (!p.host.test(url.hostname.replace(/^www\./, ""))) continue;
    const m = p.muster.exec(url.pathname);
    if (!m) continue;
    return {
      titel: p.titel > 0 ? ausSlug(m[p.titel] ?? "") : null,
      arbeitgeber: p.firma !== null ? ausSlug(m[p.firma] ?? "") : null,
    };
  }
  return { titel: null, arbeitgeber: null };
}

/**
 * Die Entscheidung für einen Link.
 *
 * `registrierteBoards` kommt von aussen — diese Datei kennt keine
 * Datenbank. Übergeben werden die Arbeitgebernamen, für die es eine
 * freigegebene Originalquelle gibt.
 */
export function analysiereLink(
  href: string,
  registrierteBoards: { employerName: string; board: string; boardToken: string }[] = [],
): LinkAnalyse {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return {
      modus: "unknown_source",
      quelle: null,
      vermuteterTitel: null,
      vermuteterArbeitgeber: null,
      hinweis: "Das sieht nicht nach einer Web-Adresse aus.",
      eigenerImportMöglich: false,
    };
  }

  const entscheidung = decideForUrl(url.href);
  const eintrag = findByUrl(url.href);
  const gelesen = ausAdresseLesen(url);

  // ── Freigegeben: der einfache Fall ─────────────────────────
  if (entscheidung.decision === "approved") {
    return {
      modus: "approved_source",
      quelle: eintrag?.displayName ?? null,
      vermuteterTitel: gelesen.titel,
      vermuteterArbeitgeber: gelesen.arbeitgeber,
      hinweis: "Diese Quelle ist freigegeben. Ich lese die Anzeige direkt.",
      eigenerImportMöglich: true,
    };
  }

  // ── Gesperrt: gibt es die Stelle beim Arbeitgeber selbst? ──
  if (gelesen.arbeitgeber) {
    const treffer = registrierteBoards.find(
      (b) => normalisiere(b.employerName) === normalisiere(gelesen.arbeitgeber!),
    );
    if (treffer) {
      return {
        modus: "canonical_employer_source",
        quelle: eintrag?.displayName ?? null,
        vermuteterTitel: gelesen.titel,
        vermuteterArbeitgeber: gelesen.arbeitgeber,
        hinweis: `${gelesen.arbeitgeber} veröffentlicht seine Stellen auch selbst. Ich sehe dort nach — das ist die Originalquelle.`,
        eigenerImportMöglich: true,
      };
    }
  }

  // ── Gesperrt und keine Originalquelle bekannt ──────────────
  if (eintrag) {
    return {
      modus: "link_only",
      quelle: eintrag.displayName,
      vermuteterTitel: gelesen.titel,
      vermuteterArbeitgeber: gelesen.arbeitgeber,
      hinweis:
        `${eintrag.displayName} erlaubt keinen automatischen Zugriff auf die Anzeige. ` +
        "Füge die Stellenbeschreibung ein oder lade sie als Datei hoch — dann sehe ich sie mir an. " +
        "Deine Kopie bleibt bei dir und wird nirgends veröffentlicht.",
      eigenerImportMöglich: true,
    };
  }

  return {
    modus: "unknown_source",
    quelle: null,
    vermuteterTitel: gelesen.titel,
    vermuteterArbeitgeber: gelesen.arbeitgeber,
    hinweis:
      "Diese Adresse kenne ich nicht. Ich rufe nichts ab, was ich nicht geprüft habe — " +
      "füge die Stellenbeschreibung ein, dann sehe ich sie mir an.",
    eigenerImportMöglich: true,
  };
}

function normalisiere(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(gmbh|ag|se|kg|ohg|mbh|co|ltd|inc|bv|nv)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}
