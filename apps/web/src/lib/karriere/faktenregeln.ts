/**
 * Wann ein neuer Fakt einen bestehenden ersetzen darf.
 *
 * ══════════════════════════════════════════════════════════════
 * Die eine Regel, um die es hier geht
 * ══════════════════════════════════════════════════════════════
 *
 * Jemand hat bestätigt: „Mindestens 70.000, das ist eine Bedingung."
 * Wochen später sagt er im Gespräch: „60 wären auch okay, wenn die
 * Stelle perfekt ist."
 *
 * Ein System, das den zweiten Satz für eine Korrektur hält,
 * überschreibt die Bedingung — und beim nächsten Vorschlag steht eine
 * Stelle mit 62.000 oben, obwohl der Mensch nie gesagt hat, dass die
 * Regel nicht mehr gilt. Er hat über einen Ausnahmefall gesprochen.
 *
 * Ein System, das den zweiten Satz ignoriert, ist genauso falsch:
 * Vielleicht HAT er seine Meinung geändert.
 *
 * Die Auflösung ist keine der beiden. Es ist eine dritte Möglichkeit:
 * beide behalten und fragen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das eine reine Funktion ist
 * ══════════════════════════════════════════════════════════════
 *
 * Hier entscheidet sich, ob eine Aussage über einen Menschen
 * bestehen bleibt. Das ist die Art Logik, die man prüfen können muss,
 * ohne eine Datenbank zu starten — sonst wird sie nie geprüft.
 */

export type Faktquelle =
  | "nutzer"
  | "gespraech"
  | "dokument"
  | "feedback"
  | "nina_ableitung";

export type Fakt = {
  schluessel: string;
  wert: unknown;
  quelle: Faktquelle;
  /** 0 bis 100. */
  konfidenz: number;
  bestaetigt: boolean;
};

export type Entscheidung =
  /** Übernehmen — es gab nichts oder das Neue ist belastbarer. */
  | { art: "ersetzen"; grund: string }
  /** Beides behalten, den Menschen fragen. */
  | { art: "nachfragen"; grund: string; frage: string }
  /** Verwerfen — das Bestehende ist belastbarer. */
  | { art: "verwerfen"; grund: string };

/** Quellen, bei denen ein Mensch selbst gesprochen hat. */
const VOM_MENSCHEN: Faktquelle[] = ["nutzer", "gespraech", "dokument"];

/**
 * Ab wann eine Ableitung überhaupt zur Diskussion steht.
 *
 * Unter 60 wird gar nicht erst gefragt. Eine Nachfrage zu jeder
 * schwachen Vermutung macht aus dem Gespräch einen Fragebogen — und
 * wer dreimal „nein, so meinte ich das nicht" sagen musste,
 * beantwortet die vierte Frage nicht mehr.
 */
const SCHWELLE_NACHFRAGE = 60;

export function entscheide(alt: Fakt | null, neu: Fakt): Entscheidung {
  /* Nichts da — nichts zu schützen. */
  if (!alt) {
    return { art: "ersetzen", grund: "Es gab noch keinen Wert." };
  }

  /* Derselbe Wert. Kein Konflikt, aber vielleicht eine bessere
     Herkunft: Wer eine Ableitung nachträglich bestätigt, soll sie
     bestätigt sehen. */
  if (JSON.stringify(alt.wert) === JSON.stringify(neu.wert)) {
    return neu.bestaetigt && !alt.bestaetigt
      ? { art: "ersetzen", grund: "Derselbe Wert, jetzt bestätigt." }
      : { art: "verwerfen", grund: "Der Wert steht bereits so da." };
  }

  /*
   * Der Mensch selbst, ausdrücklich — das gilt.
   *
   * `bestaetigt` heisst hier nicht „ein Modell war sich sicher",
   * sondern „jemand hat es gesagt und es stand ihm vor Augen".
   */
  if (neu.bestaetigt) {
    return { art: "ersetzen", grund: "Ausdrücklich geändert." };
  }

  /*
   * Das Bestehende ist bestätigt, das Neue nicht. Der Kernfall.
   *
   * Nichts wird überschrieben. Ist die neue Aussage belastbar genug,
   * entsteht daneben ein Vorschlag und eine Frage; sonst fällt sie
   * weg.
   */
  if (alt.bestaetigt) {
    return neu.konfidenz >= SCHWELLE_NACHFRAGE
      ? {
          art: "nachfragen",
          grund: "Bestätigter Wert bleibt, bis der Mensch ihn selbst ändert.",
          frage: frageZu(alt, neu),
        }
      : {
          art: "verwerfen",
          grund: "Zu unsicher, um einen bestätigten Wert infrage zu stellen.",
        };
  }

  /*
   * Beide unbestätigt. Jetzt zählt, wer näher am Menschen steht.
   *
   * Ein Satz aus dem Gespräch wiegt mehr als ein Schluss aus
   * Ablehnungen — auch wenn der Schluss die höhere Zahl trägt. Die
   * Konfidenz eines Modells misst seine eigene Sicherheit, nicht die
   * Nähe zur Wahrheit.
   */
  const altVomMenschen = VOM_MENSCHEN.includes(alt.quelle);
  const neuVomMenschen = VOM_MENSCHEN.includes(neu.quelle);

  if (neuVomMenschen && !altVomMenschen) {
    return { art: "ersetzen", grund: "Gesagt wiegt mehr als geschlossen." };
  }
  if (!neuVomMenschen && altVomMenschen) {
    return { art: "verwerfen", grund: "Eine Ableitung ersetzt keine Aussage." };
  }

  /* Gleiche Nähe — dann entscheidet die Konfidenz, und bei Gleichstand
     das Neuere: Es ist die jüngere Auskunft über denselben Menschen. */
  return neu.konfidenz >= alt.konfidenz
    ? { art: "ersetzen", grund: "Neuer und mindestens so belastbar." }
    : { art: "verwerfen", grund: "Weniger belastbar als das Bestehende." };
}

/**
 * Die Frage, die Monday stellt.
 *
 * Sie nennt beide Werte. „Hat sich etwas geändert?" ohne die Zahlen
 * zwingt den Menschen, sich zu erinnern, was er wann gesagt hat —
 * und das ist genau die Arbeit, die ihm das Gedächtnis abnehmen soll.
 */
function frageZu(alt: Fakt, neu: Fakt): string {
  const a = alsText(alt.wert);
  const n = alsText(neu.wert);
  return `Du hattest „${a}" bestätigt, gerade klang es nach „${n}". Soll ich das ändern?`;
}

function alsText(w: unknown): string {
  if (w === null || w === undefined) return "—";
  if (typeof w === "number") return w.toLocaleString("de-DE");
  if (typeof w === "string") return w;
  if (typeof w === "boolean") return w ? "ja" : "nein";
  if (Array.isArray(w)) return w.map(alsText).join(", ");
  return JSON.stringify(w);
}
