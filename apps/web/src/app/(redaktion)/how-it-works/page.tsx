import type { Metadata } from "next";
import Link from "next/link";
import {
  Abschluss,
  Abschnitt,
  Aufklapper,
  Einstieg,
  Grundsaetze,
  Hauptknopf,
  LESEBREITE,
  Nebenknopf,
  Schritte,
} from "@/components/unterseiten/Geruest";
import { Checkbeispiel } from "@/components/unterseiten/Checkbeispiel";
import { funktion, hatZiel } from "@/lib/unterseiten/verfuegbarkeit";

export const metadata: Metadata = {
  title: "So funktioniert es",
  description:
    "Von einer Anzeige zu deinem nächsten Schritt: was vorliegt, was offenbleibt und welche Frage weiterhilft.",
};

/**
 * ══════════════════════════════════════════════════════════════════
 * So funktioniert es — drei Schritte statt sechs Versprechen
 * ══════════════════════════════════════════════════════════════════
 *
 * Hier standen sechs Kästen, die im Wesentlichen dasselbe sagten wie
 * „Lösungen", nur anders formuliert. Zwei Seiten, die einander
 * wiederholen, erklären zusammen weniger als eine, die einen Ablauf
 * zeigt.
 *
 * Diese Seite hat jetzt genau eine Aufgabe: den ersten nutzbaren
 * Ablauf an einem Fall vorführen. Dasselbe Beispiel wie auf allen
 * anderen Unterseiten — der Wiedererkennungswert ist der Punkt.
 *
 * ── Was aus der alten Fassung erhalten bleibt ───────────────────
 *
 * Die Produktgrenzen. Keine Bewertung von Stimme, Gesicht, Akzent,
 * Emotion oder Ehrlichkeit; keine Ableitung von Gesundheit, Herkunft
 * oder Religion; kein Wert, der als Einstellungswahrscheinlichkeit
 * gelesen werden kann. Sie standen als Aufzählung mitten auf der
 * Seite und stehen jetzt in einer der drei Vertiefungen — sichtbar,
 * aber nicht als Hauptbotschaft. Gestrichen werden sie nicht: Sie
 * sind das, was das Produkt NICHT tut, und das ist eine Zusage.
 */
export default function SoFunktioniertEsSeite() {
  const monday = funktion("monday");
  const bewerbung = funktion("bewerbung-versenden");

  return (
    <>
      <Einstieg
        oberzeile="So funktioniert es"
        titel="Von einer Anzeige zu deinem nächsten Schritt."
        text="Du bringst eine Stellenanzeige mit oder entdeckst sie auf Velvova. Der Check zeigt, welche Angaben vorliegen, was offenbleibt und welche Frage dich weiterbringt."
        aktionen={
          <>
            <Hauptknopf href="#beispiel">Beispiel ansehen</Hauptknopf>
            {hatZiel(monday) ? (
              <Nebenknopf href={monday.route}>Mit Velvova sprechen</Nebenknopf>
            ) : null}
          </>
        }
        vorschau={<Checkbeispiel knapp />}
      />

      <Abschnitt
        id="beispiel"
        titel="Drei Schritte an einem Fall"
        text="Links der Ablauf, rechts derselbe erfundene Fall. Nichts davon springt von selbst weiter — du entscheidest, was du siehst."
        kinder={
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-14">
            <Schritte
              schritte={[
                {
                  titel: "Anzeige öffnen oder einfügen",
                  text: "Starte mit einer konkreten Stelle. Du musst dafür nicht zuerst ein vollständiges Berufsprofil erstellen.",
                },
                {
                  titel: "Angaben einordnen",
                  text: "Erkenne, was aus der Anzeige stammt, welche Informationen fehlen und wo sich Aussagen widersprechen. Ergänze freiwillig, was dir bei einem Wechsel wichtig ist.",
                },
                {
                  titel: "Gezielt weitergehen",
                  text: "Formuliere eine Rückfrage, ergänze eine Antwort oder gehe zur Originalanzeige. Du entscheidest, welcher Schritt für dich sinnvoll ist.",
                },
              ]}
            />
            <Checkbeispiel />
          </div>
        }
      />

      <Abschnitt
        titel="Drei Grundsätze"
        kinder={
          <Grundsaetze
            punkte={[
              {
                titel: "Herkunft statt Behauptung",
                text: "Bei jeder wichtigen Angabe soll erkennbar sein, worauf sie beruht — auf der Anzeige, auf deiner Eingabe oder auf einer Antwort, die du bekommen hast.",
              },
              {
                titel: "Offene Punkte statt Fantasiezahlen",
                text: "Fehlende Informationen werden nicht durch überzeugend klingende Werte ersetzt. Eine Lücke bleibt eine Lücke, bis jemand sie füllt.",
              },
              {
                titel: "Deine Entscheidung",
                text: bewerbungssatz(hatZiel(bewerbung)),
              },
            ]}
          />
        }
      />

      <Abschnitt
        titel="Wenn du es genauer wissen willst"
        kinder={
          <Aufklapper
            fragen={[
              {
                frage: "Wie entsteht eine Einordnung?",
                antwort: (
                  <>
                    <p>
                      Zuerst wird gelesen, was dasteht: Titel, Ort, Arbeitszeit, Angaben zur
                      Vergütung. Was die Anzeige nennt, wird ihr zugeordnet. Was sie nicht nennt,
                      wird als offen geführt — nicht als „nein“.
                    </p>
                    <p>
                      Widersprüche entstehen, wenn zwei Stellen der Anzeige einander ausschliessen,
                      wie Köln in der Kopfzeile und Essen im Fliesstext. Velvova markiert den
                      Unterschied und entscheidet ihn nicht.
                    </p>
                    <p>
                      Wie das im Einzelnen abläuft, steht in der{" "}
                      <Link
                        href="/methodology"
                        className="text-accent-text underline underline-offset-[3px]"
                      >
                        Methodik
                      </Link>{" "}
                      und in der{" "}
                      <Link
                        href="/ai-transparency"
                        className="text-accent-text underline underline-offset-[3px]"
                      >
                        KI-Transparenz
                      </Link>
                      .
                    </p>
                  </>
                ),
              },
              {
                frage: "Was kann die KI nicht zuverlässig beurteilen?",
                antwort: (
                  <>
                    <p>
                      Einiges tut sie ausdrücklich nicht, und das bleibt so — es sind keine noch
                      fehlenden Funktionen, sondern Grenzen:
                    </p>
                    <ul className="grid gap-1.5 pl-4">
                      <li className="list-disc">
                        Keine Bewertung von Stimme, Gesicht, Akzent, Emotion oder Ehrlichkeit.
                      </li>
                      <li className="list-disc">
                        Keine Ableitung von Gesundheit, Herkunft, Religion oder Ähnlichem.
                      </li>
                      <li className="list-disc">
                        Kein Wert, der als Einstellungswahrscheinlichkeit gelesen werden kann.
                      </li>
                    </ul>
                    <p>
                      Und sie kann nicht wissen, was in der Anzeige nicht steht. Ein fehlender
                      Gehaltsrahmen bleibt eine Frage an den Arbeitgeber, keine Schätzung.
                    </p>
                  </>
                ),
              },
              {
                frage: "Welche Angaben kontrolliere ich selbst?",
                antwort: (
                  <>
                    <p>
                      Alles, was du ergänzt. Ein Wunsch wie „mir sind freie Wochenenden wichtig“
                      gehört dir und wird getrennt von der Anzeige geführt — er macht eine Frage
                      wichtig, er beantwortet sie nicht.
                    </p>
                    <p>
                      Was du eingibst, kannst du ändern und löschen. Die Regeln dazu stehen unter{" "}
                      <Link
                        href="/security"
                        className="text-accent-text underline underline-offset-[3px]"
                      >
                        Sicherheit
                      </Link>{" "}
                      und in der{" "}
                      <Link
                        href="/privacy"
                        className="text-accent-text underline underline-offset-[3px]"
                      >
                        Datenschutzerklärung
                      </Link>
                      .
                    </p>
                  </>
                ),
              },
            ]}
          />
        }
      />

      <Abschluss
        titel="Eine Anzeige genügt für den Anfang."
        text="Kein Profil, kein Interview, keine Vorarbeit. Sieh dir den Fall an und entscheide dann, ob du weitermachen willst."
        aktionen={
          <>
            <Hauptknopf href="#beispiel">Beispiel ansehen</Hauptknopf>
            <Nebenknopf href="/product">Alle Einstiege ansehen</Nebenknopf>
          </>
        }
      />
    </>
  );
}

/**
 * Der Satz über den Bewerbungsversand — und warum er sich anpasst.
 *
 * „Wir verschicken nichts automatisch“ klingt nach einer Zusage und
 * ist, solange es gar keinen Versand gibt, eine schiefe Auskunft: Sie
 * lässt vermuten, dass es einen manuellen gäbe. Im Register steht
 * `bewerbung-versenden` als nicht verifiziert — gesucht, nicht
 * gefunden. Also sagt die Seite, was tatsächlich passiert.
 */
function bewerbungssatz(versandVorhanden: boolean): string {
  return versandVorhanden
    ? "Nichts wird ohne dich verschickt. Du entscheidest, ob eine Nachricht rausgeht und an wen."
    : "Velvova verschickt keine Bewerbungen — weder automatisch noch auf Knopfdruck. Der Bewerbungsweg führt zum Originalanbieter; ein Klick dorthin ist noch keine abgeschickte Bewerbung.";
}
