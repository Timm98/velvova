import { createHash } from "node:crypto";

/**
 * Die Kennung eines Profilbildes für die Adresse.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es diese Funktion gibt
 * ══════════════════════════════════════════════════════════════
 *
 * Die Route `/app/profilbild` liefert das Bild mit einem Jahr
 * Haltbarkeit und `immutable` aus. Die Begründung dafür stand im Code
 * und war falsch: „Der Dateiname ist der Inhalts-Hash, ein neues Bild
 * hat also eine neue Adresse."
 *
 * Der Inhalts-Hash ist der Name im SPEICHER. Die ADRESSE war immer
 * `/app/profilbild`, ohne alles. Der Browser hat sich das Bild also
 * einmal geholt und ein Jahr lang nicht mehr nachgefragt — wer sein
 * Bild wechselte, sah weiter das alte, und wer es entfernte, sah es
 * auch danach noch.
 *
 * Mit der Kennung im Adressanhang stimmt die Begründung: Ein anderes
 * Bild ergibt eine andere Adresse, und `immutable` ist dann keine
 * Behauptung, sondern wahr.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum gehasht und nicht der Pfad selbst
 * ══════════════════════════════════════════════════════════════
 *
 * Der Speicherpfad hat in einer Adresszeile nichts zu suchen. Er
 * eröffnet zwar keinen Zugriff — die Route nimmt gar keinen Pfad
 * entgegen —, aber er stünde im Verlauf, im Protokoll des Servers und
 * im Verweis-Kopf jeder Anfrage, die von dieser Seite ausgeht. Eine
 * undurchsichtige Kennung leistet dasselbe und verrät nichts.
 */
export function profilbildKennung(avatarPfad: string | null | undefined): string | null {
  if (!avatarPfad) return null;
  return createHash("sha256").update(avatarPfad).digest("hex").slice(0, 16);
}

/** Die Adresse, unter der das eigene Bild liegt — oder null. */
export function profilbildAdresse(kennung: string | null | undefined): string | null {
  return kennung ? `/app/profilbild?v=${kennung}` : null;
}
