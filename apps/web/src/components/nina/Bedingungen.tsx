"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Clock, SlidersHorizontal, X } from "lucide-react";
import type { UserConstraints } from "@paycheck/domain";
import {
  bedingungAufheben,
  bedingungFuerSitzung,
  bedingungUebernehmen,
  ladeSitzung,
  sitzungZuruecksetzen,
  ladeBedingungen,
} from "@/lib/nina/bedingungen-aktionen";
import {
  bedingungenAusSatz,
  gesetzteBedingungen,
  type Bedingungsvorschlag,
} from "@/lib/nina/bedingungen";
import { useNina } from "./NinaProvider";

/**
 * Aus dem Gespräch wird eine Regel — sichtbar, bestätigt, widerrufbar.
 *
 * Die Lücke, die das schliesst: jemand sagte Monday „mindestens 45.000,
 * darunter lohnt es nicht", und die Jobseite schrieb weiterhin „Du hast
 * keine Untergrenze festgelegt". Der Satz lag im Gesprächsverlauf, die
 * Rangfolge las `user_constraints`, und zwischen beidem war nichts.
 *
 * Drei Entscheidungen, die den Unterschied machen:
 *
 *   **Vorschlag, nicht Tatsache.** Eine harte Bedingung blendet Stellen
 *   aus. Was ausgeblendet ist, fällt niemandem auf — deshalb darf kein
 *   Muster das allein entscheiden. Hier steht, was Monday verstanden hat,
 *   mit dem Satz daneben, aus dem sie es hat.
 *
 *   **Der Beleg steht dabei.** Ohne ihn ist die Karte eine Behauptung
 *   über die eigene Person, die man entweder blind bestätigt oder
 *   ignoriert. Mit ihm ist sie überprüfbar.
 *
 *   **Aufheben ist so leicht wie Setzen.** Gleicher Ort, gleiche
 *   Grösse. Eine Zustimmung, die man nur mühsam zurücknehmen kann, ist
 *   keine.
 */
/** Ein Schlüssel je Sitzung. Nicht je Person — es ist kein Profilwissen. */
const SPEICHER = "paycheck.bedingungen.erledigt";

export function Bedingungen() {
  const nina = useNina();
  const [gilt, setGilt] = useState<UserConstraints | null>(null);
  /*
   * Erledigte Vorschläge überleben einen Seitenwechsel.
   *
   * Ohne das schlug sich eine gerade aufgehobene Bedingung sofort
   * wieder selbst vor: der Satz steht ja weiter im Gesprächsverlauf,
   * und nach dem Aufheben gilt sie nicht mehr — also sah der
   * Vorschlagscode sie als neu. Wer eine Bedingung entfernt, bekommt
   * sie zwei Sekunden später erneut angeboten. Das liest sich wie ein
   * Widerspruch gegen die eigene Entscheidung.
   *
   * `sessionStorage` und nicht die Datenbank: das ist eine
   * Aufmerksamkeitsfrage dieser Sitzung, keine Aussage über die
   * Person. Beim nächsten Besuch darf Monday ruhig noch einmal fragen —
   * inzwischen kann sich etwas geändert haben.
   */
  const [erledigt, setErledigt] = useState<string[]>(() => {
    try {
      const roh = sessionStorage.getItem(SPEICHER);
      return roh ? (JSON.parse(roh) as string[]) : [];
    } catch {
      // Privates Fenster, gesperrter Speicher: dann eben ohne Gedächtnis.
      return [];
    }
  });

  function merkeErledigt(schluessel: string) {
    setErledigt((e) => {
      const neu = [...e, schluessel];
      try {
        sessionStorage.setItem(SPEICHER, JSON.stringify(neu));
      } catch {
        /* ohne Gedächtnis weiterarbeiten */
      }
      return neu;
    });
  }
  /** Felder, deren Bedingung in dieser Sitzung aufgehoben wurde. */
  const [erledigteFelder, setErledigtFeld] = useState<string[]>([]);
  const [meldung, setMeldung] = useState<string | null>(null);
  /*
   * Was nur für diese Suche gilt.
   *
   * Getrennt von `gilt` gehalten, weil es aus einer anderen Quelle
   * kommt und einen anderen Anspruch hat — ein Keks, der mit dem
   * Fenster endet, nicht das Profil.
   */
  const [sitzung, setSitzung] = useState<Record<string, unknown>>({});
  const [pending, start] = useTransition();

  useEffect(() => {
    let lebt = true;
    /*
     * Beide Quellen gleichzeitig.
     *
     * Die Sitzungsbedingung muss beim Laden mitkommen, sonst ist sie
     * nach jedem Seitenwechsel unsichtbar — sie wirkt weiter auf die
     * Jobliste, steht aber nirgends mehr. Nacheinander zu laden wäre
     * zwei Wartezeiten für zwei Dinge, die nichts voneinander wissen.
     */
    void Promise.all([ladeBedingungen(), ladeSitzung()]).then(([c, s]) => {
      if (!lebt) return;
      setGilt(c);
      setSitzung(s as Record<string, unknown>);
    });
    return () => {
      lebt = false;
    };
  }, []);

  /*
   * Vorschläge aus den letzten eigenen Sätzen.
   *
   * Nur die letzten vier Nachrichten: was vor zwanzig Minuten gesagt
   * wurde, jetzt noch als Rückfrage aufzumachen, wirkt wie ein
   * Nachhaken — und die Person hat inzwischen weitergeredet.
   */
  const vorschlaege = useMemo(() => {
    if (!gilt) return [];
    const eigene = nina.messages.filter((m) => m.role === "user").slice(-4);
    const gesehen = new Set<string>();
    const raus: Bedingungsvorschlag[] = [];

    for (const m of eigene) {
      for (const satz of m.content.split(/(?<=[.!?])\s+/)) {
        for (const v of bedingungenAusSatz(satz)) {
          const schluessel = `${v.feld}:${JSON.stringify(v.wert)}`;
          if (gesehen.has(schluessel) || erledigt.includes(schluessel)) continue;
          if (erledigteFelder.includes(v.feld)) continue;
          if (schonSo(gilt, v)) continue;
          gesehen.add(schluessel);
          raus.push(v);
        }
      }
    }
    return raus.slice(0, 3);
  }, [nina.messages, gilt, erledigt, erledigteFelder]);

  const karten = gilt ? gesetzteBedingungen(gilt) : [];
  const sitzungsFelder = Object.entries(sitzung);
  /*
   * Eine Meldung hält die Fläche offen.
   *
   * Vorher stand hier nur „keine Vorschläge und keine Karten → nichts
   * zeigen". Beim dauerhaften Weg fiel das nicht auf, weil sofort eine
   * Karte entsteht. Beim Weg „nur für diese Suche" entsteht bewusst
   * keine — die Komponente verschwand also im selben Augenblick, in
   * dem sie hätte bestätigen sollen, was sie getan hat. Geklickt, und
   * nichts sagte, dass etwas passiert war.
   */
  if (
    !gilt ||
    (vorschlaege.length === 0 && karten.length === 0 && sitzungsFelder.length === 0 && !meldung)
  ) {
    return null;
  }

  function uebernehmen(v: Bedingungsvorschlag) {
    start(async () => {
      const r = await bedingungUebernehmen(v);
      setMeldung(r.text);
      merkeErledigt(`${v.feld}:${JSON.stringify(v.wert)}`);
      if (r.ok) setGilt(await ladeBedingungen());
    });
  }

  function verwerfen(v: Bedingungsvorschlag) {
    merkeErledigt(`${v.feld}:${JSON.stringify(v.wert)}`);
  }

  /*
   * Der dritte Weg.
   *
   * „Zeig mir heute mal Stellen in Berlin" wird von beiden anderen
   * Knöpfen falsch beantwortet: Setzen macht daraus einen dauerhaften
   * Wunschort, Verwerfen ignoriert eine klare Ansage.
   */
  function nurDieseSuche(v: Bedingungsvorschlag) {
    start(async () => {
      const r = await bedingungFuerSitzung(v);
      setMeldung(r.text);
      merkeErledigt(`${v.feld}:${JSON.stringify(v.wert)}`);
      if (r.ok) setSitzung(await ladeSitzung());
    });
  }

  function sitzungLeeren() {
    start(async () => {
      const r = await sitzungZuruecksetzen();
      setMeldung(r.text);
      setSitzung({});
    });
  }

  function aufheben(feld: (typeof karten)[number]["feld"], wert?: string) {
    start(async () => {
      const r = await bedingungAufheben(feld, wert);
      setMeldung(r.text);
      if (r.ok) {
        /*
         * Das Feld auch als erledigt merken.
         *
         * Sonst kommt genau die Bedingung, die eben aufgehoben wurde,
         * als Vorschlag zurück — aus demselben Satz im Verlauf.
         */
        merkeErledigt(`${feld}:${JSON.stringify(wert)}`);
        setErledigtFeld((f) => [...f, feld]);
        setGilt(await ladeBedingungen());
      }
    });
  }

  return (
    <section
      aria-labelledby="harte-bedingungen"
      data-bedingungen
      className="mt-10 rounded-(--radius-surface) bg-raised px-6 py-5"
    >
      <div className="flex items-center gap-2.5">
        <SlidersHorizontal className="size-4 shrink-0 text-ink-3" strokeWidth={1.8} />
        <h2 id="harte-bedingungen" className="text-sm font-medium">
          Deine harten Bedingungen
        </h2>
      </div>

      {vorschlaege.length > 0 && (
        <>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            Das klang nach einer Grenze, nicht nach einem Wunsch. Wenn du sie bestätigst, zeige ich
            dir Stellen, die sie verletzen, nicht mehr in den Haupttreffern.
          </p>
          <ul className="mt-4 grid gap-3">
            {vorschlaege.map((v) => (
              <li
                key={`${v.feld}:${JSON.stringify(v.wert)}`}
                className="rounded-(--radius-lg) bg-surface px-4 py-3.5 shadow-sm"
              >
                <p className="text-[0.9375rem] leading-relaxed">
                  <span className="text-ink-3">{v.label}: </span>
                  {v.anzeige}
                </p>
                {/* Der Satz, aus dem es stammt — ohne ihn ist die Karte nicht prüfbar. */}
                <p className="mt-1 text-sm italic leading-relaxed text-ink-3">„{v.beleg}"</p>
                {/*
                 * Wenn der Satz „heute" meint, steht „heute" vorn.
                 *
                 * Die Reihenfolge der Knöpfe ist eine Empfehlung, und
                 * eine falsche Empfehlung ist hier teuer: Wer bei
                 * „Zeig mir heute mal Berlin" zuerst auf „Als Bedingung
                 * setzen" trifft, bekommt einen dauerhaften Wunschort
                 * aus einem beiläufigen Satz.
                 *
                 * Bei `unklar` bleibt die dauerhafte Fassung vorn, aber
                 * die Sitzungsfassung steht daneben — statt einer
                 * Rückfrage, die das Gespräch anhält.
                 */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {v.geltung === "sitzung" && (
                    <button
                      type="button"
                      onClick={() => nurDieseSuche(v)}
                      disabled={pending}
                      className="inline-flex h-10 items-center gap-1.5 rounded-(--radius-control) bg-raised px-4 text-sm transition-colors hover:bg-soft"
                    >
                      <Clock className="size-4 text-accent" strokeWidth={2.2} />
                      Nur für diese Suche
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => uebernehmen(v)}
                    disabled={pending}
                    className="inline-flex h-10 items-center gap-1.5 rounded-(--radius-control) bg-raised px-4 text-sm transition-colors hover:bg-soft"
                  >
                    <Check className="size-4 text-positive" strokeWidth={2.4} />
                    {v.geltung === "sitzung" ? "Dauerhaft übernehmen" : "Als Bedingung setzen"}
                  </button>
                  {v.geltung === "unklar" && (
                    <button
                      type="button"
                      onClick={() => nurDieseSuche(v)}
                      disabled={pending}
                      className="inline-flex h-10 items-center gap-1.5 rounded-(--radius-control) px-4 text-sm text-ink-2 transition-colors hover:bg-raised"
                    >
                      <Clock className="size-4" strokeWidth={2.2} />
                      Nur für diese Suche
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => verwerfen(v)}
                    disabled={pending}
                    className="inline-flex h-10 items-center gap-1.5 rounded-(--radius-control) px-4 text-sm text-ink-2 transition-colors hover:bg-raised"
                  >
                    <X className="size-4" strokeWidth={2.2} />
                    Nur ein Wunsch
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {karten.length > 0 && (
        <>
          <p className="mt-4 text-sm text-ink-2">
            {vorschlaege.length > 0 ? "Schon gesetzt:" : "Diese Grenzen wende ich an:"}
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {karten.map((k) => (
              <li key={`${k.feld}:${k.wert ?? ""}`}>
                <span className="inline-flex items-center gap-1 rounded-(--radius-pill) bg-surface py-1 pl-3.5 pr-1 text-sm shadow-sm">
                  <span className="text-ink-3">{k.label}:</span> {k.anzeige}
                  <button
                    type="button"
                    onClick={() => aufheben(k.feld, k.wert)}
                    disabled={pending}
                    aria-label={`Bedingung „${k.label}: ${k.anzeige}" aufheben`}
                    title="Bedingung aufheben"
                    className="ml-0.5 inline-flex size-8 items-center justify-center rounded-(--radius-pill) text-ink-3 transition-colors hover:bg-raised hover:text-ink"
                  >
                    <X className="size-3.5" strokeWidth={2} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {sitzungsFelder.length > 0 && (
        <>
          {/*
           * Sichtbar UND rücknehmbar.
           *
           * Eine Bedingung, die die Jobliste verändert und nirgends
           * steht, ist schlimmer als gar keine: Die Person sieht
           * weniger Stellen und findet den Grund nicht.
           */}
          <p className="mt-4 text-sm text-ink-2">Nur für diese Suche:</p>
          <ul className="mt-2.5 flex flex-wrap items-center gap-2">
            {sitzungsFelder.map(([feld, wert]) => (
              <li key={feld}>
                <span className="inline-flex items-center gap-1 rounded-(--radius-pill) bg-surface py-1 pl-3.5 pr-3.5 text-sm shadow-sm">
                  <Clock className="size-3.5 text-accent" strokeWidth={2} />
                  <span className="text-ink-3">{feld}:</span> {String(wert)}
                </span>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={sitzungLeeren}
                disabled={pending}
                className="inline-flex h-8 items-center gap-1.5 rounded-(--radius-pill) px-3 text-sm text-ink-2 transition-colors hover:bg-raised hover:text-ink"
              >
                <X className="size-3.5" strokeWidth={2} />
                Zurücksetzen
              </button>
            </li>
          </ul>
        </>
      )}

      {meldung && (
        <p aria-live="polite" className="mt-3.5 text-sm leading-relaxed text-ink-2">
          {meldung}
        </p>
      )}
    </section>
  );
}

/** Gilt das schon? Dann ist es kein Vorschlag mehr, sondern Bestand. */
function schonSo(c: UserConstraints, v: Bedingungsvorschlag): boolean {
  const jetzt = (c as unknown as Record<string, unknown>)[v.feld];
  if (v.feld === "hardNoGos") return c.hardNoGos.includes(String(v.wert));
  return JSON.stringify(jetzt) === JSON.stringify(v.wert);
}
