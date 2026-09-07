"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { lesbarerFehler, protokolliereFehler } from "@/lib/auth/fehlertexte";
import { cn } from "@/lib/cn";

/**
 * Die gemeinsamen Teile von Anmeldung und Registrierung.
 *
 * ── Warum gemeinsam ───────────────────────────────────────────
 *
 * Die beiden Seiten sollen gleich aussehen — gleiche Feldhöhe,
 * gleiche Rundung, gleiche Knöpfe. Zweimal geschrieben laufen sie
 * beim ersten Nachbessern auseinander, und man sieht es erst, wenn
 * man zwischen beiden hin- und herwechselt.
 *
 * Die Registrierung benutzte bisher `Field`, `Input` und `Button` aus
 * dem allgemeinen Baukasten. Der ist für die Anwendung gebaut: Felder
 * mit weicher Fläche und Pillenform. Auf der Anmeldeseite ist das die
 * falsche Sprache — mehrere Pillen untereinander lesen sich als
 * Knöpfe.
 */

/*
 * `rounded-[10px]` statt `--radius-input`.
 *
 * Das Token steht auf `--radius-pill`. Ein eigenes Token für diesen
 * Wert anzulegen wäre zu viel: Er gilt für genau diese zwei Seiten,
 * und ein Token mit zwei Verwendungen ist eine Zahl mit Umweg.
 */
export const FELD = [
  "h-[56px] w-full rounded-[6px] border border-line-3 bg-transparent px-4 text-[15px] text-ink",
  "placeholder:text-ink-3",
  "transition-[border-color,box-shadow] duration-(--duration-fast) ease-(--ease-out)",
  "hover:border-ink-3",
  "focus-visible:border-(--primary) focus-visible:outline-none",
  "focus-visible:shadow-[0_0_0_1px_var(--primary)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "aria-[invalid=true]:border-(--danger) aria-[invalid=true]:shadow-[0_0_0_1px_var(--danger)]",
];

export const KNOPF =
  "inline-flex h-[56px] w-full items-center justify-center gap-3 rounded-[6px] text-[15px] font-medium transition-[background-color,border-color,opacity,transform] duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary) disabled:cursor-not-allowed disabled:opacity-55";

/** Der blaue Hauptknopf. */
export const KNOPF_HAUPT = cn(KNOPF, "bg-accent text-accent-on hover:opacity-90 active:translate-y-px");

/** Der umrandete Nebenknopf — Google, Anmeldelink, Firmenseite. */
export const KNOPF_RAND = cn(
  KNOPF,
  "border border-line-3 bg-transparent text-ink hover:bg-soft active:translate-y-px",
);

/**
 * Eine Fehlermeldung, die auch ohne Farbe ankommt.
 *
 * `role="alert"` liest ein Vorlesegerät sofort vor — ohne das erführe
 * jemand, der die Seite hört, nie, warum nichts passiert ist. Und der
 * Rahmen trägt zusätzlich zur Farbe: Wer Rot nicht von Grau
 * unterscheidet, sieht immer noch einen abgesetzten Kasten.
 */
export function Meldung({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <p
      role="alert"
      aria-live="polite"
      className="rounded-[6px] border border-critical/40 bg-critical-soft px-4 py-3 text-sm text-ink"
    >
      {text}
    </p>
  );
}

/** Eine Beschriftung über einem Feld. */
export function Beschriftet({
  label,
  htmlFor,
  hinweis,
  children,
}: {
  label: string;
  htmlFor: string;
  hinweis?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={htmlFor} className="text-sm text-ink-2">
        {label}
      </label>
      {children}
      {hinweis && (
        <p id={`${htmlFor}-hint`} className="text-xs leading-relaxed text-ink-3">
          {hinweis}
        </p>
      )}
    </div>
  );
}

/**
 * Ein Passwortfeld mit Auge.
 *
 * Der Knopf liegt IM Feld, nicht daneben. Daneben wäre er ein zweites
 * Bedienelement in der Zeile und machte das Feld schmaler — auf dem
 * Telefon spürbar.
 */
export function Passwortfeld({
  id,
  name = "password",
  autoComplete,
  minLength,
  fehlerhaft,
  gesperrt,
  beschriebenVon,
}: {
  id: string;
  name?: string;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  fehlerhaft?: boolean;
  gesperrt?: boolean;
  beschriebenVon?: string;
}) {
  const [sichtbar, setSichtbar] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={sichtbar ? "text" : "password"}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        disabled={gesperrt}
        aria-describedby={beschriebenVon}
        aria-invalid={fehlerhaft ? true : undefined}
        className={cn(FELD, "pr-14")}
      />
      <button
        type="button"
        onClick={() => setSichtbar((v) => !v)}
        /* `aria-pressed` statt zweier Beschriftungen: Ein Vorlesegerät
           sagt damit „Passwort anzeigen, gedrückt" statt bei jedem
           Klick einen anderen Knopfnamen. */
        aria-pressed={sichtbar}
        aria-label="Passwort anzeigen"
        aria-controls={id}
        className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-[8px] text-ink-3 transition-colors hover:bg-soft hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary)"
      >
        {sichtbar ? (
          <EyeOff aria-hidden className="size-5" strokeWidth={1.8} />
        ) : (
          <Eye aria-hidden className="size-5" strokeWidth={1.8} />
        )}
      </button>
    </div>
  );
}

/** „ODER" mit je einer Linie links und rechts. */
export function Trenner() {
  return (
    <div aria-hidden className="flex items-center gap-4">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs uppercase tracking-[0.14em] text-ink-3">oder</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/**
 * Das Google-Zeichen als Pfade, nicht als Bilddatei.
 *
 * Eine Datei wäre ein zusätzlicher Abruf auf der Seite, die für viele
 * die erste überhaupt ist. Und sie dürfte nicht von Google kommen: Das
 * hiesse, jedem Besucher eine Anfrage dorthin zu schicken, bevor er
 * sich für Google entschieden hat.
 */
export function GoogleZeichen() {
  return (
    <svg aria-hidden viewBox="0 0 18 18" className="size-[18px] shrink-0">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

/**
 * Ein Anmeldeknopf für einen Fremdanbieter.
 *
 * ── Warum Google und Apple derselbe Code sind ─────────────────
 *
 * Der Unterschied zwischen beiden ist ein Wort im Aufruf. Alles
 * andere — Doppelklickschutz, Rückleitungsadresse, Fehlerbehandlung,
 * das Verhalten während der Weiterleitung — ist identisch, und zwei
 * Kopien davon laufen beim ersten Nachbessern auseinander.
 *
 * ── Warum Apple angeschlossen ist, obwohl er noch nicht geht ──
 *
 * Apple ist in Supabase noch nicht eingerichtet. Der naheliegende
 * Zwischenstand wäre ein Knopf ohne Funktion gewesen — er sieht aus
 * wie einer und tut nichts. Das ist die schlechteste der drei
 * Möglichkeiten: Wer ihn drückt, erlebt eine Anwendung, die auf einen
 * Klick nicht reagiert, und das liest sich nicht als „noch nicht
 * fertig", sondern als kaputt.
 *
 * Angeschlossen antwortet Supabase mit „Unsupported provider", und
 * daraus wird ein Satz, der sagt, was los ist. Sobald der Anbieter
 * dort eingetragen ist, funktioniert der Knopf ohne eine Zeile
 * Änderung hier: Der Rückweg über `/auth/callback` unterscheidet die
 * Anbieter nicht — `ausSupabaseNutzer` liest ihn aus dem Nutzer, nicht
 * aus dem Knopf.
 */
function AnbieterKnopf({
  anbieter,
  beschriftung,
  zeichen,
  weiter,
  gesperrt,
}: {
  anbieter: "google" | "apple";
  beschriftung: string;
  zeichen: React.ReactNode;
  weiter?: string;
  gesperrt?: boolean;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function los() {
    /* Ein zweiter Klick während der Weiterleitung startet einen
       zweiten Vorgang; der erste läuft dann ins Leere. */
    if (laeuft) return;
    setFehler(null);
    setLaeuft(true);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLaeuft(false);
      setFehler(`Die Anmeldung mit ${beschriftung} ist gerade nicht verfügbar.`);
      return;
    }

    const ziel = new URL("/auth/callback", window.location.origin);
    if (weiter) ziel.searchParams.set("weiter", weiter);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: anbieter,
      options: { redirectTo: ziel.toString() },
    });

    if (error) {
      protokolliereFehler(anbieter, error);
      setFehler(lesbarerFehler(error, beschriftung));
      setLaeuft(false);
    }
    /* Kein Zurücksetzen im Erfolgsfall: Der Browser verlässt die Seite
       gerade. Der Knopf sähe sonst für einen Moment wieder klickbar
       aus. */
  }

  return (
    <>
      <Meldung text={fehler} />
      <button type="button" onClick={() => void los()} disabled={gesperrt || laeuft} className={KNOPF_RAND}>
        {zeichen}
        {laeuft ? "Weiterleitung …" : `Weiter mit ${beschriftung}`}
      </button>
    </>
  );
}

/**
 * „Weiter mit Google".
 *
 * Dieselbe Beschriftung für Anmeldung und Registrierung: Bei Google
 * gibt es zwischen beidem keinen Unterschied — wer noch kein Konto
 * hat, bekommt eines. „Registrieren mit Google" behauptete eine
 * Unterscheidung, die der Vorgang nicht macht.
 */
export function GoogleKnopf({ weiter, gesperrt }: { weiter?: string; gesperrt?: boolean }) {
  return (
    <AnbieterKnopf
      anbieter="google"
      beschriftung="Google"
      zeichen={<GoogleZeichen />}
      weiter={weiter}
      gesperrt={gesperrt}
    />
  );
}

/** Das Apple-Zeichen. Ein Pfad, keine Bilddatei — wie bei Google. */
function AppleZeichen() {
  return (
    <svg aria-hidden viewBox="0 0 16 20" className="size-[18px] shrink-0" fill="currentColor">
      <path d="M13.3 10.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.9-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.9-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.7 2.3 2.9 2.2 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.2.9-1.2 1.3-2.5 1.3-2.5s-2.5-1-2.5-3.5ZM11 3.2c.6-.8 1-1.9.9-3-1 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.6 2.9-1.3Z" />
    </svg>
  );
}

/** „Weiter mit Apple". */
export function AppleKnopf({ weiter, gesperrt }: { weiter?: string; gesperrt?: boolean }) {
  return (
    <AnbieterKnopf
      anbieter="apple"
      beschriftung="Apple"
      zeichen={<AppleZeichen />}
      weiter={weiter}
      gesperrt={gesperrt}
    />
  );
}

/**
 * Die Fremdanbieter als ein Block.
 *
 * ── Warum die beiden Knöpfe enger stehen als der Rest ─────────
 *
 * Das Formular setzt zwanzig Pixel zwischen alles — richtig zwischen
 * Feldern, die verschiedene Dinge abfragen. Zwischen „Weiter mit
 * Google" und „Weiter mit Apple" ist es zu viel: Die beiden sind
 * dieselbe Sache in zwei Ausführungen, und ein grosser Abstand macht
 * daraus zwei Angebote, zwischen denen man abwägen soll.
 *
 * Zehn Pixel lesen sich als Paar. Der Abstand zum Trenner darüber
 * bleibt gross, denn dort verläuft die eigentliche Trennung: eigenes
 * Passwort auf der einen Seite, fremder Ausweis auf der anderen.
 */
export function Fremdanmeldung({ weiter, gesperrt }: { weiter?: string; gesperrt?: boolean }) {
  return (
    <>
      <Trenner />
      <div className="grid gap-2.5">
        <GoogleKnopf weiter={weiter} gesperrt={gesperrt} />
        <AppleKnopf weiter={weiter} gesperrt={gesperrt} />
      </div>
    </>
  );
}
