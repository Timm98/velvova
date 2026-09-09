/**
 * ══════════════════════════════════════════════════════════════════
 * Wann ein Vorhaben eines ist
 * ══════════════════════════════════════════════════════════════════
 *
 * Ein Projekt entsteht im Gespräch: Jemand sagt, dass er in Zürich
 * sucht, Monday fragt nach, und daraus wird ein Eintrag in der
 * Seitenleiste.
 *
 * Der heikle Teil ist nicht das Anlegen, sondern das NICHT-Anlegen.
 * Ein Modell, das jede geäusserte Richtung zu einem Projekt macht,
 * füllt binnen einer Woche eine Seitenleiste mit Fragmenten — „Jobs",
 * „Neue Suche", „Zürich?", „Vielleicht Marketing". Danach ist die
 * Leiste kein Überblick mehr, sondern eine Halde.
 *
 * Deshalb stehen die Regeln hier und nicht im Prompt. Ein Prompt ist
 * eine Bitte; das hier ist eine Bedingung.
 */

/**
 * Wie viele Vorhaben gleichzeitig offen sein dürfen.
 *
 * Zwölf ist keine technische Grenze, sondern eine der Übersicht: Was
 * nicht ohne Scrollen in die Seitenleiste passt, wird nicht mehr
 * gelesen. Wer mehr braucht, schliesst zuerst eines ab — und genau
 * diese Entscheidung ist die nützliche.
 */
export const MAX_AKTIVE_PROJEKTE = 12;

/** So kurz, dass es in die Leiste passt, ohne abgeschnitten zu werden. */
export const MAX_NAME = 40;
export const MIN_NAME = 2;

/**
 * Den Namen in die Form bringen, in der er in der Leiste steht.
 *
 * Zeilenumbrüche und doppelte Leerzeichen fliegen raus — ein Modell
 * liefert gern „Zürich\n(Projektmanagement)", und in einer einzeiligen
 * Leiste wird daraus „Zürich (Projektmanagement" mit abgeschnittenem
 * Rest.
 */
export function projektnameNormalisieren(roh: string): string {
  return roh
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME)
    .trim();
}

/** Zwei Namen, die sich nur in Schreibweise unterscheiden, sind einer. */
export function gleicherName(a: string, b: string): boolean {
  return projektnameNormalisieren(a).toLowerCase() === projektnameNormalisieren(b).toLowerCase();
}

export interface Vorhandenesprojekt {
  id: string;
  name: string;
  status: string;
}

export type Anlageurteil =
  | { erlaubt: true; name: string }
  /** Es gibt es schon — dann wird es benutzt, nicht neu angelegt. */
  | { erlaubt: false; grund: "existiert"; vorhandenesId: string; name: string }
  | { erlaubt: false; grund: "zu_kurz" | "zu_viele"; hinweis: string };

/**
 * Darf daraus ein Vorhaben werden?
 *
 * ── Warum „existiert" kein Fehler ist ───────────────────────────
 *
 * Wenn jemand nach drei Wochen wieder über Zürich spricht, ist das
 * dasselbe Vorhaben — auch wenn Monday es gerade neu anlegen wollte.
 * Ein zweites „Zürich" daneben wäre für den Menschen nicht
 * unterscheidbar, und die Stellen lägen danach in zwei Töpfen.
 *
 * Deshalb gibt diese Prüfung die Kennung des vorhandenen zurück statt
 * einer Fehlermeldung: Der Aufrufer soll es öffnen, nicht scheitern.
 */
export function projektAnlegenPruefen(
  rohName: string,
  vorhandene: readonly Vorhandenesprojekt[],
): Anlageurteil {
  const name = projektnameNormalisieren(rohName);

  if (name.length < MIN_NAME) {
    return {
      erlaubt: false,
      grund: "zu_kurz",
      hinweis: "Das Vorhaben braucht einen Namen, den man in der Leiste wiedererkennt.",
    };
  }

  /*
   * Auch ein ruhendes zählt.
   *
   * Wer ein pausiertes „Zürich" hat und wieder darüber spricht, meint
   * dieses — nicht ein neues daneben.
   */
  const schonDa = vorhandene.find((p) => gleicherName(p.name, name));
  if (schonDa) {
    return { erlaubt: false, grund: "existiert", vorhandenesId: schonDa.id, name: schonDa.name };
  }

  const aktive = vorhandene.filter((p) => p.status === "aktiv").length;
  if (aktive >= MAX_AKTIVE_PROJEKTE) {
    return {
      erlaubt: false,
      grund: "zu_viele",
      hinweis:
        `Es sind bereits ${MAX_AKTIVE_PROJEKTE} Vorhaben offen. ` +
        "Schliesse oder pausiere eines, bevor ein neues dazukommt.",
    };
  }

  return { erlaubt: true, name };
}
