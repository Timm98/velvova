import { z } from "zod";

/**
 * Zod-Schema in JSON Schema uebersetzen, damit ein Anbieter mit Tool Use
 * daran gebunden werden kann. Zod 4 bringt das mit; die Hülle hier haelt
 * die Abhängigkeit an einer Stelle und ergaenzt, was Tool-Use-Schnittstellen
 * zusätzlich erwarten.
 */
export function zodToJsonSchema(schema: z.ZodType<unknown>): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-7", io: "output" }) as Record<string, unknown>;
  if (json.type !== "object") {
    // Tool-Use erwartet auf oberster Ebene ein Objekt.
    return { type: "object", properties: { value: json }, required: ["value"] };
  }
  return json;
}
