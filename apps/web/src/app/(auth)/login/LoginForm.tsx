"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { loginAction, type FormState } from "../actions";
import { withRedirectSafety } from "@/lib/formAction";
import {
  Beschriftet,
  FELD,
  Fremdanmeldung,
  KNOPF_HAUPT,
  Meldung,
  Passwortfeld,
} from "../formstuecke";
import { cn } from "@/lib/cn";

/**
 * Anmelden — mit Adresse und Passwort oder mit Google.
 *
 * ── Wer die Sitzung ausstellt ─────────────────────────────────
 *
 * Google läuft über Supabase, Adresse und Passwort über die eigene
 * Anmeldung. Am Ende steht in beiden Fällen dieselbe Sitzung: die aus
 * unserer `sessions`-Tabelle. Supabase ist Ausweisstelle, nicht
 * Türsteher — die Begründung steht in `lib/auth/fremdanmeldung.ts`.
 *
 * ── Was hier NICHT steht ──────────────────────────────────────
 *
 * Die Anmeldung per Telefonnummer. Sie war gebaut — Umschalter,
 * Vorwahlauswahl, sechsstelliger Code, Countdown — und ist auf Wunsch
 * wieder aus der Oberfläche verschwunden.
 *
 * Die Serverseite steht weiterhin: `telefonAnmeldungAbschliessen` in
 * `../actions.ts`, `lib/auth/rufnummer.ts` und der `phone`-Zweig in
 * `lib/auth/fremdanmeldung.ts`. Das ist Absicht: Diese Teile sind ohne
 * Oberfläche wirkungslos, und sie wieder anzuschliessen ist eine
 * Ansicht, kein Neubau.
 *
 * Auch kein Apple-Knopf: Apple ist in Supabase nicht eingerichtet. Ein
 * Anmeldeweg, der nicht funktioniert, ist teurer als ein fehlender —
 * wer ihn drückt, hält danach das ganze Konto für kaputt.
 */
export function LoginForm({
  labels,
  weiter,
  supabaseBereit,
}: {
  labels: Record<
    | "email"
    | "password"
    | "submit"
    | "errorInvalid"
    | "errorEmailInvalid"
    | "forgot",
    string
  >;
  weiter?: string;
  /** Ob die Google-Anmeldung überhaupt zur Verfügung steht. */
  supabaseBereit: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    withRedirectSafety(loginAction),
    {},
  );
  const passwortId = useId();
  const laeuft = pending;

  const errorText =
    state.error === "invalid"
      ? labels.errorInvalid
      : state.error === "email_invalid"
        ? labels.errorEmailInvalid
        : state.error || null;

  return (
    <div className="grid gap-4">
      <Meldung text={errorText} />

      <form action={action} className="grid gap-4">
        {/*
          Wohin es nach dem Anmelden weitergeht, kommt aus der Adresse.

          Ohne dieses Feld verliert jeder, der aus der öffentlichen
          Stellensuche auf eine Anzeige klickt, genau diese Anzeige.
          Geprüft wird der Wert serverseitig — ein Ziel aus der
          Adresszeile ist eine Eingabe wie jede andere.
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
            disabled={laeuft}
            defaultValue={state.values?.email ?? ""}
            aria-invalid={errorText ? true : undefined}
            className={cn(FELD)}
          />
        </Beschriftet>

        <Beschriftet label={labels.password} htmlFor={passwortId}>
          <Passwortfeld
            id={passwortId}
            autoComplete="current-password"
            fehlerhaft={Boolean(errorText)}
            gesperrt={laeuft}
          />
        </Beschriftet>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-ink-2">
            {/*
              Voreingestellt angehakt.

              Wer das Kästchen abwählt, sitzt an einem fremden Rechner —
              das ist der Fall, für den es da ist, und der seltenere. Es
              tut auch wirklich etwas: ohne Häkchen bekommt der Browser
              ein Sitzungscookie, das beim Schliessen verfällt. Siehe
              `createSession`.
            */}
            <input
              type="checkbox"
              name="bleiben"
              defaultChecked
              disabled={laeuft}
              className="size-[18px] cursor-pointer accent-(--primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary)"
            />
            Eingeloggt bleiben
          </label>
          <Link
            href="/forgot-password"
            className="text-sm text-ink-2 underline underline-offset-[3px]"
          >
            {labels.forgot}
          </Link>
        </div>

        <button type="submit" disabled={laeuft} className={KNOPF_HAUPT}>
          {pending ? "Wird geprüft …" : "Einloggen"}
        </button>

        {supabaseBereit && <Fremdanmeldung weiter={weiter} gesperrt={laeuft} />}

        {/*
          Hier stand „Link per E-Mail senden".

          Der Weg gibt es weiterhin — `magicLinkAction` in
          `../actions.ts`, die Tabelle `magic_links`, die Route
          `/magic`. Er ist nur nicht mehr angeboten: Auf einer Karte
          mit Passwortfeld, Google-Knopf und Anmeldelink standen drei
          Wege übereinander, und die Frage „welchen nehme ich" gehört
          nicht auf eine Anmeldeseite.

          Wer sein Passwort nicht weiss, hat „Passwort vergessen"
          direkt über dem Knopf.
        */}
      </form>
    </div>
  );
}
