import { permanentRedirect } from "next/navigation";

/**
 * Der frühere Ort des Karriereprofils.
 *
 * Bleibt als dauerhafte Weiterleitung bestehen: gespeicherte Links und
 * Lesezeichen sollen nicht ins Leere laufen, nur weil ein Bereich einen
 * besseren Namen bekommen hat.
 */
export default function ProfileRedirect(): never {
  permanentRedirect("/app/career");
}
