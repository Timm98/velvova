import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSession } from "@/lib/auth";
import { ausSupabaseNutzer, verknuepfeIdentitaet } from "@/lib/auth/fremdanmeldung";
import { zielNachLogin } from "@/lib/auth/ziel";
import { ensureWorkflowState, entryRoute, sanitiseRoute } from "@/lib/nina/workflow-state";
import { protokolliereFehler } from "@/lib/auth/fehlertexte";

/**
 * Der Rückweg von Google.
 *
 * ── Was hier passiert ─────────────────────────────────────────
 *
 *   1. Supabase hängt einen `code` an die Adresse. Er wird gegen eine
 *      Supabase-Sitzung getauscht.
 *   2. Aus dem Supabase-Nutzer wird über `auth_accounts` ein
 *      Velvova-Konto — gefunden oder genau einmal angelegt.
 *   3. Unsere eigene Sitzung wird ausgestellt.
 *   4. Die Supabase-Sitzung wird sofort wieder beendet.
 *   5. Weiter dorthin, wo der Besucher hinwollte.
 *
 * ── Warum Schritt 4 ───────────────────────────────────────────
 *
 * Zwei Sitzungen nebeneinander sind eine zu viel. Alles in dieser
 * Anwendung — Zeilenrechte, Abmelden, die Geräteliste in den
 * Einstellungen — hängt an unserer eigenen. Eine zweite, die
 * unbemerkt weiterläuft und sich selbst auffrischt, wäre eine
 * Anmeldung, die das Abmelden nicht beendet.
 *
 * Supabase hat seine Aufgabe erfüllt, sobald es bestätigt hat, wem
 * diese Google-Adresse gehört.
 *
 * ── Warum die Fehler in die Adresse und nicht in eine Seite ───
 *
 * Diese Route hat keine eigene Oberfläche. Wer hier scheitert, gehört
 * zurück auf die Anmeldeseite — mit einem Grund, der dort steht.
 * Sonst landet er auf einer weissen Seite mit einem Statuscode.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const weiter = sanitiseRoute(searchParams.get("weiter"));

  const zurueck = (fehler: string) =>
    NextResponse.redirect(
      new URL(
        `/login?fehler=${fehler}${weiter ? `&weiter=${encodeURIComponent(weiter)}` : ""}`,
        origin,
      ),
    );

  /*
   * Der Nutzer hat im Google-Fenster abgebrochen.
   *
   * Das ist kein Fehler, sondern eine Entscheidung — und sie darf sich
   * nicht wie ein Fehler anfühlen. Deshalb zurück auf die
   * Anmeldeseite, ohne Meldung.
   */
  const fehlerVomAnbieter = searchParams.get("error");
  if (fehlerVomAnbieter) {
    const beschreibung = searchParams.get("error_description") ?? "";
    protokolliereFehler("callback", `${fehlerVomAnbieter}: ${beschreibung}`);

    /* Abbruch im Fenster des Anbieters ist kein Fehler, sondern eine
       Entscheidung — und darf sich nicht wie einer anfühlen. */
    if (fehlerVomAnbieter === "access_denied") {
      return NextResponse.redirect(new URL("/login", origin));
    }

    /*
     * „Provider not enabled" ist der Fall, den man heute trifft, wenn
     * man auf Apple drückt: Der Anbieter ist in Supabase nicht
     * eingerichtet. Das ist etwas anderes als eine gescheiterte
     * Anmeldung — „versuche es noch einmal" wäre hier falsch, denn es
     * ändert nichts.
     */
    return zurueck(
      /provider.*(not enabled|is not supported)|unsupported provider|validation_failed/i.test(
        beschreibung,
      )
        ? "anbieter_aus"
        : "anbieter",
    );
  }

  const code = searchParams.get("code");
  /*
   * ── Warum die Gründe hier auseinandergezogen sind ───────────────
   *
   * Bis eben endeten drei ganz verschiedene Fälle in derselben
   * Meldung: kein Code angekommen, Austausch gescheitert, Konto nicht
   * verknüpfbar. Von aussen — also für den, der es meldet, und für
   * den, der es beheben soll — waren sie nicht zu unterscheiden.
   *
   * Es geht nicht um bessere Sätze für die Person; die bleiben
   * absichtlich zurückhaltend. Es geht darum, dass in der Adresse
   * steht, WELCHE Strecke gerissen ist. Ohne das bleibt nur Raten,
   * und Raten hat hier schon eine Runde gekostet.
   *
   * Nichts davon verrät etwas: Es sind unsere eigenen Abschnitte des
   * Ablaufs, keine Aussagen über Gültigkeit von Zugangsdaten.
   */
  if (!code) return zurueck("anbieter_kein_code");
  if (!isSupabaseConfigured()) return zurueck("anbieter_aus");

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      protokolliereFehler("callback:exchange", error);
      /*
       * Der häufigste Grund an dieser Stelle ist der fehlende
       * PKCE-Prüfwert: Er liegt als Cookie auf dem Host, auf dem die
       * Anmeldung begann. Kommt der Rückweg auf einer anderen Domain
       * an, ist er nicht da — und der Austausch scheitert, ohne dass
       * irgendetwas kaputt wäre.
       */
      return zurueck("anbieter_tausch");
    }

    const { userId } = await verknuepfeIdentitaet(ausSupabaseNutzer(data.user));

    /* Erst unsere Sitzung, dann die fremde beenden — in dieser
       Reihenfolge, sonst steht bei einem Fehler dazwischen jemand
       ganz ohne Anmeldung da. */
    await createSession(userId, request.headers.get("user-agent") ?? undefined, true);
    await supabase.auth.signOut().catch(() => undefined);

    const state = await ensureWorkflowState(userId);
    return NextResponse.redirect(new URL(zielNachLogin(entryRoute(state), weiter), origin));
  } catch (fehler) {
    protokolliereFehler("callback", fehler);
    return zurueck("anbieter_konto");
  }
}
