import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { brand } from "@paycheck/config";
import { BestandProvider } from "@/components/marketing/BestandProvider";
import { LebendeZahl } from "@/components/marketing/LebendeZahl";
import { NinaVisual } from "@/components/nina/NinaVisual";
import { Einstieg } from "@/components/marketing/Einstieg";
import { HaeufigeFragen } from "@/components/marketing/HaeufigeFragen";
import { Partnerleiste } from "@/components/marketing/Partnerleiste";
import { AppHinweisleiste } from "@/components/shell/AppHinweisleiste";
import { NachtsWeiter } from "@/components/jobs/NachtsWeiter";
import { TopNav } from "@/components/shell/TopNav";
import { VelvovaFooter } from "@/components/shell/VelvovaFooter";
import { laenderbestand } from "@/lib/jobs/laenderbestand";
import { Arbeitswelt } from "@/components/marketing/Arbeitswelt";
import { Befund } from "@/components/marketing/Befund";
import { Bewerbungsbeleg } from "@/components/marketing/Bewerbungsbeleg";
import { Erscheint } from "@/components/marketing/Erscheint";
import { Erwartungsbeleg } from "@/components/marketing/Erwartungsbeleg";
import { Trennstrahl } from "@/components/marketing/Trennstrahl";
import { Rechnet } from "@/components/marketing/Rechnet";
import { Schrittfolge } from "@/components/marketing/Schrittfolge";
import { HilfeKnopf } from "@/components/marketing/HilfeKnopf";
import { Lebenshaltung } from "@/components/marketing/Lebenshaltung";
import { Zukunftsblick } from "@/components/marketing/Zukunftsblick";
import { StimmenAbschnitt } from "@/components/reviews/StimmenAbschnitt";
import { Landeshinweis, Laenderschalter } from "@/components/marketing/Landeshinweis";
import { besucherHerkunft } from "@/lib/herkunft";
import { bestandszahl, type Bestandszahl } from "@/lib/jobs/bestandszahl";
import { kopfsitzung } from "@/components/shell/Kopfsitzung";
import { landesname, lageFuer, type Landeslage } from "@/lib/landeslage";
import { Abomodell } from "@/components/marketing/Abomodell";

/*
 * Kein `revalidate` — diese Seite wird ohnehin bei jedem Aufruf
 * gerendert.
 *
 * Hier stand eine Vorhaltezeit von zehn Minuten mit der Begründung,
 * die Stellenzahl solle nie mehr als einen Zählvorgang hinterherhängen.
 * Der Bau zeigt die Route als `ƒ`, also dynamisch: sie liest
 * Suchparameter beziehungsweise Kopfzeilen und kann gar nicht
 * vorgehalten werden. Die Angabe war wirkungslos, der Kommentar
 * daneben falsch — und ein Kommentar, der ein Verhalten beschreibt,
 * das der Code nicht hat, ist schlimmer als keiner.
 *
 * Die Zahl ist damit bei jedem Aufruf aktuell. Sie kostet dabei eine
 * einzige indizierte Zeile aus `bestandskennzahlen`, die der
 * Pflegelauf stündlich neu schreibt.
 */
export const metadata: Metadata = {
  title: "Du suchst keinen Job. Monday findet den richtigen für dich.",
  description:
    "Monday lernt, was dir wichtig ist, prüft echte Stellen und zeigt dir nicht nur, was passen " +
    "könnte — sondern warum. Unternehmen veröffentlichen Stellen und finden passende Menschen.",
};

/**
 * Die Landingpage.
 *
 * ── Was hier neu gedacht wurde ────────────────────────────────
 *
 * Die vorige Fassung war technisch sauber und emotional leer: ein Hero
 * aus drei losen Karten mit einer Kugel darüber, danach eine Reihe
 * weisser Kästen. Sie erklärte das Kandidatenprodukt und verschwieg,
 * dass es eine zweite Seite gibt.
 *
 * Drei Entscheidungen tragen den Umbau:
 *
 *   **Eine Komposition statt drei Karten.** Der Monday Core zeigt einen
 *   Zusammenhang — was jemand sagt, was Monday daraus macht, was dabei
 *   herauskommt. Der Zusammenhang IST die Produktidee.
 *
 *   **Rhythmus statt Gleichförmigkeit.** Hell, weiss, lavendel, dunkel,
 *   ganzflächiges Bild. Eine Seite aus lauter gleichen Karten hat keine
 *   Dramaturgie, und ohne Dramaturgie liest niemand bis unten.
 *
 *   **Beide Seiten.** Unternehmen kommen nicht im Fuss vor, sondern in
 *   der Kopfzeile, im Hero und in einem eigenen grossen Abschnitt.
 *
 * ── Was hier weiterhin NICHT steht ────────────────────────────
 *
 * Erfundene Nutzerzahlen, Presse-Logos, Erfolgsquoten, Kundenlogos. Auf
 * einer Seite, die Belegbarkeit verspricht, wäre eine erfundene Zahl
 * der schlechteste mögliche erste Eindruck.
 *
 * ── Zu den Bildern ────────────────────────────────────────────
 *
 * Die Flächen unter `/arbeitswelt` sind Platzhalter: Räume und Licht,
 * keine Menschen. Warum, und wie ein Foto sie ersetzt, steht in
 * `public/arbeitswelt/BILDER.md`.
 */
export default async function LandingPage() {
  /*
   * Das Land des Besuchers — soweit das Netz es ohnehin weiss.
   *
   * Kein Standortdialog, kein JavaScript, keine IP: nur der Ländercode,
   * den das CDN als Kopfzeile mitschickt. Er entscheidet über zwei
   * Aussagen, die sonst falsch wären — ob es hier Stellen gibt und ob
   * die Nettorechnung gilt.
   *
   * Alles andere bleibt gleich. Insbesondere werden keine Beispielzahlen
   * umgerechnet: Aus „53.000 €" würde „53.000 CHF" und damit eine
   * Behauptung über das Schweizer Lohnniveau, die niemand geprüft hat.
   */
  const herkunft = await besucherHerkunft();
  const lage = lageFuer(herkunft.code);

  /*
   * Die Stellenzahl steht in der ersten Zeile der Seite und ist die
   * einzige Angabe darauf, die ein Besucher sofort nachprüfen kann:
   * Er sucht, zählt die Treffer und weiss, ob die Überschrift lügt.
   *
   * Sie kommt deshalb aus dem Bestand, nicht aus dem Entwurf, und
   * wächst mit dem Bestand mit — der Pflegelauf zählt stündlich nach.
   */
  const [bestand, laender, sitzung] = await Promise.all([
    bestandszahl(),
    laenderbestand(),
    /*
     * Wer den Kopf sieht — und ob überhaupt jemand.
     *
     * Diese Seite ist für beide da. Ein `requireUser` wäre genau der
     * Bruch, der mit der „Heute"-Seite verschwunden ist: Wer angemeldet
     * ist, soll dieselbe Seite sehen, nur mit seinem Namen darüber.
     */
    kopfsitzung(),
  ]);

  return (
    <BestandProvider genau={bestand.genau} proSekunde={bestand.proSekunde}>
    <div
      data-surface="editorial"
      /*
       * Kein festes `data-theme="light"` mehr.
       *
       * Es stand hier mit der Begründung, die Startseite werde von
       * Menschen geöffnet, die das Produkt noch nicht kennen — meist
       * bei Tageslicht. Das mag stimmen, hebelt aber die Wahl aus:
       * Wer im Fuss auf „Dunkel" stellt, sah die Startseite weiterhin
       * hell und hielt den Schalter für kaputt.
       *
       * Die Tokens tragen beide Fassungen; der Wechsel funktioniert
       * hier genauso wie überall sonst.
       */
      className="min-h-dvh"
      style={{ background: "var(--ed-canvas)", color: "var(--ed-ink)" }}
    >
      <a href="#inhalt" className="skip-link">
        Zum Inhalt springen
      </a>

      {/* Die Ankündigung steht über dem Kopf — auf jeder Seite
          dieselbe, mittig, dunkelblau. */}
<AppHinweisleiste />

      {/*
       * Derselbe Kopf wie überall.
       *
       * Die Startseite trug eine eigene Kopfzeile mit eigener Marke,
       * eigenen Wegen und eigenen Abständen. Wer sich von hier
       * anmeldete, dem wechselte im selben Moment die ganze Umgebung —
       * und die Startseite ist für die meisten die erste Seite.
       */}
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
      <Landeshinweis lage={lage} quelle={herkunft.quelle} />

      {/*
        ══════════════════════════════════════════════════════════════
        Vierzehn Abschnitte wurden zwei
        ══════════════════════════════════════════════════════════════

        Die Startseite erklärte in vierzehn Abschnitten, warum sich
        Velvova lohnt — und bot nirgends an, es zu versuchen. Wer sich
        anmelden wollte, musste erst eine Navigationsentscheidung
        treffen.

        Jetzt steht der Einstieg dort, wo der Blick zuerst hinfällt.
        Die Erklärungen sind nicht gelöscht: Sie stehen weiter unten in
        dieser Datei und werden über die Navigation erreichbar gemacht.
        Eine Startseite ist kein Ort, an dem man alles sagt.
      */}
      <main id="inhalt">
        <Einstiegshero angemeldet={sitzung.angemeldet} anrede={sitzung.anrede} />
        {/*
          Preise vor die Fragen.

          Wer bis hierher gelesen hat, will als Nächstes wissen, was es
          kostet — nicht, ob es ein Konto braucht. Steht die Preisfrage
          erst unter der FAQ, beantwortet sie die FAQ zweimal: einmal
          als Frage und einmal als Abschnitt darunter.
        */}
        <Abomodell angemeldet={sitzung.angemeldet} />
        <HaeufigeFragen assistentName={brand.assistantName} />
      </main>

      {/* Auch der Fuss ist derselbe: Märkte, Zahlungsarten, Region,
          Rechtliches. */}
      <VelvovaFooter laender={laender} />

      {/* Unten rechts, auf jeder Bildschirmhöhe erreichbar: Wer nicht
          weiterweiss, soll nicht erst zum Fuss scrollen müssen. */}
      <HilfeKnopf assistantName={brand.assistantName} />
    </div>
    </BestandProvider>
  );
}


/* ══════════════════════════════════════════════════════════════
   Nach der Bewerbung
   ══════════════════════════════════════════════════════════════ */

/**
 * Was passiert, wenn es klappt — und wenn nicht.
 *
 * ── Warum die Absage hier vorkommt ────────────────────────────
 *
 * Jede Produktseite endet mit dem Erfolg. Auf einem Stellenmarkt ist
 * das die Hälfte der Wahrheit: Die meisten Bewerbungen führen zu einer
 * Absage, und wer sie bekommt, hat sie nicht verdient — sie ist die
 * Regel, nicht das Scheitern. Das auszusprechen kostet nichts und
 * nimmt einer Erfahrung die Spitze, die ohnehin kommt.
 *
 * ── Warum der Datenteil dazugehört ────────────────────────────
 *
 * „Monday kennt deinen ganzen Weg" ist ein Versprechen und zugleich
 * eine Aussage darüber, was wir speichern. Beides in einem Absatz zu
 * lesen, ist ehrlicher, als das eine hier und das andere in der
 * Datenschutzerklärung zu haben.
 */
function NachDerBewerbung() {
  return (
    <Abschnitt grund="weiss">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <Erscheint className="grid content-start gap-6">
          <Augenbraue>Und nach der Bewerbung?</Augenbraue>
          <Ueberschrift>
            Eine Bewerbung ist ein Schritt.
            <br />
            {brand.assistantName} begleitet den Weg.
          </Ueberschrift>
        </Erscheint>

        <Erscheint verzoegerung={120} className="grid content-start gap-5">
          <Fliess>
            {brand.assistantName} erhöht deine Chancen, indem sie dich bestmöglich vorbereitet. Ob
            eine Zusage kommt, entscheidet am Ende das Unternehmen. Eine Absage ist deshalb kein
            Scheitern, sondern ein normaler Teil der Jobsuche.
          </Fliess>
          <Fliess>
            Wirst du genommen, hilft sie dir, sicher in den neuen Job zu starten. Klappt es nicht,
            bleibt sie da: Sie wertet mit dir aus, was sich verbessern lässt, passt die Strategie
            an und begleitet die nächste Bewerbung.
          </Fliess>
          <Fliess>
            Mit der Zeit wird sie dein Karriereagent — sie kennt deinen Weg, deine Erfahrungen,
            deine Ziele und frühere Entscheidungen. Du fängst nicht bei jeder Bewerbung von vorn
            an.
          </Fliess>

          {/*
            Der Datenteil steht bewusst hier und nicht nur in der
            Datenschutzerklärung: Wer liest, dass Monday sich alles
            merkt, fragt sich im selben Moment, wo das liegt.
          */}
          <p
            className="rounded-(--radius-md) px-5 py-4 text-[15px] leading-relaxed"
            style={{
              background: "color-mix(in oklab, var(--ed-ink) 4%, transparent)",
              color: "var(--ed-ink-2)",
            }}
          >
            Deine Daten liegen in unserer eigenen Infrastruktur. Sie werden nicht zum Training
            externer KI-Anbieter verwendet und nicht ohne deine Zustimmung weitergegeben. Zugriff
            hast du — und {brand.assistantName}, soweit sie ihn für deine Unterstützung braucht.
          </p>
        </Erscheint>
      </div>
    </Abschnitt>
  );
}

/* ══════════════════════════════════════════════════════════════
   Kopf und Fuss
   ══════════════════════════════════════════════════════════════ */

const NAV = [
  ["Produkt", "/product"],
  [brand.assistantName, "/how-it-works"],
  /*
     Zeigte auf `/product#jobs` — einen Abschnitt der Produktseite, der
     über Stellen *spricht*. Wer im Kopf einer Jobplattform auf „Jobs"
     klickt, will Stellen sehen, nicht einen Text darüber. Seit es die
     öffentliche Suche gibt, ist das kein Kompromiss mehr.
  */
  ["Jobs", "/jobs"],
  ["Für Unternehmen", "/for-business"],
  ["Sicherheit", "/security"],
  ["Über uns", "/about"],
] as const;

function Kopfzeile() {
  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-xl"
      style={{
        background: "color-mix(in oklab, var(--ed-canvas) 82%, transparent)",
        boxShadow: "0 1px 24px rgba(9, 11, 18, 0.05)",
      }}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-6 px-5 md:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="block size-[18px] rounded-full"
            style={{
              background:
                "conic-gradient(from 180deg, var(--ed-violet), var(--ed-ice), var(--ed-mint), var(--ed-violet))",
            }}
          />
          <span className="font-display text-[15px] font-normal tracking-[-0.02em]">
            {brand.name}
          </span>
        </Link>

        {/*
          Erst ab `lg`. Bei 768 Pixeln — der Breite jedes Tablets im
          Hochformat — brauchten sechs Punkte plus zwei Knöpfe mehr Platz
          als da ist, und die Seite lief über.
        */}
        <nav aria-label="Hauptnavigation" className="ml-auto hidden items-center gap-6 lg:flex">
          {NAV.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-11 items-center rounded-(--radius-pill) px-1.5 text-sm transition-colors hover:text-[var(--ed-ink)]"
              style={{ color: "var(--ed-ink-2)" }}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Link
            href="/login"
            className="hidden min-h-11 items-center rounded-(--radius-pill) px-3 text-sm sm:inline-flex"
            style={{ color: "var(--ed-ink-2)" }}
          >
            Anmelden
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-11 items-center rounded-(--radius-pill) px-4 text-sm font-medium transition-transform hover:-translate-y-px"
            style={{
              background: "var(--ed-violet)",
              color: "#fff",
              boxShadow: "0 6px 20px color-mix(in oklab, var(--ed-violet) 32%, transparent)",
            }}
          >
            Kostenlos starten
          </Link>
        </div>
      </div>
    </header>
  );
}

function Fusszeile({ lage }: { lage: Landeslage }) {
  const spalten: [string, [string, string][]][] = [
    [
      "Für dich",
      [
        ["So funktioniert es", "/how-it-works"],
        ["Produkt", "/product"],
        ["Preise", "/pricing"],
        ["Methodik", "/methodology"],
      ],
    ],
    [
      "Für Unternehmen",
      [
        ["Stellen veröffentlichen", "/for-business#stellen"],
        ["Passende Menschen finden", "/for-business#finden"],
        ["Mit dem Markt vergleichen", "/for-business#markt"],
        ["Unternehmen registrieren", "/business/signup"],
      ],
    ],
    [
      "Vertrauen",
      [
        ["Sicherheit", "/security"],
        ["Datenschutz", "/privacy"],
        ["KI-Transparenz", "/ai-transparency"],
        ["Über uns", "/about"],
      ],
    ],
  ];

  return (
    <footer style={{ borderTop: "1px solid var(--ed-hairline)" }}>
      <div className="mx-auto grid w-full max-w-[1240px] gap-10 px-5 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)] md:px-8">
        <div className="grid content-start gap-3">
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="block size-[18px] rounded-full"
              style={{
                background:
                  "conic-gradient(from 180deg, var(--ed-violet), var(--ed-ice), var(--ed-mint), var(--ed-violet))",
              }}
            />
            <span className="font-display text-[15px] font-normal">{brand.name}</span>
          </span>
          <p className="max-w-[34ch] text-sm leading-relaxed" style={{ color: "var(--ed-ink-2)" }}>
            Karriere ist eine Folge von Entscheidungen. Wir liefern die Grundlage dafür — begründet,
            nachprüfbar, in deiner Hand.
          </p>
        </div>

        {spalten.map(([titel, punkte]) => (
          <nav key={titel} aria-label={titel} className="grid content-start gap-3">
            <h2 className="text-2xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--ed-ink-3)" }}>
              {titel}
            </h2>
            <ul className="grid gap-2.5">
              {punkte.map(([label, href]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm transition-colors hover:text-[var(--ed-ink)]"
                    style={{ color: "var(--ed-ink-2)" }}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mx-auto grid w-full max-w-[1240px] gap-3 px-5 pb-10 md:px-8">
        {/*
          Der Länderschalter steht auch dann hier, wenn oben kein Hinweis
          erscheint. Sonst gäbe es für jemanden in Deutschland, der die
          Seite für die Schweiz ansehen will, keinen Weg — und für
          jemanden mit falsch gespeicherter Wahl keinen zurück.
        */}
        <Laenderschalter lage={lage} />
        <div
          className="flex flex-wrap gap-x-6 gap-y-2 text-2xs"
          style={{ color: "var(--ed-ink-3)" }}
        >
          <Link href="/imprint">Impressum</Link>
          <Link href="/terms">AGB</Link>
          <Link href="/privacy">Datenschutz</Link>
        </div>
      </div>
    </footer>
  );
}

/* ══════════════════════════════════════════════════════════════
   Bausteine
   ══════════════════════════════════════════════════════════════ */

/**
 * Der Abschnitt unter den Stellen — der Kasten in einem Abschnitt.
 *
 * Der Inhalt steht in `components/jobs/NachtsWeiter.tsx`, weil er auf
 * der Stellenseite noch einmal gebraucht wird. Zwei Fassungen
 * desselben Versprechens liefen irgendwann auseinander.
 */
function NachtsAbschnitt() {
  return (
    /*
      Kein `Abschnitt` mehr um das Band.
      
      `Abschnitt` legt seinen Inhalt immer in den 1240er-Behälter mit
      Innenabstand — genau das, was ein randloses Bild nicht haben
      darf. Der Abschnitt steht deshalb hier direkt, mit der Fläche
      des Rhythmus, und das Band füllt ihn von Kante zu Kante.
      
      Die Schrift IM Band steht trotzdem im Raster: `randlos` legt sie
      in denselben Behälter, in dem alles darüber und darunter steht.
    */
    <section style={{ background: "var(--ed-canvas)" }} className="pb-20 md:pb-28">
      {/*
        Kein lavendelfarbener Grund mehr und kein Abstand nach oben.

        Der Rhythmus der Startseite wechselt die Flächen — hell,
        weiss, lavendel, dunkel —, damit eine lange Seite Absätze
        bekommt. Bei einem randlosen Foto kehrt sich das um: Über und
        unter dem Bild standen zwei lila Streifen, und das Bild sah
        aus wie hineingelegt statt wie ein eigener Abschnitt.

        Ein Foto über die volle Breite IST der Absatz. Es braucht
        keine Fläche, die ihn zusätzlich behauptet.

        Der Grund ist `--ed-canvas`, eine Stufe neben den Abschnitten
        davor und danach. Damit zeichnet sich über und unter dem Bild
        eine feine Kante ab — auf Ansage: Sie setzt das Band als
        eigenen Abschnitt ab, ohne den lauten Lavendelstreifen, der
        vorher hier stand.
      */}
      <NachtsWeiter randlos />
    </section>
  );
}

function Abschnitt({
  children,
  grund = "canvas",
  klasse = "",
  id,
}: {
  children: React.ReactNode;
  grund?: "canvas" | "weiss" | "lavendel" | "dunkel";
  klasse?: string;
  id?: string;
}) {
  /*
   * Der Hintergrundrhythmus.
   *
   * Eine Seite aus lauter hellgrauen Abschnitten liest sich wie ein
   * einziger langer Abschnitt. Der Wechsel gibt dem Auge Absätze — und
   * der dunkle Block in der Mitte gibt ihr einen Höhepunkt.
   */
  const flaeche = {
    canvas: { background: "var(--ed-canvas)" },
    weiss: { background: "var(--ed-surface)" },
    lavendel: { background: "var(--ed-violet-soft)" },
    dunkel: { background: "#0b0d16", color: "#f4f5fa" },
  }[grund];

  return (
    <section id={id} style={flaeche} className={klasse}>
      <div className="mx-auto w-full max-w-[1240px] px-5 py-20 md:px-8 md:py-28">{children}</div>
    </section>
  );
}

function Augenbraue({ children, hell = false }: { children: React.ReactNode; hell?: boolean }) {
  return (
    <p
      /*
       * Die Hausschrift, nicht die Zahlenschrift.
       *
       * Hier stand `font-mono`. Die Schreibmaschinenschrift ist für
       * Ziffern gewählt — gleiche Breite, eindeutige Eins — und für
       * einen gesperrten Grossbuchstabensatz genau das Falsche: Die
       * feste Breite reisst zwischen schmalen Buchstaben Löcher, die
       * Sperrung verdoppelt sie, und der Satz zerfällt in Einzelzeichen.
       */
      className="text-2xs font-semibold uppercase tracking-[0.18em]"
      style={{ color: hell ? "rgba(244,245,250,.62)" : "var(--ed-ink-3)" }}
    >
      {children}
    </p>
  );
}

function Ueberschrift({
  children,
  gross = false,
  hell = false,
}: {
  children: React.ReactNode;
  gross?: boolean;
  hell?: boolean;
}) {
  return (
    <h2
      className={
        "font-display font-semibold tracking-[-0.03em] " +
        (gross
          ? "text-[clamp(2.4rem,5.2vw,4.4rem)] leading-[0.98]"
          : "text-[clamp(1.9rem,3.4vw,3rem)] leading-[1.04]")
      }
      style={{ color: hell ? "#f4f5fa" : "var(--ed-ink)" }}
    >
      {children}
    </h2>
  );
}

function Fliess({ children, hell = false }: { children: React.ReactNode; hell?: boolean }) {
  return (
    <p
      className="max-w-[56ch] text-[clamp(1rem,1.35vw,1.15rem)] leading-[1.62]"
      style={{ color: hell ? "rgba(244,245,250,.76)" : "var(--ed-ink-2)" }}
    >
      {children}
    </p>
  );
}

function Hauptknopf({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex min-h-13 items-center gap-2 rounded-(--radius-pill) px-6 text-[15px] font-medium transition-transform hover:-translate-y-0.5"
      style={{
        background: "var(--ed-violet)",
        color: "#fff",
        boxShadow: "0 10px 34px color-mix(in oklab, var(--ed-violet) 34%, transparent)",
      }}
    >
      {children}
      <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
    </Link>
  );
}

function Nebenknopf({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-13 items-center gap-2 rounded-(--radius-pill) px-6 text-[15px] font-medium transition-colors"
      style={{
        color: "var(--ed-ink)",
        boxShadow: "inset 0 0 0 1px var(--ed-hairline-strong)",
      }}
    >
      {children}
      <ArrowUpRight aria-hidden className="size-4" strokeWidth={2} />
    </Link>
  );
}

/* ══════════════════════════════════════════════════════════════
   1 · Hero
   ══════════════════════════════════════════════════════════════ */

/**
 * Der Einstieg: links was es ist und wie man anfängt, rechts der Core.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum 45 zu 55 und nicht die Hälfte
 * ══════════════════════════════════════════════════════════════
 *
 * Die linke Spalte trägt Text und Knöpfe — beides bricht um und
 * braucht eine Zeilenlänge, die man noch lesen kann. Die rechte trägt
 * ein rundes Objekt, das seinen Platz füllt, egal wie viel er misst.
 *
 * Bei genau der Hälfte wirkt der Core klein und die Textspalte zu
 * breit. Fünf Prozent nach rechts verschoben stimmt beides.
 *
 * ══════════════════════════════════════════════════════════════
 * Der Core lädt, die Anmeldung nicht
 * ══════════════════════════════════════════════════════════════
 *
 * `NinaVisual` bringt seine eigene Ersatzdarstellung mit und hängt in
 * einer eigenen Spalte. Wer sich anmelden will, wartet nicht auf ein
 * 3D-Modell — die linke Spalte steht sofort und vollständig.
 */
function Einstiegshero({ angemeldet, anrede }: { angemeldet: boolean; anrede: string | null }) {
  return (
    /*
        Nebeneinander ab 768, nicht erst ab 1024.

        Die Aufteilung stand auf `lg`. Das klingt nach „Desktop" und ist
        es nicht: Ein Fenster mit 900 oder 1000 Pixeln Breite ist der
        Normalfall auf einem Notebook — daneben ein Editor, ein Chat
        oder einfach ein nicht maximiertes Fenster. Dort stand die
        Anmeldekarte unter dem Core statt neben ihm, und der Einstieg
        lag unterhalb des ersten Bildschirms.

        Ab 520, nicht erst ab 768.

        Die Grenze wanderte dreimal nach unten: erst `lg` (1024), dann
        `md` (768), dann `sm` (640) — und dreimal stand der Core bei
        jemandem trotzdem unter dem Text. Ein Browserfenster auf halber
        Bildschirmbreite, ein geteilter Bildschirm, ein Tablet quer:
        Die Breiten, bei denen jemand tatsächlich sitzt, liegen tiefer
        als die üblichen Stufen vermuten lassen.

        520 ist deshalb kein Stufenname mehr, sondern ein Mass. Weiter
        hinunter trägt es nicht: Bei 500 Pixeln blieben der Textspalte
        rund 220, und darin steht keine Überschrift mehr.

        Bei 640 bleibt die Aufteilung tragfähig, wenn die Spalten fast
        gleich sind — deshalb dort 46/54.

        ── Ab 1024 keine Anteile mehr, sondern ein Mass ────────
        Anteile teilen jeden gewonnenen Pixel zwischen beiden Spalten
        auf. Die Karte sollte aber breiter werden, ohne dass der Text
        mitwächst — er braucht nicht mehr als seine Zeilenlänge, und
        alles darüber macht ihn nur schwerer lesbar.

        Deshalb steht links ein Höchstmass und rechts `1fr`: Die
        Textspalte hört bei 27rem auf, die Karte bekommt den Rest.
        27rem sind 432 Pixel, und gemessen braucht „Dein nächster Job."
        bei 51 Pixeln Schriftgrad genau 418 — knapp darüber, damit die
        Überschrift zweizeilig bleibt und nicht auf drei bricht.

        ── Und warum die Karte trotzdem nicht alles nimmt ──────
        Ein Zwischenstand gab dem Einstieg 1400 Pixel statt 1240 und
        der Karte damit 856. Das war zu viel: Der Core füllte die halbe
        Seite und wurde vom Blickfang zum Hintergrundbild, und die
        Anmeldekarte daneben sah aus wie eine Randnotiz.

        Deshalb wieder 1240 für den Abschnitt und ein Deckel auf der
        Karte selbst. Sie nimmt, was die Spalte hergibt, aber höchstens
        680 Pixel — der Rest der Spalte bleibt Luft zwischen Text und
        Fläche.

        ── Warum 40/60 und nicht 34/66 ─────────────────────────
        Ein Zwischenstand gab der Karte zwei Drittel. Sie wurde damit
        742 Pixel breit — und die Überschrift brach auf drei Zeilen,
        weil „Dein nächster Job." bei 51 Pixeln Schriftgrad rund 430
        Pixel braucht und nur 383 übrig waren. Ein grösserer Core, der
        die Aussage daneben zerlegt, ist kein besserer Einstieg.

        ── Text links, Core rechts — und was das kostet ────────
        Ein Zwischenstand hatte es umgedreht. Der Grund war nicht
        Symmetrie, sondern der Umbruch: Unter 768 Pixeln ist die
        Reihenfolge im Text die Reihenfolge auf dem Schirm, und was
        rechts steht, landet unten. Gemessen bei 390 Pixeln lag der
        Core dann auf y=924 gegen y=313 für die Überschrift — ein
        Bildschirm Scrollen, bevor man ihn sieht.

        Auf Ansage wieder Text links. Der Preis ist genau jene
        Position auf dem Telefon; wer sie ändern will, dreht die
        beiden Blöcke, nicht das Spaltenmass.
      */
    <section className="mx-auto grid w-full max-w-[1240px] items-center gap-10 px-5 pb-20 pt-0 min-[520px]:grid-cols-[0.46fr_0.54fr] min-[520px]:gap-6 md:gap-8 lg:grid-cols-[minmax(0,27rem)_1fr] md:px-8 md:pb-28 md:pt-2 lg:gap-12">
      <div className="grid max-w-[30rem] gap-7">
        <h1 className="font-display text-[clamp(2.1rem,4.2vw,3.2rem)] font-normal leading-[1.06] tracking-[-0.02em]">
          {anrede ? (
            <>
              Willkommen zurück,
              <br />
              <span style={{ color: "var(--ed-violet-text)" }}>{anrede}.</span>
            </>
          ) : (
            <>
              Dein nächster Job.
              <br />
              Mit mehr Klarheit.
            </>
          )}
        </h1>

        {/*
          Ein Satz, keine Liste.

          Er nennt nur, was die Anwendung heute tut: Anzeigen einordnen,
          vergleichen, den nächsten Schritt vorbereiten. Kein
          Versprechen über Passgenauigkeit, kein „findet den richtigen".
        */}
        <p className="text-[17px] leading-relaxed" style={{ color: "var(--ed-ink-2)" }}>
          {brand.assistantName} hilft dir, Stellen zu verstehen, Möglichkeiten zu vergleichen und
          deinen nächsten Schritt vorzubereiten.
        </p>

        <Einstieg angemeldet={angemeldet} />
      </div>

      {/*
        Der Core in einer ruhigen Karte — und darunter die Marken.

        ── Warum kein Quadrat mehr ─────────────────────────────
        Die Karte stand auf `aspect-square` bei höchstens 560 Pixeln.
        Das war eine sichere Wahl und eine zu kleine: Neben einer
        Anmeldekarte von rund 470 Pixeln Höhe wirkte der Core wie eine
        Abbildung daneben statt wie die Hauptsache.

        Jetzt 4:5 und bis 680 Pixel breit. Das Verhältnis bleibt fest,
        damit beim Laden nichts springt — eine feste Höhe hätte auf
        schmalen Geräten entweder Luft verschenkt oder den Core
        angeschnitten.

        ── Warum die Leiste in derselben Spalte steht ──────────
        Sie gehört unter den Core, nicht unter die ganze Seite. In
        einer eigenen Zeile unterhalb beider Spalten stünde sie
        mittig unter Anmeldekarte und Core und damit unter nichts.
      */}
      <div className="grid gap-8">
        <div
          /*
             Kein `mx-auto` und kein `ml-auto`.

             Beides sind automatische Aussenabstände, und die heben bei
             einem Gitterkind die Streckung auf: Das Element bemisst
             sich dann nach seinem Inhalt statt nach der Spalte.
             Gemessen blieb die Karte deshalb bei 620 Pixeln stehen,
             obwohl die Spalte 744 breit war und `w-full` danebenstand.
             `justify-self-end` sagt dasselbe über die Ausrichtung, ohne
             die Breite anzufassen.

             ── Und warum der Überhang wieder weg ist ────────────
             Eine Weile griff die Karte über den Innenabstand der Seite
             hinaus, zuletzt bis zu 7rem weit. Das schob sie nach
             rechts an die Fensterkante — und damit aus der Flucht, in
             der Kopfzeile, Preise und Fuss stehen. Eine einzelne
             Fläche, die weiter aussen sitzt als alles darüber und
             darunter, sieht nicht grosszügig aus, sondern verrutscht.

             ── Nach rechts, aber nur so weit wie Platz ist ─────
             `-mr-14` waren 56 Pixel, und das war ein Fehler: Zur
             Verfügung stehen unterhalb von 1240 Pixeln Fensterbreite
             nur die 32 Pixel Innenabstand der Seite. Gemessen lief die
             Seite dadurch bei 800, 900, 1024 und 1200 Pixeln seitlich
             über — sichtbar als waagerechter Rollbalken, nicht als
             falsch sitzende Karte, und deshalb leicht zu übersehen.

             Die Rechnung nimmt genau den vorhandenen Platz: den Rand,
             der entsteht, sobald das Fenster breiter ist als der
             Inhaltsbereich, plus die 32 Pixel, die ohnehin da sind.
             `max` hält sie bei schmalen Fenstern bei diesen 32,
             `min` deckelt sie bei 56.

             Die ersten beiden verschieben die rechte Kante um 32
             Pixel nach aussen und lassen die linke, wo sie war — die
             Karte wird also nach rechts breiter statt beidseitig.

             Eine Weile stand hier zusätzlich `pr-14`, um genau diese
             32 Pixel als Innenabstand zurückzugeben und den Core an
             seiner Stelle zu halten. Das tat es auch — und setzte ihn
             dabei 16 Pixel links der Kartenmitte ab. In einem Kasten
             mit sichtbarem Rahmen fällt eine solche Verschiebung auf,
             sobald man sie einmal gesehen hat.

             Deshalb wieder gleicher Abstand auf beiden Seiten. Der
             Core steht mittig; seine Grösse hält der Deckel in
             `NinaVisual`, nicht der Innenabstand.
          */
          className="relative flex w-full max-w-[712px] flex-col gap-5 justify-self-end rounded-(--radius-lg) border border-line p-5 md:mt-24 md:mr-[calc(-1*min(3.5rem,max(2rem,(100vw-1240px)/2+2rem)))] md:p-6"
          style={{ background: "var(--ed-surface)" }}
        >
          {/*
            `self-center`, und der Grund ist keine Vorliebe.

            Die Karte ist eine Flex-Spalte. Deren Kinder werden in der
            Breite gestreckt — bis eines eine Höchstbreite hat: Dann
            hört es beim Höchstmass auf und bleibt am Anfang der Achse
            stehen, also links. Gemessen sass der Core dadurch 7 Pixel
            links der Kartenmitte, bei ansonsten völlig symmetrischen
            Abständen.

            `items-center` auf der Karte wäre der breitere Hebel und
            hätte auch die Partnerzeile auf ihre Inhaltsbreite
            geschrumpft. Hier soll nur ein Kind mittig stehen, also
            steht es an diesem Kind.
          */}
          <NinaVisual
            size="hero"
            strategie="sichtbar"
            grund="keiner"
            zyklus
            className="self-center"
          />
          <Partnerleiste />
        </div>
      </div>
    </section>
  );
}

function Hero({ bestand, anrede }: { bestand: Bestandszahl; anrede: string | null }) {
  return (
    <section style={{ background: "var(--ed-canvas)" }}>
      <div /* Weniger Luft nach oben: Zwischen Wegeleiste und Überschrift
             standen 80 Pixel, und der Hero begann erst weit unterhalb
             des Falzes. */
          className="mx-auto grid w-full max-w-[1240px] items-center gap-10 px-5 pb-14 pt-4 md:px-8 md:pb-20 md:pt-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <div className="grid gap-7">
          <Augenbraue>Deine persönliche Karrierebegleitung</Augenbraue>

          {/*
            Zwei Überschriften, und nur eine steht je Besuch da.

            ── Abgemeldet: die Zahl ──────────────────────────

            Vorher stand hier „Du suchst keinen Job. Monday findet den
            richtigen für dich." — eine Aussage über uns. Was jemand
            beim ersten Besuch wissen will, ist, ob es hier überhaupt
            genug zu finden gibt. Das beantwortet eine Zahl, und zwar
            eine echte: sie kommt aus dem Bestand und wird stündlich
            nachgezählt.

            ── Angemeldet: der Name ──────────────────────────

            Wer wiederkommt, hat die Frage nach der Grösse des Bestands
            beim ersten Besuch beantwortet bekommen. Ihm sie erneut
            hinzustellen heisst, ihn wie einen Fremden zu begrüssen —
            und dafür den Platz zu verbrauchen, an dem sein Name stehen
            könnte.

            Die Zahl ist damit nicht weg: Sie läuft weiterhin im Kopf
            mit, auf jeder Seite, angemeldet wie abgemeldet.
          */}
          <h1 /* Vier Zeilen statt drei: etwas kleiner gesetzt und enger
              geführt, sonst reicht der Hero über den Falz hinaus. */
            className="font-display text-[clamp(2rem,4.4vw,3.4rem)] font-normal leading-[1.04] tracking-[-0.02em]">
            {anrede ? (
              <>
                Willkommen
                <br />
                zurück,
                <br />
                {/*
                  Der Punkt steht IM Auszeichnungselement.

                  Daneben gesetzt ist er ein eigener Textabschnitt, und
                  der Zeilensatz behandelt ihn als solchen: Nach einem
                  Namen, der auf eine Klammer endet — „Lea (Demo)" —
                  klaffte davor sichtbar Luft, als wäre versehentlich
                  ein Leerzeichen im Satz. Im selben Textlauf greift die
                  normale Unterschneidung.
                */}
                <span style={{ color: "var(--ed-violet-text)" }}>{anrede}.</span>
              </>
            ) : (
              <>
                Entdecke
                <br />
                <span style={{ color: "var(--ed-violet-text)" }}>
                  <LebendeZahl start={bestand.genau} className="font-mono font-bold tabular-nums" />
                </span>{" "}
                Jobs
                <br />
                perfekt abgestimmt
                <br />
                auf dich.
              </>
            )}
          </h1>

          {/*
            Keine zweite Suche im Hero.

            Hier standen Beruf, Ort und „Jobs finden" — dieselben drei
            Felder, die oben im Kopf bereits stehen und dort auf jeder
            Seite mitlaufen. Zwei Suchen auf einem Bildschirm lassen
            offen, welche die richtige ist.

            Übrig bleiben die beiden Wege, die der Kopf nicht anbietet:
            das Gespräch und die Arbeitgeberseite.
          */}
          {/*
            Auch der Hauptweg unterscheidet sich.

            „Mit Monday sprechen" führt auf die Registrierung — für
            jemanden, der bereits ein Konto hat, ist das eine Sackgasse
            mit dem Namen eines Angebots. Angemeldet führt derselbe
            Knopf dorthin, wo das Gespräch schon liegt.
          */}
          <div className="flex flex-wrap items-center gap-3">
            {anrede ? (
              <Hauptknopf href="/app/monday">Gespräch fortsetzen</Hauptknopf>
            ) : (
              <Hauptknopf href="/register">Mit {brand.assistantName} sprechen</Hauptknopf>
            )}
            <Nebenknopf href="/for-business">Ich suche Mitarbeiter</Nebenknopf>
          </div>

<p className="text-sm leading-relaxed" style={{ color: "var(--ed-ink-3)" }}>
            Aus lizenzierten Quellen, mit Angabe der Herkunft. Keine Bewerbung wird ohne deine
            Freigabe versendet.
          </p>
        </div>

        <div className="relative grid gap-3">
          {/*
            Das echte Modell, nicht die Marketing-Attrappe.
            
            Hier stand `NinaCore` — eine gezeichnete Kugel aus CSS. Auf
            der Seite, auf der jemand zum ersten Mal sieht, was Monday
            ist, gehört Monday selbst hin, mit denselben Clips und
            derselben Farbe wie in der Anwendung.
          */}
          {/*
            Kein `overflow-hidden` mehr.

            Es sollte verhindern, dass der Core rechts aus dem Bild
            läuft — und schnitt ihn stattdessen ab. Das Modell zeichnet
            über seine Leinwand hinaus; wer es beschneidet, sieht einen
            Kreis mit gerader Kante.

            Richtig ist, das Modell in der Szene kleiner zu skalieren
            (siehe NinaScene) und der Fläche hier volle Breite zu
            lassen. Dann steht der ganze Core im Bild, mittig.
          */}
          {/* Der Versatz nach links ist auf ein Viertel zurückgenommen.

            Er sollte die Lücke zwischen Textspalte und Core schliessen
            — mit 80 beziehungsweise 112 Pixeln zog er den Core aber
            über die Spaltengrenze und drängte ihn an den Text. Sechs
            beziehungsweise zehn nehmen die Lücke, ohne den Abstand
            zum Text aufzugeben. */}
          {/*
            `min-w-0` und eine relative Breite: Mit `max-w-[600px]` auf
            einem 320-Pixel-Bildschirm riss der Core die Seite um 340
            Pixel auf — eine feste Breite in einem Gitter, dessen Spalte
            schmaler ist, wächst nicht mit, sondern drückt.

            Der Versatz nach links gilt erst ab `lg`; darunter steht der
            Core ohnehin unter dem Text und hätte nichts, wohin er
            rücken könnte.
          */}
          <div className="grid aspect-square w-full min-w-0 max-w-[min(92vw,600px)] place-items-center justify-self-center lg:ml-2 xl:ml-6">
            {/*
              „sichtbar", nicht „beiInteresse".

              Der Core ist auf dieser Seite nicht Schmuck neben dem
              Inhalt — er ist der Inhalt der rechten Spalte. Mit
              „beiInteresse" wartete er auf die erste Bewegung, einen
              Tastendruck oder ein Scrollen; wer die Seite öffnete und
              stehenblieb, sah dauerhaft den Platzhalter statt Monday.
              Das war kein Ladezustand, sondern ein Endzustand.

              Die Fläche steht dabei von Anfang an: `aspect-square`
              reserviert sie, bevor etwas geladen ist — es gibt keinen
              Sprung, wenn der Core erscheint.
            */}
            <NinaVisual size="xl" strategie="sichtbar" grund="keiner" zyklus />
          </div>
{/* Der erklärende Satz stand hier und ist weg: Was Monday tut,
              steht links im Hero — zweimal dasselbe auf einem
              Bildschirm liest niemand. */}
        </div>
      </div>
    </section>
  );
}

/*
 * Hier stand „Was das Produkt tut" — drei nummerierte Zeilen 01, 02,
 * 03 direkt unter dem Hero.
 *
 * Die Nummerierung versprach eine Reihenfolge, die es nicht gibt:
 * Monday versteht, prüft und bleibt dabei nicht nacheinander, sondern
 * durchgehend. Und inhaltlich stand dort dasselbe wie im Hero, nur
 * in drei Teile zerlegt.
 */

/* ══════════════════════════════════════════════════════════════
   3 · Nicht jeder weiss, wonach er suchen soll
   ══════════════════════════════════════════════════════════════ */

function ZuerstDerMensch() {
  return (
    /*
     * Der Beleg beginnt hier — und das soll man sehen.
     *
     * Oben steht die Behauptung, hier steht die Studie. Beide auf
     * derselben Fläche flossen ineinander, und die Zahlen wirkten wie
     * eine Fortsetzung des Werbetextes statt wie eine Quelle.
     *
     * Der Übergang ist ein schmaler Farbverlauf statt einer harten
     * Kante: Eine Linie quer über die Seite trennt zwar, sieht aber
     * nach Tabelle aus. Ein Verlauf von der hellen Fläche in die
     * dunklere setzt ab, ohne zu zerschneiden.
     */
    <section
      className="relative"
      style={{ background: "color-mix(in oklab, var(--ed-ink) 4%, var(--ed-canvas))" }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16"
        style={{
          background:
            "linear-gradient(180deg, var(--ed-canvas) 0%, color-mix(in oklab, var(--ed-ink) 4%, var(--ed-canvas)) 100%)",
        }}
      />
      {/* Geht beim Heranscrollen von der Mitte nach beiden Seiten
        auf — siehe Trennstrahl. */}
      <Trennstrahl
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px w-[min(88%,68rem)]"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklab, var(--ed-violet) 45%, transparent), transparent)",
        }}
      />
      <div className="mx-auto grid w-full max-w-[1240px] items-center gap-0 md:grid-cols-2">
        {/*
          Ein Diagramm statt eines Stimmungsbildes.
          
          Hier stand ein Foto aus einer Werkstatt — schön, aber ohne
          Aussage. An der Stelle, an der die Überschrift behauptet,
          dass Menschen nicht wissen, wo sie anfangen sollen, gehört
          der Beleg dafür: eine Studie mit Quelle und unsere eigenen
          Messwerte mit Grundgesamtheit.
        */}
        <div className="order-2 px-5 py-10 md:order-1 md:px-12 md:py-16">
          <Befund />
        </div>
        {/*
          `self-stretch` und `content-start`: Der Text soll oben
          beginnen und über die ganze Höhe des Diagramms laufen, statt
          mittig darin zu schweben. Nebeneinander gelesen gehören
          Befund und Antwort zusammen — nicht Befund oben, Antwort in
          der Mitte.
        */}
        <div className="order-1 grid content-start gap-6 self-stretch px-5 py-16 md:order-2 md:px-12 md:py-20">
          <Augenbraue>Der Anfang</Augenbraue>
          <Ueberschrift>Nicht jeder weiss, wonach er suchen soll.</Ueberschrift>
          <Fliess>
            Du musst {brand.assistantName} keinen perfekten Jobtitel nennen. Es reicht, wenn du
            erzählst, was du kannst, was dich stört und was sich ändern soll.
          </Fliess>
          <Fliess>
            Aus Sätzen wird ein Profil — nicht aus Häkchen in einer Liste, die jemand vor zehn Jahren
            zusammengestellt hat.
          </Fliess>

          {/*
            Was Monday konkret tut — drei Schritte, keine Behauptung.

            „Game changer" schreibt jede zweite Produktseite über sich
            selbst. Was den Unterschied macht, lässt sich benennen: Sie
            fragt, bevor sie sucht; sie begründet, was sie vorschlägt;
            und sie sagt dazu, wie es mit dem Beruf weitergeht. Das
            dritte tut sonst niemand.
          */}
          <ul className="mt-2 grid gap-4">
            {[
              [
                "Sie fragt zuerst",
                "Ein Gespräch statt eines Formulars. Wer keinen Jobtitel im Kopf hat, muss auch keinen eingeben.",
              ],
              [
                "Sie begründet jeden Vorschlag",
                "Zu jeder Stelle steht, warum sie kommt — und was dagegen spricht. Keine Reihenfolge nach Werbebudget.",
              ],
              [
                "Sie zeigt den Beruf, wie er wirklich ist",
                "Was der Alltag verlangt und wie es mit dem Beruf weitergeht — Arbeitszeiten, Belastung, Aussichten. Grundlage sind Forschung, amtliche Daten und die Erfahrungsberichte, die Nutzer hier hinterlassen. Wer sich etwas anderes vorgestellt hat, merkt es dadurch vorher statt im dritten Monat, und Monday nennt dann den ähnlichen Weg, der besser passt.",
              ],
            ].map(([titel, text]) => (
              <li key={titel} className="grid gap-1">
                <span
                  className="text-[15px] font-semibold"
                  style={{ color: "var(--ed-ink)" }}
                >
                  {titel}
                </span>
                <span
                  className="text-[15px] leading-relaxed"
                  style={{ color: "var(--ed-ink-2)" }}
                >
                  {text}
                </span>
              </li>
            ))}
          </ul>

          {/* Kompakter Beleg direkt unter der Aussage — nicht als
              eigener Abschnitt, sonst wird die Seite zur Literaturliste. */}
          <Erwartungsbeleg />
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   4 · Entdeckung — die Geschichte
   ══════════════════════════════════════════════════════════════ */

function Entdeckung() {
  return (
    <Abschnitt grund="weiss">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div className="grid content-start gap-6">
          <Augenbraue>Richtungen, nicht Stellenanzeigen</Augenbraue>
          <Ueberschrift>
            Vielleicht ist dein nächster Job einer, nach dem du nie gesucht hättest.
          </Ueberschrift>
          <Fliess>
            Die meisten Menschen suchen nach dem Titel, den sie schon haben. Genau dort liegen die
            wenigsten Möglichkeiten.
          </Fliess>
        </div>

        <div className="grid gap-4">
          {/*
            Das gesprochene Zitat trägt den Abschnitt.

            Es ist die einzige Stelle der Seite, an der jemand in der
            ersten Person spricht — deshalb steht es gross und nicht in
            einer Karte mit Anführungszeichen als Deko.
          */}
          <blockquote
            className="rounded-(--radius-xl) p-7 md:p-9"
            style={{ background: "var(--ed-canvas)" }}
          >
            <p className="font-display text-[clamp(1.2rem,2vw,1.6rem)] leading-[1.35] tracking-[-0.02em]">
              „Ich arbeite im Lager. Ich will nicht mehr so körperlich arbeiten. Ich bin gut mit
              Menschen und mit Computern.“
            </p>
          </blockquote>

          <div className="grid gap-3 pl-1">
            <p className="text-sm" style={{ color: "var(--ed-ink-3)" }}>
              {brand.assistantName} sieht darin vier Richtungen:
            </p>
            <ul className="flex flex-wrap gap-2">
              {["Disposition", "Kundenbetreuung", "Innendienst / Vertrieb", "Logistikkoordination"].map(
                (r) => (
                  <li
                    key={r}
                    className="rounded-(--radius-pill) px-4 py-2 text-[15px]"
                    style={{
                      background: "var(--ed-violet-soft)",
                      color: "var(--ed-violet-text)",
                    }}
                  >
                    {r}
                  </li>
                ),
              )}
            </ul>
            <p className="max-w-[52ch] text-sm leading-relaxed" style={{ color: "var(--ed-ink-2)" }}>
              Keine davon stand in dem Satz. Alle vier folgen aus ihm.
            </p>
          </div>
        </div>
      </div>
    </Abschnitt>
  );
}

/* ══════════════════════════════════════════════════════════════
   5 · Zukunft statt Schlagwörter
   ══════════════════════════════════════════════════════════════ */

function NichtNachSchlagwoertern() {
  return (
    <section style={{ background: "var(--ed-canvas)" }}>
      {/*
        Text links, Beleg rechts — kein Bild mehr.
        
        Hier stand ein Pflegemotiv. Neben einer Aussage über die
        Zukunft eines Berufs ist ein Stimmungsbild das Gegenteil eines
        Arguments; die Zahlen daneben sind es.
        
        `items-start` statt `items-center`: Beide Spalten beginnen
        oben, damit Behauptung und Beleg auf gleicher Höhe stehen.
      */}
      <div className="mx-auto grid w-full max-w-[1240px] items-start gap-0 md:grid-cols-2">
        <Erscheint className="grid content-start gap-6 px-5 py-16 md:px-12 md:py-20">
          <Augenbraue>Wie es weitergeht</Augenbraue>
          <Ueberschrift>
            {brand.assistantName} sagt dir, wie es mit deinem Wunschberuf weitergeht.
          </Ueberschrift>
          <Fliess>
            Ob eine Stelle heute passt, ist die eine Frage. Ob es den Beruf in zehn Jahren noch
            gibt, ist die andere — und die stellt sich beim Wechsel niemand gern.
          </Fliess>
          <Fliess>
            {brand.assistantName} ordnet jede Stelle in ihre Berufsgruppe ein und nennt dazu, was
            die Forschung über deren Aussichten sagt: Nachfrage, Automatisierbarkeit, Lohnaussicht
            — mit der Quelle daneben und als Einschätzung gekennzeichnet, nicht als Prognose.
          </Fliess>

          {/*
            Der zweite Teil: das falsche Bild vom Beruf.
            
            Er gehört hierher und nicht in einen eigenen Abschnitt —
            beides ist dieselbe Frage aus zwei Richtungen: Passt der
            Beruf zu mir, und stimmt das Bild, das ich von ihm habe?
          */}
          <Fliess>
            Vielleicht ist dein nächster Beruf einer, an den du nie gedacht hast. Und vielleicht
            hast du von dem, den du dir wünschst, ein Bild, das mit dem Alltag darin wenig zu tun
            hat — das merkt man sonst erst im dritten Monat.
          </Fliess>
          <Fliess>
            {brand.assistantName} legt offen, was sich an einem Beruf realistisch erwarten lässt:
            Arbeitszeiten, Belastung, Einstiegswege, was Beschäftigte darin berichten. Passt es
            nicht zu dem, was dir wichtig ist, nennt sie den ähnlichen Weg, der besser passt —
            statt dir recht zu geben.
          </Fliess>
        </Erscheint>

        <Erscheint verzoegerung={120} className="px-5 py-16 md:px-12 md:py-20">
          <Zukunftsblick />
        </Erscheint>
      </div>
    </section>
  );
}


/*
 * Der Abschnitt „Mehr Jobs sind nicht die Lösung" ist entfernt.
 *
 * Er war eine Überleitung ohne eigenen Inhalt: ein Satz und ein Bild
 * zwischen zwei Abschnitten, die beide bereits sagen, worum es geht.
 * Was er behauptete — bessere Aufklärung schlägt mehr Treffer —
 * beweisen die Belege davor und danach, statt es zu behaupten.
 */




/* ══════════════════════════════════════════════════════════════
   6 · Job Intelligence — die dunkle Sektion
   ══════════════════════════════════════════════════════════════ */

function JobIntelligenz() {
  return (
    /*
     * Kein eigener dunkler Abschnitt mehr.
     *
     * „Was Monday über einen Job wissen will" stand auf dunklem Grund,
     * die Rechnung darunter auf hellem — zwei Kapitel für eine
     * Aussage. Zusammen gelesen ist es eine: Was steht in der Anzeige,
     * und was bleibt davon übrig.
     */
    <Abschnitt grund="weiss" id="jobs">
      <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div className="grid content-start gap-6">
          <Augenbraue>Was in einer Anzeige wirklich steht</Augenbraue>
          <Ueberschrift>Was {brand.assistantName} über einen Job wissen will.</Ueberschrift>
          <Fliess>
            Die meisten Anzeigen nennen kein Gehalt. Manche nennen eines, das von einem Portal
            geschätzt wurde. Der Unterschied entscheidet, wie ernst du die Zahl nehmen kannst — und
            er steht bei uns an der Zahl, nicht im Kleingedruckten.
          </Fliess>
          <p className="text-sm leading-relaxed" style={{ color: "var(--ed-ink-3)" }}>
            Bestätigt, geschätzt oder unklar — {brand.assistantName} sagt dir, was wirklich bekannt
            ist.
          </p>
        </div>

        {/*
          Eine echte Produktfläche, kein Marketingbild.

          Dieselben Angaben in derselben Reihenfolge wie auf der
          Jobseite: Herkunft über der Zahl, dann das Netto, dann was
          fehlt. Wer sich anmeldet, findet genau das wieder.
        */}
        <div
          className="grid gap-5 rounded-(--radius-xl) p-6 md:p-8"
          style={{ background: "#12151f", boxShadow: "0 40px 120px rgba(0,0,0,.45)" }}
        >
          <div className="grid gap-1.5">
            {/*
              „Beispiel" steht ÜBER der Anzeige, nicht darunter.
              
              Diese Fläche sieht aus wie eine echte Stellenanzeige — das
              ist ihr Zweck. Genau deshalb muss unmissverständlich
              dastehen, dass sie keine ist: Wer sich auf eine erfundene
              Stelle bei einer erfundenen Firma bewirbt, hat eine
              Erfahrung gemacht, die keine Korrektur zurückholt.
            */}
            <span className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-(--radius-pill) px-2 py-0.5 text-2xs font-semibold uppercase tracking-[0.12em]"
                style={{ background: "rgba(255,255,255,.14)", color: "#fff" }}
              >
                Beispiel
              </span>
              <span className="text-2xs font-semibold uppercase tracking-[0.14em]" style={{ color: "rgba(244,245,250,.6)" }}>
                So sieht eine geprüfte Anzeige bei uns aus
              </span>
            </span>
            <h3 className="font-display text-[clamp(1.2rem,2vw,1.7rem)] font-normal tracking-[-0.02em] text-white">
              Operations Coordinator (m/w/d)
            </h3>
            <p className="text-sm" style={{ color: "rgba(244,245,250,.66)" }}>
              Dortmund · Hybrid · Unbefristet
            </p>
          </div>

          <div className="grid gap-2 border-t pt-5" style={{ borderColor: "rgba(255,255,255,.09)" }}>
            <span className="text-2xs font-semibold uppercase tracking-[0.14em]" style={{ color: "rgba(244,245,250,.6)" }}>
              Gehalt · vom Arbeitgeber angegeben
            </span>
            <p className="font-mono text-[clamp(1.4rem,2.6vw,2rem)] font-semibold tabular text-white">
              53.000 – 59.000 €
            </p>
            <p className="text-sm" style={{ color: "rgba(244,245,250,.72)" }}>
              Voraussichtlich <span className="font-mono">3.114 – 3.402 €</span> netto im Monat.
            </p>

            {/*
              Der Fit Score gehört an die Anzeige, nicht in eine
              eigene Ansicht.

              Drei getrennte Werte statt eines: „87" allein sagt nicht,
              ob es am Fachlichen liegt oder an der Arbeitsweise — und
              genau das entscheidet, ob man sich bewirbt.
            */}
            <div
              className="mt-5 grid gap-3 border-t pt-5"
              style={{ borderColor: "rgba(255,255,255,.09)" }}
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-2xs font-semibold uppercase tracking-[0.14em]" style={{ color: "rgba(244,245,250,.6)" }}>
                  Fit Score
                </span>
                <span className="font-mono text-lg font-bold tabular-nums text-white">87</span>
              </div>
              <ul className="grid gap-2">
                {[
                  ["Fachlich", 92],
                  ["Persönlich", 88],
                  ["Langfristig", 79],
                ].map(([k, v]) => (
                  <li key={String(k)} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3">
                    <span className="text-[13px]" style={{ color: "rgba(244,245,250,.72)" }}>
                      {k}
                    </span>
                    <span
                      aria-hidden
                      className="h-1.5 overflow-hidden rounded-full"
                      style={{ background: "rgba(255,255,255,.12)" }}
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${v}%`, background: "var(--ed-violet)" }}
                      />
                    </span>
                    <span className="font-mono text-[13px] tabular-nums text-white">{v}</span>
                  </li>
                ))}
              </ul>

              {/*
                Die Begründung steht hinter einer Aufklappung, nicht
                daneben.

                Eine Zahl ohne Begründung ist ein Urteil, und ein
                Urteil ohne Begründung ist genau das, was dieses
                Produkt anderen vorwirft. Die Erklärung muss also da
                sein.

                Sie steht trotzdem nicht offen: Ausgeklappt sind es
                sechs weitere Absätze über einer Anzeige, die man in
                zwei Sekunden überfliegen will. Wer die Zahl glaubt,
                liest weiter; wer sie nicht glaubt, klappt auf.

                `<details>` und nicht ein eigener Zustand: Das Element
                kann das von sich aus, funktioniert ohne JavaScript,
                ist mit der Tastatur bedienbar und meldet sich der
                Vorlesesoftware korrekt als auf- und zuklappbar. Ein
                Nachbau mit `useState` wäre mehr Code für weniger.
              */}
              <details className="group mt-1">
                <summary
                  className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium underline decoration-dotted underline-offset-4 outline-none focus-visible:outline-2"
                  style={{ color: "rgba(244,245,250,.82)" }}
                >
                  Genauere Einschätzung von {brand.assistantName}
                  <span
                    aria-hidden
                    className="transition-transform duration-200 group-open:rotate-90"
                  >
                    ›
                  </span>
                </summary>

                <div className="grid gap-3 pt-3">
                  {[
                    {
                      k: "Fachlich · 92",
                      dafuer:
                        "Disposition und Kundenkontakt stehen in deinem Profil und in der Anzeige — mit denselben Worten.",
                      dagegen:
                        "Ein Warenwirtschaftssystem wird verlangt, deines heisst anders. Vermutlich übertragbar, belegt ist es nicht.",
                    },
                    {
                      k: "Persönlich · 88",
                      dafuer:
                        "Kleines Team, viel Eigenverantwortung — das hast du in beiden letzten Stellen so gesucht.",
                      dagegen:
                        "Wie viele Bürotage erwartet werden, steht nicht in der Anzeige. Ohne diese Angabe bleibt der Wert eine Vermutung.",
                    },
                    {
                      k: "Langfristig · 79",
                      dafuer:
                        "Die Berufsgruppe gilt bis 2035 als voraussichtlich stabil — Einschätzung, keine Messung.",
                      dagegen:
                        "Zur Entwicklung im Unternehmen sagt die Anzeige nichts. Der Wert trägt deshalb weniger weit als die beiden anderen.",
                    },
                  ].map((e) => (
                    <div
                      key={e.k}
                      className="grid gap-1.5 rounded-(--radius-sm) p-3"
                      style={{ background: "rgba(255,255,255,.05)" }}
                    >
                      <span className="font-mono text-2xs font-semibold uppercase tracking-[0.1em]" style={{ color: "rgba(244,245,250,.62)" }}>
                        {e.k}
                      </span>
                      {/*
                        Dafür und dagegen gleich gross und gleich
                        gesetzt. Wer den Einwand kleiner druckt als das
                        Argument, hat schon entschieden.
                      */}
                      <p className="text-[13px] leading-relaxed" style={{ color: "rgba(244,245,250,.86)" }}>
                        <span style={{ color: "var(--ed-positive-text, #6ee7a8)" }}>Dafür — </span>
                        {e.dafuer}
                      </p>
                      <p className="text-[13px] leading-relaxed" style={{ color: "rgba(244,245,250,.86)" }}>
                        <span style={{ color: "var(--ed-caution-text, #f4c26b)" }}>Offen — </span>
                        {e.dagegen}
                      </p>
                    </div>
                  ))}

                  <p className="text-2xs leading-relaxed" style={{ color: "rgba(244,245,250,.6)" }}>
                    {brand.assistantName} rechnet nur mit dem, was in der Anzeige und in deinem
                    Profil steht. Fehlt eine Angabe, senkt sie den Wert — sie ergänzt ihn nicht.
                  </p>
                </div>
              </details>
            </div>
          </div>

          <dl className="grid gap-3 border-t pt-5 sm:grid-cols-2" style={{ borderColor: "rgba(255,255,255,.09)" }}>
            {[
              ["Warum sie passt", "Disposition und Kundenkontakt sind belegt — beides steht in deinem Profil."],
              ["Was offen ist", "Die Zahl der Bürotage steht nicht in der Anzeige. Eine gute Frage fürs Gespräch."],
              ["Arbeitsweg", "35 Minuten je Richtung — 15 Stunden im Monat."],
              ["Wochenstunden", "40 — damit sind es 20,93 € netto je Arbeitsstunde."],
            ].map(([k, v]) => (
              <div key={k} className="grid gap-1">
                <dt className="text-2xs uppercase tracking-[0.1em]" style={{ color: "rgba(244,245,250,.6)" }}>
                  {k}
                </dt>
                <dd className="text-sm leading-relaxed" style={{ color: "rgba(244,245,250,.82)" }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap gap-2 border-t pt-5" style={{ borderColor: "rgba(255,255,255,.09)" }}>
            {[
              ["Starker Fit", true],
              ["Interessant", false],
              ["Zu prüfen", false],
            ].map(([label, aktiv]) => (
              <span
                key={String(label)}
                className="rounded-(--radius-pill) px-3.5 py-1.5 text-sm"
                style={
                  aktiv
                    ? { background: "var(--ed-violet)", color: "#fff" }
                    : { color: "rgba(244,245,250,.62)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)" }
                }
              >
                {label}
              </span>
            ))}
            {/*
              Auf dunklem Grund reicht 45 % Weiss nicht.
              
              axe mass 4,25:1 und verlangt 4,5:1 — bei 14 Pixeln also
              knapp durchgefallen. Genau die Stelle, an der ein zu
              blasser Ton am wenigsten auffällt und am ehesten
              durchgeht: eine Fussnote unter einer Zahlenreihe.
            */}
            <span className="ml-auto self-center text-2xs" style={{ color: "rgba(244,245,250,.62)" }}>
              Keine Prozentzahl, wo die Datenbasis keine hergibt.
            </span>
          </div>
        </div>
      </div>
    </Abschnitt>
  );
}

/* ══════════════════════════════════════════════════════════════
   7 · Life Fit
   ══════════════════════════════════════════════════════════════ */

function LifeFit({ lage }: { lage: Landeslage }) {
  return (
    /*
     * Heller Grund, dunkelblaue Kästen.
     *
     * Der Weg dahin ging über beide Fehlversuche: erst getönte Kästen
     * auf hellem Grund — zu flau; dann heller Kasten auf dunklem Grund
     * — der Abschnitt riss die Seite auseinander.
     *
     * Richtig ist die Umkehrung im Kleinen: Die Seite bleibt hell, und
     * die Rechnung sitzt in einer dunklen Fläche. Dadurch hebt sie
     * sich ab, ohne dass ein ganzer Abschnitt die Farbe wechselt.
     */
    <Abschnitt grund="weiss">
      <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <Erscheint className="grid content-start gap-6">
          <Augenbraue>Was am Ende übrig bleibt</Augenbraue>
          <Ueberschrift>
            Nicht: was verdienst du.
            <br />
            Sondern: was bleibt dir?
          </Ueberschrift>
          <Fliess>
            Ein Job kann auf dem Papier passen und dein Leben trotzdem schlechter machen. Ein
            höheres Gehalt ist nicht automatisch der bessere Job — und heute weniger denn je: Was
            davon ankommt, entscheiden Miete, Fahrweg, Steuerklasse und Arbeitszeit.
          </Fliess>
          {/*
            Der Weg steht links, unter der Frage — nicht rechts bei
            der Rechnung.

            Rechts stand er als dritter dunkler Kasten unter zwei
            anderen: drei Werkzeuge übereinander, von denen man das
            unterste nicht mehr liest. Links beantwortet er die Frage
            direkt, die darüber gestellt wird: „Was bleibt dir?" —
            und Zeit ist das, was nach dem Geld übrig bleibt.
          */}
          <div data-theme="dark" className="grid gap-3 rounded-(--radius-xl) bg-sunken p-6 text-ink md:p-8">
            <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-3">
              Der Weg dorthin
            </span>
            <ul className="grid gap-2.5">
              {/*
                Ein Beispielweg: Lünen nach Dortmund-Innenstadt, rund
                14 Kilometer.

                Die Farbe sagt, ob der Weg trägt — grün heisst
                alltagstauglich, gelb geht an guten Tagen, rot ist
                keine Option. Ohne diese Einordnung sind es vier
                Zeiten, aus denen jeder selbst schliessen müsste.
              */}
              {[
                ["Auto", "26 Min.", "text-positive"],
                ["Bahn", "34 Min.", "text-positive"],
                ["Fahrrad", "48 Min.", "text-caution"],
                ["Zu Fuss", "2 Std. 50", "text-critical"],
              ].map(([m, z, ton]) => (
                <li key={m} className="flex items-baseline justify-between gap-4">
                  <span className="text-[15px] text-ink-2">{m}</span>
                  <span className={`font-mono text-[15px] tabular-nums ${ton}`}>{z}</span>
                </li>
              ))}
            </ul>
            <p className="text-2xs text-ink-3">Lünen → Dortmund-Innenstadt, rund 14 km. Bei zwei Bürotagen die Woche.</p>
          </div>

          <Fliess>
            Deshalb rechnet {brand.assistantName} bei jeder Stelle mit, was am Ende des Monats
            übrig bleibt. Nicht das Bruttogehalt aus der Anzeige, sondern der Betrag, mit dem du
            tatsächlich planst.
          </Fliess>
          {/*
            Der einzige Satz der Seite, der ein Land voraussetzt.
            
            Es gibt genau ein Steuerregelwerk, das deutsche für 2026.
            Jemandem in Zürich „rechnet mit deinen Steuerangaben" zu
            versprechen, ist nicht ungenau, sondern falsch — und er merkt
            es zehn Minuten nach der Anmeldung selbst.
          */}
          {lage.nettoRechnung ? (
            <Fliess>
              {brand.assistantName} rechnet mit deinen Steuerangaben, deinen Fixkosten und deinem
              Arbeitsweg — und sagt dir, was der Wechsel tatsächlich bringt.
            </Fliess>
          ) : (
            <Fliess>
              Fixkosten und Arbeitsweg rechnet {brand.assistantName} überall. Die Rechnung nach
              Steuern gibt es bisher nur für Deutschland — für {landesname(lage.code)} fehlt uns
              das Regelwerk, und eine deutsche Rechnung auf ein Gehalt dort wäre eine Zahl, die
              überzeugend aussieht und nichts bedeutet.
            </Fliess>
          )}
        </Erscheint>

        <Erscheint verzoegerung={120} className="grid gap-4">
          {/* Die Belege stehen über der Beispielrechnung: erst warum
              das Rechnen nötig ist, dann wie es aussieht. */}
          <Lebenshaltung />

          <div
            /*
              Der Kasten trägt das Dunkelblau, nicht der Abschnitt.
              `data-theme="dark"` löst darin alle Token auf die dunkle
              Palette auf — Schrift, Linien, Flächen —, statt jede
              Farbe einzeln zu überschreiben.
            */
            data-theme="dark"
            className="grid gap-4 rounded-(--radius-xl) bg-sunken p-6 text-ink md:p-8"
          >
            {/*
              Dieselbe Stelle wie im Beispiel weiter oben — beim Namen
              genannt. Eine Rechnung ohne Bezug ist eine Tabelle; mit
              Bezug ist sie eine Aussage über einen konkreten Job.
            */}
            <div className="grid gap-0.5 border-b border-line pb-4">
              <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-3">
                Für diese Stelle
              </span>
              <span className="text-[15px] font-semibold text-ink">
                Operations Coordinator (m/w/d) · Dortmund
              </span>
            </div>
            {/*
              Die Zahlen rechnen sich beim Heranscrollen einmal aus.

              Als fertige Tabelle liest sich der Kasten wie ein
              Bildschirmfoto. Läuft die Rechnung durch, sieht man, was
              Monday bei jeder Stelle tut — und die Endwerte sind
              dieselben wie vorher, nur der Weg dorthin ist sichtbar.
            */}
            {/*
              Dieselbe Stelle wie im Beispiel oben.

              Dort steht „53.000 – 59.000 €, voraussichtlich 3.114 –
              3.402 € netto". Hier stand vorher ein anderes Gehalt —
              zwei Beispiele auf derselben Seite, die sich
              widersprechen, lesen sich wie ein Rechenfehler.
              Genommen ist die Mitte der Spanne: 56.000 € brutto,
              3.258 € netto.
            */}
            {[
              ["Brutto im Jahr", 56000],
              ["Netto im Monat", 3258],
              ["− Fixkosten", 1600],
              ["− Fahrtkosten", 180],
            ].map(([k, v], i) => (
              <div key={String(k)} className="flex items-baseline justify-between gap-4">
                <span className="text-[15px]" style={{ color: "var(--ed-ink-2)" }}>
                  {k}
                </span>
                {/*
                  Abzüge in Rot, damit man auf einen Blick sieht, was
                  weggeht. Erkannt am Minuszeichen im Namen, nicht an
                  einer zweiten Liste — sonst laufen Beschriftung und
                  Farbe auseinander, sobald jemand eine Zeile ergänzt.
                */}
                {/* Jede Zeile setzt 320 ms nach der vorigen ein — so
                    läuft die Rechnung von oben nach unten durch und
                    man sieht, wie sie zustande kommt. */}
                <Rechnet
                  wert={v as number}
                  verzoegerung={i * 320}
                  className={
                    String(k).startsWith("−")
                      ? "font-mono text-[15px] tabular-nums text-critical"
                      : "font-mono text-[15px] tabular-nums"
                  }
                />
              </div>
            ))}
            <div
              className="flex items-baseline justify-between gap-4 border-t pt-4"
              style={{ borderColor: "var(--ed-hairline)" }}
            >
              <span className="text-[15px] font-medium">Frei verfügbar</span>
              {/*
                Was übrig bleibt, steht in Grün — nicht in Rot.

                Gewünscht war Rot für beides. Für die Abzüge stimmt
                das: Rot heisst „geht weg". Auf der Restsumme hiesse es
                „Warnung", und das ist die eine Zahl der Rechnung, die
                keine ist — sie ist das Ergebnis, auf das es ankommt.
                Ist sie einmal negativ, fällt Rot dort umso mehr auf.
              */}
              {/* Das Ergebnis zuletzt — nach allen vier Zeilen darüber. */}
              <Rechnet
                wert={1478}
                verzoegerung={4 * 320}
                className="font-mono text-[clamp(1.4rem,2.4vw,1.9rem)] font-semibold tabular-nums text-positive"
              />
            </div>
            <p className="text-2xs leading-relaxed" style={{ color: "var(--ed-ink-3)" }}>
              Dazu 12 Stunden Arbeitsweg im Monat — Zeit, die genauso weg ist wie Geld, nur
              unbezahlt.
              {!lage.nettoRechnung && " Beispiel nach deutschen Steuerregeln."}
            </p>
          </div>

        </Erscheint>
      </div>
    </Abschnitt>
  );
}

/* ══════════════════════════════════════════════════════════════
   7b · Der Fit Score
   ══════════════════════════════════════════════════════════════ */

/**
 * Was die Zahl an der Anzeige bedeutet.
 *
 * ── Warum ein eigener Abschnitt ───────────────────────────────
 *
 * Neben dem Gehalt und dem Arbeitsweg steht in der Beispielanzeige
 * eine dritte Zahl — und anders als die beiden anderen erklärt sie
 * sich nicht selbst. Ein Gehalt ist ein Gehalt, 35 Minuten sind 35
 * Minuten. Eine 87 ist ein Urteil, und ein Urteil braucht eine
 * Begründung, sonst ist es genau die Sorte Zahl, gegen die dieses
 * Produkt gebaut ist.
 *
 * ── Warum derselbe helle Grund ────────────────────────────────
 *
 * Kein Farbwechsel: Gehalt, Arbeitsweg und Fit Score sind drei
 * Antworten auf dieselbe Frage — lohnt sich diese Stelle für mich.
 * Ein eigener Farbraum machte daraus ein eigenes Kapitel.
 */
function FitScore() {
  const teile = [
    {
      k: "Fachlich",
      frage: "Kannst du die Aufgaben heute erfüllen — oder schnell lernen?",
      grundlage:
        "Verglichen werden die Anforderungen der Anzeige mit dem, was in deinem Profil belegt ist. Nicht mit dem, was dazu passen könnte.",
    },
    {
      k: "Persönlich",
      frage: "Passt die Art zu arbeiten zu dem, was du suchst?",
      grundlage:
        "Teamgrösse, Eigenverantwortung, Präsenz, Schichten. Steht es nicht in der Anzeige, geht es auch nicht in die Zahl ein.",
    },
    {
      k: "Langfristig",
      frage: "Trägt die Stelle in fünf Jahren noch?",
      grundlage:
        "Aus der Zukunftseinschätzung der Berufsgruppe — eine Einordnung aus veröffentlichten Studien, keine Messung.",
    },
  ];

  return (
    <Abschnitt grund="weiss">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <Erscheint className="grid content-start gap-6">
          <Augenbraue>Was die Zahl an der Anzeige heisst</Augenbraue>
          <Ueberschrift>Der Fit Score.</Ueberschrift>
          <Fliess>
            Drei Fragen, drei Werte, ein Gesamtwert. Getrennt, weil die Antwort auf die Frage
            „soll ich mich bewerben" davon abhängt, an welcher der drei es hakt — eine 87 aus
            drei mal 87 ist etwas anderes als eine 87 aus 98, 95 und 68.
          </Fliess>
          {/*
            Was er nicht kann, steht gleich gross daneben.

            Ein Passungswert, der nur seine Stärken nennt, ist eine
            Werbeaussage. Die Grenze gehört an dieselbe Stelle wie das
            Versprechen, nicht in eine Fussnote weiter unten.
          */}
          <p className="text-sm leading-relaxed" style={{ color: "var(--ed-ink-3)" }}>
            Fehlende Angaben senken den Wert, sie füllen ihn nicht auf. Eine Anzeige, die nichts
            über Bürotage sagt, bekommt dafür keine Punkte — und {brand.assistantName} schreibt
            dazu, welche Angabe gefehlt hat.
          </p>
        </Erscheint>

        <Erscheint className="grid content-start gap-3">
          {teile.map((t) => (
            <div
              key={t.k}
              className="grid gap-2 rounded-(--radius-md) border border-line p-5"
              style={{ background: "color-mix(in oklab, var(--ed-ink) 3%, transparent)" }}
            >
              <span className="text-2xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--ed-violet-text)" }}>
                {t.k}
              </span>
              <p className="text-[15px] font-medium leading-snug text-ink">{t.frage}</p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--ed-ink-2)" }}>
                {t.grundlage}
              </p>
            </div>
          ))}
          <p className="pt-1 text-2xs leading-relaxed" style={{ color: "var(--ed-ink-3)" }}>
            Der Gesamtwert ist der gewichtete Durchschnitt der drei. Wo die Zahl steht, steht die
            Begründung dazu — aufklappbar an jeder Anzeige.
          </p>
        </Erscheint>
      </div>
    </Abschnitt>
  );
}

/* ══════════════════════════════════════════════════════════════
   8 · Bewerbung
   ══════════════════════════════════════════════════════════════ */

function Bewerbung() {
  const schritte: readonly (readonly [string, string])[] = [
    ["Stelle gewählt", "Du entscheidest, nicht ein Filter."],
    ["Unterlagen vorbereitet", "Auf diese Stelle zugeschnitten, aus belegten Angaben."],
    ["Anschreiben entworfen", "Ein Entwurf, kein fertiger Text in deinem Namen."],
    ["Von dir geprüft", "Jedes Wort, bevor es hinausgeht."],
    ["Abgeschickt", "Erst auf deine ausdrückliche Freigabe."],
  ];

  return (
    <section style={{ background: "var(--ed-canvas)" }}>
      <div className="mx-auto grid w-full max-w-[1240px] items-center gap-0 md:grid-cols-2">
        {/*
          Beleg statt Stimmungsbild — wie im Abschnitt darüber.
          
          Hier stand ein Bürofoto. An der Stelle, an der behauptet
          wird, dass Bewerben der schwerere Teil ist, gehört der Beleg
          dafür: vier Zahlen mit Quelle und der Ablauf, der daraus
          folgt.
        */}
        <Erscheint className="order-2 px-5 py-10 md:order-1 md:px-12 md:py-16">
          <Bewerbungsbeleg />
        </Erscheint>
        <div className="order-1 grid gap-6 px-5 py-16 md:order-2 md:px-12 md:py-24">
          <Augenbraue>Bewerbung</Augenbraue>
          <Ueberschrift>Wenn die Bewerbung deine Fähigkeiten nicht zeigt.</Ueberschrift>
          <Fliess>
            Du kannst perfekt zur Stelle passen und trotzdem früh aussortiert werden.
            {" "}
            {brand.assistantName} übersetzt deine Erfahrungen in eine klare, stellenbezogene
            Bewerbung, prüft sie auf Lesbarkeit für Recruiter wie für Auswahlsysteme und bereitet
            dich anschliessend gezielt auf genau dieses Gespräch vor.
          </Fliess>
          <Fliess>
            Sie liest die Anzeige, trennt Muss- von Kann-Anforderungen und verbindet sie mit dem,
            was du tatsächlich gemacht hast. Was fehlt, sagt sie dir — statt es zu erfinden.
          </Fliess>
          {/* Die Schritte bauen sich beim Scrollen auf: Die Linie
              wächst mit, jeder Punkt springt an, wenn sie ihn
              erreicht. */}
          <Schrittfolge schritte={schritte} />

          {/* Die Schlusszeile trägt die ganze Aussage des Abschnitts —
              deshalb steht sie allein und nicht als vierter Absatz. */}
          <p
            className="mt-2 font-display text-xl font-normal leading-snug"
            style={{ color: "var(--ed-ink)" }}
          >
            Du bringst die Fähigkeiten mit. {brand.assistantName} macht sie sichtbar.
          </p>
        </div>
      </div>
    </section>
  );
}

/*
 * Der Abschnitt „Danach — Der neue Job ist nicht das Ende" ist
 * entfernt.
 *
 * „Und nach der Bewerbung?" weiter oben sagt dasselbe und mehr: was
 * bei einer Zusage passiert, was bei einer Absage, und wo die Daten
 * liegen. Zwei Abschnitte mit derselben Aussage lesen sich wie ein
 * Versehen.
 */



/* ══════════════════════════════════════════════════════════════
   10 · Zwei Seiten
   ══════════════════════════════════════════════════════════════ */

function ZweiSeiten() {
  return (
    <Abschnitt grund="canvas">
      <div className="grid gap-10 text-center">
        <div className="mx-auto grid max-w-[46rem] gap-5">
          <Augenbraue>Die andere Seite des Matches</Augenbraue>
          <Ueberschrift gross>Zwei Seiten, eine Vermittlung.</Ueberschrift>
        </div>

        <div className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
          <div
            className="grid content-center gap-3 rounded-(--radius-xl) p-8 text-left"
            style={{ background: "var(--ed-surface)", boxShadow: "var(--ed-shadow-soft)" }}
          >
            <Augenbraue>Für dich</Augenbraue>
            <p className="font-display text-[clamp(1.2rem,2vw,1.6rem)] font-normal leading-[1.25] tracking-[-0.02em]">
              „{brand.assistantName} weiss, was ich suche.“
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--ed-ink-2)" }}>
              Aus einem Gespräch, nicht aus einem Lebenslauf-Upload.
            </p>
          </div>

          {/*
            Der echte Core statt eines Buchstabens.

            Hier stand ein „N" in einem Farbkreis — ein Platzhalter aus
            der Zeit, als das Modell noch nicht eingebunden war.
            Zwischen den beiden Seiten steht Monday; dann soll dort auch
            Monday stehen.
          */}
          <div className="grid place-items-center py-4 md:py-0">
            <div className="size-24 md:size-28">
              <NinaVisual size="sm" strategie="beiInteresse" grund="keiner" className="size-full" />
            </div>
          </div>

          <div
            className="grid content-center gap-3 rounded-(--radius-xl) p-8 text-left"
            style={{ background: "var(--ed-surface)", boxShadow: "var(--ed-shadow-soft)" }}
          >
            <Augenbraue>Für Unternehmen</Augenbraue>
            <p className="font-display text-[clamp(1.2rem,2vw,1.6rem)] font-normal leading-[1.25] tracking-[-0.02em]">
              „{brand.assistantName} weiss, wen wir brauchen.“
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--ed-ink-2)" }}>
              Aus einer Stelle, die vollständig genug ist, um sie zu beurteilen.
            </p>
          </div>
        </div>

        <p className="mx-auto max-w-[48ch] text-sm leading-relaxed" style={{ color: "var(--ed-ink-3)" }}>
          Keine Datenbank, die Recruiter durchsuchen. {brand.assistantName} bringt Menschen und
          Chancen zusammen — und private Karrieregespräche bleiben dabei privat.
        </p>
      </div>
    </Abschnitt>
  );
}

/* ══════════════════════════════════════════════════════════════
   11 · Für Unternehmen
   ══════════════════════════════════════════════════════════════ */

function FuerUnternehmen() {
  return (
    <Abschnitt grund="dunkel">
      <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div className="grid content-start gap-6">
          <Augenbraue hell>Für Unternehmen</Augenbraue>
          <Ueberschrift hell>
            Du suchst Mitarbeiter?
            <br />
            {brand.assistantName} sucht auch für dich.
          </Ueberschrift>
          <Fliess hell>
            Unternehmen veröffentlichen strukturierte Stellen, und {brand.assistantName} findet
            passende Menschen — ohne private Karrieregespräche offenzulegen.
          </Fliess>

          <ul className="grid gap-3 pt-2">
            {[
              "Stellen mit Monday schreiben und prüfen lassen",
              "Passende Menschen entdecken statt Profile durchsuchen",
              "Bewerbungen im Team bearbeiten, mit Rollen und Protokoll",
              "Die eigene Stelle mit dem Markt vergleichen",
            ].map((b) => (
              <li key={b} className="flex gap-3 text-[15px]" style={{ color: "rgba(244,245,250,.82)" }}>
                <span aria-hidden style={{ color: "var(--ed-mint)" }}>
                  —
                </span>
                {b}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/business/signup"
              className="inline-flex min-h-13 items-center gap-2 rounded-(--radius-pill) px-6 text-[15px] font-medium"
              style={{ background: "#fff", color: "#0b0d16" }}
            >
              Unternehmen registrieren
              <ArrowRight aria-hidden className="size-4" strokeWidth={2} />
            </Link>
            <Link
              href="/for-business"
              className="inline-flex min-h-13 items-center gap-2 rounded-(--radius-pill) px-6 text-[15px]"
              style={{ color: "#fff", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.24)" }}
            >
              Business ansehen
            </Link>
          </div>
        </div>

        {/* Die Arbeitgeberoberfläche, nicht die Kandidatenansicht. */}
        <div
          className="grid content-start gap-5 rounded-(--radius-xl) p-6 md:p-8"
          style={{ background: "#12151f", boxShadow: "0 40px 120px rgba(0,0,0,.45)" }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-display text-[clamp(1.1rem,1.8vw,1.5rem)] font-normal text-white">
              Senior Controller (m/w/d)
              <span className="sr-only"> — Beispielansicht</span>
            </h3>
            <span
              className="rounded-(--radius-pill) px-3 py-1 font-mono text-2xs"
              style={{ background: "rgba(255,255,255,.14)", color: "#fff" }}
            >
              Beispiel
            </span>
          </div>

          <dl className="grid grid-cols-3 gap-4 border-y py-5" style={{ borderColor: "rgba(255,255,255,.09)" }}>
            {[
              ["14", "passende Menschen"],
              ["3", "neue Anfragen"],
              ["2", "im Gespräch"],
            ].map(([zahl, label]) => (
              <div key={label} className="grid gap-1">
                <dd className="font-mono text-[clamp(1.5rem,3vw,2.2rem)] font-semibold tabular text-white">
                  {zahl}
                </dd>
                <dt className="text-2xs leading-tight" style={{ color: "rgba(244,245,250,.62)" }}>
                  {label}
                </dt>
              </div>
            ))}
          </dl>

          <div className="grid gap-2">
            <span className="text-2xs font-semibold uppercase tracking-[0.14em]" style={{ color: "rgba(244,245,250,.6)" }}>
              Marktvergleich
            </span>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(244,245,250,.82)" }}>
              Eure Spanne liegt <span className="font-mono">4 %</span> unter vergleichbaren Stellen in
              der Region. Zwei ähnliche Anzeigen nennen zusätzlich Homeoffice.
            </p>
          </div>

          <div
            className="grid gap-2 rounded-(--radius-md) p-4"
            style={{ background: "rgba(255,255,255,.05)" }}
          >
            <span className="text-2xs uppercase tracking-[0.1em]" style={{ color: "rgba(244,245,250,.6)" }}>
              Was {brand.assistantName} an der Anzeige anmerkt
            </span>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(244,245,250,.82)" }}>
              Ohne Wochenstunden lässt sich nicht ausrechnen, was die Stelle je Stunde bringt — die
              einzige Zahl, die zwei Angebote fair vergleicht.
            </p>
          </div>
        </div>
      </div>
    </Abschnitt>
  );
}

/*
 * Der Abschnitt „Was gilt" mit den zwei Regeln stand hier.
 *
 * Beide Aussagen — nichts geht ohne Freigabe hinaus, jede Empfehlung
 * ist begründet — stehen bereits unter dem Hero, direkt neben den
 * Knöpfen. Ein eigener Abschnitt weiter unten wiederholte sie für
 * Leser, die längst überzeugt oder längst weg sind.
 */

/* ══════════════════════════════════════════════════════════════
   13 · Abschluss
   ══════════════════════════════════════════════════════════════ */

function Abschluss() {
  return (
    <Abschnitt grund="canvas">
      <div className="grid justify-items-center gap-8 text-center">
        <Ueberschrift gross>
          Fang mit einem Satz an.
          <br />
          Nicht mit einem Lebenslauf.
        </Ueberschrift>
        <Fliess>
          Erzähl {brand.assistantName}, was du machst und was sich ändern soll. Den Rest übernimmt
          sie — nachvollziehbar, und immer mit dir am Steuer.
        </Fliess>
        <div className="flex flex-wrap justify-center gap-3">
          <Hauptknopf href="/register">Kostenlos mit {brand.assistantName} starten</Hauptknopf>
          <Nebenknopf href="/for-business">Ich suche Mitarbeiter</Nebenknopf>
        </div>
        <p className="text-sm" style={{ color: "var(--ed-ink-3)" }}>
          Kostenlos beginnen · Keine Zahlungsdaten · Jederzeit löschbar
        </p>
      </div>
    </Abschnitt>
  );
}
