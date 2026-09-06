/**
 * Aus einem Supabase-Fehler wird ein Satz, den man lesen kann.
 *
 * ── Warum übersetzt und nicht durchgereicht ───────────────────
 *
 * Supabase antwortet mit „Invalid login credentials", „Token has
 * expired or is invalid", „AuthApiError: 400". Das sind Meldungen für
 * die Person, die den Fehler behebt — nicht für die, die ihn erlebt.
 * Wer sich nicht anmelden kann, braucht einen Hinweis, was er tun
 * soll, und nicht die Innenansicht eines Systems.
 *
 * ── Warum nicht auf den Statuscode geprüft wird ───────────────
 *
 * Supabase schickt für „falsches Passwort" und „Konto gesperrt"
 * denselben Code. Der Code ist also nicht die Auskunft, der Text ist
 * es — auch wenn das an Textmuster gebunden ist, die sich ändern
 * können. Deshalb der Auffangsatz am Ende: Er ist verständlich, auch
 * wenn ein Muster nicht mehr passt.
 *
 * Der ursprüngliche Text geht dabei nicht verloren, er wird nur nicht
 * gezeigt — siehe `protokolliereFehler`.
 */

const MUSTER: { treffer: RegExp; text: string }[] = [
  {
    treffer: /invalid login credentials|invalid_grant/i,
    text: "E-Mail oder Passwort ist nicht korrekt.",
  },
  {
    treffer: /email not confirmed/i,
    text: "Diese E-Mail-Adresse ist noch nicht bestätigt. Sieh bitte in deinem Postfach nach.",
  },
  {
    treffer: /token has expired|otp.*expired|expired/i,
    text: "Der Code ist abgelaufen. Bitte fordere einen neuen an.",
  },
  {
    treffer: /invalid.*(otp|token|code)|token.*invalid/i,
    text: "Der eingegebene Code ist nicht korrekt.",
  },
  {
    treffer: /(sms|phone).*(not|invalid|failed)|invalid phone/i,
    text: "Diese Telefonnummer konnte nicht verwendet werden. Prüfe bitte Vorwahl und Nummer.",
  },
  {
    treffer: /rate limit|too many requests|over_.*_rate_limit|429/i,
    text: "Zu viele Versuche in kurzer Zeit. Warte bitte einen Moment und versuche es noch einmal.",
  },
  {
    treffer: /user already registered|already exists/i,
    text: "Zu dieser Kennung gibt es bereits ein Konto. Melde dich damit an oder setze dein Passwort zurück.",
  },
  {
    /*
     * „Unsupported provider" heisst: In Supabase ist dieser Anbieter
     * nicht eingerichtet. Das ist kein Fehler des Nutzers und auch
     * kein Aussetzer — es geht heute schlicht nicht, und das ist die
     * einzige Auskunft, die ihm weiterhilft. „Versuche es noch
     * einmal" wäre hier falsch: Es ändert nichts.
     */
    treffer: /unsupported provider|provider is not enabled|validation_failed/i,
    text: "ANBIETER ist als Anmeldeweg noch nicht eingerichtet.",
  },
  {
    treffer: /oauth|provider|access_denied|callback/i,
    text: "Die Anmeldung mit ANBIETER konnte nicht abgeschlossen werden. Bitte versuche es noch einmal.",
  },
  {
    treffer: /network|fetch failed|timeout/i,
    text: "Die Verbindung hat nicht geklappt. Prüfe bitte deine Internetverbindung.",
  },
];

/**
 * @param anbieter Für die Anmeldewege von Fremdanbietern — „Google",
 *   „Apple". Steht er nicht dabei, bleibt es beim allgemeinen Satz;
 *   „Die Anmeldung mit dem Anbieter" liest sich schlechter als „Die
 *   Anmeldung".
 */
export function lesbarerFehler(fehler: unknown, anbieter?: string): string {
  const roh =
    typeof fehler === "string"
      ? fehler
      : fehler instanceof Error
        ? fehler.message
        : typeof fehler === "object" && fehler && "message" in fehler
          ? String((fehler as { message: unknown }).message)
          : "";

  for (const m of MUSTER) {
    if (!m.treffer.test(roh)) continue;
    if (!m.text.includes("ANBIETER")) return m.text;
    return anbieter
      ? m.text.replace("ANBIETER", anbieter)
      : m.text.replace("ANBIETER ist", "Dieser Anmeldeweg ist").replace("mit ANBIETER ", "");
  }

  return "Das hat gerade nicht geklappt. Bitte versuche es noch einmal.";
}

/**
 * Den technischen Fehler behalten, ohne ihn zu zeigen.
 *
 * In der Entwicklung landet er in der Konsole — ohne ihn sucht man
 * eine falsche Rufnummernformatierung stundenlang. In der Produktion
 * nicht: Anmeldefehler enthalten regelmässig die Kennung, mit der es
 * versucht wurde, und die gehört nicht in ein Protokoll, das breiter
 * gelesen wird als die Datenbank.
 */
export function protokolliereFehler(stelle: string, fehler: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  console.warn(`[auth:${stelle}]`, fehler);
}
