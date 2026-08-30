import { describe, expect, it } from "vitest";
import { extractJobPosting } from "./jobImport.ts";

/**
 * Gelesen wird nur, was der Arbeitgeber selbst als maschinenlesbare
 * Beschreibung veröffentlicht hat. Aus dem Fliesstext einer fremden
 * Seite dasselbe herauszuraten wäre eine Auslegung fremder Inhalte —
 * und die steht uns nicht zu.
 */

const seite = (json: string) =>
  `<html><head><script type="application/ld+json">${json}</script></head><body>egal</body></html>`;

describe("JobPosting aus JSON-LD", () => {
  it("liest die üblichen Felder", () => {
    const p = extractJobPosting(
      seite(
        JSON.stringify({
          "@context": "https://schema.org",
          "@type": "JobPosting",
          title: "Fachkraft Lagerlogistik (m/w/d)",
          datePosted: "2026-08-20",
          validThrough: "2026-10-01",
          hiringOrganization: { "@type": "Organization", name: "Muster GmbH" },
          jobLocation: {
            "@type": "Place",
            address: { "@type": "PostalAddress", addressLocality: "Hamburg" },
          },
          description: "<p>Du nimmst <b>Waren</b> an.</p>",
        }),
      ),
    );

    expect(p?.title).toBe("Fachkraft Lagerlogistik (m/w/d)");
    expect(p?.company).toBe("Muster GmbH");
    expect(p?.location).toBe("Hamburg");
    expect(p?.description).toBe("Du nimmst Waren an.");
    expect(p?.validThrough?.getUTCFullYear()).toBe(2026);
  });

  it("findet das Posting in einer Liste", () => {
    const p = extractJobPosting(
      seite(
        JSON.stringify([
          { "@type": "Organization", name: "Muster GmbH" },
          { "@type": "JobPosting", title: "Sachbearbeitung" },
        ]),
      ),
    );
    expect(p?.title).toBe("Sachbearbeitung");
  });

  it("findet das Posting in einem @graph", () => {
    const p = extractJobPosting(
      seite(JSON.stringify({ "@graph": [{ "@type": "JobPosting", title: "Pflegefachkraft" }] })),
    );
    expect(p?.title).toBe("Pflegefachkraft");
  });

  it("nimmt bei mehreren Orten den ersten", () => {
    const p = extractJobPosting(
      seite(
        JSON.stringify({
          "@type": "JobPosting",
          title: "T",
          jobLocation: [
            { address: { addressLocality: "Hamburg" } },
            { address: { addressLocality: "Bremen" } },
          ],
        }),
      ),
    );
    expect(p?.location).toBe("Hamburg");
  });

  it("gibt null zurück, wenn kein JobPosting da ist", () => {
    // Kein Raten. Die Person bekommt stattdessen die Bitte, den Text
    // einzufügen — das ist ehrlicher als ein erfundener Datensatz.
    expect(extractJobPosting(seite(JSON.stringify({ "@type": "Article", title: "X" })))).toBeNull();
    expect(extractJobPosting("<html><body>Nur Text</body></html>")).toBeNull();
  });

  it("stolpert nicht über kaputtes JSON-LD", () => {
    // Kommt in freier Wildbahn ständig vor. Ein Absturz hier wäre ein
    // Absturz durch fremde Daten.
    const html =
      seite("{ das ist kein json }").replace("</head>", "") +
      seite(JSON.stringify({ "@type": "JobPosting", title: "Trotzdem gefunden" }));
    expect(extractJobPosting(html)?.title).toBe("Trotzdem gefunden");
  });

  it("meldet fehlende Felder als fehlend, nicht als leer geraten", () => {
    const p = extractJobPosting(seite(JSON.stringify({ "@type": "JobPosting", title: "Nur Titel" })));
    expect(p?.title).toBe("Nur Titel");
    expect(p?.company).toBeNull();
    expect(p?.location).toBeNull();
    expect(p?.publishedAt).toBeNull();
  });
});
