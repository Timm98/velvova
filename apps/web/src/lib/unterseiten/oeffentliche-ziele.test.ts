import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ══════════════════════════════════════════════════════════════════
 * Kein öffentlicher Verweis endet in einer Sackgasse
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Der Fehler, den dieser Test festhält ────────────────────────
 *
 * Am 10.09.2026 stand „Preise ansehen" auf der Unternehmensseite und
 * im Fuss jeder Seite. Beide zeigten auf `/pricing`, und `/pricing`
 * war eine Weiterleitung auf `/app/settings/abo` — eine Seite hinter
 * der Anmeldung. Wer die Preise sehen wollte, bekam ein
 * Anmeldeformular.
 *
 * Kaputt war nichts: Die Route antwortete mit 200, die Weiterleitung
 * war beabsichtigt, und für Angemeldete war sie sogar richtig. Genau
 * deshalb fiel es niemandem auf. Ein Verweis, der funktioniert und
 * trotzdem am Ziel vorbeiführt, ist von einem funktionierenden nur
 * dadurch zu unterscheiden, dass man ihm folgt.
 *
 * ── Warum über Dateien und nicht über Verhalten ─────────────────
 *
 * Dieselbe Überlegung wie in `kopfzeile-vollstaendig.test.ts`: Der
 * Defekt ist eine fehlende Verkabelung, kein falsches Ergebnis. Ein
 * Verhaltenstest bräuchte einen laufenden Server und würde trotzdem
 * nur die eine Seite prüfen, an die jemand gedacht hat.
 */

const APP = join(import.meta.dirname, "..", "..", "app");

/** Die Flächen, die ein Besucher ohne Konto zu sehen bekommt. */
const OEFFENTLICH = [
  join(APP, "page.tsx"),
  join(APP, "for-business", "page.tsx"),
  join(APP, "unterstuetzung", "page.tsx"),
  join(APP, "pricing", "page.tsx"),
  join(import.meta.dirname, "..", "..", "components", "shell", "VelvovaFooter.tsx"),
];

interface Route {
  pfad: string;
  datei: string;
  /** Enthält einen Platzhalter wie `[slug]`. */
  dynamisch: boolean;
}

/**
 * Alle Routen aus dem Dateibaum.
 *
 * Gruppen in Klammern — `(public)`, `(auth)` — sind Ordnungsmittel und
 * kommen in keiner Adresse vor. Sie fallen deshalb heraus, und genau
 * das macht diese Zuordnung nötig: `/pricing` lag in `(public)`, und
 * ein naiver Vergleich mit dem Dateipfad hätte es nicht gefunden.
 */
function alleRouten(pfad: string, praefix = "", treffer: Route[] = []): Route[] {
  for (const eintrag of readdirSync(pfad)) {
    const voll = join(pfad, eintrag);
    if (statSync(voll).isDirectory()) {
      const teil = /^\(.*\)$/.test(eintrag) ? praefix : `${praefix}/${eintrag}`;
      alleRouten(voll, teil, treffer);
    } else if (eintrag === "page.tsx") {
      treffer.push({
        pfad: praefix === "" ? "/" : praefix,
        datei: voll,
        dynamisch: praefix.includes("["),
      });
    }
  }
  return treffer;
}

/**
 * Eine Seite, die nichts zeigt, sondern nur weiterschickt.
 *
 * Erkannt daran, dass sie `redirect` aufruft und selbst nichts malt.
 * Eine Seite, die je nach Zustand weiterleitet und sonst etwas
 * darstellt, ist keine Sackgasse — sie hat einen Inhalt.
 */
function istReineWeiterleitung(datei: string): boolean {
  const inhalt = readFileSync(datei, "utf8");
  if (!/\bredirect\(/.test(inhalt)) return false;
  return !/<[a-zA-Z]/.test(inhalt);
}

const ROUTEN = alleRouten(APP);
const STATISCH = new Set(ROUTEN.filter((r) => !r.dynamisch).map((r) => r.pfad));
const NACH_PFAD = new Map(ROUTEN.map((r) => [r.pfad, r]));

/** Die internen Ziele einer Datei, ohne Anker und Suchteil. */
function zieleAus(datei: string): string[] {
  const inhalt = readFileSync(datei, "utf8");
  const treffer = [...inhalt.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]!);
  return [...new Set(treffer.map((z) => z.split(/[?#]/)[0]!).filter((z) => z !== ""))];
}

/**
 * Ob eine Datei diesen Pfad überhaupt nennt.
 *
 * Nötig, weil ein Ziel nicht immer im `href` steht: Auf
 * `/for-business` hängt der Hauptknopf am Verfügbarkeitsregister und
 * bekommt seine Adresse aus einer Variablen. Genau darin liegt auch
 * die Grenze der Prüfung oben — ein toter Verweis, dessen Adresse
 * erst zur Laufzeit entsteht, fällt ihr nicht auf.
 */
function nenntZiel(datei: string, pfad: string): boolean {
  return readFileSync(datei, "utf8").includes(`"${pfad}"`);
}

describe("Öffentliche Verweise", () => {
  it("prüft überhaupt Dateien, die es gibt", () => {
    expect(OEFFENTLICH.filter((d) => !existsSync(d))).toEqual([]);
    expect(ROUTEN.length).toBeGreaterThan(20);
  });

  it("zeigen auf Seiten, die es gibt", () => {
    const tot: string[] = [];
    for (const datei of OEFFENTLICH) {
      for (const ziel of zieleAus(datei)) {
        /* Anwendungsinterne Ziele hinter der Anmeldung sind hier in
           Ordnung — sie sind kein Versprechen an einen Besucher,
           sondern der Weg für jemanden, der schon drin ist. */
        if (ziel.startsWith("/api/")) continue;
        if (!STATISCH.has(ziel)) tot.push(`${datei.split("/src/")[1]} → ${ziel}`);
      }
    }
    expect(tot).toEqual([]);
  });

  it("enden nicht in einer reinen Weiterleitung", () => {
    const sackgassen: string[] = [];
    for (const datei of OEFFENTLICH) {
      for (const ziel of zieleAus(datei)) {
        const route = NACH_PFAD.get(ziel);
        /* Die Anwendung selbst ist ausgenommen: Wer angemeldet ist,
           soll dorthin geschickt werden. Der Test schützt den Weg
           von aussen. */
        if (!route || ziel.startsWith("/app/")) continue;
        if (istReineWeiterleitung(route.datei)) {
          sackgassen.push(`${datei.split("/src/")[1]} → ${ziel}`);
        }
      }
    }
    expect(sackgassen).toEqual([]);
  });
});

describe("Die beiden Einstiege", () => {
  it("gibt es als eigene Seite", () => {
    expect(STATISCH.has("/unterstuetzung")).toBe(true);
    expect(STATISCH.has("/pricing")).toBe(true);
  });

  it("zeigen Preise, statt in die Anmeldung zu schicken", () => {
    expect(istReineWeiterleitung(NACH_PFAD.get("/pricing")!.datei)).toBe(false);
  });

  /*
   * Gegenprobe.
   *
   * Ein Erkenner, der nie anschlägt, macht jeden Test darüber grün und
   * wertlos. `/setup` ist eine echte reine Weiterleitung im Bestand —
   * schlägt er dort nicht an, ist der Test kaputt und nicht der Code.
   */
  it("erkennt eine reine Weiterleitung, wenn es eine gibt", () => {
    expect(istReineWeiterleitung(NACH_PFAD.get("/setup")!.datei)).toBe(true);
  });

  it("führen von der Unternehmensseite aus dorthin", () => {
    const seite = join(APP, "for-business", "page.tsx");
    expect(nenntZiel(seite, "/unterstuetzung")).toBe(true);
    expect(zieleAus(seite).some((z) => z === "/pricing")).toBe(true);
  });
});
