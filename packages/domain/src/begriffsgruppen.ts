/**
 * ══════════════════════════════════════════════════════════════════
 * Welche Berufsgruppen zu einem Suchbegriff gehören
 * ══════════════════════════════════════════════════════════════════
 *
 * Sieben Menschen suchen „Lager, Logistik". Elf von sechzehn Treffern
 * kamen nicht über den Titel herein, sondern über den Fliesstext —
 * darunter „Sachbearbeiter Debitorenbuchhaltung", „Kaufmännischer
 * Sachbearbeiter" und „Verkäufer auf Vollzeitbasis". In jeder dieser
 * Anzeigen steht irgendwo „unser Lager" oder „Logistikzentrum".
 *
 * ── Warum nicht einfach nur im Titel suchen ─────────────────────
 *
 * Weil „Versandmitarbeiter" ein echter Logistikjob ist, dessen Titel
 * weder „Lager" noch „Logistik" enthält. Wer die Suche auf den Titel
 * verengt, verliert genau die Stellen, die jemand sonst nie findet —
 * und das ist der Zweck des Produkts.
 *
 * ── Der Diskriminator, der schon dasteht ────────────────────────
 *
 * Die amtliche Berufskennung. 928.242 deutsche Anzeigen tragen sie.
 * „Sachbearbeiter Debitorenbuchhaltung" trägt 72 (kaufmännisch),
 * „Versandmitarbeiter" trägt 51 (Verkehr und Logistik).
 *
 * ── Warum niemand eine Zuordnungstabelle pflegen muss ───────────
 *
 * Welche Gruppen zu „lager" gehören, lässt sich ablesen: Man schaut,
 * welche Berufskennungen die Anzeigen tragen, in deren TITEL das Wort
 * steht. Der Titel ist die Aussage des Arbeitgebers über die Rolle;
 * der Fliesstext ist alles, was sonst noch dazugehört.
 *
 * Das ist eine Messung, keine Tabelle — und sie altert mit dem
 * Bestand, statt zu veralten.
 */

/** Darunter sagt die Verteilung nichts. Dreissig Titeltreffer sind wenig. */
export const MINDESTSTICHPROBE = 30;

/**
 * Ab welchem Anteil eine Gruppe den Begriff trägt.
 *
 * Zehn Prozent, weil ein Begriff oft in zwei oder drei Gruppen
 * vorkommt: „Lager" trägt Verkehr und Logistik, aber auch
 * Lagerwirtschaft im Handel. Eine Grenze, die nur die grösste Gruppe
 * durchlässt, würde die zweite fälschlich abwerten.
 */
export const TRAGENDER_ANTEIL = 0.1;

export interface Gruppenzaehlung {
  /** Die ersten zwei Stellen der KldB — die Berufshauptgruppe. */
  gruppe: string;
  /** Anzeigen mit dem Begriff im Titel. */
  titeltreffer: number;
}

export interface Gruppenlage {
  /** Die Gruppen, die den Begriff tragen. Leer heisst: keine Aussage. */
  tragend: readonly string[];
  /** Wie viele Titeltreffer die Aussage stützen. */
  stichprobe: number;
  /** Ob die Stichprobe überhaupt reicht. */
  belastbar: boolean;
}

/**
 * Welche Gruppen einen Begriff tragen.
 *
 * Gibt bei zu kleiner Stichprobe eine leere Liste zurück und
 * `belastbar: false`. Der Unterschied ist wichtig: „keine Gruppe
 * trägt diesen Begriff" und „wir wissen es nicht" führen zu
 * verschiedenen Entscheidungen.
 */
export function gruppenlage(zaehlungen: readonly Gruppenzaehlung[]): Gruppenlage {
  const stichprobe = zaehlungen.reduce((a, z) => a + z.titeltreffer, 0);
  if (stichprobe < MINDESTSTICHPROBE) {
    return { tragend: [], stichprobe, belastbar: false };
  }
  const tragend = zaehlungen
    .filter((z) => z.titeltreffer / stichprobe >= TRAGENDER_ANTEIL)
    .sort((a, b) => b.titeltreffer - a.titeltreffer)
    .map((z) => z.gruppe);
  return { tragend, stichprobe, belastbar: true };
}

/**
 * Passt diese Anzeige zum Suchbegriff?
 *
 * ── Warum drei Antworten und nicht zwei ─────────────────────────
 *
 *   true   Die Berufskennung der Anzeige gehört zu den Gruppen, die
 *          der Begriff trägt.
 *   false  Sie gehört nicht dazu. Das ist ein Hinweis, kein
 *          Ausschluss: Berufskennungen sind zugeordnet, nicht
 *          erklärt, und eine falsche Zuordnung darf niemandem eine
 *          Stelle wegnehmen.
 *   null   Nicht entscheidbar — die Anzeige trägt keine Kennung, oder
 *          die Stichprobe reicht nicht.
 *
 * `null` ist der wichtigste der drei Werte. Von 1,24 Millionen
 * deutschen Anzeigen tragen 928.242 eine Kennung; die übrigen dürfen
 * nicht dadurch benachteiligt werden, dass jemand sie nicht
 * zugeordnet hat.
 */
export function passtZurGruppe(
  kldb: string | null,
  lage: Gruppenlage,
): boolean | null {
  if (!lage.belastbar || lage.tragend.length === 0) return null;
  if (kldb === null || kldb.length < 2) return null;
  return lage.tragend.includes(kldb.slice(0, 2));
}

/**
 * Der Satz, der die Abwertung erklärt.
 *
 * Er steht neben der Stelle, nicht in einer Fussnote: Wer eine
 * Empfehlung weiter unten findet, soll den Grund lesen können — und
 * widersprechen, wenn er falsch ist.
 */
export function gruppensatz(
  passt: boolean | null,
  begriff: string,
): string | null {
  if (passt === null) return null;
  if (passt) return null;
  return `Der Begriff „${begriff}" steht in dieser Anzeige, aber die Stelle gehört zu einer anderen Berufsgruppe.`;
}
