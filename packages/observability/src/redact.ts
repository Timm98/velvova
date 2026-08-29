/**
 * Redaktion fuer Protokolle und Nutzungsmessung.
 *
 * Die Regel ist einfach und hart: Chattexte, Dokumentinhalte und
 * Freitexte des Menschen erscheinen nirgends in einem Protokoll. Was
 * bleibt, sind Ereignisart, Kennungen und Zahlen.
 *
 * Der Grund ist nicht Formalismus. Ein Protokoll wird kopiert,
 * durchsucht, an Werkzeuge weitergereicht und lange aufbewahrt - es ist
 * der Ort, an dem personenbezogene Daten am ehesten unbemerkt liegen
 * bleiben.
 */

/** Feldnamen, deren Werte nie protokolliert werden. */
export const NEVER_LOG = [
  "password", "passwordHash", "token", "tokenHash", "authorization", "cookie",
  "answer", "statement", "content", "body", "extractedText", "draftMessage",
  "careerCompass", "rationale", "notes", "credentialsEncrypted", "apiKey",
] as const;

const PATTERNS: [RegExp, string][] = [
  [/\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g, "[E-Mail]"],
  [/\b(?:\+49|0)[\s\-/]?\d{2,5}[\s\-/]?\d{3,}\b/g, "[Telefon]"],
  [/\bDE\d{2}[\s]?(?:\d{4}[\s]?){4}\d{2}\b/gi, "[IBAN]"],
  [/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[IP]"],
];

export function redactText(text: string): string {
  return PATTERNS.reduce((acc, [re, replacement]) => acc.replace(re, replacement), text);
}

/**
 * Redigiert ein Objekt rekursiv. Bekannte Geheimnisfelder werden
 * vollstaendig ersetzt, alle uebrigen Zeichenketten gemustert.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[zu tief]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = (NEVER_LOG as readonly string[]).includes(k) ? "[entfernt]" : redact(v, depth + 1);
    }
    return out;
  }
  return "[unbekannt]";
}
