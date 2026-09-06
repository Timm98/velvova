"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { registerAction, type FormState } from "../actions";
import { withRedirectSafety } from "@/lib/formAction";
import {
  Beschriftet,
  FELD,
  Fremdanmeldung,
  KNOPF_HAUPT,
  KNOPF_RAND,
  Meldung,
  Passwortfeld,
} from "../formstuecke";
import { cn } from "@/lib/cn";

/**
 * Registrieren — dieselbe Karte wie die Anmeldung.
 *
 * ── Warum nicht der allgemeine Baukasten ──────────────────────
 *
 * Hier standen `Field`, `Input` und `Button` aus `components/ui`. Die
 * sind für die Anwendung gebaut: weiche Flächen, Pillenform. Neben
 * der Anmeldeseite sah das aus wie ein zweites Produkt — gleiche
 * Marke, andere Felder, andere Knöpfe, andere Rundung.
 *
 * Beide Seiten benutzen jetzt dieselben Teile aus `../formstuecke`.
 * Wer von der Anmeldung auf „Jetzt registrieren" klickt,
 * sieht dieselbe Fläche mit anderem Inhalt.
 *
 * ── Warum der Google-Knopf hier derselbe ist ──────────────────
 *
 * Bei Google gibt es keinen Unterschied zwischen Anmelden und
 * Registrieren: Wer noch kein Konto hat, bekommt eines. Ein Knopf
 * „Registrieren mit Google" würde eine Unterscheidung behaupten, die
 * der Vorgang nicht macht.
 */
export function RegisterForm({
  labels,
  weiter,
  supabaseBereit,
  fuerUnternehmen,
}: {
  /** Wohin nach der Anmeldung — etwa in den Arbeitgeberbereich. */
  weiter?: string;
  supabaseBereit: boolean;
  /** Blendet den Verweis auf das Firmenkonto aus, wenn man schon dort ist. */
  fuerUnternehmen: boolean;
  labels: Record<
    | "email"
    | "password"
    | "passwordHint"
    | "submit"
    | "errorEmailTaken"
    | "errorPasswordShort"
    | "errorEmailInvalid",
    string
  >;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    withRedirectSafety(registerAction),
    {},
  );
  const passwortId = useId();

  const emailFehler =
    state.error === "email_taken"
      ? labels.errorEmailTaken
      : state.error === "email_invalid"
        ? labels.errorEmailInvalid
        : undefined;
  const passwortFehler = state.error === "password_short" ? labels.errorPasswordShort : undefined;

  return (
    /*
      `gap-3.5` statt `gap-4` wie bei der Anmeldung.

      Diese Karte trägt zwei Elemente mehr — den Rechtssatz und den
      Firmenknopf — und war damit rund 120 Pixel höher als die
      Anmeldung. Auf einem Bildschirm mit 900 Pixeln Höhe stand der
      untere Rand darunter.

      Zwei Pixel je Zwischenraum holen das wieder herein, ohne dass
      der Unterschied zur Anmeldeseite auffällt: Beide Karten wirken
      gleich, nur eine hat mehr Inhalt.
    */
    <div className="grid gap-3.5">
      <Meldung text={emailFehler ?? passwortFehler} />

      <form action={action} className="grid gap-3.5">
        {/*
          Die Absicht reist als verstecktes Feld mit.

          Ohne sie landet jemand, der auf „Firmenkonto erstellen"
          geklickt hat, nach der Anmeldung in der Jobsuche und muss den
          Weg noch einmal suchen. Die Serveraktion prüft den Wert,
          bevor sie ihm folgt.
        */}
        {weiter && <input type="hidden" name="weiter" value={weiter} />}

        <Beschriftet label="E-Mail-Adresse" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            disabled={pending}
            defaultValue={state.values?.email ?? ""}
            aria-invalid={emailFehler ? true : undefined}
            className={cn(FELD)}
          />
        </Beschriftet>

        {/* Ohne Hinweiszeile: Die Regel steht am Feld (`minLength`),
            und der Browser sagt sie an, wenn sie greift. Ein Satz, den
            jeder beim Anlegen mitliest, für eine Auskunft, die nur im
            Fehlerfall zählt. */}
        <Beschriftet label={labels.password} htmlFor={passwortId}>
          <Passwortfeld
            id={passwortId}
            autoComplete="new-password"
            minLength={8}
            fehlerhaft={Boolean(passwortFehler)}
            gesperrt={pending}
          />
        </Beschriftet>

        {/*
          Angehakt voreingestellt — und das ist hier vertretbar.

          Es geht nicht um Werbung, sondern um den Dienst, für den
          jemand sich gerade anmeldet: passende Stellen und Nachrichten
          zu seinen eigenen Bewerbungen. Wer sich auf einem
          Stellenmarkt registriert und dann nichts hört, hält das
          Produkt für kaputt, nicht für zurückhaltend.

          Abwählbar ist es trotzdem hier und nicht erst hinterher in
          den Einstellungen. Ein Kästchen, das man nur nachträglich
          findet, ist keine Wahl, sondern eine Bestätigung.
        */}
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-2">
          <input
            type="checkbox"
            name="benachrichtigen"
            defaultChecked
            disabled={pending}
            className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-(--primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary)"
          />
          <span className="leading-relaxed">
            Benachrichtigt mich per E-Mail über neue passende Stellen und Nachrichten zu meinen
            Bewerbungen.
          </span>
        </label>

        <button type="submit" disabled={pending} className={KNOPF_HAUPT}>
          {pending ? "Wird angelegt …" : labels.submit}
        </button>

        {supabaseBereit && <Fremdanmeldung weiter={weiter} gesperrt={pending} />}
      </form>

      {/*
        Der Weg zum Firmenkonto steht nur auf dieser Seite.

        Auf der Anmeldung wäre er falsch: Wer sich anmeldet, hat sein
        Konto bereits — und weiss, welche Art es ist. Die Frage stellt
        sich beim Anlegen, und nur dort.

        Ohne Symbol: Der Google-Knopf trägt eines, weil dort eine
        fremde Marke im Spiel ist. Dieser Weg führt nach nebenan, ins
        eigene Haus — ein Zeichen davor liesse ihn wie einen dritten
        Anbieter aussehen.
      */}
      {!fuerUnternehmen && (
        <Link
          href="/register?absicht=unternehmen&weiter=%2Fbusiness%2Feinrichten"
          className={KNOPF_RAND}
        >
          Firmenkonto erstellen
        </Link>
      )}
    </div>
  );
}
