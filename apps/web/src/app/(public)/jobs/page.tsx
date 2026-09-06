import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Building2, Clock, ArrowRight } from "lucide-react";
import { brand } from "@paycheck/config";
import { oeffentlicheSuche, PRO_SEITE, type Suchtreffer } from "@/lib/jobs/oeffentliche-suche";
import { bestandszahl } from "@/lib/jobs/bestandszahl";
import { Suchleiste } from "@/components/jobs/Suchleiste";

/*
 * Die Stellensuche für Besucher ohne Konto.
 *
 * ── Warum es sie gibt ─────────────────────────────────────────
 *
 * Die Startseite trägt ein Suchfeld an prominenter Stelle. Ein
 * Suchfeld, das nur zur Registrierung führt, ist eine Attrappe — man
 * tippt einen Beruf ein und bekommt eine Anmeldemaske. Wer so etwas
 * einmal erlebt hat, tippt kein zweites Mal.
 *
 * Gezeigt werden Titel, Unternehmen, Ort, Gehalt, Arbeitsmodell,
 * Datum und Quelle. Der Beschreibungstext bleibt draussen: 26 der 28
 * Quellen untersagen die wörtliche Wiedergabe, und was wir öffentlich
 * zeigen dürfen, entscheidet die Quelle, nicht der Entwurf.
 */

export const metadata: Metadata = {
  title: `Stellensuche — ${brand.name}`,
  description:
    "Durchsuche geprüfte Stellenanzeigen aus lizenzierten Quellen. Mit Gehalt, Herkunft der Zahl und Bewerbung über die Originalanzeige.",
};

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
export default async function OeffentlicheJobsSeite({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ort?: string; land?: string; seite?: string }>;
}) {
  const p = await searchParams;
  const seite = Math.max(1, Number.parseInt(p.seite ?? "1", 10) || 1);

  const [ergebnis, bestand] = await Promise.all([
    oeffentlicheSuche({ q: p.q, ort: p.ort, land: p.land, seite }),
    bestandszahl(),
  ]);

  /*
   * Ein Land zählt als Suche.
   *
   * Vorher nicht: Wer im Fuss auf eine Flagge klickte, bekam die
   * allgemeine Überschrift „2.360.000 Stellen durchsuchen" und keine
   * Trefferzahl — also kein Zeichen, dass der Filter überhaupt griff.
   * Ein Filter, den man nicht bestätigt sieht, wirkt kaputt, auch wenn
   * er arbeitet.
   */
  const land = p.land?.trim().toUpperCase();
  const landName = land ? LAENDERNAME[land] ?? land : null;
  const gesucht = Boolean(p.q?.trim() || p.ort?.trim() || land);
  const anzahlText = ergebnis.mehrAls
    ? `über ${ergebnis.anzahl.toLocaleString("de-DE")}`
    : ergebnis.anzahl.toLocaleString("de-DE");

  return (
    <div className="grid gap-8">
      <header className="grid gap-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {landName ? (
            `Stellen in ${landName}`
          ) : gesucht ? (
            "Stellensuche"
          ) : (
            <>
              <span className="font-mono tabular-nums">{bestand.text}</span> Stellen durchsuchen
            </>
          )}
        </h1>
        <p className="max-w-[62ch] text-sm leading-relaxed text-ink-2">
          Aus lizenzierten Quellen, mit Angabe der Herkunft. Beworben wird immer über die
          Originalanzeige — {brand.name} verschickt nichts ohne deine Freigabe.
        </p>
      </header>

      <Suchleiste q={p.q ?? ""} ort={p.ort ?? ""} />

      {gesucht && (
        <p className="text-sm text-ink-2" role="status" aria-live="polite">
          <strong className="font-mono font-bold tabular-nums text-ink">{anzahlText}</strong>{" "}
          {ergebnis.anzahl === 1 ? "Stelle" : "Stellen"} gefunden
          {p.q?.trim() ? ` für „${p.q.trim()}“` : ""}
          {p.ort?.trim() ? ` in ${p.ort.trim()}` : ""}
          {landName && !p.ort?.trim() ? ` in ${landName}` : ""}.
        </p>
      )}

      {ergebnis.treffer.length === 0 ? (
        <div className="rounded-(--radius-lg) border border-line bg-inset px-6 py-10 text-center">
          <p className="text-sm font-medium">Dazu haben wir gerade nichts gefunden.</p>
          <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-ink-2">
            Versuch einen breiteren Begriff oder lass den Ort weg. Der Bestand wächst laufend —
            was heute fehlt, kann morgen da sein.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {ergebnis.treffer.map((t) => (
            <li key={t.id}>
              <Trefferkarte treffer={t} />
            </li>
          ))}
        </ul>
      )}

      <Blaettern
        seite={ergebnis.seite}
        hatWeitere={ergebnis.hatWeitere}
        parameter={{ q: p.q, ort: p.ort, land: p.land }}
      />
    </div>
  );
}

/* ── Eine Anzeige ───────────────────────────────────────────── */

function Trefferkarte({ treffer }: { treffer: Suchtreffer }) {
  return (
    <Link
      href={`/app/jobs/${treffer.id}`}
      className="group grid gap-3 rounded-(--radius-lg) border border-line bg-surface px-5 py-4 transition-colors hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold leading-snug group-hover:text-accent-text">
          {treffer.titel}
        </h2>
        <ArrowRight
          aria-hidden
          className="mt-1 size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <Building2 aria-hidden className="size-3.5 shrink-0 text-ink-3" />
          {treffer.unternehmen}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin aria-hidden className="size-3.5 shrink-0 text-ink-3" />
          {treffer.ort}
        </span>
        {treffer.veroeffentlicht && (
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden className="size-3.5 shrink-0 text-ink-3" />
            <time dateTime={treffer.veroeffentlicht}>{alter(treffer.veroeffentlicht)}</time>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/*
          Ein Gehalt steht hier nur, wenn die Anzeige eines nennt.
          Geschätzte Zahlen gehören auf die Detailseite, wo daneben
          steht, woher sie kommen — nicht auf eine Karte, die wie eine
          Zusage aussieht.
        */}
        {treffer.gehaltAngegeben && treffer.gehaltMin ? (
          <Merkmal ton="gut">{gehaltText(treffer)}</Merkmal>
        ) : (
          <Merkmal>Gehalt nicht angegeben</Merkmal>
        )}
        {treffer.arbeitsmodell && <Merkmal>{ARBEITSMODELL[treffer.arbeitsmodell] ?? treffer.arbeitsmodell}</Merkmal>}
        <Merkmal leise>Quelle: {treffer.quelle}</Merkmal>
      </div>
    </Link>
  );
}

const ARBEITSMODELL: Record<string, string> = {
  remote: "Vollständig remote",
  hybrid: "Hybrid",
  on_site: "Vor Ort",
};

function Merkmal({
  children,
  ton,
  leise,
}: {
  children: React.ReactNode;
  ton?: "gut";
  leise?: boolean;
}) {
  const klasse = ton === "gut"
    ? "border-positive/30 bg-positive-soft text-ink-1"
    : leise
      ? "border-transparent bg-transparent text-ink-3"
      : "border-line bg-inset text-ink-2";
  return (
    <span className={`rounded-full border px-2.5 py-1 text-2xs font-medium ${klasse}`}>
      {children}
    </span>
  );
}

function gehaltText(t: Suchtreffer): string {
  const einheit = t.gehaltZeitraum === "hour" ? " / Std." : t.gehaltZeitraum === "month" ? " / Monat" : " / Jahr";
  const f = (n: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: t.waehrung || "EUR",
      maximumFractionDigits: 0,
    }).format(n);
  if (t.gehaltMax && t.gehaltMax > (t.gehaltMin ?? 0)) {
    return `${f(t.gehaltMin!)} – ${f(t.gehaltMax)}${einheit}`;
  }
  return `ab ${f(t.gehaltMin!)}${einheit}`;
}

/*
 * „vor 3 Tagen" statt eines Datums.
 *
 * Bei Stellenanzeigen ist das Alter die Auskunft, nicht der Kalendertag:
 * Niemand rechnet im Kopf aus, ob der 12. August lange her ist.
 */
function alter(iso: string): string {
  const tage = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (tage <= 0) return "heute";
  if (tage === 1) return "gestern";
  if (tage < 7) return `vor ${tage} Tagen`;
  if (tage < 14) return "vor einer Woche";
  if (tage < 31) return `vor ${Math.floor(tage / 7)} Wochen`;
  if (tage < 60) return "vor einem Monat";
  return `vor ${Math.floor(tage / 30)} Monaten`;
}

/* ── Blättern ───────────────────────────────────────────────── */

function Blaettern({
  seite,
  hatWeitere,
  parameter,
}: {
  seite: number;
  hatWeitere: boolean;
  parameter: Record<string, string | undefined>;
}) {
  if (seite === 1 && !hatWeitere) return null;

  /*
   * Die bestehenden Parameter werden ergänzt, nicht ersetzt.
   *
   * Genau hier steckte im angemeldeten Bereich schon einmal ein
   * Fehler: Der Adressbauer schrieb die Adresse neu, und jeder Klick
   * auf „weiter" warf alle gesetzten Filter weg.
   */
  const adresse = (zielSeite: number) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(parameter)) if (v?.trim()) s.set(k, v.trim());
    if (zielSeite > 1) s.set("seite", String(zielSeite));
    const q = s.toString();
    return q ? `/jobs?${q}` : "/jobs";
  };

  return (
    <nav className="flex items-center justify-between gap-4 border-t border-line pt-5" aria-label="Seiten">
      {seite > 1 ? (
        <Link href={adresse(seite - 1)} className="text-sm font-medium text-accent-text underline underline-offset-[3px]">
          ← Vorherige Seite
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-ink-3">
        Seite {seite} · {PRO_SEITE} je Seite
      </span>
      {hatWeitere ? (
        <Link href={adresse(seite + 1)} className="text-sm font-medium text-accent-text underline underline-offset-[3px]">
          Nächste Seite →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/*
 * Ländernamen für die Überschrift.
 *
 * Dieselben neunzehn wie im Fuss — sie stehen dort in
 * `lib/jobs/laenderbestand.ts` und hier, weil diese Seite die Liste
 * nicht laden muss, nur einen Namen. Wächst der Bestand über diese
 * Länder hinaus, fällt es hier zuerst auf: dann steht der Code da,
 * nicht ein falscher Name.
 */
const LAENDERNAME: Record<string, string> = {
  AT: "Österreich", AU: "Australien", BE: "Belgien", BR: "Brasilien",
  CA: "Kanada", CH: "der Schweiz", DE: "Deutschland", ES: "Spanien",
  FR: "Frankreich", GB: "Grossbritannien", IN: "Indien", IT: "Italien",
  MX: "Mexiko", NL: "den Niederlanden", NZ: "Neuseeland", PL: "Polen",
  SG: "Singapur", US: "den USA", ZA: "Südafrika",
};
