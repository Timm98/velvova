"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { SterneWahl } from "./Sterne";
import { bewertungAbgeben } from "@/lib/reviews/aktionen";
import { MIN_TEXT, type Fehler } from "@/lib/reviews/pruefung";

/**
 * Eine Bewertung schreiben.
 *
 * Das Formular macht drei Dinge anders als die üblichen:
 *
 *   **Fehler stehen am Feld, nicht oben.** Eine Sammelmeldung „Bitte
 *   prüfen Sie Ihre Eingaben" zwingt die Person, selbst zu suchen. Jeder
 *   Fehler steht dort, wo er entstanden ist, und ist mit dem Feld
 *   verknüpft, damit ein Vorlesegerät ihn beim Hineinspringen mitliest.
 *
 *   **Der Absendeknopf sperrt sich selbst.** Nicht, weil doppeltes
 *   Klicken schlimm wäre, sondern weil eine zweite Bewertung derselben
 *   Person die Moderation beschäftigt und danach jemand entscheiden
 *   muss, welche gilt.
 *
 *   **Ein Honigtopf statt eines Captchas.** Ein unsichtbares Feld, das
 *   nur Automaten ausfüllen. Ein Captcha kostet jeden ehrlichen
 *   Menschen Zeit und scheitert am häufigsten bei denen, die ohnehin
 *   Mühe haben.
 */

export function BewertungFormular({
  onFertig,
  className,
}: {
  onFertig?: () => void;
  className?: string;
}) {
  /*
   * Alle Felder werden im Zustand gehalten — auch die, die es nicht
   * müssten.
   *
   * React 19 setzt ein `<form action={…}>` nach jedem Durchlauf der
   * Aktion zurück, auch wenn sie fehlschlägt. Bei ungesteuerten Feldern
   * heisst das: wer die Zustimmung übersieht, bekommt eine Fehlermeldung
   * UND ein leeres Formular. Der ganze Text ist weg.
   *
   * Gefunden hat das eine Prüfung, die nach dem ersten Fehlversuch die
   * Feldinhalte gelesen hat — im Browser sieht man es nur, wenn man
   * genau diesen Weg geht, und dann ärgert man sich sehr.
   */
  const [werte, setWerte] = useState({
    displayName: "",
    roleOrCompany: "",
    headline: "",
    body: "",
    contactEmail: "",
  });
  const [zustimmung, setZustimmung] = useState({ publish: false, privacy: false });
  const [sterne, setSterne] = useState(0);
  const [fehler, setFehler] = useState<Fehler[]>([]);
  const [danke, setDanke] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  const setze = (feld: keyof typeof werte) => (e: { target: { value: string } }) =>
    setWerte((w) => ({ ...w, [feld]: e.target.value }));

  const fehlerZu = (feld: string) => fehler.find((f) => f.feld === feld)?.text;

  if (danke) {
    return (
      <div className={cn("grid gap-4 rounded-(--radius-surface) bg-positive-soft p-8", className)}>
        <span className="grid size-12 place-items-center rounded-full bg-surface">
          <Check aria-hidden className="size-6 text-positive" strokeWidth={2.2} />
        </span>
        <p className="max-w-[var(--measure)] text-lg leading-relaxed text-ink">{danke}</p>
        {onFertig && (
          <button
            type="button"
            onClick={onFertig}
            className="justify-self-start text-sm text-accent-text underline underline-offset-[3px]"
          >
            Schliessen
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      ref={form}
      className={cn("grid gap-5", className)}
      action={(daten) =>
        startTransition(async () => {
          setFehler([]);
          const r = await bewertungAbgeben(daten);
          if (r.ok) {
            setDanke(r.danke ?? "Vielen Dank.");
            setWerte({ displayName: "", roleOrCompany: "", headline: "", body: "", contactEmail: "" });
            setZustimmung({ publish: false, privacy: false });
            setSterne(0);
          } else {
            setFehler(r.fehler ?? []);
            /*
             * Zum ersten Fehler springen.
             *
             * Ohne das steht die Meldung womöglich ausserhalb des
             * Bildes, und für die Person ist der Knopf einfach wirkungslos.
             */
            const erstes = r.fehler?.[0]?.feld;
            if (erstes) {
              form.current
                ?.querySelector<HTMLElement>(`[name="${erstes}"], #feld-${erstes}`)
                ?.focus();
            }
          }
        })
      }
    >
      {/*
       * Der Honigtopf.
       *
       * `sr-only` statt `display:none`: manche Automaten überspringen
       * versteckte Felder, aber fast keiner überspringt solche, die für
       * Vorlesegeräte da sind. `tabIndex={-1}` und `autoComplete="off"`
       * halten Menschen davon fern.
       */}
      <div aria-hidden className="sr-only">
        <label htmlFor="website">Website (bitte frei lassen)</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Feld label="Dein Name" id="displayName" fehler={fehlerZu("displayName")} pflicht>
        <input
          id="feld-displayName"
          name="displayName"
          required
          maxLength={80}
          autoComplete="name"
          value={werte.displayName}
          onChange={setze("displayName")}
          className={eingabeKlasse(!!fehlerZu("displayName"))}
        />
      </Feld>

      <Feld
        label="Unternehmen oder Position"
        id="roleOrCompany"
        hinweis="Freiwillig."
        fehler={fehlerZu("roleOrCompany")}
      >
        <input
          id="feld-roleOrCompany"
          name="roleOrCompany"
          maxLength={120}
          value={werte.roleOrCompany}
          onChange={setze("roleOrCompany")}
          className={eingabeKlasse(!!fehlerZu("roleOrCompany"))}
        />
      </Feld>

      <div className="grid gap-1.5">
        <span className="text-sm font-medium">
          Wie bewertest du Velvova? <span className="text-critical">*</span>
        </span>
        <SterneWahl wert={sterne} onChange={setSterne} fehler={!!fehlerZu("rating")} />
        {fehlerZu("rating") && <Fehlerzeile id="rating" text={fehlerZu("rating")!} />}
      </div>

      <Feld label="Überschrift" id="headline" hinweis="Freiwillig." fehler={fehlerZu("headline")}>
        <input
          id="feld-headline"
          name="headline"
          maxLength={120}
          placeholder="In einem Satz"
          value={werte.headline}
          onChange={setze("headline")}
          className={eingabeKlasse(!!fehlerZu("headline"))}
        />
      </Feld>

      <Feld
        label="Deine Bewertung"
        id="body"
        pflicht
        hinweis={`Mindestens ${MIN_TEXT} Zeichen — aktuell ${werte.body.trim().length}.`}
        fehler={fehlerZu("body")}
      >
        <textarea
          id="feld-body"
          name="body"
          required
          rows={6}
          maxLength={5000}
          value={werte.body}
          onChange={setze("body")}
          placeholder="Was hat dir geholfen? Was hat gefehlt?"
          className={cn(eingabeKlasse(!!fehlerZu("body")), "resize-y py-3 leading-relaxed")}
        />
      </Feld>

      <Feld
        label="E-Mail für Rückfragen"
        id="contactEmail"
        hinweis="Freiwillig. Wird nie veröffentlicht."
        fehler={fehlerZu("contactEmail")}
      >
        <input
          id="feld-contactEmail"
          name="contactEmail"
          type="email"
          autoComplete="email"
          value={werte.contactEmail}
          onChange={setze("contactEmail")}
          className={eingabeKlasse(!!fehlerZu("contactEmail"))}
        />
      </Feld>

      <div className="grid gap-3 rounded-(--radius-md) bg-inset px-4 py-3.5">
        <Zustimmung
          name="consentPublish"
          fehler={fehlerZu("consentPublish")}
          checked={zustimmung.publish}
          onChange={(v) => setZustimmung((z) => ({ ...z, publish: v }))}
          text="Meine Bewertung darf mit meinem Namen auf der Website veröffentlicht werden."
        />
        <Zustimmung
          name="consentPrivacy"
          fehler={fehlerZu("consentPrivacy")}
          checked={zustimmung.privacy}
          onChange={(v) => setZustimmung((z) => ({ ...z, privacy: v }))}
          text={
            <>
              Ich habe die{" "}
              <Link href="/privacy" className="text-accent-text underline underline-offset-[3px]">
                Datenschutzerklärung
              </Link>{" "}
              gelesen.
            </>
          }
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center justify-center gap-2 justify-self-start rounded-(--radius-pill) bg-accent px-7 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover disabled:opacity-70"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            Wird gesendet
          </>
        ) : (
          "Bewertung absenden"
        )}
      </button>

      <p className="max-w-[var(--measure)] text-xs leading-relaxed text-ink-3">
        Jede Bewertung wird vor der Veröffentlichung von einem Menschen gelesen. Bis dahin ist sie
        nirgends sichtbar.
      </p>
    </form>
  );
}

function eingabeKlasse(fehler: boolean): string {
  return cn(
    "min-h-11 w-full rounded-(--radius-sm) border bg-surface px-3.5 text-[15px] text-ink outline-none transition-colors",
    "placeholder:text-ink-3 focus:ring-2 focus:ring-accent/25",
    fehler ? "border-critical focus:border-critical" : "border-line focus:border-accent",
  );
}

function Feld({
  label,
  id,
  hinweis,
  fehler,
  pflicht,
  children,
}: {
  label: string;
  id: string;
  hinweis?: string;
  fehler?: string;
  pflicht?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={`feld-${id}`} className="text-sm font-medium">
        {label}
        {pflicht && <span className="text-critical"> *</span>}
      </label>
      {children}
      {fehler ? (
        <Fehlerzeile id={id} text={fehler} />
      ) : (
        hinweis && <p className="text-xs text-ink-3">{hinweis}</p>
      )}
    </div>
  );
}

function Fehlerzeile({ id, text }: { id: string; text: string }) {
  return (
    <p id={`fehler-${id}`} role="alert" className="text-xs leading-relaxed text-critical">
      {text}
    </p>
  );
}

function Zustimmung({
  name,
  text,
  fehler,
  checked,
  onChange,
}: {
  name: string;
  text: React.ReactNode;
  fehler?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="grid gap-1">
      <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
        />
        <span className="text-ink-2">{text}</span>
      </label>
      {fehler && (
        <p role="alert" className="pl-6 text-xs text-critical">
          {fehler}
        </p>
      )}
    </div>
  );
}

/** Der Auslöser: ein Knopf, der das Formular in einem Blatt öffnet. */
export function BewertungAbgebenKnopf({ className }: { className?: string }) {
  const [offen, setOffen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        className={cn(
          "inline-flex min-h-11 items-center justify-center rounded-(--radius-pill) border border-line px-5 text-sm font-medium text-ink transition-colors hover:bg-soft",
          className,
        )}
      >
        Bewertung abgeben
      </button>

      {offen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bewertung abgeben"
          className="fixed inset-0 z-50 grid place-items-end overflow-y-auto sm:place-items-center"
        >
          <button
            type="button"
            aria-label="Schliessen"
            onClick={() => setOffen(false)}
            className="fixed inset-0 bg-ink/25 backdrop-blur-[2px]"
          />
          <div className="relative m-0 w-full max-w-[38rem] rounded-t-(--radius-surface) bg-surface p-6 shadow-2xl sm:m-6 sm:rounded-(--radius-surface) sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <h2 className="font-display text-2xl font-normal tracking-[-0.02em]">
                Deine Bewertung
              </h2>
              <button
                type="button"
                onClick={() => setOffen(false)}
                aria-label="Schliessen"
                className="grid size-10 shrink-0 place-items-center rounded-(--radius-pill) text-ink-2 hover:bg-soft hover:text-ink"
              >
                <X className="size-5" strokeWidth={1.8} />
              </button>
            </div>
            <BewertungFormular onFertig={() => setOffen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
