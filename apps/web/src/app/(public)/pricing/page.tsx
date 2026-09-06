import { redirect } from "next/navigation";

/**
 * Es gibt keine eigene Preisseite mehr.
 *
 * Sie sah aus wie ein Laden — drei Kästen, ein Kaufknopf, und oben ein
 * „Zurück zu Nina", das zugab, dass man das Produkt gerade verlassen
 * hatte. Preise sind aber keine Zwischenstation, sondern eine Auskunft
 * über das eigene Konto: was habe ich, was nutze ich, was kostet der
 * nächste Schritt.
 *
 * Deshalb steht das jetzt unter Profil → Einstellungen → Plan &
 * Abrechnung, und diese Adresse leitet dorthin. Gelöscht wird sie
 * nicht: alte Links, Lesezeichen und Suchergebnisse zeigen weiter
 * hierher, und eine 404 wäre eine schlechtere Antwort als der richtige
 * Ort.
 *
 * Wer nicht angemeldet ist, landet über die Anmeldung dort — das
 * übernimmt `requireUser` auf der Zielseite.
 */
export default function PricingRedirect() {
  redirect("/app/settings/abo");
}
