import { describe, expect, it } from "vitest";
import { leseFeed } from "./radar.ts";
import { RADAR_QUELLEN } from "./radar-quellen.ts";

const QUELLE = RADAR_QUELLEN[0]!;

describe("Radar-Feed", () => {
  it("liest Titel, Link, Datum und Beschreibung aus RSS", () => {
    const xml = `<rss><channel>
      <item>
        <title>Arbeitsmarkt im August</title>
        <link>https://example.org/a</link>
        <pubDate>Mon, 25 Aug 2026 09:00:00 +0000</pubDate>
        <description>Kurze Zusammenfassung.</description>
      </item>
    </channel></rss>`;
    const [b] = leseFeed(xml, QUELLE);
    expect(b!.titel).toBe("Arbeitsmarkt im August");
    expect(b!.link).toBe("https://example.org/a");
    expect(b!.beschreibung).toBe("Kurze Zusammenfassung.");
    expect(b!.datum?.getUTCFullYear()).toBe(2026);
  });

  it("versteht auch Atom", () => {
    const xml = `<feed><entry>
      <title>Neue Berufsbilder</title>
      <link href="https://example.org/b"/>
      <updated>2026-08-20T10:00:00Z</updated>
      <summary>Ein Satz.</summary>
    </entry></feed>`;
    const [b] = leseFeed(xml, QUELLE);
    expect(b!.titel).toBe("Neue Berufsbilder");
    expect(b!.link).toBe("https://example.org/b");
  });

  it("entfernt Auszeichnung und CDATA", () => {
    const xml = `<rss><item>
      <title><![CDATA[Titel mit <b>Fett</b>]]></title>
      <link>https://example.org/c</link>
      <description>&lt;p&gt;Text &amp;amp; mehr&lt;/p&gt;</description>
    </item></rss>`;
    const [b] = leseFeed(xml, QUELLE);
    expect(b!.titel).toBe("Titel mit Fett");
    expect(b!.beschreibung).not.toContain("<");
  });

  it("kürzt einen Volltext auf einen Anreisser", () => {
    /*
     * Manche Feeds liefern den ganzen Artikel mit. Ihn vollständig zu
     * übernehmen wäre genau das, was §23.2 ausschliesst — technisch
     * möglich, rechtlich nicht unsere Entscheidung.
     */
    const lang = "Wort ".repeat(300);
    const xml = `<rss><item><title>T</title><link>https://example.org/d</link><description>${lang}</description></item></rss>`;
    const [b] = leseFeed(xml, QUELLE);
    expect(b!.beschreibung.length).toBeLessThanOrEqual(280);
    expect(b!.beschreibung.endsWith("…")).toBe(true);
  });

  it("überspringt Einträge ohne brauchbaren Link", () => {
    const xml = `<rss>
      <item><title>Ohne Link</title></item>
      <item><title>Relativer Link</title><link>/nur/pfad</link></item>
      <item><title>Gut</title><link>https://example.org/e</link></item>
    </rss>`;
    // Ein Beitrag ohne Ziel ist wertlos: der ganze Sinn ist der Weg
    // zum Original beim Herausgeber.
    expect(leseFeed(xml, QUELLE).map((b) => b.titel)).toEqual(["Gut"]);
  });

  it("kommt mit Unsinn zurecht, ohne zu werfen", () => {
    for (const müll of ["", "kein xml", "<rss>", "<item></item>"]) {
      expect(() => leseFeed(müll, QUELLE)).not.toThrow();
    }
  });
});

describe("Radar-Quellen", () => {
  it("nennt für jede Quelle die Grundlage", () => {
    // Ohne benannte Grundlage keine Quelle. Die Frage „dürfen wir das?"
    // muss beantwortet in der Datei stehen, nicht im Gedächtnis.
    for (const q of RADAR_QUELLEN) {
      expect(q.grundlage.length, q.name).toBeGreaterThan(20);
      expect(q.feed).toMatch(/^https:\/\//);
    }
  });
});
