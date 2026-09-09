import type { Metadata } from "next";
import {
  Abschluss,
  Abschnitt,
  Ausblick,
  Einstieg,
  Einstiegskarte,
  Hauptknopf,
  LESEBREITE,
  Nebenknopf,
} from "@/components/unterseiten/Geruest";
import { Checkbeispiel } from "@/components/unterseiten/Checkbeispiel";
import { funktion, hatZiel } from "@/lib/unterseiten/verfuegbarkeit";

/*
 * Der Titel heisst wie der Weg dorthin.
 *
 * Oben in der Kopfzeile steht „Lösungen", die Seite hiess „Produkt".
 * Wer klickt, landet auf einer Seite mit einem anderen Namen und muss
 * kurz prüfen, ob er richtig ist — jedes Mal.
 *
 * Der Pfad bleibt `/product`: Eine Umbenennung der Adresse bräche
 * jeden bestehenden Verweis, und darum geht es hier nicht.
 */
export const metadata: Metadata = {
  title: "Lösungen",
  description:
    "Stellenanzeigen einordnen, offene Fragen erkennen und einen möglichen Wechsel vorbereiten — mit sichtbarer Herkunft jeder Angabe.",
};

/**
 * ══════════════════════════════════════════════════════════════════
 * Lösungen — vier Aufgaben statt zehn Featurezeilen
 * ══════════════════════════════════════════════════════════════════
 *
 * Hier standen zehn gleich aussehende Abschnitte: Karriereanalyse,
 * Career Evidence Profile, Rollen entdecken, Job Reality Check,
 * Application Studio und so weiter — durchnummeriert, alle in
 * derselben Schriftgrösse, alle gleich wichtig. Zehn Überschriften
 * beantworten die Frage nicht, mit der jemand ankommt: „Was mache ich
 * hier zuerst?"
 *
 * Jetzt vier Aufgaben, ein einziges Beispiel, ein kleiner Ausblick.
 *
 * ── Wo die zehn Punkte geblieben sind ───────────────────────────
 *
 * Keiner ist gelöscht. Karriereanalyse, Kompetenzprofil und Rollen
 * stehen im ersten Ausblickspunkt; Bewerbungsstudio und Suchaufträge
 * im zweiten; „nach der Einstellung" im dritten. Arbeitsweg und Netto
 * gehören in einen Check und nicht in eine eigene Produktzeile — sie
 * stehen deshalb bei „Einen Wechsel vergleichen".
 *
 * ── Warum die Ziele aus einem Register kommen ───────────────────
 *
 * Weil die alte Seite Dinge anbot, die es nicht gibt. Gesucht nach
 * „Wechsel-Check" in `apps/web/src`: kein Treffer — weder Route noch
 * Bauteil noch Endpunkt. Der Name stand trotzdem als Leistung da.
 *
 * `funktion()` und `hatZiel()` entscheiden hier deshalb, wohin ein
 * Knopf führt. Fehlt die Funktion, führt er zum gekennzeichneten
 * Beispiel weiter unten: nicht auf `#`, nicht in ein leeres
 * Eingabefeld, nicht in eine Auswertung, die nur so aussieht.
 */
export default function LoesungenSeite() {
  const suche = funktion("jobsuche");
  const wechsel = funktion("wechsel-check");
  const monday = funktion("monday");

  const ZUM_BEISPIEL = "#beispiel";

  return (
    <>
      <Einstieg
        oberzeile="Lösungen für deinen nächsten Schritt"
        titel="Finde nicht nur eine Stelle. Verstehe, ob sie zu dir passt."
        text="Velvova hilft dir, Stellenanzeigen einzuordnen, offene Fragen zu erkennen und einen möglichen Wechsel besser vorzubereiten. Du kannst mit einer Anzeige starten oder passende Stellen entdecken."
        aktionen={
          <>
            <Hauptknopf href={ZUM_BEISPIEL}>Beispiel ansehen</Hauptknopf>
            {hatZiel(suche) ? <Nebenknopf href={suche.route}>Jobs entdecken</Nebenknopf> : null}
          </>
        }
        vorschau={<Checkbeispiel knapp />}
      />

      <Abschnitt
        titel="Vier Wege hinein"
        text="Jeder führt zu etwas, das es gibt. Wo eine Funktion noch nicht freigegeben ist, steht das an der Karte — statt eines Knopfes, der ins Leere führt."
        kinder={
          <ul className="grid gap-4 md:grid-cols-2">
            <Einstiegskarte
              titel="Eine Stelle verstehen"
              text="Was steht tatsächlich in der Anzeige? Velvova trennt die vorhandenen Angaben von fehlenden Informationen und Widersprüchen."
              ziel={ZUM_BEISPIEL}
              aktion="Beispiel ansehen"
            />
            <Einstiegskarte
              titel="Passende Stellen finden"
              text="Beschreibe, was dir wichtig ist. Deine Suchkriterien bleiben sichtbar und veränderbar."
              ziel={hatZiel(suche) ? suche.route : ZUM_BEISPIEL}
              aktion={hatZiel(suche) ? "Jobs entdecken" : "Beispiel ansehen"}
            />
            {/*
              Diese Karte hat bewusst keinen Rechner als Ziel.

              Ein Vergleich mit der heutigen Lage braucht Gehalt,
              Arbeitszeit und Weg — und ein freigegebenes Rechenmodell.
              Im Register steht `wechsel-check` als „nicht-verifiziert“.
              Also erklärt die Karte den Gedanken und zeigt ihn am
              Beispiel, statt eine Berechnung vorzutäuschen.
            */}
            <Einstiegskarte
              titel="Einen Wechsel vergleichen"
              text={
                hatZiel(wechsel)
                  ? "Vergleiche die neue Stelle mit deiner heutigen Situation. Fehlende Angaben bleiben offen."
                  : "Fehlende Angaben bleiben offen, statt geschätzt zu werden. Solange kein freigegebenes Rechenmodell dahintersteht, zeigt Velvova hier keine Beträge."
              }
              ziel={hatZiel(wechsel) ? wechsel.route : ZUM_BEISPIEL}
              aktion={hatZiel(wechsel) ? "Wechsel einordnen" : "Am Beispiel ansehen"}
            />
            <Einstiegskarte
              titel="Den nächsten Schritt klären"
              text="Aus offenen Punkten werden konkrete Rückfragen. Du bereitest eine Nachricht vor und ergänzt Antworten, wenn du neue Informationen bekommst."
              ziel={ZUM_BEISPIEL}
              aktion="Rückfrage im Beispiel ansehen"
            />
          </ul>
        }
      />

      <Abschnitt
        id="beispiel"
        titel="Eine gute Entscheidung beginnt mit den richtigen Fragen."
        text="Ein einziger erfundener Fall, drei Ansichten. Er enthält von jeder Sorte genau eine: eine belegte Angabe, eine fehlende und einen Widerspruch."
        kinder={
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-12">
            <div className={`${LESEBREITE} grid gap-5 text-[16px] leading-[1.65] text-ink-2`}>
              <p>
                Die Anzeige nennt Köln in der Kopfzeile und Essen im Fliesstext. Velvova markiert
                den Unterschied — und legt keinen der beiden Orte als den richtigen fest. Welcher
                stimmt, weiss nur der Arbeitgeber.
              </p>
              <p>
                „Hybrides Arbeiten möglich“ ist eine Angabe, aber keine Anzahl. Aus ihr folgt kein
                einziger Homeoffice-Tag. Solche Sätze bleiben deshalb bei dem stehen, was sie
                sagen.
              </p>
              <p>
                <strong className="font-semibold text-ink">
                  „Bekannt“ heisst zugeordnet, nicht geprüft.
                </strong>{" "}
                Es sagt, dass eine Angabe aus einer benannten Quelle stammt — aus der Anzeige, aus
                deiner Eingabe, aus einer Antwort. Es sagt nicht, dass jemand sie nachgeprüft hat.
              </p>
              <p>
                Und es gibt keine Gesamtnote. Eine Zahl wie „92“ fasst zusammen, was man getrennt
                entscheiden muss: Was ist da? Was fehlt? Was widerspricht sich?
              </p>
            </div>
            <Checkbeispiel />
          </div>
        }
      />

      <Ausblick
        titel="Was wir Schritt für Schritt erweitern."
        einleitung="Das Folgende ist beschlossen und nicht gebaut. Es steht hier, weil es die Richtung erklärt — nicht, weil man es heute benutzen kann."
        punkte={[
          {
            titel: "Stärken und Möglichkeiten verstehen",
            text: "Gespräche über konkrete Erfahrungen, ein bearbeitbares Kompetenzprofil und neue berufliche Richtungen. Kein Pflichtgespräch, bevor du eine Anzeige prüfen darfst.",
          },
          {
            titel: "Suche und Bewerbung begleiten",
            text: "Freigegebene Suchaufträge, Unterstützung bei den Unterlagen und eine Übersicht über die nächsten Schritte.",
          },
          {
            titel: "Den Einstieg begleiten",
            text: "Unterstützung nach einer Zusage, sofern dieses Angebot später eingeführt wird.",
          },
        ]}
      />

      <Abschluss
        titel="Fang mit einer Stelle an."
        text="Du brauchst kein vollständiges Berufsprofil, um eine Anzeige einzuordnen. Eine Stelle genügt."
        aktionen={
          <>
            <Hauptknopf href={ZUM_BEISPIEL}>Beispiel ansehen</Hauptknopf>
            {hatZiel(monday) ? (
              <Nebenknopf href={monday.route}>Mit Velvova sprechen</Nebenknopf>
            ) : null}
          </>
        }
      />
    </>
  );
}
