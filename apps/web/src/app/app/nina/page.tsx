import { permanentRedirect } from "next/navigation";

/**
 * Der frühere Ort des Gesprächs.
 *
 * Die Begleitung heisst jetzt Monday, und die Adresse heisst mit. Die
 * alte bleibt als dauerhafte Weiterleitung bestehen: In Lesezeichen,
 * E-Mails und Verläufen steht sie noch, und ein „404" wäre eine
 * Umbenennung, die auf Kosten der Leute geht, die schon da waren.
 *
 * `permanentRedirect` — also 308. Suchmaschinen übernehmen damit die
 * neue Adresse, statt beide zu führen.
 */
export default function NinaWeiterleitung(): never {
  permanentRedirect("/app/monday");
}
