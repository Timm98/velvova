import type { Metadata } from "next";
import { brand } from "@paycheck/config";
import { BestandProvider } from "@/components/marketing/BestandProvider";
import { NinaVisual } from "@/components/nina/NinaVisual";
import { NinaVorladen } from "@/components/nina/NinaVorladen";
import { Einstieg } from "@/components/marketing/Einstieg";
import { HaeufigeFragen } from "@/components/marketing/HaeufigeFragen";
import { Partnerleiste } from "@/components/marketing/Partnerleiste";
import { AppHinweisleiste } from "@/components/shell/AppHinweisleiste";
import { TopNav } from "@/components/shell/TopNav";
import { VelvovaFooter } from "@/components/shell/VelvovaFooter";
import { laenderbestand } from "@/lib/jobs/laenderbestand";
import { HilfeKnopf } from "@/components/marketing/HilfeKnopf";
import { Landeshinweis } from "@/components/marketing/Landeshinweis";
import { besucherHerkunft } from "@/lib/herkunft";
import { bestandszahl } from "@/lib/jobs/bestandszahl";
import { kopfsitzung } from "@/components/shell/Kopfsitzung";
import { lageFuer } from "@/lib/landeslage";
import { Abomodell } from "@/components/marketing/Abomodell";
import { mondayZiel } from "@/lib/mondayziel";

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
      {/*
        Das Modell parallel zum HTML anfordern.

        Steht bewusst vor der Kopfzeile: Der Browser liest von oben und
        soll die 7,6 MB anstossen, bevor er sich um irgendetwas anderes
        kümmert. Begründung und Messwerte stehen im Bauteil.
      */}
      <NinaVorladen />

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
        <Einstiegshero
          angemeldet={sitzung.angemeldet}
          anrede={sitzung.anrede}
          mondayHref={await mondayZiel()}
        />
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
      <VelvovaFooter laender={laender} mondayHref={await mondayZiel()} />

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


/* ══════════════════════════════════════════════════════════════
   Bausteine
   ══════════════════════════════════════════════════════════════ */


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
function Einstiegshero({
  angemeldet,
  anrede,
  mondayHref,
}: {
  angemeldet: boolean;
  anrede: string | null;
  /* Von der Seite gereicht, weil nur sie den Host der Anfrage kennt. */
  mondayHref: string;
}) {
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

        {/*
          Auf der öffentlichen Seite absolut, überall sonst relativ.

          `mondayZiel()` liest den Host der Anfrage. Steht sie auf
          velvova.com und ist die Trennung eingerichtet, führt der
          Knopf direkt auf die Anwendungsdomain — ein Sprung weniger
          als über die Weiche in der Middleware. Auf jedem anderen
          Host bleibt der Pfad relativ, und dort ist er richtig.
        */}
        <Einstieg angemeldet={angemeldet} mondayZiel={mondayHref} />
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


/* ══════════════════════════════════════════════════════════════
   4 · Entdeckung — die Geschichte
   ══════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════════
   5 · Zukunft statt Schlagwörter
   ══════════════════════════════════════════════════════════════ */


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


/* ══════════════════════════════════════════════════════════════
   7 · Life Fit
   ══════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════════
   7b · Der Fit Score
   ══════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════════
   8 · Bewerbung
   ══════════════════════════════════════════════════════════════ */


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


/* ══════════════════════════════════════════════════════════════
   11 · Für Unternehmen
   ══════════════════════════════════════════════════════════════ */


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

