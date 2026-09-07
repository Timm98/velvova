"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ExternalLink, Loader2, TriangleAlert } from "lucide-react";
import { profilSpeichern, profilVeroeffentlichen } from "@/lib/arbeitgeber/profil-aktionen";
import {
  BEREICHE,
  ninaHinweise,
  vollstaendigkeit,
  type Bereich,
  type Profilstand,
  type Wert,
} from "@/lib/arbeitgeber/profil-felder";
import { cn } from "@/lib/cn";

/**
 * Der Editor der Unternehmensseite.
 *
 * ── Warum ein Formular und nicht fünf ─────────────────────────
 *
 * Die fünf Bereiche sind Ansichten auf denselben Datensatz, keine
 * Schritte. Wer in „Leistungen" etwas ändert und dann auf
 * „Grundlagen" wechselt, darf die Änderung nicht verlieren — also
 * bleibt alles im selben Formular stehen und nur die Sichtbarkeit
 * wechselt.
 *
 * Die versteckten Bereiche stehen dabei wirklich im DOM. `hidden`
 * statt Ausbauen: Ein ausgebautes Feld ist beim Absenden nicht dabei,
 * und dann löschte ein Speichern aus „Leistungen" alles, was in den
 * anderen vier Bereichen stand.
 *
 * ── Warum automatisch gespeichert wird ────────────────────────
 *
 * Dieses Formular hat über fünfzig Felder. Es wird über Tage
 * ausgefüllt, oft nebenbei, oft im zweiten Tab. Ein Entwurf, der beim
 * Schliessen weg ist, wird kein zweites Mal angefangen.
 *
 * Gespeichert wird zwei Sekunden nach dem letzten Tastendruck — nicht
 * bei jedem: Fünfzig Felder mal ein Aufruf je Zeichen wären ein Angriff
 * auf die eigene Datenbank.
 */

const FELD =
  "w-full rounded-[10px] border border-line-3 bg-transparent px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] hover:border-ink-3 focus-visible:border-(--primary) focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--primary)]";

type Stand = "ruhe" | "tippt" | "speichert" | "gespeichert" | "fehler";

export function ProfilEditor({
  organizationId,
  slug,
  darfVeroeffentlichen,
  geprueft,
  start,
}: {
  organizationId: string;
  slug: string | null;
  darfVeroeffentlichen: boolean;
  geprueft: boolean;
  start: Profilstand | null;
}) {
  const [bereich, setBereich] = useState<string>(BEREICHE[0]!.id);
  const [stand, setStand] = useState<Stand>("ruhe");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [, starte] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  /*
   * Der angezeigte Stand lebt im Zustand, nicht nur im Formular.
   *
   * Die Vorschau rechts und die Vollständigkeit oben müssen sich beim
   * Tippen mitbewegen — sonst sieht man erst nach dem Speichern, was
   * man gebaut hat. Ein Formular ohne kontrollierte Felder weiss
   * darüber nichts.
   */
  const [entwurf, setEntwurf] = useState<Record<string, string>>(() => {
    const anfang: Record<string, string> = {};
    for (const b of BEREICHE) {
      for (const f of b.felder) {
        const w = start?.[f.name];
        anfang[String(f.name)] = w === null || w === undefined ? "" : String(w);
      }
    }
    const werte = start?.werte ?? [];
    for (let i = 0; i < 3; i++) {
      anfang[`wert_${i}`] = werte[i]?.wert ?? "";
      anfang[`beispiel_${i}`] = werte[i]?.beispiel ?? "";
    }
    return anfang;
  });

  /** Der Stand als Profilobjekt — für Vorschau, Prozent und Hinweise. */
  const alsProfil = useMemo<Profilstand>(() => {
    const werte: Wert[] = [];
    for (let i = 0; i < 3; i++) {
      const w = entwurf[`wert_${i}`]?.trim();
      if (w) werte.push({ wert: w, beispiel: entwurf[`beispiel_${i}`] ?? "" });
    }
    return {
      ...(start ?? ({ organizationId, aktualisiertAm: new Date() } as unknown as Profilstand)),
      ...(Object.fromEntries(
        Object.entries(entwurf).filter(([k]) => !k.startsWith("wert_") && !k.startsWith("beispiel_")),
      ) as Partial<Profilstand>),
      werte,
    } as Profilstand;
  }, [entwurf, start, organizationId]);

  const { prozent, offen } = vollstaendigkeit(alsProfil);
  const hinweise = ninaHinweise(alsProfil);

  const speichern = useCallback(() => {
    const el = form.current;
    if (!el) return;
    setStand("speichert");
    const daten = new FormData(el);
    starte(async () => {
      const r = await profilSpeichern(organizationId, daten);
      if (r.ok) {
        setStand("gespeichert");
        setMeldung(null);
      } else {
        setStand("fehler");
        setMeldung(r.fehler ?? "Speichern fehlgeschlagen.");
      }
    });
  }, [organizationId]);

  /* Zwei Sekunden nach dem letzten Tastendruck. */
  useEffect(() => {
    if (stand !== "tippt") return;
    const uhr = setTimeout(speichern, 2000);
    return () => clearTimeout(uhr);
  }, [stand, entwurf, speichern]);

  /*
   * Der Warnhinweis beim Schliessen.
   *
   * Er greift nur, solange noch etwas offen ist — nach dem
   * automatischen Speichern nicht mehr. Ein Dialog, der immer kommt,
   * wird weggeklickt, ohne gelesen zu werden, und schützt dann nichts.
   */
  useEffect(() => {
    if (stand !== "tippt" && stand !== "speichert") return;
    const warnen = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warnen);
    return () => window.removeEventListener("beforeunload", warnen);
  }, [stand]);

  function aendern(name: string, wert: string) {
    setEntwurf((v) => ({ ...v, [name]: wert }));
    setStand("tippt");
  }

  function veroeffentlichen() {
    starte(async () => {
      const r = await profilVeroeffentlichen(organizationId);
      if (r.ok) {
        setMeldung(null);
        setStand("gespeichert");
      } else {
        setMeldung(r.fehler ?? "Veröffentlichen fehlgeschlagen.");
        setStand("fehler");
      }
    });
  }

  return (
    <div className="grid gap-6">
      {/* ── Kopfleiste ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-(--radius-md) border border-line p-4">
        <div className="grid gap-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold tabular-nums text-ink">{prozent} %</span>
            <span className="text-sm text-ink-2">
              vollständig{offen.length > 0 && ` · ${offen.length} Angaben offen`}
            </span>
          </div>
          <span
            aria-hidden
            className="h-1.5 w-56 max-w-full overflow-hidden rounded-full bg-inset"
          >
            <span className="block h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${prozent}%` }} />
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Speicherstand stand={stand} />
          {slug && (
            <Link
              href={`/unternehmen/${slug}`}
              target="_blank"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-pill) px-3 text-sm text-ink-2 hover:text-ink"
            >
              Öffentliche Seite
              <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.9} />
            </Link>
          )}
          <button
            type="button"
            onClick={speichern}
            className="inline-flex min-h-11 items-center rounded-(--radius-pill) border border-line-3 px-4 text-sm font-medium text-ink hover:bg-soft"
          >
            Entwurf speichern
          </button>
          <button
            type="button"
            onClick={veroeffentlichen}
            disabled={!darfVeroeffentlichen || !geprueft}
            title={
              !darfVeroeffentlichen
                ? "Dafür brauchst du mindestens die Rolle „Verwaltung“."
                : !geprueft
                  ? "Die Zugehörigkeit zum Unternehmen ist noch nicht bestätigt."
                  : undefined
            }
            className="inline-flex min-h-11 items-center rounded-(--radius-pill) bg-accent px-4 text-sm font-semibold text-accent-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Unternehmensseite veröffentlichen
          </button>
        </div>
      </div>

      {meldung && (
        <p role="alert" className="flex items-start gap-2.5 rounded-(--radius-md) border border-critical/40 bg-critical-soft px-4 py-3 text-sm text-ink">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {meldung}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)_22rem]">
        {/* ── Links: die Bereiche ────────────────────────── */}
        <nav aria-label="Bereiche" className="lg:sticky lg:top-4 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto lg:grid lg:gap-0.5">
            {BEREICHE.map((b) => {
              const fehlt = b.felder.filter((f) => f.zaehlt && !String(entwurf[String(f.name)] ?? "").trim()).length;
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setBereich(b.id)}
                    aria-current={bereich === b.id ? "step" : undefined}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-2 whitespace-nowrap rounded-(--radius-sm) px-3 text-sm transition-colors",
                      bereich === b.id ? "bg-soft font-medium text-ink" : "text-ink-2 hover:text-ink",
                    )}
                  >
                    {b.titel}
                    {fehlt > 0 && (
                      <span className="font-mono text-2xs tabular-nums text-ink-3">{fehlt}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Mitte: die Felder ──────────────────────────── */}
        <form ref={form} className="grid gap-6">
          {BEREICHE.map((b) => (
            <fieldset key={b.id} hidden={bereich !== b.id} className="grid gap-5">
              <legend className="sr-only">{b.titel}</legend>
              <p className="text-sm leading-relaxed text-ink-2">{b.einleitung}</p>

              {b.felder.map((f) => {
                const id = `feld-${String(f.name)}`;
                return (
                  <div key={String(f.name)} className="grid gap-2">
                    <label htmlFor={id} className="text-sm font-medium text-ink">
                      {f.label}
                      {f.zaehlt && <span className="ml-2 text-2xs font-normal text-ink-3">zählt zur Vollständigkeit</span>}
                    </label>
                    {f.lang ? (
                      <textarea
                        id={id}
                        name={String(f.name)}
                        rows={4}
                        value={entwurf[String(f.name)] ?? ""}
                        onChange={(e) => aendern(String(f.name), e.target.value)}
                        className={cn(FELD, "resize-y leading-relaxed")}
                      />
                    ) : (
                      <input
                        id={id}
                        name={String(f.name)}
                        value={entwurf[String(f.name)] ?? ""}
                        onChange={(e) => aendern(String(f.name), e.target.value)}
                        className={FELD}
                      />
                    )}
                    {f.hinweis && <p className="text-xs leading-relaxed text-ink-3">{f.hinweis}</p>}
                  </div>
                );
              })}

              {b.id === "kultur" && (
                <div className="grid gap-4 rounded-(--radius-md) border border-line p-4">
                  <p className="text-sm font-medium text-ink">Bis zu drei Werte — jeder mit einem Beispiel</p>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="grid gap-2">
                      <input
                        name={`wert_${i}`}
                        placeholder={`Wert ${i + 1}`}
                        value={entwurf[`wert_${i}`] ?? ""}
                        onChange={(e) => aendern(`wert_${i}`, e.target.value)}
                        aria-label={`Wert ${i + 1}`}
                        className={FELD}
                      />
                      <textarea
                        name={`beispiel_${i}`}
                        rows={2}
                        placeholder="Woran merkt man das im Alltag?"
                        value={entwurf[`beispiel_${i}`] ?? ""}
                        onChange={(e) => aendern(`beispiel_${i}`, e.target.value)}
                        aria-label={`Beispiel für Wert ${i + 1}`}
                        className={cn(FELD, "resize-y leading-relaxed")}
                      />
                    </div>
                  ))}
                </div>
              )}
            </fieldset>
          ))}
        </form>

        {/* ── Rechts: Vorschau und Hinweise ──────────────── */}
        <aside className="grid content-start gap-5 lg:sticky lg:top-4 lg:self-start">
          <div className="grid gap-3 rounded-(--radius-md) border border-line p-4">
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-3">Vorschau</p>
            <p className="text-[15px] font-medium leading-snug text-ink">
              {entwurf.kurzbeschreibung?.trim() || (
                <span className="italic text-ink-3">Vom Unternehmen noch nicht angegeben.</span>
              )}
            </p>
            <dl className="grid gap-2 border-t border-line pt-3 text-sm">
              {(["branche", "groesse", "hauptsitz", "arbeitsmodell", "homeoffice", "urlaubstage"] as const).map((k) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-ink-3">{beschriftung(k)}</dt>
                  <dd className="text-right text-ink-2">
                    {entwurf[k]?.trim() || <span className="italic text-ink-3">nicht angegeben</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/*
            Mondays Hinweise sind Regeln über den Text, keine Bewertung
            des Arbeitgebers. „Eure Homeoffice-Regel ist noch nicht
            eindeutig" sagt etwas über einen Satz; „euer Angebot ist
            nicht wettbewerbsfähig" sagt etwas über ein Unternehmen —
            und das steht uns nicht zu.
          */}
          {hinweise.length > 0 && (
            <div className="grid gap-2.5 rounded-(--radius-md) border border-line p-4">
              <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-3">Monday merkt an</p>
              <ul className="grid gap-2">
                {hinweise.map((h) => (
                  <li key={h} className="text-sm leading-relaxed text-ink-2">
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function beschriftung(k: string): string {
  const alle = BEREICHE.flatMap((b: Bereich) => b.felder);
  return alle.find((f) => String(f.name) === k)?.label ?? k;
}

/** Was gerade mit dem Entwurf passiert — in Worten, nicht als Symbol allein. */
function Speicherstand({ stand }: { stand: Stand }) {
  if (stand === "ruhe") return null;
  const text =
    stand === "tippt"
      ? "Nicht gespeicherte Änderungen"
      : stand === "speichert"
        ? "Wird gespeichert …"
        : stand === "gespeichert"
          ? "Gespeichert"
          : "Nicht gespeichert";
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-1.5 text-sm", stand === "fehler" ? "text-critical" : "text-ink-3")}
    >
      {stand === "speichert" && <Loader2 aria-hidden className="size-3.5 animate-spin" strokeWidth={2} />}
      {stand === "gespeichert" && <Check aria-hidden className="size-3.5" strokeWidth={2.2} />}
      {text}
    </span>
  );
}
