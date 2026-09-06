import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Den Bestätigungscode über Supabase Auth verschicken und prüfen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum überhaupt Supabase und nicht der eigene Versand
 * ══════════════════════════════════════════════════════════════
 *
 * Weil dann kein Versandschlüssel in dieser Anwendung liegt. Der
 * Zugang steht im Supabase-Dashboard unter Authentication → SMTP,
 * und diese Anwendung kennt ihn nicht — sie bittet Supabase, eine
 * Mail zu schicken, und erfährt den Code nie.
 *
 * Das ist auch der Grund, warum hier nichts gehasht wird: Es gibt
 * nichts zu hashen. Den Vergleich macht Supabase.
 *
 * ══════════════════════════════════════════════════════════════
 * Was im Supabase-Dashboard eingestellt sein muss
 * ══════════════════════════════════════════════════════════════
 *
 *   1. Authentication → Email Templates → **Confirm signup** muss
 *      `{{ .Token }}` enthalten.
 *
 *      Nicht „Magic Link“ — das war der Irrtum, der einen halben
 *      Nachmittag gekostet hat. Welche Vorlage Supabase nimmt, hängt
 *      davon ab, ob die Adresse dort schon ein bestätigtes Konto hat.
 *      Hat sie keines, ist der Vorgang eine Registrierung — im
 *      Protokoll als `user_confirmation_requested` — und die Vorlage
 *      heisst *Confirm signup*.
 *
 *      Das ist bei uns der Regelfall und nicht die Ausnahme: Jeder
 *      Arbeitgeber, der sich neu anmeldet, ist bei Supabase ein neuer
 *      Nutzer. „Magic Link“ greift erst bei einer zweiten
 *      Bestätigung — den Wert dort trotzdem setzen, sonst bekommt
 *      genau dieser Fall wieder einen Link statt Ziffern.
 *
 *   2. Authentication → Providers → Email → **OTP Length = 6**.
 *      Der Standard ist nicht überall sechs. Kommen acht Ziffern an,
 *      weist `codePruefen` sie ab, weil das Formular sechs Felder
 *      hat: Die Mail ist da und der Code trotzdem unbrauchbar.
 *
 *   3. Authentication → Providers → Email → **OTP Expiration**.
 *      Sie bestimmt die Gültigkeit, nicht mehr `GUELTIG_MINUTEN`.
 *      Die Bestätigungsseite nennt zwanzig Minuten; steht dort etwas
 *      anderes, sagt unsere Seite die Unwahrheit.
 *
 *   4. Authentication → SMTP Settings: ein eigener Versanddienst.
 *      Der eingebaute schickt nur an Teammitglieder der eigenen
 *      Organisation und höchstens zwei Nachrichten je Stunde — für
 *      einen echten Arbeitgeber kommt damit nichts an.
 *
 * Alles vier ist Konfiguration und steht deshalb hier im Kommentar
 * und nicht im Code: Wer den Fehler sucht, sucht ihn hier. Den
 * Wortlaut eines gescheiterten Versands liefern die Auth-Protokolle
 * des Projekts, auffindbar über die `request_id` aus der 500er-Antwort.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum unsere Sperren trotzdem bleiben
 * ══════════════════════════════════════════════════════════════
 *
 * Supabase begrenzt seine eigenen Anfragen. Unsere Grenzen schützen
 * unseren Endpunkt — die fünf Versuche, die Viertelstunde Sperre, die
 * Codes je Stunde und je IP. Sie stehen weiter in `bestaetigung.ts`
 * und laufen um diesen Aufruf herum.
 */

export type SupabaseVersand =
  | { ok: true }
  | { ok: false; grund: "nicht_eingerichtet" | "abgelehnt" | "gedrosselt" | "fehler"; text: string };

/** Ist der Supabase-Weg überhaupt vorhanden? */
export function supabaseVersandMoeglich(): boolean {
  return isSupabaseConfigured();
}

/**
 * Fehlermeldungen des Anbieters übersetzen.
 *
 * Der Wortlaut von Supabase steht nie in der Antwort an den Browser.
 * „Email address not authorized“ ist eine Auskunft über unsere
 * Konfiguration, nicht über die eingegebene Adresse — sie dort
 * anzuzeigen führt jemanden dazu, seine eigene Adresse für falsch zu
 * halten.
 */
function uebersetze(roh: string): SupabaseVersand {
  const t = roh.toLowerCase();

  if (t.includes("not authorized")) {
    return {
      ok: false,
      grund: "abgelehnt",
      text: "Der Mailversand ist noch nicht vollständig eingerichtet. Wir kümmern uns darum.",
    };
  }
  if (t.includes("rate limit") || t.includes("too many") || t.includes("over_email_send_rate")) {
    return {
      ok: false,
      grund: "gedrosselt",
      text: "Gerade wurden zu viele Codes angefordert. Versuch es in ein paar Minuten noch einmal.",
    };
  }
  return {
    ok: false,
    grund: "fehler",
    text: "Der Code konnte nicht verschickt werden. Versuch es gleich noch einmal.",
  };
}

/**
 * Supabase bitten, einen Code an die Adresse zu schicken.
 */
export async function supabaseCodeSenden(email: string): Promise<SupabaseVersand> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      grund: "nicht_eingerichtet",
      text: "Der Mailversand ist nicht eingerichtet.",
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        /*
         * Ein Supabase-Konto darf dabei entstehen.
         *
         * Ohne das lehnt Supabase jede Adresse ab, die es noch nicht
         * kennt — und das sind genau die, die zu bestätigen sind. Das
         * so entstehende Konto ist ein Nebenprodukt: Wir melden uns
         * damit nicht an, wir verknüpfen es nicht, und die Sitzung
         * wird nach der Prüfung wieder beendet.
         */
        shouldCreateUser: true,
        /*
         * Kein `emailRedirectTo`.
         *
         * Wir wollen sechs Ziffern, keinen Link. Eine Zieladresse hier
         * macht aus der Mail eine Einladung zum Klicken — und wer
         * klickt, landet in einer Supabase-Sitzung statt in unserer
         * Bestätigung.
         */
      },
    });

    if (error) {
      /* Der Wortlaut ins Protokoll, nicht in die Antwort. */
      console.warn("[bestaetigung] supabase otp:", error.message);
      return uebersetze(error.message);
    }
    return { ok: true };
  } catch (fehler) {
    console.warn("[bestaetigung] supabase otp:", fehler instanceof Error ? fehler.message : fehler);
    return { ok: false, grund: "fehler", text: "Der Code konnte nicht verschickt werden." };
  }
}

/**
 * Den eingegebenen Code von Supabase prüfen lassen.
 *
 * Gibt nur wahr oder falsch zurück. Warum er falsch war — abgelaufen,
 * vertippt, schon verbraucht — sagt diese Funktion nicht: Die Antwort
 * an den Browser formt `bestaetigung.ts`, und die zählt dabei unsere
 * eigenen Versuche mit.
 */
export async function supabaseCodePruefen(email: string, code: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      /* `email`, nicht `magiclink`. Der Typ muss zu dem passen, was
         `signInWithOtp` erzeugt hat, sonst ist jeder Code falsch. */
      type: "email",
    });

    if (error || !data.user) return false;

    /*
     * Die Supabase-Sitzung sofort wieder beenden.
     *
     * Sie ist hier nur der Beleg, dass die Mail angekommen ist. Bliebe
     * sie stehen, hätte der Browser zwei Sitzungen nebeneinander — und
     * die zweite überlebte jedes Abmelden bei uns. Dieselbe Regel wie
     * beim Telefonweg in `(auth)/actions.ts`.
     */
    await supabase.auth.signOut().catch(() => undefined);
    return true;
  } catch (fehler) {
    console.warn("[bestaetigung] supabase verify:", fehler instanceof Error ? fehler.message : fehler);
    return false;
  }
}
