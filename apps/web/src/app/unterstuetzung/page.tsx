import type { Metadata } from "next";
import { AppHinweisleiste } from "@/components/shell/AppHinweisleiste";
import {
  Abschluss,
  Abschnitt,
  Ausblick,
  Einstieg,
  Einstiegskarte,
  Grundsaetze,
  Hauptknopf,
  Nebenknopf,
  Schritte,
} from "@/components/unterseiten/Geruest";
import { BestandProvider } from "@/components/marketing/BestandProvider";
import { HilfeKnopf } from "@/components/marketing/HilfeKnopf";
import { Landeshinweis } from "@/components/marketing/Landeshinweis";
import { TopNav } from "@/components/shell/TopNav";
import { VelvovaFooter } from "@/components/shell/VelvovaFooter";
import { kopfsitzung } from "@/components/shell/Kopfsitzung";
import { brand } from "@paycheck/config";
import { besucherHerkunft } from "@/lib/herkunft";
import { bestandszahl } from "@/lib/jobs/bestandszahl";
import { laenderbestand } from "@/lib/jobs/laenderbestand";
import { lageFuer } from "@/lib/landeslage";
import { mondayZiel } from "@/lib/mondayziel";
import { funktion, hatZiel } from "@/lib/unterseiten/verfuegbarkeit";

export const metadata: Metadata = {
  title: "Unterstützung finden",
  description:
    "Sagt in einem Absatz, wen ihr sucht — oder was bei euch klemmt. Monday klärt den Bedarf, " +
    "bevor daraus eine Stelle wird. Keine Anzeige, keine Sichtbarkeit, kein Ranking.",
};

export const dynamic = "force-dynamic";

/**
 * ══════════════════════════════════════════════════════════════════
 * Der zweite Einstieg: Unterstützung finden
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Warum es diese Seite gibt ───────────────────────────────────
 *
 * Die Bedarfsaufnahme unter `/business/bedarf` war am 10.09.2026
 * gebaut und von aussen unerreichbar: kein Verweis auf der
 * Unternehmensseite, kein Weg in der Kopfzeile, kein Eintrag im
 * Register. Wer nicht zufällig die Adresse kannte, kam nicht hin.
 * `angebote` hatte an dem Tag null Zeilen.
 *
 * `/for-business` erklärt, `/unterstuetzung` handelt. Der Unterschied
 * ist keine Geschmacksfrage: Eine Erklärseite, die zugleich der
 * Einstieg sein soll, muss zwischen zwei Aufgaben teilen, und beide
 * werden schlechter.
 *
 * ── Warum zwei Wege und nicht ein Feld ──────────────────────────
 *
 * Weil die beiden Ausgangslagen verschieden sind und verschiedene
 * Fragen brauchen. Wer die Rolle kennt, will nicht über seine Abläufe
 * sprechen. Wer nur weiss, dass etwas klemmt, hat auf „Welche Rolle
 * suchen Sie?“ keine Antwort — und erfindet dann eine.
 *
 * Der Weg steht als `weg=rolle` oder `weg=klaerung` in der Adresse:
 * ein Wert aus zwei bekannten, sonst nichts. Freitext gehört nicht in
 * eine URL, weil er von dort in Verlauf, Verweisadresse und
 * Serverprotokolle gerät.
 *
 * ── Was hinter dem Knopf steht ──────────────────────────────────
 *
 * Ein Firmenkonto mit bestätigter Adresse. Das steht auf dieser Seite
 * VOR dem Klick, nicht danach: Ein Knopf, der in ein Anmeldeformular
 * führt, ohne das anzukündigen, ist derselbe tote Knopf wie „Preise
 * ansehen“ es war.
 */
export default async function UnterstuetzungPage() {
  /*
   * Auch hier führt kein Knopf an der Wirklichkeit vorbei: Ist die
   * Bedarfsaufnahme im Register nicht mehr erreichbar, führen beide
   * Wege zum Kontaktformular statt in ein Formular, das nichts tut.
   */
  const bedarf = funktion("bedarfsaufnahme");
  const offen = hatZiel(bedarf);
  const zielRolle = offen ? "/business/bedarf?weg=rolle" : "/contact";
  const zielKlaerung = offen ? "/business/bedarf?weg=klaerung" : "/contact";

  const herkunft = await besucherHerkunft();
  const lage = lageFuer(herkunft.code);
  const [bestand, laender, sitzung] = await Promise.all([
    bestandszahl(),
    laenderbestand(),
    kopfsitzung(),
  ]);

  return (
    <BestandProvider genau={bestand.genau} proSekunde={bestand.proSekunde}>
      <div
        data-surface="editorial"
        className="min-h-dvh"
        style={{ background: "var(--ed-canvas)", color: "var(--ed-ink)" }}
      >
        <a href="#inhalt" className="skip-link">
          Zum Inhalt springen
        </a>

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
        <Landeshinweis lage={lage} quelle={herkunft.quelle} pfad="/unterstuetzung" />

        <main id="inhalt">
          <Einstieg
            oberzeile="Für Unternehmen"
            titel="Sagt, was gebraucht wird."
            text="Für eine feste Rolle oder eine abgegrenzte Aufgabe. Ein Absatz in euren Worten genügt — keine Anzeige, kein Formular. Dafür braucht ihr ein Firmenkonto mit bestätigter Adresse; wenn ihr noch keines habt, legt ihr es im nächsten Schritt an."
            aktionen={
              <>
                <Hauptknopf href={zielRolle}>Unterstützung finden</Hauptknopf>
                <Nebenknopf href="/pricing?fuer=unternehmen">Preise ansehen</Nebenknopf>
              </>
            }
          />

          <Abschnitt
            id="wege"
            titel="Zwei Ausgangslagen"
            text="Beide führen an denselben Ort. Der Unterschied ist, womit das Gespräch anfängt."
            kinder={
              <div className="grid gap-5 md:grid-cols-2">
                <Einstiegskarte
                  titel="Wir wissen, wen wir suchen"
                  text="Sagt die Rolle, was sie zahlt, wann sie anfängt. Was fehlt, wird nachgefragt — höchstens drei Fragen auf einmal."
                  ziel={zielRolle}
                  aktion="Bedarf beschreiben"
                />
                <Einstiegskarte
                  titel="Wir wissen nur, dass etwas klemmt"
                  text="Beschreibt die Lage: was liegen bleibt, was doppelt gemacht wird, wo Rückfragen entstehen. Ob daraus eine Stelle wird, entscheidet sich später — vielleicht gar nicht."
                  ziel={zielKlaerung}
                  aktion="Lage beschreiben"
                />
              </div>
            }
          />

          <Abschnitt
            titel="Was danach passiert"
            text="Drei Schritte, und zwei davon gehören euch."
            kinder={
              <Schritte
                schritte={[
                  {
                    titel: "Ihr redet, wie ihr redet",
                    text: "Ein Absatz reicht. Eine Stellenanzeige zu schreiben kostet zwei Stunden — für einen Betrieb mit acht Leuten ist das der Grund, warum er niemanden findet, nicht der Fachkräftemangel.",
                  },
                  {
                    titel: "Was fehlt, wird nachgefragt",
                    text: "Rolle, Geld, Arbeitszeit, Ort, Befristung, Frist. Höchstens drei Fragen je Runde, und keine zweimal. Wünsche, die nach dem Gleichbehandlungsgesetz nicht ausgewählt werden dürfen, werden gestrichen und euch mit Begründung gezeigt.",
                  },
                  {
                    titel: "Verbindlich wird es durch einen Menschen",
                    text: "Bis dahin ist es ein Entwurf, der bei euch liegt. Er wird nicht veröffentlicht, taucht in keiner Suche auf und bekommt keinen Platz in einer Liste. Kandidaten sehen euren Namen erst, wenn beide Seiten aufdecken.",
                  },
                ]}
              />
            }
          />

          {/*
            Der Absatz, der gegen das eigene Geschäft argumentiert —
            und deshalb der glaubwürdigste auf der Seite.
          */}
          <Abschnitt
            titel="Ein bestätigtes Problem ist noch kein Personalbedarf"
            text="Manche Engpässe verschwinden, sobald eine Zuständigkeit geklärt ist. Deshalb steht zwischen eurer Lage und einer Stelle eine Klärung, und sie darf auch ergeben, dass niemand eingestellt werden muss."
            kinder={
              <Grundsaetze
                punkte={[
                  {
                    titel: "Ein Signal ist keine Ursache",
                    text: "Lange Bearbeitungszeiten können an schwierigeren Fällen liegen, an fehlenden Informationen, an Kapazität — oder daran, dass die Zeitstempel nichts taugen. Wer daraus sofort „mehr Personal“ macht, hat geraten.",
                  },
                  {
                    titel: "„Erst messen“ ist ein gültiges Ergebnis",
                    text: "Ebenso „vorerst beobachten“ und „keine neue Person nötig“. Ein System, dessen Ergebnismenge nur aus Handlungen besteht, findet immer eine Handlung.",
                  },
                  {
                    titel: "Keine erfundene Rolle",
                    text: "Was ihr nicht gesagt habt, steht nicht im Entwurf. Trägt das Modell eine Rolle ein, die in eurem Text nicht vorkommt, wird sie verworfen und euch als Auffälligkeit gezeigt.",
                  },
                  {
                    titel: "Keine Zahl unter fünf",
                    text: "Ihr seht Zähler, keine Profile — und eine Zahl erst ab einer Gruppengrösse, bei der niemand erkennbar ist. Darunter steht „wenige“.",
                  },
                ]}
              />
            }
          />

          <Ausblick
            titel="Was es noch nicht gibt"
            einleitung="Damit ihr es hier lest und nicht erst nach dem Anlegen eines Kontos."
            punkte={[
              {
                titel: "Die Klärung wird noch nicht gespeichert",
                text: "Die Rückfragen kommen, eure Antworten fliessen in denselben Entwurf — aber ein Befund über eure Abläufe wird noch nirgends abgelegt. Er ist beim nächsten Besuch nicht mehr da.",
              },
              {
                titel: "Kein Monatsbericht",
                text: "Ein monatlicher Vergleich, der zeigt, was sich verändert hat, ist beschlossen und nicht gebaut. Solange er nicht läuft, wird er auch nicht angeboten.",
              },
              {
                titel: "Keine Auswertung eurer Systeme",
                text: "Postfächer, Mitarbeiterkommunikation und Kundendaten werden nicht im Ganzen ausgewertet — nicht heute und nicht später. Einzelne Kennzahlen über Vorgänge könnt ihr freigeben, jede mit eigenem Zweck.",
              },
            ]}
          />

          <Abschluss
            titel="Fangt bei dem an, was ihr ohnehin sagen könnt"
            text="Ein Absatz, wie ihr ihn einer Kollegin sagen würdet. Alles Weitere ergibt sich aus Rückfragen."
            aktionen={
              <>
                <Hauptknopf href={zielRolle}>Unterstützung finden</Hauptknopf>
                <Nebenknopf href="/for-business">Wie das funktioniert</Nebenknopf>
              </>
            }
          />
        </main>

        <VelvovaFooter laender={laender} />
        <HilfeKnopf assistantName={brand.assistantName} />
      </div>
    </BestandProvider>
  );
}
