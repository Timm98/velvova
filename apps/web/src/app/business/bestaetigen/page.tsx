import { redirect } from "next/navigation";

/**
 * Die Bestätigung ist umgezogen.
 *
 * Sie lag im Arbeitgeberrahmen, mit Kopfzeile, Bereichsnavigation und
 * Fortschrittsleiste über sechs Ziffernfeldern. Jetzt steht sie im
 * Anmelderahmen, in derselben Karte wie Anmeldung, Registrierung und
 * Firmenkonto — die Strecke sieht damit durchgehend gleich aus.
 *
 * Der Pfad bleibt: Die Fortschrittsleiste und mehrere Verweise zeigen
 * darauf.
 */
export default function BestaetigenWeiterleitung() {
  redirect("/bestaetigen");
}
