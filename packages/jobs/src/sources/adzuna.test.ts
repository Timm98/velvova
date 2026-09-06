import { describe, expect, it } from "vitest";
import { AdzunaAdapter } from "./adzuna.ts";

/**
 * Dass Adzuna mehr als eine Seite hergibt.
 *
 * Die Adresse endete auf `/search/1` — fest verdrahtet Seite eins. Ein
 * Abruf mit Limit 400 holte 50 Anzeigen, der nächste dieselben 50. Die
 * Quelle sah erschöpft aus; sie wurde nur nie ein zweites Mal gefragt.
 */

function treffer(seite: number | string, anzahl: number) {
  return {
    results: Array.from({ length: anzahl }, (_, i) => ({
      id: `s${seite}-${i}`,
      title: `Stelle ${seite}-${i}`,
      company: { display_name: "Beispiel GmbH" },
      location: { display_name: "Hamburg" },
      description: "Eine Beschreibung mit genug Text, um als Anzeige zu zählen.",
      redirect_url: `https://example.invalid/${seite}-${i}`,
      created: "2026-08-01T00:00:00Z",
    })),
  };
}

function adapterMit(
  seiten: Record<number, number>,
  statusJeSeite: Record<number, number> = {},
  o: { abfragen?: string[]; wiederholtAb?: number } = {},
) {
  const gefragt: number[] = [];
  const a = new AdzunaAdapter({
    appId: "test",
    appKey: "test",
    abfragen: o.abfragen,
    fetchImpl: (async (eingabe: unknown) => {
      const url = new URL(String(eingabe));
      const seite = Number(url.pathname.split("/").pop());
      gefragt.push(seite);
      const status = statusJeSeite[seite];
      if (status) return new Response("{}", { status });
      /*
       * Adzuna liefert jenseits seiner echten Tiefe weiter volle
       * Seiten — mit denselben Anzeigen. Die Attrappe bildet das nach,
       * sonst prüfte der Test eine Höflichkeit, die es nicht gibt.
       */
      const echteSeite = o.wiederholtAb && seite >= o.wiederholtAb ? o.wiederholtAb : seite;
      const was = url.searchParams.get("what") ?? "";
      return new Response(JSON.stringify(treffer(`${was}${echteSeite}` as unknown as number, seiten[seite] ?? 0)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch,
  });
  return { a, gefragt };
}

describe("Adzuna blättert", () => {
  it("holt mehr als fünfzig Anzeigen", async () => {
    const { a } = adapterMit({ 1: 50, 2: 50, 3: 20 });
    const l = await a.fetchListings({ limit: 120 });
    expect(l).toHaveLength(120);
  });

  it("hört nach dem Block auf, in dem eine Seite nicht voll war", async () => {
    /*
     * ── Der Preis der Gleichzeitigkeit, ausgeschrieben ────────
     *
     * Vier Seiten werden zusammen geholt. Ist die zweite schon nicht
     * mehr voll, sind die dritte und vierte bereits unterwegs — bis zu
     * drei Anfragen je Suchbegriff für nichts.
     *
     * Das ist bewusst so: Nacheinander waren es 40 Anzeigen je
     * Sekunde, für 12,3 Millionen also 85 Stunden. Der Aufschlag von
     * höchstens drei Anfragen je Begriff kauft den vierfachen
     * Durchsatz.
     *
     * Der Test hält beides fest — dass Schluss ist, und was es kostet.
     */
    const { a, gefragt } = adapterMit({ 1: 50, 2: 12 });
    const l = await a.fetchListings({ limit: 500 });
    expect(l).toHaveLength(62);

    /*
     * Geprüft wird das Verhalten, nicht die Blockgrösse.
     *
     * Wie viele Seiten gleichzeitig geholt werden, ist eine
     * Einstellgrösse — sie hängt davon ab, wie viele Prozesse laufen,
     * und wurde nach den ersten 429ern von vier auf zwei gesenkt. Eine
     * Zusicherung auf „genau die Seiten 1 bis 4" wäre dann rot
     * geworden, ohne dass etwas kaputt ist.
     *
     * Was gelten muss: Seite 1 und 2 werden geholt, danach ist binnen
     * eines Blocks Schluss — nicht hundert Seiten weiter.
     */
    expect(gefragt).toContain(1);
    expect(gefragt).toContain(2);
    expect(gefragt.length).toBeLessThanOrEqual(8);
  });

  it("liefert nie mehr als das Limit", async () => {
    const { a } = adapterMit({ 1: 50, 2: 50, 3: 50 });
    expect(await a.fetchListings({ limit: 70 })).toHaveLength(70);
  });

  it("gibt bei einer Taktgrenze zurück, was schon da ist", async () => {
    /*
     * Kein Fehler, sondern Schluss.
     *
     * Ein geworfener Fehler verwürfe die schon geholten Anzeigen —
     * das verbrannte Kontingent wäre dann ganz umsonst gewesen.
     */
    const { a } = adapterMit({ 1: 50, 2: 50 }, { 2: 429 });
    expect(await a.fetchListings({ limit: 500 })).toHaveLength(50);
  });

  it("wirft bei einem Fehler auf der allerersten Anfrage", async () => {
    // Da ist nichts zu retten, und die Ursache ist eine andere:
    // falscher Schlüssel oder ausgefallener Dienst.
    const { a } = adapterMit({ 1: 50 }, { 1: 401 });
    await expect(a.fetchListings({ limit: 50 })).rejects.toThrow(/401/);
  });

  it("behält die Ausbeute, wenn ein späterer Suchbegriff ausfällt", async () => {
    /*
     * ── Der Fehler, der 553 Sekunden gekostet hat ─────────────
     *
     * Ein Lauf für die Schweiz sammelte neun Minuten lang Anzeigen,
     * bekam dann einen 503 und lieferte null.
     *
     * Der Grund war eine Bedingung, die harmlos aussah: `seite === 1`
     * sollte „ganz am Anfang" heissen und warf dort einen Fehler. Mit
     * mehreren Suchbegriffen ist es aber der Anfang JEDES Begriffs —
     * ein vorübergehender Ausfall beim zweiten verwarf alles vom
     * ersten.
     *
     * Jetzt entscheidet, ob schon etwas geholt wurde.
     */
    const { a } = adapterMit({ 1: 50, 2: 50 }, { 3: 503 }, {
      abfragen: ["Elektroniker", "Erzieher"],
      wiederholtAb: 9,
    });
    const l = await a.fetchListings({ limit: 500 });
    expect(l).toHaveLength(100);
  });
});

describe("Wenn Adzuna sich wiederholt", () => {
  it("hört auf, sobald eine volle Seite nichts Neues bringt", async () => {
    /*
     * Der teuerste Irrtum bei dieser Quelle.
     *
     * Gemessen: Seite 1.600 antwortet mit fünfzig Treffern — es sind
     * dieselben wie auf Seite 120. Wer nur auf „volle Seite" prüft,
     * blättert tausendmal weiter und importiert immer dieselben
     * fünftausend Anzeigen. Der Bestand sieht dann gewachsen aus.
     */
    const seiten: Record<number, number> = {};
    for (let i = 1; i <= 100; i++) seiten[i] = 50;
    const { a, gefragt } = adapterMit(seiten, {}, { wiederholtAb: 4 });
    const l = await a.fetchListings({ limit: 5000 });
    // Seiten 1 bis 4 sind verschieden, Seite 5 wiederholt Seite 4.
    expect(l.length).toBe(200);
    expect(gefragt.length).toBeLessThanOrEqual(10);
  });

  it("gibt jede Anzeige nur einmal zurück", async () => {
    const seiten: Record<number, number> = { 1: 50, 2: 50, 3: 50 };
    const { a } = adapterMit(seiten, {}, { wiederholtAb: 2 });
    const l = await a.fetchListings({ limit: 500 });
    expect(new Set(l.map((x) => x.externalId)).size).toBe(l.length);
  });

  it("fängt bei jedem Suchbegriff von vorn an", async () => {
    /*
     * Der Weg über die Grenze von 5.000: Mit Begriff beginnt Adzunas
     * Zählung neu. „Elektroniker" hat eigene hundert Seiten.
     */
    const seiten: Record<number, number> = { 1: 50, 2: 50 };
    const { a, gefragt } = adapterMit(seiten, {}, {
      abfragen: ["Elektroniker", "Erzieher"],
      wiederholtAb: 3,
    });
    const l = await a.fetchListings({ limit: 400 });
    const begriffe = gefragt.length;
    /*
     * Zwei Begriffe, je zwei ergiebige Seiten à 50 — zusammen 200
     * verschiedene Anzeigen. Wie viele Anfragen dafür nötig waren,
     * hängt an der Blockgrösse und gehört nicht in die Zusicherung.
     */
    expect(begriffe).toBeGreaterThan(2);
    expect(l.length).toBe(200);
  });
});
