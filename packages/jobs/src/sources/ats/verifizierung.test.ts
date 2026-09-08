import { describe, expect, it } from "vitest";
import { findeArbeitgeberBoards, pruefeArbeitgeberBoard } from "./verifizierung.ts";

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

describe("Recruitee: der Bezeichner steht davor, nicht dahinter", () => {
  /*
   * ── Warum das eine eigene Beschreibung verdient ───────────────
   *
   * Vier Anbieter hängen den Arbeitgeber hinten an
   * (`boards.greenhouse.io/musterfirma`), Recruitee stellt ihn davor
   * (`musterfirma.recruitee.com`). Der Pfadleser findet auf
   * `musterfirma.recruitee.com/o/stelle` den Bezeichner `o` — ein
   * Treffer, der nach Verifizierung aussieht und keine ist.
   *
   * Die Tests hier prüfen beide Richtungen: dass die richtige Form
   * erkannt wird, und dass die falschen es nicht werden.
   */

  it("erkennt den Mandanten in der Subdomäne", async () => {
    const r = await pruefeArbeitgeberBoard("recruitee", "musterfirma", "muster.de", {
      fetchImpl: seite('<a href="https://musterfirma.recruitee.com/o/stelle-1">Offene Stellen</a>'),
    });
    expect(r.ok).toBe(true);
    expect(r.beleg).toContain("musterfirma");
  });

  it("lässt sich von einem ähnlichen Mandanten nicht überzeugen", async () => {
    /*
     * Ohne die Wache vor dem Bezeichner belegte `musterfirma` auch
     * `nichtmusterfirma.recruitee.com` — ein fremdes Board, gemessen
     * an einem Namen, der zufällig darin endet.
     */
    const r = await pruefeArbeitgeberBoard("recruitee", "musterfirma", "muster.de", {
      fetchImpl: seite('<a href="https://nichtmusterfirma.recruitee.com/o/stelle-1">Jobs</a>'),
    });
    expect(r.ok).toBe(false);
  });

  it("nimmt den Host allein nicht als Beleg", async () => {
    const r = await pruefeArbeitgeberBoard("recruitee", "musterfirma", "muster.de", {
      fetchImpl: seite('<script src="https://cdn.recruitee.com/widget.js"></script>'),
    });
    expect(r.ok).toBe(false);
  });

  it("liest den Mandanten aus der Karriereseite", async () => {
    const funde = await findeArbeitgeberBoards("muster.de", {
      fetchImpl: seite('<a href="https://musterfirma.recruitee.com/o/stelle-1">Karriere</a>'),
    });
    expect(funde).toHaveLength(1);
    expect(funde[0]).toMatchObject({ board: "recruitee", boardToken: "musterfirma" });
  });

  it("hält Recruitees eigene Seiten nicht für Arbeitgeber", async () => {
    /*
     * `www.recruitee.com` und `help.recruitee.com` gehören dem
     * Anbieter. Ohne diese Ausnahme würde jede Seite, die auf
     * Recruitees Hilfe verlinkt, den Arbeitgeber „help" registrieren.
     */
    const funde = await findeArbeitgeberBoards("muster.de", {
      fetchImpl: seite(
        '<a href="https://www.recruitee.com">Bewerbersystem</a>' +
        '<a href="https://help.recruitee.com/de">Hilfe</a>',
      ),
    });
    expect(funde).toHaveLength(0);
  });

  it("verwechselt das Pfadsegment nicht mit dem Mandanten", async () => {
    /* Aus `.../o/stelle-1` darf kein Arbeitgeber `o` werden. */
    const funde = await findeArbeitgeberBoards("muster.de", {
      fetchImpl: seite('<a href="https://musterfirma.recruitee.com/o/stelle-1">Karriere</a>'),
    });
    expect(funde.map((f) => f.boardToken)).not.toContain("o");
  });

  it("lässt die Pfadform der anderen vier unberührt", async () => {
    const funde = await findeArbeitgeberBoards("muster.de", {
      fetchImpl: seite('<a href="https://boards.greenhouse.io/musterfirma/jobs/1">Karriere</a>'),
    });
    expect(funde).toContainEqual(
      expect.objectContaining({ board: "greenhouse", boardToken: "musterfirma" }),
    );
  });
});
