import type { Metadata } from "next";
import { AppHinweisleiste } from "@/components/shell/AppHinweisleiste";
import {
  Abschluss,
  Abschnitt,
  Ausblick,
  Einstieg,
  Grundsaetze,
  Hauptknopf,
  Nebenknopf,
  Schritte,
} from "@/components/unterseiten/Geruest";
import { Arbeitgeberbeispiel } from "@/components/unterseiten/Arbeitgeberbeispiel";
import { funktion, hatZiel } from "@/lib/unterseiten/verfuegbarkeit";
import { brand } from "@paycheck/config";
import { BestandProvider } from "@/components/marketing/BestandProvider";
import { HilfeKnopf } from "@/components/marketing/HilfeKnopf";
import { Landeshinweis } from "@/components/marketing/Landeshinweis";
import { VelvovaFooter } from "@/components/shell/VelvovaFooter";
import { TopNav } from "@/components/shell/TopNav";
import { mondayZiel } from "@/lib/mondayziel";
import { kopfsitzung } from "@/components/shell/Kopfsitzung";
import { besucherHerkunft } from "@/lib/herkunft";
import { bestandszahl } from "@/lib/jobs/bestandszahl";
import { laenderbestand } from "@/lib/jobs/laenderbestand";
import { lageFuer } from "@/lib/landeslage";

export const metadata: Metadata = {
  title: "Stelle veröffentlichen. Monday findet passende Menschen.",
  description:
    "Unternehmen veröffentlichen strukturierte Stellen und finden passende Kandidatinnen und " +
    "Kandidaten — ohne private Karrieregespräche offenzulegen.",
};

/**
 * Die Landingpage für Unternehmen.
 *
 * ── Warum sie NICHT unter `(public)` liegt ────────────────────
 *
 * Der Rahmen dort bringt eine eigene Kopfzeile mit und begrenzt den
 * Inhalt auf 760 Pixel — richtig für Impressum und Datenschutz, falsch
 * für eine Landingpage. Die erste Fassung lag dort und bekam zwei
 * Kopfzeilen übereinander und eine Hero-Überschrift in einer
 * Textspalte. Diese Seite trägt ihre Umgebung deshalb selbst, wie `/`
 * auch.
 *
 * ── Warum eine eigene Seite und kein Abschnitt ────────────────
 *
 * Wer Mitarbeiter sucht, kommt mit einer anderen Frage. Ihn auf einer
 * Seite abzuholen, die von der ersten Zeile an mit „du“ über seine
 * eigene Karriere spricht, kostet die Hälfte der Aufmerksamkeit für
 * eine Übersetzungsleistung, die er nicht erbringen muss.
 *
 * ── Was diese Seite vor allem tun muss ────────────────────────
 *
 * Vertrauen herstellen — in beide Richtungen. Ein Unternehmen will
 * wissen, dass es Menschen erreicht. Und es muss wissen, dass es NICHT
 * alles über sie erfährt, denn genau das ist der Grund, warum diese
 * Menschen überhaupt hier sind.
 *
 * Deshalb steht die Trennlinie nicht im Kleingedruckten, sondern als
 * eigener Abschnitt mit eigener Überschrift.
 */
export default async function FuerUnternehmenSeite() {
  const klarheit = funktion("klarheits-check");
  /*
   * Auch hier zählt das Land — aus einem anderen Grund.
   *
   * Ein Unternehmen in der Schweiz kann Stellen einstellen; was fehlt,
   * ist die Nettorechnung auf der Bewerberseite. Das ist keine
   * Einschränkung des Arbeitgeberprodukts, aber eine Auskunft, die
   * jemand vor der Anmeldung haben sollte.
   */
  const herkunft = await besucherHerkunft();
  const lage = lageFuer(herkunft.code);

  /*
   * Bestand und Länder auch hier.
   *
   * Nicht als Schmuck: Der Kopf trägt auf jeder Seite die laufende
   * Stellenzahl, und der Fuss die Märkte. Beides gehört zum Kopf und
   * Fuss, nicht zur Seite — würde es hier fehlen, wäre es nicht
   * derselbe Kopf, sondern einer, der so aussieht.
   */
  const [bestand, laender, sitzung] = await Promise.all([
    bestandszahl(),
    laenderbestand(),
    /* Auch hier der echte Anmeldestand: Ein Unternehmen, das im
       eigenen Konto angemeldet ist, bekam hier „Anmelden" und „Konto
       anlegen" angeboten. */
    kopfsitzung(),
  ]);

  return (
    <BestandProvider genau={bestand.genau} proSekunde={bestand.proSekunde}>
    <div
      data-surface="editorial"
      /*
       * Kein festes `data-theme="light"`.
       *
       * Es stand hier und hebelte die Wahl aus: Wer im Fuss auf
       * „Dunkel" stellt, sah diese Seite weiterhin hell und hielt den
       * Schalter für kaputt. Die Tokens tragen beide Fassungen.
       */
      className="min-h-dvh"
      style={{ background: "var(--ed-canvas)", color: "var(--ed-ink)" }}
    >
      <a href="#inhalt" className="skip-link">
        Zum Inhalt springen
      </a>

      {/* Die Ankündigung steht über dem Kopf — auf jeder Seite
          dieselbe. */}

      {/*
       * Derselbe Kopf wie überall — die Regel gilt ohne Ausnahme.
       *
       * Hier stand eine eigene Kopfzeile: andere Höhe (64 statt 88
       * Pixel), ein farbiger Kreis vor dem Schriftzug, ein
       * „Business"-Abzeichen, keine Suche, keine Wege. Wer von der
       * Startseite hierher wechselte, wechselte damit die ganze
       * Anwendung — und das ist genau der Eindruck, den ein
       * Unternehmen auf einer Seite über Vertrauen nicht bekommen
       * darf.
       *
       * Was diese Seite braucht, steht ohnehin schon im Kopf: „Für
       * Unternehmen" ist einer der Wege in der zweiten Zeile.
       */}
      <AppHinweisleiste nachtsZiel={await mondayZiel("/register")} />

      <TopNav
        anmeldeZiel={await mondayZiel("/login")}
        registrierZiel={await mondayZiel("/register")}
        brandName={brand.name}
        userName={sitzung.userName}
        userEmail={sitzung.userEmail}
        unreadCount={sitzung.unreadCount}
        stellenzahl={bestand.text}
        stellenGenau={bestand.genau}
        proSekunde={bestand.proSekunde}
        angemeldet={sitzung.angemeldet}
        accountMenu={sitzung.accountMenu}
      />
      <Landeshinweis lage={lage} quelle={herkunft.quelle} pfad="/for-business" />

      <main id="inhalt">
        <Einstieg
          oberzeile="Für Unternehmen"
          titel="Macht klar, was eure Stelle ausmacht."
          text="Der Klarheits-Check zeigt, welche Angaben in eurer Anzeige fehlen oder widersprüchlich sind. Ihr ergänzt die Informationen, die Menschen für eine fundierte Entscheidung brauchen."
          aktionen={
            <>
              {/*
                Die Hauptaktion ist die Anfrage, nicht das Werkzeug.

                Im Register steht `klarheits-check` als
                „nicht-verifiziert": Der Name kommt in apps/web/src nur
                in Marketingtexten und im Preismodell vor, nicht als
                Werkzeug. „Stellenanzeige prüfen" als Hauptknopf wäre
                eine Tür, hinter der nichts ist.
              */}
              <Hauptknopf href={hatZiel(klarheit) ? klarheit.route : "/contact"}>
                {hatZiel(klarheit) ? "Stellenanzeige prüfen" : "Pilotzugang anfragen"}
              </Hauptknopf>
              <Nebenknopf href="#beispiel">Beispiel ansehen</Nebenknopf>
            </>
          }
          vorschau={<Arbeitgeberbeispiel />}
        />

        <Abschnitt
          id="beispiel"
          titel="In drei Schritten"
          text="Ihr nutzt den Text, den ihr ohnehin habt. Kein weiteres langes Formular."
          kinder={
            <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-14">
              <Schritte
                schritte={[
                  {
                    titel: "Anzeige einfügen",
                    text: "Der vorhandene Anzeigentext genügt. Ihr müsst eure Stelle nicht noch einmal in ein Formular eintragen.",
                  },
                  {
                    titel: "Offene Punkte erkennen",
                    text: "Ihr seht, welche Angaben vorliegen, welche fehlen und wo sich zwei Stellen der Anzeige widersprechen.",
                  },
                  {
                    titel: "Gezielt verbessern",
                    text: "Ihr ergänzt die Anzeige selbst. Velvova erfindet keine Arbeitsbedingungen für euch — und eine Verbesserung ist zunächst ein Entwurf, der ohne eure Freigabe nirgends veröffentlicht wird.",
                  },
                ]}
              />
              <Arbeitgeberbeispiel />
            </div>
          }
        />

        {/*
          ══════════════════════════════════════════════════════════
          Was ihr seht — und was nicht
          ══════════════════════════════════════════════════════════

          Der Abschnitt bleibt sichtbar und wandert nicht in einen
          Rechtstext. Er ist der Grund, warum jemand einer Plattform
          Bewerberdaten anvertraut oder eben nicht.

          Die Überschrift sagt ausdrücklich „geplant". Im Register
          steht `arbeitgeber-freigabe` als geplant: Ein Freigabemodell
          wurde im Code nicht gefunden. Die Tabelle als heutigen
          Zustand zu zeigen, wäre die gefährlichste Zeile dieser Seite.
        */}
        <Abschnitt
          titel="Was ihr seht — und was nicht"
          text="Vorschläge entstehen nur zu Menschen, die der Auffindbarkeit ausdrücklich zugestimmt haben. Ohne diese Einwilligung wird niemand geprüft, und der Zugang ist auf den Pilot begrenzt."
          kinder={
            <div className="grid gap-6 md:grid-cols-2 md:gap-10">
              <div className="grid content-start gap-3 border-t border-line pt-5">
                <h3 className="text-[17px] font-semibold text-ink">
                  Nach ausdrücklicher Freigabe für diese Stelle
                </h3>
                <ul className="grid gap-2 text-[15px] leading-[1.6] text-ink-2">
                  {[
                    "Name und Kontakt — erst, wenn der Kontakt geöffnet ist",
                    "Angaben, die für diese Stelle freigegeben wurden",
                    "Eine Einschätzung zur Passung, wenn die Person das ausdrücklich angekreuzt hat (Voreinstellung: nein)",
                  ].map((z) => (
                    <li key={z}>{z}</li>
                  ))}
                </ul>
              </div>
              <div className="grid content-start gap-3 border-t border-line pt-5">
                <h3 className="text-[17px] font-semibold text-ink">
                  Nicht Bestandteil eines Arbeitgeberzugangs
                </h3>
                <ul className="grid gap-2 text-[15px] leading-[1.6] text-ink-2">
                  {[
                    "Private Gespräche mit der Assistenz",
                    "Aktuelles Gehalt und private Finanzüberlegungen",
                    "Andere Bewerbungen und Suchverläufe",
                    "Die Gründe hinter einer Passung — Belege und Bedingungen bleiben im privaten Profil",
                  ].map((z) => (
                    <li key={z}>{z}</li>
                  ))}
                </ul>
              </div>
              <p className="text-[13px] leading-[1.6] text-ink-3 md:col-span-2">
                Bis jemand den Kontakt öffnet, steht in der Übersicht eine Vorschlagsnummer statt
                eines Namens. Das ist eine Pseudonymisierung und keine Anonymität — sie gehört zum
                Vorschlag, nicht zur Person, und wir sagen deshalb keine Anonymität zu.
              </p>
            </div>
          }
        />

        {/*
          Statt behaupteter Wirkung: die Fragen, die der Pilot klären soll.

          Hier stand eine Studienstrecke mit „28 % der Bewerbungen galten
          als geeignet — vier von sechzehn". Vier von sechzehn sind 25
          Prozent. Entweder die Vier oder die 28 stimmt nicht, und
          welche, lässt sich ohne die Primärquelle nicht sagen. Eine
          Zahl, die sich selbst widerspricht, belegt nichts.

          Ausserdem: Fremde Arbeitsmarktdaten sind kein Ergebnis von
          Velvova, auch wenn sie stimmen. „Massenbewerbungen gehen
          zurück" wäre eine Messung, die niemand gemacht hat.
        */}
        <Abschnitt
          titel="Was wir im Pilot prüfen"
          text="Noch keine Ergebnisse — das sind die Fragen, an denen sich der Pilot messen lassen soll."
          kinder={
            <Grundsaetze
              punkte={[
                {
                  titel: "Werden offene Fragen früher geklärt?",
                  text: "Kommen Gehaltsrahmen, Präsenztage und Arbeitsort vor dem ersten Gespräch zur Sprache statt danach?",
                },
                {
                  titel: "Werden Anzeigen vollständiger?",
                  text: "Ergänzen Unternehmen die Angaben, die im Check als fehlend markiert waren?",
                },
                {
                  titel: "Hilft das beiden Seiten?",
                  text: "Führt mehr Klarheit zu Gesprächen, die für beide Seiten sinnvoller sind — oder nur zu weniger davon?",
                },
              ]}
            />
          }
        />

        <Ausblick
          titel="Der nächste Schritt: Stellen und Klärungen gemeinsam bearbeiten."
          einleitung="Beschlossen und nicht gebaut. Kein automatischer Ausschluss ab einem Schwellenwert, keine verborgene Kandidatensuche."
          punkte={[
            {
              titel: "Gemeinsamer Klärungsbereich",
              text: "Personal und Fachabteilung arbeiten am selben Stand, mit Zuständigkeiten und Bearbeitungsständen.",
            },
            {
              titel: "Rollen und Freigaben",
              text: "Wer darf was sehen und entscheiden — je Stelle, nicht pauschal je Konto.",
            },
            {
              titel: "Übersicht über offene Klärungen",
              text: "Fachliche Anforderungen, Arbeitsbedingungen und Entwicklungsmöglichkeiten bleiben getrennte Gesichtspunkte. Kein Wert, der als persönliche Eignung gelesen werden kann.",
            },
          ]}
        />

        <Abschluss
          titel="Prüft zuerst eure Anzeige. Entscheidet dann über den nächsten Schritt."
          text="Es gibt hier nichts zu abonnieren. Der Pilot ist begrenzt, und eine Anfrage legt kein freigeschaltetes Unternehmenskonto an."
          aktionen={
            <>
              <Hauptknopf href={hatZiel(klarheit) ? klarheit.route : "/contact"}>
                {hatZiel(klarheit) ? "Stellenanzeige prüfen" : "Pilotzugang anfragen"}
              </Hauptknopf>
              <Nebenknopf href="/pricing">Preise ansehen</Nebenknopf>
            </>
          }
        />
      </main>

      {/*
       * Auch der Fuss ist derselbe: Märkte, Zahlungsarten, Region,
       * Rechtliches, die sozialen Netze.
       *
       * Hier stand eine Zeile mit vier Verweisen. Das war kein Fuss,
       * sondern der Rest eines Fusses — und auf der einen Seite, auf
       * der jemand nach Impressum, Datenschutz und Zahlungsarten
       * sucht, bevor er ein Konto anlegt, ausgerechnet die knappste
       * Fassung.
       */}
      <VelvovaFooter laender={laender} />

      {/* Unten rechts, auf jeder Bildschirmhöhe erreichbar. */}
      <HilfeKnopf assistantName={brand.assistantName} />

    </div>
    </BestandProvider>
  );
}

/* ══════════════════════════════════════════════════════════════
   Bausteine
   ══════════════════════════════════════════════════════════════ */
