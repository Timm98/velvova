import "server-only";

import { createSupabaseServerClient } from "./server.ts";

/**
 * Dateiablage.
 *
 * Drei Regeln, die den Unterschied zwischen „funktioniert" und „sicher"
 * ausmachen:
 *
 *   1. Der Pfad beginnt immer mit der Nutzerkennung. Daran hängt die
 *      Zugriffsregel in der Datenbank — nicht an einer Prüfung im
 *      Anwendungscode, die man vergessen kann.
 *   2. Links sind kurzlebig und signiert. Es gibt keinen öffentlichen
 *      Lebenslauf.
 *   3. Der Dateiname wird normalisiert. Ein Name aus einem fremden
 *      Betriebssystem hat in einem Pfad nichts verloren.
 */

export const BUCKETS = {
  career: "career-documents",
  application: "application-documents",
  voice: "voice-recordings",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "image/jpeg",
  "image/png",
]);

const MAX_BYTES = 20 * 1024 * 1024;

export function normaliseFilename(raw: string): string {
  return (
    raw
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w.\-]+/g, "_")
      .replace(/_{2,}/g, "_")
      .slice(-120) || "datei"
  );
}

export function checkUpload(file: { type: string; size: number }): string | null {
  if (!ALLOWED_MIME.has(file.type)) {
    return `Dieser Dateityp wird nicht angenommen (${file.type}). Erlaubt sind PDF, DOCX, TXT und Bilder.`;
  }
  if (file.size > MAX_BYTES) {
    return `Die Datei ist zu groß (${Math.round(file.size / 1024 / 1024)} MB). Höchstens 20 MB.`;
  }
  return null;
}

export function storagePath(userId: string, documentId: string, filename: string): string {
  return `${userId}/${documentId}/${normaliseFilename(filename)}`;
}

/** Ein Link, der nach kurzer Zeit verfällt. Voreinstellung: fünf Minuten. */
export async function signedUrl(
  bucket: BucketName,
  path: string,
  expiresInSeconds = 300,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);

  if (error || !data) {
    throw new Error(`Der Link konnte nicht erzeugt werden: ${error?.message ?? "unbekannt"}`);
  }
  return data.signedUrl;
}
