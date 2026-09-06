"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";

/**
 * Was gerade gilt — sichtbar und einzeln abschaltbar.
 *
 * ── Warum das fehlte ──────────────────────────────────────────
 *
 * Die Filter standen in der Adresse und hinter einem Knopf namens
 * „Filter". Wer eine Bedingung in die Suchzeile getippt hatte, sah
 * danach eine kürzere Liste und nirgends, warum. Und um sie
 * zurückzunehmen, musste er raten, was er vorhin geschrieben hatte.
 *
 * Ein Chip beantwortet beides: Er sagt, was gilt, und sein X nimmt es
 * zurück. Ohne Umweg über ein Formular.
 *
 * ── Warum jeder Chip für sich steht ───────────────────────────
 *
 * „Alle Filter zurücksetzen" ist ein Knopf, den man selten drückt und
 * dann bereut. Meist will man genau eine Bedingung lockern — die, die
 * gerade zu viel weggenommen hat.
 */

const NAMEN: Record<string, (wert: string) => string> = {
  gehaltAb: (v) => `ab ${Number(v).toLocaleString("de-DE")} €`,
  salary: () => "nur mit Gehaltsangabe",
  ort: (v) => v,
  umkreisKm: (v) => `${v} km Umkreis`,
  pendelzeit: (v) => `höchstens ${v} Min. Fahrt`,
  arbeitszeit: (v) => (v === "teilzeit" ? "Teilzeit" : "Vollzeit"),
  schicht: (v) => (v === "0" ? "keine Schichtarbeit" : "Schichtarbeit"),
  remote: (v) => ({ remote: "Remote", hybrid: "Hybrid", onsite: "Vor Ort" })[v] ?? v,
  contract: (v) =>
    ({
      permanent: "Unbefristet",
      temporary: "Befristet",
      freelance: "Freiberuflich",
      internship: "Praktikum",
    })[v] ?? v,
  since: (v) => `seit ${v} Tagen`,
  nicht: (v) => `ohne ${v}`,
  q: (v) => `„${v}“`,
};

/** Reihenfolge der Chips — die einschneidendste Bedingung zuerst. */
/**
 * Reihenfolge der Chips — die einschneidendste Bedingung zuerst.
 *
 * ── Warum die Liste vollständig sein muss ────────────────────
 *
 * Sie ist die einzige Stelle, an der ein Filter sichtbar wird. Was
 * hier fehlt, wirkt in der Liste und steht nirgends — der stille
 * Filter, der die Trefferliste unerklärlich leer hält.
 *
 * `umkreisKm`, `pendelzeit`, `arbeitszeit` und `schicht` fehlten
 * genau so. „Keine längere Autofahrt als 170 Minuten" filterte, ohne
 * dass ein Plättchen davon erzählte.
 */
const FOLGE = [
  "gehaltAb",
  "salary",
  "ort",
  "umkreisKm",
  "pendelzeit",
  "remote",
  "arbeitszeit",
  "schicht",
  "contract",
  "nicht",
  "since",
  "q",
];

const LANDNAME: Record<string, string> = {
  DE: "Deutschland",
  AT: "Österreich",
  CH: "Schweiz",
  GB: "Grossbritannien",
  FR: "Frankreich",
  IT: "Italien",
  ES: "Spanien",
  NL: "Niederlande",
  PL: "Polen",
  US: "USA",
};

const QUELLENWORT: Record<string, string> = {
  netz: "nach deinem Standort",
  sprache: "nach deiner Spracheinstellung",
  gewaehlt: "von dir gewählt",
};

export function FilterChips({
  ohneAngabe = 0,
  abgeleitetesLand = null,
}: {
  ohneAngabe?: number;
  /**
   * Ein Land, das niemand eingetragen hat — abgeleitet aus der Anfrage.
   *
   * ── Warum es hier steht und nicht bei den anderen Plättchen ──
   *
   * Weil es keine Entscheidung der Person ist, sondern eine Vermutung
   * über sie. Es trägt deshalb seine Quelle mit und ein anderes Wort
   * zum Wegnehmen: „überall suchen" statt eines Kreuzes.
   *
   * Genau diese Sichtbarkeit hat der alten Vorgabe „DE" gefehlt. Sie
   * schränkte 998 Konten ein, und es stand nirgends.
   */
  abgeleitetesLand?: { code: string; quelle: string } | null;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const [unterwegs, starte] = useTransition();

  const aktiv = FOLGE.flatMap((k) => {
    const v = params.get(k);
    return v ? [{ schluessel: k, wert: v, text: NAMEN[k]?.(v) ?? v }] : [];
  });

  if (aktiv.length === 0 && !abgeleitetesLand) return null;

  function entfernen(schluessel: string) {
    const next = new URLSearchParams(params.toString());
    next.delete(schluessel);
    /*
     * Die Anzahl fällt mit weg.
     *
     * Wer eine Bedingung löst, bekommt eine längere Liste — und soll
     * dann wieder oben bei den ersten fünfundzwanzig anfangen, nicht
     * mit dreihundert Zeilen an derselben Scrollposition.
     */
    next.delete("anzahl");
    starte(() => router.replace(`/app/jobs?${next.toString()}`, { scroll: false }));
  }

  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Aktive Filter">
      {aktiv.map((f) => (
        <li key={f.schluessel}>
          <button
            type="button"
            disabled={unterwegs}
            onClick={() => entfernen(f.schluessel)}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-(--radius-pill) bg-accent-soft px-3 text-sm text-ink transition-colors hover:bg-soft disabled:opacity-60"
          >
            {f.text}
            <X aria-hidden className="size-3.5 text-ink-3" strokeWidth={2.2} />
            <span className="sr-only">entfernen</span>
          </button>
        </li>
      ))}

      {/*
        Wie viele Anzeigen ausgeblendet sind, weil sie nichts sagen.

        ══════════════════════════════════════════════════════════
        Der Unterschied, den diese Zahl sichtbar macht
        ══════════════════════════════════════════════════════════

        Ein eingetippter Filter ist streng: „Teilzeit" heisst, die
        Anzeige muss Teilzeit nennen. Rund die Hälfte aller Anzeigen
        nennt die Wochenstunden nicht — die fallen damit heraus.

        Ohne diese Zahl sieht das aus wie ein kleiner Arbeitsmarkt.
        Mit ihr ist es eine Auskunft über die ANZEIGEN: „acht
        ausgeblendet, weil sie dazu nichts sagen" ist etwas völlig
        anderes als „es gibt nur zwei Stellen".

        Sie steht als Text neben den Plättchen und nicht als eigenes
        Plättchen: Man kann sie nicht wegklicken, weil sie kein Filter
        ist, sondern eine Folge.
      */}
      {abgeleitetesLand && (
        <li className="flex items-center gap-2 text-xs text-ink-3">
          <span>
            Nur {LANDNAME[abgeleitetesLand.code] ?? abgeleitetesLand.code}
            {QUELLENWORT[abgeleitetesLand.quelle]
              ? `, ${QUELLENWORT[abgeleitetesLand.quelle]}`
              : ""}
          </span>
          <button
            type="button"
            disabled={unterwegs}
            onClick={() => {
              const next = new URLSearchParams(params.toString());
              next.set("land", "alle");
              next.delete("anzahl");
              starte(() => router.replace(`/app/jobs?${next.toString()}`, { scroll: false }));
            }}
            className="text-accent-text underline underline-offset-[3px] disabled:opacity-60"
          >
            überall suchen
          </button>
        </li>
      )}

      {ohneAngabe > 0 && (
        <li className="text-xs text-ink-3">
          {ohneAngabe === 1
            ? "1 Anzeige ausgeblendet, weil sie dazu nichts sagt"
            : `${ohneAngabe} Anzeigen ausgeblendet, weil sie dazu nichts sagen`}
        </li>
      )}
    </ul>
  );
}
