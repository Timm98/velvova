import type { Metadata } from "next";
import { AppHinweisleiste } from "@/components/shell/AppHinweisleiste";
import { Abschluss, Abschnitt, Einstieg, Grundsaetze, Hauptknopf, Nebenknopf } from "@/components/unterseiten/Geruest";
import { Abomodell } from "@/components/marketing/Abomodell";
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
import type { Zielgruppe } from "@/lib/billing/preismodell";

export const metadata: Metadata = {
  title: "Preise",
  description:
    "Was Velvova kostet, was kostenlos bleibt und was noch nicht buchbar ist — für Einzelpersonen und für Unternehmen.",
};

export const dynamic = "force-dynamic";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Preisseite
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Warum es sie wieder gibt ────────────────────────────────────
 *
 * Hier stand eine Weiterleitung auf `/app/settings/abo`, mit der
 * Begründung: Preise seien keine Zwischenstation, sondern eine
 * Auskunft über das eigene Konto. Für Angemeldete stimmt das und gilt
 * weiter — der Weg dorthin steht unten auf dieser Seite.
 *
 * Für alle anderen war es eine Sackgasse. Die Unternehmensseite bot
 * „Preise ansehen“ an, und wer klickte, landete in einem
 * Anmeldeformular. Am 10.09.2026 war das der einzige tote Knopf im
 * öffentlichen Bestand.
 *
 * ── Warum sie NICHT unter `(public)` liegt ──────────────────────
 *
 * Derselbe Grund wie bei `/for-business`: Der Rahmen dort begrenzt den
 * Inhalt auf 760 Pixel. Die Angebotskarten stehen ab `md` zu dritt
 * nebeneinander; in 760 Pixeln wären das drei Spalten von je gut 230
 * Pixeln mit siebenzeiligen Listen darin. Kopf und Fuss sind
 * dieselben — der Rahmen hier trägt sie selbst, wie die Startseite
 * auch.
 *
 * ── Woher die Zahlen kommen ─────────────────────────────────────
 *
 * Aus `lib/billing/preismodell.ts` und aus nichts sonst. Diese Seite
 * schreibt keinen Betrag hin. Was dort als `nochNicht` markiert ist,
 * erscheint hier als nicht buchbar — sichtbar an der Karte, bevor
 * jemand klickt.
 */
export default async function PreisePage({
  searchParams,
}: {
  searchParams: Promise<{ fuer?: string }>;
}) {
  const { fuer } = await searchParams;
  /* Nur die beiden bekannten Werte. Alles andere ist die
     Personenansicht — ein unbekannter Parameter darf keine dritte
     Ansicht erfinden. */
  const start: Zielgruppe = fuer === "unternehmen" ? "unternehmen" : "person";

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
        <Landeshinweis lage={lage} quelle={herkunft.quelle} pfad="/pricing" />

        <main id="inhalt">
          <Einstieg
            oberzeile="Preise"
            titel="Was kostet — und was nicht."
            text="Der erste vollständige Fall ist kostenlos und bleibt es; er verschwindet nicht nachträglich hinter einer Schranke. Was noch nicht buchbar ist, steht auf der Karte und nicht in einer Fussnote."
            aktionen={
              sitzung.angemeldet ? (
                <>
                  <Hauptknopf href="/app/settings/abo">Dein Plan und deine Abrechnung</Hauptknopf>
                  <Nebenknopf href="/unterstuetzung">Für Unternehmen</Nebenknopf>
                </>
              ) : (
                <>
                  <Hauptknopf href={await mondayZiel("/register")}>Kostenlos starten</Hauptknopf>
                  <Nebenknopf href="/unterstuetzung">Für Unternehmen</Nebenknopf>
                </>
              )
            }
          />

          <Abomodell angemeldet={sitzung.angemeldet} start={start} />

          {/*
            Der wichtigste Absatz der Seite, und er verkauft nichts.

            Wer für ein Abo bezahlt, nimmt leicht an, dass Velvova auch
            das Geld für die Arbeit selbst führt — Treuhand, Schutz,
            Rückholung. Tut es nicht. Diesen Irrtum später aufzuklären
            ist teurer als ihn hier zu vermeiden.
          */}
          <Abschnitt
            titel="Was Velvova nicht abrechnet"
            text="Lohn und Honorar laufen unmittelbar zwischen den Vertragsparteien. Velvova ist an keiner Zahlung für geleistete Arbeit beteiligt — es gibt keine Treuhand, keinen Zahlungsschutz und keine Rückholung. Was hier steht, ist ausschliesslich der Preis für die Nutzung von Velvova."
            kinder={
              <Grundsaetze
                punkte={[
                  {
                    titel: "Sichtbarkeit ist unverkäuflich",
                    text: "Es gibt keinen Platz, den ein Unternehmen kaufen kann. Kein Tarif verändert die Reihenfolge, die Passungswerte oder die Sichtbarkeit eines Menschen — weder nach oben noch nach unten.",
                  },
                  {
                    titel: "Kein schlechteres Ergebnis ohne Abo",
                    text: "Monday antwortet nie absichtlich knapper, weil jemand nicht bezahlt. Der Unterschied zwischen den Stufen liegt in Funktionen und Kontingenten, nicht in künstlich verschlechterten Antworten.",
                  },
                  {
                    titel: "Keine erfundene Knappheit",
                    text: "Keine ablaufenden Angebote, keine durchgestrichenen Preise, kein „beliebtester Tarif“ ohne Buchungsnachweis, keine Jahresrabatte, die es nicht gibt.",
                  },
                  {
                    titel: "Kein Erfolgsversprechen",
                    text: "Kein Plan verspricht eine Stelle, ein Gespräch oder einen Auftrag. Was ein Plan ändert, ist, wie gründlich Monday arbeitet — nicht, wer einstellt.",
                  },
                ]}
              />
            }
          />

          <Abschluss
            titel="Anfangen kostet nichts"
            text="Der erste vollständige Fall läuft ohne Konto und ohne Zahlungsdaten. Erst danach entscheidet sich, ob überhaupt etwas dazukommen muss."
            aktionen={
              <>
                <Hauptknopf href={await mondayZiel("/register")}>Kostenlos starten</Hauptknopf>
                <Nebenknopf href="/unterstuetzung">Unterstützung finden</Nebenknopf>
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
