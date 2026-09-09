import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodToJsonSchema } from "../jsonSchema.ts";
import { fuerGeminiSaeubern, sseLesen } from "./gemini.ts";

/*
 * Geprüft wird, was ohne Netz prüfbar ist: der Schemafilter und der
 * Zerleger für den Ereignisstrom. Beide sind die Stellen, an denen ein
 * Fehler still bleibt — ein abgelehntes Schema kommt als Fehlermeldung
 * über ein Feld zurück, das es gar nicht gibt, und ein zerschnittenes
 * JSON verschluckt einfach einen Teil der Antwort.
 *
 * Was hier NICHT geprüft wird: dass Google diese Anfragen annimmt. Das
 * kann nur ein echter Aufruf, und dafür lag kein Schlüssel vor.
 */

describe("Der Schemafilter", () => {
  it("wirft die Schlüsselwörter weg, die Gemini nicht kennt", () => {
    const sauber = fuerGeminiSaeubern({
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      additionalProperties: false,
      properties: { name: { type: "string" } },
      required: ["name"],
    }) as Record<string, unknown>;

    expect(sauber.$schema).toBeUndefined();
    expect(sauber.additionalProperties).toBeUndefined();
    expect(sauber.type).toBe("object");
    expect(sauber.required).toEqual(["name"]);
  });

  it("räumt auch in der Tiefe auf", () => {
    /*
     * Der Fall, der ohne Rekursion durchrutscht: Das oberste Schema
     * ist sauber, und in einem verschachtelten Objekt steht noch ein
     * `additionalProperties`.
     */
    const sauber = fuerGeminiSaeubern({
      type: "object",
      properties: {
        adresse: { type: "object", additionalProperties: false, properties: {} },
      },
    }) as { properties: { adresse: Record<string, unknown> } };

    expect(sauber.properties.adresse.additionalProperties).toBeUndefined();
  });

  it("räumt in Listen auf", () => {
    const sauber = fuerGeminiSaeubern({
      type: "array",
      items: [{ type: "string", default: "x" }],
    }) as { items: Record<string, unknown>[] };

    expect(sauber.items[0]?.default).toBeUndefined();
    expect(sauber.items[0]?.type).toBe("string");
  });

  it("lässt ein echtes Zod-Schema übrig, mit dem sich arbeiten lässt", () => {
    /*
     * Nicht nur „es wirft nichts": Nach dem Filtern müssen Typ,
     * Eigenschaften und Pflichtfelder noch da sein — sonst bindet das
     * Schema die Antwort an nichts mehr.
     */
    const roh = zodToJsonSchema(
      z.object({ titel: z.string(), treffer: z.array(z.string()) }),
    );
    const sauber = fuerGeminiSaeubern(roh) as Record<string, unknown>;

    expect(sauber.type).toBe("object");
    expect(Object.keys(sauber.properties as object)).toEqual(["titel", "treffer"]);
    expect(sauber.required).toEqual(["titel", "treffer"]);
    expect(JSON.stringify(sauber)).not.toContain("$schema");
  });

  it("lässt einfache Werte in Ruhe", () => {
    expect(fuerGeminiSaeubern("text")).toBe("text");
    expect(fuerGeminiSaeubern(null)).toBeNull();
    expect(fuerGeminiSaeubern(7)).toBe(7);
  });
});

/** Eine Antwort mit einem Körper bauen, der in vorgegebenen Stücken kommt. */
function stromAus(...stuecke: string[]): Response {
  const koder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(steuerung) {
        for (const s of stuecke) steuerung.enqueue(koder.encode(s));
        steuerung.close();
      },
    }),
  );
}

async function alle(antwort: Response) {
  const raus = [];
  for await (const stueck of sseLesen(antwort)) raus.push(stueck);
  return raus;
}

describe("Der Zerleger für den Ereignisstrom", () => {
  it("liest zwei vollständige Ereignisse", async () => {
    const stuecke = await alle(
      stromAus(
        'data: {"candidates":[{"content":{"parts":[{"text":"Hallo"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":" Welt"}]}}]}\n\n',
      ),
    );
    expect(stuecke.map((s) => s.candidates?.[0]?.content?.parts?.[0]?.text)).toEqual([
      "Hallo", " Welt",
    ]);
  });

  it("setzt ein Ereignis zusammen, das über zwei Netzpakete verteilt ankommt", async () => {
    /*
     * Der eigentliche Grund für den Puffer. Ohne ihn zerbricht das
     * JSON in der Mitte, `JSON.parse` scheitert, und das Stück ist
     * weg — bei langen Antworten also regelmässig ein Satzfragment.
     */
    const stuecke = await alle(
      stromAus(
        'data: {"candidates":[{"content":{"parts":[{"text":"Ein la',
        'ngerer Satz"}]}}]}\n\n',
      ),
    );
    expect(stuecke).toHaveLength(1);
    expect(stuecke[0]?.candidates?.[0]?.content?.parts?.[0]?.text).toBe("Ein langerer Satz");
  });

  it("überspringt ein kaputtes Stück, statt den ganzen Strom abzubrechen", async () => {
    const stuecke = await alle(
      stromAus(
        "data: {kaputt\n\n",
        'data: {"candidates":[{"content":{"parts":[{"text":"danach"}]}}]}\n\n',
      ),
    );
    expect(stuecke).toHaveLength(1);
    expect(stuecke[0]?.candidates?.[0]?.content?.parts?.[0]?.text).toBe("danach");
  });

  it("ignoriert Zeilen, die keine Nutzlast sind", async () => {
    const stuecke = await alle(
      stromAus(
        ": Kommentar\n",
        "event: message\n",
        'data: {"usageMetadata":{"promptTokenCount":12}}\n\n',
        "data: [DONE]\n\n",
      ),
    );
    expect(stuecke).toHaveLength(1);
    expect(stuecke[0]?.usageMetadata?.promptTokenCount).toBe(12);
  });

  it("kommt mit einem leeren Körper zurecht", async () => {
    expect(await alle(new Response(null))).toEqual([]);
  });
});
