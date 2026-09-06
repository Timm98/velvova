import { describe, expect, it } from "vitest";
import { pruefeArbeitgeberBoard } from "./verifizierung.ts";

/**
 * Die Prüfung entscheidet, ob wir ein fremdes System abfragen dürfen.
 *
 * Zwei Fehlerrichtungen, und die erste ist die gefährliche:
 *
 *   **Zu leicht überzeugt.** Ein Board wird eingetragen, obwohl der
 *   Arbeitgeber es nie veröffentlicht hat. Aus einem geratenen
 *   Bezeichner wird eine Quelle — und aus dem Produkt ein Werkzeug, das
 *   fremde Bewerbersysteme aufzählt.
 *
 *   **Zu streng.** Ein echtes Board wird abgelehnt. Ärgerlich, aber
 *   sichtbar und mit einem Satz behebbar.
 */

function seite(inhalt: string, typ = "text/html"): typeof fetch {
  return (async () =>
    new Response(inhalt, { status: 200, headers: { "content-type": typ } })) as unknown as typeof fetch;
}

const nichts: typeof fetch = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;

describe("Nachweis gefunden", () => {
  it("erkennt einen Link auf das Board der Firma", async () => {
    const r = await pruefeArbeitgeberBoard(
      "greenhouse",
      "musterfirma",
      "muster.de",
      { fetchImpl: seite('<a href="https://boards.greenhouse.io/musterfirma">Offene Stellen</a>') },
    );
    expect(r.ok).toBe(true);
    expect(r.fundstelle).toContain("muster.de");
    expect(r.beleg).toContain("musterfirma");
  });

  it("erkennt Lever, Ashby und SmartRecruiters genauso", async () => {
    const faelle = [
      ["lever", "https://jobs.lever.co/musterfirma"],
      ["ashby", "https://jobs.ashbyhq.com/musterfirma"],
      ["smartrecruiters", "https://careers.smartrecruiters.com/musterfirma"],
    ] as const;
    for (const [board, url] of faelle) {
      const r = await pruefeArbeitgeberBoard(board, "musterfirma", "muster.de", {
        fetchImpl: seite(`<a href="${url}">Karriere</a>`),
      });
      expect(r.ok, board).toBe(true);
    }
  });

  it("hält den Beleg fest, damit die Entscheidung nachvollziehbar bleibt", async () => {
    // Ohne Beleg steht in der Datenbank eine Berechtigung, die niemand
    // mehr überprüfen kann — und die deshalb nie wieder hinterfragt wird.
    const r = await pruefeArbeitgeberBoard("greenhouse", "musterfirma", "muster.de", {
      fetchImpl: seite('<a href="https://boards.greenhouse.io/musterfirma">Jobs</a>'),
    });
    expect(r.beleg).toMatch(/verlinkt sein greenhouse-Board/);
    expect(r.beleg).toMatch(/Geprüft am \d{4}-\d{2}-\d{2}/);
  });
});

describe("Kein Nachweis", () => {
  it("lehnt ab, wenn die Seite das Board nicht nennt", async () => {
    const r = await pruefeArbeitgeberBoard("greenhouse", "musterfirma", "muster.de", {
      fetchImpl: seite("<h1>Willkommen bei Muster</h1><p>Wir sind ein Familienunternehmen.</p>"),
    });
    expect(r.ok).toBe(false);
    expect(r.grund).toMatch(/kein Verweis/i);
  });

  it("lehnt ab, wenn die Seite gar nicht antwortet", async () => {
    const r = await pruefeArbeitgeberBoard("greenhouse", "musterfirma", "muster.de", { fetchImpl: nichts });
    expect(r.ok).toBe(false);
  });

  it("lässt sich nicht vom Host allein überzeugen", async () => {
    /*
     * Eine Seite kann Greenhouse für etwas anderes einbinden — ein
     * Bewerbungsformular, ein Skript, eine andere Tochterfirma. Der
     * Host allein ist kein Nachweis für DIESEN Bezeichner.
     */
    const r = await pruefeArbeitgeberBoard("greenhouse", "musterfirma", "muster.de", {
      fetchImpl: seite('<script src="https://boards.greenhouse.io/embed/job_board.js"></script>'),
    });
    expect(r.ok).toBe(false);
  });

  it("lässt sich nicht vom Bezeichner allein überzeugen", async () => {
    // Der Bezeichner ist meistens der Firmenname und steht überall auf
    // der Seite. Für sich genommen sagt er nichts.
    const r = await pruefeArbeitgeberBoard("greenhouse", "musterfirma", "muster.de", {
      fetchImpl: seite("<h1>musterfirma</h1><p>musterfirma ist ein Familienunternehmen.</p>"),
    });
    expect(r.ok).toBe(false);
  });

  it("verwechselt keine ähnlichen Bezeichner", async () => {
    /*
     * `musterfirma-gmbh` ist nicht `musterfirma`. Ohne Wortgrenze
     * würde ein Board eingetragen, das jemand anderem gehört — und
     * genau das wäre der Übergriff, den diese Prüfung verhindern soll.
     */
    const r = await pruefeArbeitgeberBoard("greenhouse", "musterfirma", "muster.de", {
      fetchImpl: seite('<a href="https://boards.greenhouse.io/musterfirmaholding">Jobs</a>'),
    });
    expect(r.ok).toBe(false);
  });

  it("weist eine unbrauchbare Domäne ohne Netzzugriff ab", async () => {
    let gerufen = false;
    const r = await pruefeArbeitgeberBoard("greenhouse", "x", "keine-domäne", {
      fetchImpl: (async () => {
        gerufen = true;
        return new Response("");
      }) as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    expect(gerufen).toBe(false);
  });

  it("liest kein HTML aus einer Nicht-HTML-Antwort", async () => {
    // Ein JSON-Dokument, das zufällig die Zeichenkette enthält, ist
    // keine Karriereseite.
    const r = await pruefeArbeitgeberBoard("greenhouse", "musterfirma", "muster.de", {
      fetchImpl: seite('{"x":"boards.greenhouse.io/musterfirma"}', "application/json"),
    });
    expect(r.ok).toBe(false);
  });
});
