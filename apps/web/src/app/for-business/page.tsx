import type { Metadata } from "next";
import { AppHinweisleiste } from "@/components/shell/AppHinweisleiste";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { brand } from "@paycheck/config";
import { NinaVisual } from "@/components/nina/NinaVisual";
import { Studienlage } from "@/components/marketing/Studienlage";
import { Produktflaeche } from "@/components/marketing/Produktflaeche";
import { BestandProvider } from "@/components/marketing/BestandProvider";
import { HilfeKnopf } from "@/components/marketing/HilfeKnopf";
import { Landeshinweis } from "@/components/marketing/Landeshinweis";
import { VelvovaFooter } from "@/components/shell/VelvovaFooter";
import { TopNav } from "@/components/shell/TopNav";
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
      <AppHinweisleiste nachtsZiel="/register" />

      <TopNav
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
        {/* ── Hero ────────────────────────────────────────── */}
        <section>
          <div className="mx-auto grid w-full max-w-[1240px] items-center gap-12 px-5 pb-16 pt-12 md:px-8 md:pb-24 md:pt-20 lg:grid-cols-[1fr_1fr]">
            <div className="grid gap-7">
              <p
                className="text-2xs font-semibold uppercase tracking-[0.16em]"
                style={{ color: "var(--ed-ink-3)" }}
              >
                Für Unternehmen
              </p>
              <h1 className="font-display text-[clamp(2.2rem,4.8vw,3.8rem)] font-normal leading-[1.02] tracking-[-0.02em]">
                Du suchst keine Bewerbungen.
                <br />
                Du suchst{" "}
                <span style={{ color: "var(--ed-violet-text)" }}>den richtigen Menschen</span>.
              </h1>
              <p
                className="max-w-[52ch] text-[clamp(1rem,1.35vw,1.15rem)] leading-[1.62]"
                style={{ color: "var(--ed-ink-2)" }}
              >
                Veröffentliche deine Stelle — und {brand.assistantName} beginnt zu arbeiten. Sie
                versteht nicht nur Qualifikation und Berufserfahrung, sondern auch Erwartungen,
                Arbeitsweise und langfristige Ziele. Klassische Portale warten, bis sich jemand
                bewirbt; {brand.assistantName} sucht aktiv nach Menschen, die zur Stelle und zum
                Unternehmen passen.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/business/signup"
                  className="group inline-flex min-h-13 items-center gap-2 rounded-(--radius-pill) px-6 text-[15px] font-medium transition-transform hover:-translate-y-0.5"
                  style={{
                    background: "var(--ed-violet)",
                    color: "#fff",
                    boxShadow: "0 10px 34px color-mix(in oklab, var(--ed-violet) 34%, transparent)",
                  }}
                >
                  Unternehmen registrieren
                  <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
                </Link>
                <Link
                  href="#trennlinie"
                  className="inline-flex min-h-13 items-center rounded-(--radius-pill) px-6 text-[15px] font-medium"
                  style={{ color: "var(--ed-ink)", boxShadow: "inset 0 0 0 1px var(--ed-hairline-strong)" }}
                >
                  Was ihr seht — und was nicht
                </Link>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--ed-ink-3)" }}>
                Vor der ersten Veröffentlichung prüfen wir, dass ihr für dieses Unternehmen sprecht.
              </p>
            </div>

            {/*
              Derselbe Core wie auf der Startseite, an derselben
              Stelle.

              Hier stand eine Beispielkarte: „Senior Controller
              (m/w/d)", vierzehn passende Menschen, drei Anfragen, ein
              Marktvergleich mit vier Prozent. Erfundene Zahlen zu
              einer erfundenen Stelle — auf der einen Seite, auf der
              ein Unternehmen entscheidet, ob es diesem Produkt seine
              Personalauswahl anvertraut.

              Monday selbst ist die ehrlichere Antwort auf dieselbe
              Frage: Wer hier arbeitet, ist dieselbe Monday wie auf der
              Bewerberseite — und genau das ist die Zusage, um die es
              auf dieser Seite geht.
            */}
            <div className="relative grid gap-3">
              <div className="grid aspect-square w-full min-w-0 max-w-[min(92vw,600px)] place-items-center justify-self-center lg:ml-2 xl:ml-6">
                <NinaVisual size="xl" strategie="sichtbar" grund="keiner" zyklus />
              </div>
            </div>
          </div>
        </section>

        {/*
          Hier stand die Kachelreihe mit Stellen schreiben,
          Bewerbungen, Team und Auswertung.

          Eine Funktionsliste direkt unter dem Hero: Sie nahm einen
          ganzen Bildschirm fuer Ueberschriften, die jeder Abschnitt
          darunter ausfuehrlich behandelt. Wer nach dem Hero
          weiterliest, will wissen wie es funktioniert - nicht, wie
          die Bereiche heissen.
        */}

        <Produktflaeche />

        <Studienlage />

        {/* ── Automatische Vermittlung ────────────────────── */}
        <section id="vermitteln">
          <div className="mx-auto grid w-full max-w-[1240px] gap-10 px-5 py-20 md:grid-cols-[0.9fr_1.1fr] md:gap-16 md:px-8 md:py-24">
            <div className="grid content-start gap-5">
              <p
                className="text-2xs font-semibold uppercase tracking-[0.16em]"
                style={{ color: "var(--ed-ink-3)" }}
              >
                Vermittlung
              </p>
              <h2 className="font-display text-[clamp(1.7rem,3vw,2.6rem)] font-normal leading-[1.06] tracking-[-0.02em]">
                {brand.assistantName} führt zusammen, was zusammenpasst — auch nachts.
              </h2>
              <p className="text-[17px] leading-relaxed" style={{ color: "var(--ed-ink-2)" }}>
                Ihr müsst nicht suchen. {brand.assistantName} vergleicht laufend eure offenen
                Stellen mit den Profilen der Menschen, die zu ihnen passen — und stellt den Kontakt
                her, sobald beide Seiten einverstanden sind.
              </p>
              {/*
                Der Satz über die Zustimmung steht nicht im
                Kleingedruckten, sondern im Text.

                „Automatisch verbunden" klingt sonst danach, dass
                Profile herumgereicht werden. Es passiert nichts ohne
                die ausdrückliche Freigabe beider Seiten — und wer das
                nicht liest, glaubt zu Recht das Gegenteil.
              */}
              <p className="text-[15px] leading-relaxed" style={{ color: "var(--ed-ink-2)" }}>
                Nichts geschieht einseitig: Ihr seht ein Profil erst, wenn die Person zugestimmt
                hat, und sie sieht eure Anfrage erst, wenn ihr sie freigebt. Ohne beide Ja
                passiert nichts.
              </p>
            </div>

            <div
              className="grid content-start gap-5 rounded-(--radius-xl) p-7 md:p-9"
              style={{ background: "var(--ed-surface)", boxShadow: "var(--ed-shadow-soft)" }}
            >
              <p className="text-[15px] font-semibold">Ihr legt die Schwelle fest</p>
              <ul className="grid gap-3">
                {[
                  ["Passungswert", "ab 90 — nur wer wirklich passt, taucht auf"],
                  ["Berufserfahrung", "mindestens 3 Jahre im Feld"],
                  ["Abschluss", "Ausbildung, Abitur oder Studium"],
                  ["Umkreis", "40 km um den Standort, oder remote"],
                  ["Verfügbarkeit", "in den nächsten drei Monaten"],
                ].map(([k, v]) => (
                  <li key={k} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4">
                    <span
                      className="whitespace-nowrap text-[15px] font-medium"
                      style={{ color: "var(--ed-ink)" }}
                    >
                      {k}
                    </span>
                    <span
                      className="text-[15px] leading-snug"
                      style={{ color: "var(--ed-ink-2)" }}
                    >
                      {v}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-2xs leading-relaxed" style={{ color: "var(--ed-ink-3)" }}>
                Beispielhafte Einstellungen. Was ihr hier setzt, filtert vorher — statt hinterher
                Absagen zu schreiben.
              </p>
            </div>
          </div>

          {/* ── Was über Nacht passiert ───────────────────── */}
          <div className="mx-auto grid w-full max-w-[1240px] gap-10 px-5 pb-20 md:grid-cols-2 md:gap-16 md:px-8 md:pb-24">
            <div className="grid content-start gap-5">
              <h3 className="font-display text-[clamp(1.4rem,2.4vw,2rem)] font-normal leading-[1.1] tracking-[-0.02em]">
                {brand.assistantName} sucht auch dann, wenn ihr nicht sucht.
              </h3>
              <p className="text-[17px] leading-relaxed" style={{ color: "var(--ed-ink-2)" }}>
                Eure Stellen stehen nicht einfach online. Über Nacht vergleicht sie neue und
                bestehende Profile mit euren offenen Stellen — auch bei Menschen, die eure Anzeige
                nie gesehen haben. Am nächsten Morgen stehen dort nicht mehr Bewerbungen, sondern
                Möglichkeiten.
              </p>
              <ul className="grid gap-2">
                {[
                  "Neue Profile gegen offene Stellen prüfen",
                  "Besonders passende Menschen vorne einsortieren",
                  "Veränderungen im Passungswert bemerken",
                  "Mit Einwilligung beider Seiten den Kontakt öffnen",
                  "Das Team über neue Treffer informieren",
                ].map((z) => (
                  <li
                    key={z}
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 text-[15px]"
                    style={{ color: "var(--ed-ink-2)" }}
                  >
                    <span aria-hidden style={{ color: "var(--ed-violet-text)" }}>
                      ·
                    </span>
                    <span>{z}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/*
              Die drei Bewertungen getrennt.

              Eine einzige Zahl beantwortet die Frage nicht, die ein
              Unternehmen hat: Kann die Person das heute, passt die
              Arbeitsweise, und trägt das in drei Jahren noch? Drei
              Werte lassen sich unterschiedlich gewichten; einer nicht.
            */}
            <div className="grid content-start gap-4">
              {[
                [
                  "Fachlicher Fit",
                  "Kann die Person die Aufgaben heute erfüllen — oder schnell lernen?",
                ],
                [
                  "Persönlicher Fit",
                  "Passen Arbeitsweise, Erwartungen und Ziele zu dieser Stelle?",
                ],
                [
                  "Langfristiger Fit",
                  "Gibt es eine realistische Perspektive, damit aus der Einstellung eine Zusammenarbeit wird?",
                ],
              ].map(([titel, text]) => (
                <div
                  key={titel}
                  className="grid gap-1.5 rounded-(--radius-lg) p-6"
                  style={{ background: "var(--ed-surface)", boxShadow: "var(--ed-shadow-soft)" }}
                >
                  <span className="text-[15px] font-semibold">{titel}</span>
                  <span className="text-[15px] leading-relaxed" style={{ color: "var(--ed-ink-2)" }}>
                    {text}
                  </span>
                </div>
              ))}
              <p className="text-2xs leading-relaxed" style={{ color: "var(--ed-ink-3)" }}>
                Keine undurchsichtige Zahl: Zu jedem Treffer steht, worauf er beruht und was vor
                dem Gespräch zu klären ist.
              </p>
            </div>
          </div>
        </section>

        {/* ── Fit Score ───────────────────────────────────── */}
        <UnternehmensAbschnitt
          augenbraue="Mehr als ein Lebenslaufvergleich"
          titel="Der Fit Score."
          einleitung={`Kein einzelner Wert und keine undurchsichtige Zahl. ${brand.assistantName} bewertet drei Dinge getrennt — und schreibt zu jedem, woher die Einschätzung kommt und was vor dem Gespräch noch zu klären ist.`}
        >
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Fachlicher Fit", "Kann die Person die Aufgaben heute erfüllen — oder schnell lernen?"],
              ["Persönlicher Fit", "Passen Arbeitsweise, Erwartungen und Ziele zu dieser Stelle?"],
              ["Langfristiger Fit", "Gibt es eine realistische Perspektive über die Einarbeitung hinaus?"],
            ].map(([k, v]) => (
              <div
                key={k}
                className="grid content-start gap-2 rounded-(--radius-md) border border-line p-5"
                style={{ background: "color-mix(in oklab, var(--ed-ink) 3%, transparent)" }}
              >
                <span className="text-2xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--ed-violet-text)" }}>
                  {k}
                </span>
                <p className="text-[15px] leading-snug" style={{ color: "var(--ed-ink-2)" }}>{v}</p>
              </div>
            ))}
          </div>

          {/*
            Die Kriterien als Marken, nicht als Liste.

            Es sind zwölf, und zwölf Zeilen untereinander liest
            niemand. Nebeneinander gesetzt sieht man in einem Blick,
            wie breit die Grundlage ist — und das ist die Aussage,
            nicht der einzelne Punkt.

            Die Einschränkung steht davor, nicht dahinter: „soweit
            freigegeben" ist keine Fussnote, sondern die Bedingung, unter
            der die ganze Liste überhaupt gilt.
          */}
          <div className="grid gap-3 pt-2">
            <p className="text-sm" style={{ color: "var(--ed-ink-3)" }}>
              Berücksichtigt wird, <strong style={{ color: "var(--ed-ink-2)" }}>soweit die Person es freigegeben hat</strong>:
            </p>
            <ul className="flex flex-wrap gap-2">
              {[
                "fachliche Kenntnisse",
                "Berufs- und Projekterfahrung",
                "übertragbare Kompetenzen",
                "gewünschte Aufgaben",
                "Arbeitszeitmodell",
                "Verfügbarkeit",
                "Gehaltsvorstellung",
                "Arbeitsort und Pendelbereitschaft",
                "Team- und Unternehmensgrösse",
                "Arbeitsweise und Kommunikation",
                "Entwicklungsziele",
                "Ausschlusskriterien beider Seiten",
              ].map((x) => (
                <li
                  key={x}
                  className="rounded-(--radius-pill) px-3 py-1.5 text-sm"
                  style={{ background: "var(--ed-violet-soft)", color: "var(--ed-violet-text)" }}
                >
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </UnternehmensAbschnitt>

        {/*
          Hier stand die Einwilligung als eigener Abschnitt mit fuenf
          nummerierten Karten.

          Sie sagt dieselbe Zusage wie der Vertrauensabschnitt weiter
          unten - einmal als Ablauf, einmal als Haltung. Zwei
          Abschnitte fuer eine Aussage, mit einem Bildschirm dazwischen.
          Der Ablauf steht jetzt dort, wo die Zusage steht.
        */}

        {/* ── Was noch dazugehört ─────────────────────────── */}
        {/*
          Hier standen vier Abschnitte: Filter, Anzeigenprüfung,
          Entscheidungsgrundlage und Zusammenarbeit — jeder mit
          Überschrift, Einleitung und zwei Spalten Aufzählung.

          Vier Mal dieselbe Bauform hintereinander liest niemand bis
          zum Ende, und wer es täte, fände darin keine Entscheidung,
          sondern eine Funktionsliste. Was davon zählt, steht jetzt in
          einem Abschnitt; das Ausführliche gehört in die Anwendung,
          nicht auf die Seite, die zur Anmeldung führt.
        */}
        <UnternehmensAbschnitt
          augenbraue="Was noch dazugehört"
          titel="Vom Entwurf bis zum Gespräch."
          einleitung={`${brand.assistantName} unterscheidet Muss, Wunsch und entwickelbar — niemand fällt heraus, weil ein Schlagwort fehlt. Sie prüft eure Anzeige auf fehlende und widersprüchliche Angaben, und aus den offenen Punkten eines Vorschlags entsteht ein Interviewleitfaden.`}
        >
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Anzeige", "Fehlende Angaben, widersprüchliche Anforderungen und Formulierungen, die unnötig ausschliessen."],
              ["Unternehmensseite", "Arbeitsalltag, Führung, Arbeitszeit, Gehalt, Entwicklung und Bewerbungsprozess — konkret statt werblich."],
              ["Zusammenarbeit", "Rollen, gemeinsame Ansicht, dokumentierte Bewertungen und ein Protokoll der Entscheidungen."],
            ].map(([k, v]) => (
              <div
                key={k}
                className="grid content-start gap-2 rounded-(--radius-md) border border-line p-5"
              >
                <span className="text-2xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--ed-violet-text)" }}>
                  {k}
                </span>
                <p className="text-[15px] leading-snug" style={{ color: "var(--ed-ink-2)" }}>{v}</p>
              </div>
            ))}
          </div>
        </UnternehmensAbschnitt>

        {/* ── Was sich ändert und wo die Grenze liegt ─────── */}
        <UnternehmensAbschnitt
          augenbraue="Was sich dadurch ändert"
          titel="Weniger Bewerbungen. Mehr Gespräche, die etwas bringen."
          einleitung="Das Ziel ist nicht ein voller Posteingang. Es ist ein leerer Posteingang mit drei richtigen Namen darin."
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              "Massenbewerbungen gehen zurück",
              "geeignete Menschen fallen früher auf",
              "Quereinsteiger werden überhaupt sichtbar",
              "die Bearbeitungszeit sinkt",
              "Rückmeldungen kommen schneller",
              "Fehlbesetzungen durch falsche Erwartungen werden seltener",
              "langfristige Passung wiegt mit",
              "der Aufwand wird messbar",
            ].map((x) => (
              <li
                key={x}
                className="rounded-(--radius-sm) px-4 py-3 text-[15px]"
                style={{ background: "color-mix(in oklab, var(--ed-ink) 3%, transparent)", color: "var(--ed-ink-2)" }}
              >
                {x}
              </li>
            ))}
          </ul>

          {/*
            Die Grenze steht in einem eigenen, abgesetzten Kasten.

            Ein System, das aus vergangenen Entscheidungen lernt,
            übernimmt auch deren Fehler — und ein Einstellungsprozess
            ist genau der Ort, an dem das teuer wird. Diese Einschränkung
            hier in eine Aufzählung zu stellen hiesse, sie zu
            verstecken.
          */}
          {/*
            Tiefes Navy statt der Tintenfarbe.

            `--ed-ink` ist der Ton der Schrift; als Fläche war er im
            hellen Modus ein dunkles Grau und im dunklen fast der
            Seitengrund — der Kasten verschwand also genau dort, wo er
            sich absetzen soll. `#0b0d16` ist derselbe Ton, den der
            Vertrauensabschnitt weiter unten trägt, und damit in beiden
            Modi dieselbe Fläche.
          */}
          <div
            className="grid gap-3 rounded-(--radius-md) p-6 md:p-8"
            style={{ background: "#0b0d16", color: "#f4f5fa" }}
          >
            <p className="text-2xs font-semibold uppercase tracking-[0.16em]" style={{ color: "rgba(244,245,250,.62)" }}>
              {brand.assistantName} lernt — kontrolliert
            </p>
            <p className="max-w-[62ch] text-[15px] leading-relaxed" style={{ color: "rgba(244,245,250,.86)" }}>
              Sie wertet aus, welche Profile zu Gesprächen geführt haben, welche Kriterien weniger
              wichtig waren als gedacht, warum Menschen abgesagt haben und welche Formulierungen
              passende Bewerbungen ausgelöst haben.
            </p>
            <p className="max-w-[62ch] text-[15px] leading-relaxed" style={{ color: "rgba(244,245,250,.86)" }}>
              Vergangene Entscheidungen werden dabei nicht zur Wahrheit. Sensible Merkmale bleiben
              aus der Bewertung ausgeschlossen, jede Empfehlung ist erklärbar und überprüfbar — und
              die Entscheidung trifft ein Mensch.
            </p>
          </div>
        </UnternehmensAbschnitt>

        {/*
          Hier lag ein Bild mit dem Satz „Eine Stelle, die vollständig
          ist, findet andere Menschen."

          Ein Stimmungsmotiv mit einer Behauptung darüber — beides ohne
          Beleg, und der Satz sagte nichts, was die Abschnitte davor
          nicht schon konkreter sagen.
        */}

        {/* ── Die Trennlinie ──────────────────────────────── */}
        <section id="trennlinie" style={{ background: "#0b0d16", color: "#f4f5fa" }}>
          <div className="mx-auto grid w-full max-w-[1240px] gap-10 px-5 py-20 md:px-8 md:py-28 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="grid content-start gap-5">
              <p
                className="font-mono text-2xs uppercase tracking-[0.16em]"
                style={{ color: "rgba(244,245,250,.62)" }}
              >
                Vertrauen
              </p>
              <h2 className="font-display text-[clamp(1.9rem,3.4vw,3rem)] font-normal leading-[1.04] tracking-[-0.02em] text-white">
                Private Gespräche bleiben privat.
              </h2>
              <p
                className="max-w-[52ch] text-[clamp(1rem,1.35vw,1.15rem)] leading-[1.62]"
                style={{ color: "rgba(244,245,250,.76)" }}
              >
                Menschen erzählen {brand.assistantName} Dinge, die sie keinem Arbeitgeber erzählen
                würden — was sie verdienen, was sie belastet, warum sie wechseln wollen. Genau
                deshalb sind sie hier.
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(244,245,250,.6)" }}>
                Das ist keine Vereinbarung, sondern in der Datenbank verankert und mit Tests gegen
                eine echte Datenbank belegt.
              </p>
            </div>

            {/*
              Hier standen zwei Kästen: „Ihr seht" und „Ihr seht nie",
              mit je vier Zeilen.

              Sie beantworteten eine Frage, die auf einer Produktseite
              niemand in dieser Ausführlichkeit stellt — acht
              Aufzählungspunkte neben einem Absatz, der dieselbe
              Aussage in drei Sätzen macht.

              Die Liste selbst ist richtig und gehört gelesen. Sie
              steht jetzt auf der Sicherheitsseite: dort geht hin, wer
              es genau wissen will, und dort steht sie neben den
              übrigen Zusagen statt allein.
            */}
            <div className="grid content-start gap-5">
              {/*
                Der Ablauf stand bis eben als eigener Abschnitt weiter
                oben, mit fünf nummerierten Karten über einen ganzen
                Bildschirm. Hier steht er als Liste neben der Zusage,
                zu der er gehört — dieselbe Aussage, ein Zehntel der
                Höhe.

                Nummeriert, weil es wirklich eine Reihenfolge gibt:
                Ohne Schritt drei gibt es keinen Schritt vier.
              */}
              <ol className="grid gap-2.5">
                {[
                  [`${brand.assistantName} erkennt eine hohe Übereinstimmung.`, false],
                  ["Die Person bekommt erklärt, warum die Stelle passen könnte.", true],
                  ["Sie entscheidet, ob ihr Profil für euch freigegeben wird.", true],
                  ["Ihr erhaltet das freigegebene Profil mitsamt der Erklärung.", false],
                  ["Bei beiderseitigem Interesse öffnet sich der Kontakt.", true],
                ].map(([text, beiIhr], i) => (
                  <li key={String(text)} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 text-[15px]">
                    <span className="font-mono tabular-nums" style={{ color: "rgba(244,245,250,.5)" }}>
                      {i + 1}
                    </span>
                    <span style={{ color: "rgba(244,245,250,.82)" }}>
                      {text}
                      {beiIhr === true && (
                        <span className="ml-2 text-2xs font-semibold uppercase tracking-[0.1em]" style={{ color: "rgba(244,245,250,.5)" }}>
                          Die Person entscheidet
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>

              <p className="text-sm leading-relaxed" style={{ color: "rgba(244,245,250,.6)" }}>
                Kein Profilhandel. Keine ungefragte Weitergabe. Kontakt erst nach Zustimmung.
              </p>

              <Link
                href="/security"
                className="inline-flex min-h-13 w-fit items-center gap-2 rounded-(--radius-pill) px-6 text-[15px] font-medium transition-colors"
                style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}
              >
                Was ihr seht — und was nicht
                <ArrowRight aria-hidden className="size-4" strokeWidth={2} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Abschluss ───────────────────────────────────── */}
        <section>
          <div className="mx-auto grid w-full max-w-[1240px] justify-items-center gap-8 px-5 py-20 text-center md:px-8 md:py-28">
            <h2 className="font-display text-[clamp(2.2rem,4.6vw,3.6rem)] font-normal leading-[1.02] tracking-[-0.02em]">
              Erste Stelle in ein paar Minuten.
            </h2>
            <p
              className="max-w-[52ch] text-[clamp(1rem,1.35vw,1.15rem)] leading-[1.62]"
              style={{ color: "var(--ed-ink-2)" }}
            >
              Konto anlegen, Entwurf schreiben, prüfen lassen. Veröffentlichen könnt ihr, sobald wir
              bestätigt haben, dass ihr für das Unternehmen sprecht.
            </p>
            <Link
              href="/business/signup"
              className="group inline-flex min-h-13 items-center gap-2 rounded-(--radius-pill) px-6 text-[15px] font-medium transition-transform hover:-translate-y-0.5"
              style={{
                background: "var(--ed-violet)",
                color: "#fff",
                boxShadow: "0 10px 34px color-mix(in oklab, var(--ed-violet) 34%, transparent)",
              }}
            >
              Unternehmen registrieren
              <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
            </Link>
          </div>
        </section>
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

/**
 * Ein Abschnitt dieser Seite.
 *
 * Die Seite hatte sieben Abschnitte mit sieben Mal denselben
 * Abständen, Breiten und Überschriftsgrössen — jedes Mal von Hand
 * geschrieben. Beim achten wäre einer davon abgewichen, und das sieht
 * man einer Seite an, noch bevor man weiss, woran es liegt.
 */
function UnternehmensAbschnitt({
  augenbraue,
  titel,
  einleitung,
  children,
}: {
  augenbraue: string;
  titel: string;
  einleitung?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-5 py-20 md:px-8 md:py-28">
        <div className="grid max-w-[68ch] gap-4">
          <p
            className="text-2xs font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--ed-ink-3)" }}
          >
            {augenbraue}
          </p>
          <h2 className="font-display text-[clamp(1.7rem,3vw,2.6rem)] font-normal leading-[1.06] tracking-[-0.02em]">
            {titel}
          </h2>
          {einleitung && (
            <p className="text-[clamp(1rem,1.3vw,1.1rem)] leading-[1.62]" style={{ color: "var(--ed-ink-2)" }}>
              {einleitung}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

/**
 * Eine beschriftete Liste.
 *
 * Bewusst ohne Häkchen: Ein Häkchen vor jeder Zeile macht aus einer
 * Aufzählung eine Leistungsliste, und aus Punkten, die Monday *prüft*,
 * werden dann Punkte, die sie *garantiert*. Ein Strich sagt nur, dass
 * es mehrere sind.
 */
function Spalte({
  titel,
  children,
  fuss,
}: {
  titel: string;
  children: string[];
  fuss?: string;
}) {
  return (
    <div className="grid content-start gap-3">
      <h3 className="text-[15px] font-semibold">{titel}</h3>
      <ul className="grid gap-2.5">
        {children.map((x) => (
          <li key={x} className="flex gap-3 text-[15px] leading-snug" style={{ color: "var(--ed-ink-2)" }}>
            <span aria-hidden className="mt-2.5 h-px w-3 shrink-0" style={{ background: "var(--ed-hairline-strong)" }} />
            {x}
          </li>
        ))}
      </ul>
      {fuss && (
        <p className="pt-1 text-sm leading-relaxed" style={{ color: "var(--ed-ink-3)" }}>
          {fuss}
        </p>
      )}
    </div>
  );
}
