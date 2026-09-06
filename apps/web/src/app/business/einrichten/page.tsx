import { redirect } from "next/navigation";

/**
 * Die Einrichtung ist umgezogen.
 *
 * Sie lag hier, also im Arbeitgeberrahmen — mit Kopfzeile,
 * Bereichsnavigation und Fortschrittsleiste über einem Formular mit
 * einem Feld. Das ist der Rahmen für jemanden, der schon drin ist;
 * hier ist noch niemand drin.
 *
 * Der Pfad bleibt als Weiterleitung: `arbeitgeberKontext` schickt
 * jeden ohne Organisation hierher, und diese Stelle steht an mehreren
 * Punkten im Code.
 */
export default function EinrichtenWeiterleitung() {
  redirect("/firma");
}
