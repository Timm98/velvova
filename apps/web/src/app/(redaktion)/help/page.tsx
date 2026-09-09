import type { Metadata } from "next";
import Link from "next/link";
import { getPageContext } from "@/lib/locale";
import { currentUser } from "@/lib/auth";
import { HILFE, HILFE_BEREICHE, sucheHilfe } from "@/lib/content/hilfe";
import {
  Abschluss,
  Abschnitt,
  Aufklapper,
  Einstieg,
  Hauptknopf,
  LESEBREITE,
  Nebenknopf,
} from "@/components/unterseiten/Geruest";
import { funktion, hatZiel } from "@/lib/unterseiten/verfuegbarkeit";
import { HilfeSuche } from "./HilfeSuche";
import { SupportChat } from "./SupportChat";

export const metadata: Metadata = {
  title: "Hilfe",
  description:
    "Antworten zu Konto, Jobsuche und Stellenchecks — durchsuchbar, mit Kontaktweg für alles andere.",
};
export const dynamic = "force-dynamic";

/**
 * ══════════════════════════════════════════════════════════════════
 * Hilfe — ein Anliegen lösen, nicht die Produktgeschichte lesen
 * ══════════════════════════════════════════════════════════════════
 *
 * Diese Seite war schon vor dem Umbau die ehrlichste der fünf: echte
 * Volltextsuche über echte Einträge, ein Nulltrefferzustand, ein
 * Support-Faden, der ausdrücklich vom Karrieregespräch getrennt ist.
 * Das bleibt alles.
 *
 * ── Was sich ändert ────────────────────────────────────────────
 *
 * Erstens die Form: Die sechs Bereiche waren nur Zwischenüberschriften
 * in einer langen Liste. Wer mit einem bestimmten Anliegen kommt,
 * scrollt daran vorbei. Jetzt stehen sie oben als Übersicht mit der
 * Zahl ihrer Antworten und führen an die Stelle.
 *
 * Zweitens ein Satz, der nicht belegt war. Unter „Lieber ein Mensch?"
 * stand: „Wir antworten selbst — es gibt keine Warteschleife und kein
 * Ticketsystem, das dich verwaltet." Das ist eine Aussage über die
 * eigene Organisation, für die es keinen Nachweis gibt. Sie ist
 * ersetzt durch das, was nachprüfbar stimmt: wohin die Nachricht
 * geht.
 *
 * ── Warum die Bereiche heissen, wie sie heissen ────────────────
 *
 * Das Konzept schlägt „Stellen & Wechsel-Check", „Preise & Käufe" und
 * „Technische Probleme" vor. Zu allen dreien gibt es keinen einzigen
 * Hilfeeintrag — und „Wechsel-Check" gibt es als Funktion überhaupt
 * nicht. Drei leere Kacheln wären schlechter als sechs volle.
 *
 * Deshalb stehen hier die Bereiche, zu denen es Antworten gibt. Sie
 * kommen aus `lib/content/hilfe.ts` und nicht aus dieser Datei; wächst
 * die Hilfe, wächst die Übersicht mit.
 */
export default async function HilfeSeite({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { brand } = await getPageContext();
  const { q } = await searchParams;
  const user = await currentUser();

  const treffer = q ? sucheHilfe(q) : HILFE;
  const gefiltert = Boolean(q?.trim());
  const kontakt = funktion("kontakt");

  return (
    <>
      <Einstieg
        oberzeile="Hilfe"
        titel="Wobei brauchst du Hilfe?"
        text={`Finde Antworten zu deinem Konto, zur Jobsuche und zu Stellenchecks. Für alles andere erreichst du uns direkt. ${brand.assistantName} antwortet hier aus der Produktdokumentation — nicht aus deinem Karriereprofil.`}
        unter={<HilfeSuche defaultValue={q ?? ""} />}
      />

      {/*
        Die Trefferzeile ist `aria-live`, damit ein Vorleseprogramm
        nach dem Absenden erfährt, wie viele Antworten es gibt. Ohne
        sie ändert sich nur der Bildschirm.
      */}
      {gefiltert ? (
        <Abschnitt
          kinder={
            <p className="text-[16px] text-ink-2" aria-live="polite">
              {treffer.length === 0
                ? `Zu „${q}“ steht hier nichts. Frag ${brand.assistantName} weiter unten — oder schreib uns.`
                : `${treffer.length} ${treffer.length === 1 ? "Antwort" : "Antworten"} zu „${q}“.`}
            </p>
          }
        />
      ) : (
        <Abschnitt
          titel="Sechs Bereiche"
          text="Jede Kachel führt an die Stelle mit den Antworten dazu. Was hier steht, gibt es auch — leere Bereiche sind keine dabei."
          kinder={
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {HILFE_BEREICHE.map((bereich) => {
                const anzahl = HILFE.filter((e) => e.bereich === bereich).length;
                if (anzahl === 0) return null;
                return (
                  <li key={bereich}>
                    <a
                      href={`#${anker(bereich)}`}
                      className="grid min-h-[6.5rem] content-between gap-3 rounded-(--radius-lg) border border-line p-5 transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      style={{ background: "var(--ed-surface)" }}
                    >
                      <span className="text-[16px] font-medium text-ink">{bereich}</span>
                      <span className="text-[13px] text-ink-3">
                        {anzahl} {anzahl === 1 ? "Antwort" : "Antworten"}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          }
        />
      )}

      {HILFE_BEREICHE.map((bereich) => {
        const eintraege = treffer.filter((e) => e.bereich === bereich);
        if (eintraege.length === 0) return null;
        return (
          <Abschnitt
            key={bereich}
            id={anker(bereich)}
            titel={bereich}
            kinder={
              <Aufklapper
                fragen={eintraege.map((e) => ({
                  frage: e.frage,
                  antwort: <p>{e.antwort}</p>,
                }))}
              />
            }
          />
        );
      })}

      <Abschnitt
        titel="Eine Frage zur Bedienung?"
        text={`${brand.assistantName} beantwortet hier Fragen anhand der Produktinformationen. Dein Karrieregespräch ist ein eigener Bereich — es wird in diese Antworten nicht geladen.`}
        kinder={<SupportChat assistantName={brand.assistantName} angemeldet={Boolean(user)} />}
      />

      <Abschluss
        titel="Lieber direkt mit uns sprechen?"
        text="Beschreibe kurz, wobei du Unterstützung brauchst. Bitte schicke keine Passwörter oder Zugangsschlüssel — wir fragen nie danach."
        aktionen={
          <>
            {hatZiel(kontakt) ? (
              <Hauptknopf href={kontakt.route}>Support kontaktieren</Hauptknopf>
            ) : null}
            <Nebenknopf href="/security">Wie wir mit Daten umgehen</Nebenknopf>
          </>
        }
      />

      {/*
        Der Hinweis darauf, was der Kontaktweg ist — und was nicht.

        Hier stand „es gibt keine Warteschleife und kein Ticketsystem,
        das dich verwaltet". Im Register steht bei `kontakt`: Die
        Kontaktseite besteht aus Mailto-Verweisen, es gibt kein
        Formular und keine Eingangsbestätigung. Über Bearbeitungszeiten
        sagt der Code nichts, also sagt die Seite nichts darüber.
      */}
      <section className="mx-auto w-full max-w-[1120px] px-5 pb-16 md:px-8">
        <p className={`${LESEBREITE} text-[13px] leading-[1.6] text-ink-3`}>
          Der Kontakt läuft über E-Mail an die Adressen auf der{" "}
          <Link href="/contact" className="underline underline-offset-[3px]">
            Kontaktseite
          </Link>
          . Es gibt kein Formular auf dieser Seite, das dir den Eingang bestätigen könnte — und
          deshalb behaupten wir ihn auch nicht.
        </p>
      </section>
    </>
  );
}

/**
 * Aus einem Bereichsnamen einen Anker machen.
 *
 * Umlaute und Kaufmanns-Und gehören nicht in eine Fragment-Kennung:
 * Sie funktionieren zwar meist, überleben aber Kopieren, Verkürzen und
 * fremde Programme nicht zuverlässig.
 */
function anker(bereich: string): string {
  return (
    "hilfe-" +
    bereich
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}
