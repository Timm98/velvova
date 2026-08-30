/**
 * Zahl und Substantiv, in der richtigen Form.
 *
 * Anlass war ein Satz auf der Bewerbungsseite: „13 Bewerbungen, 1
 * Gespräche. 1 Auffälligkeit." Ein Fehler, den kein Test bemerkt und
 * jede Person sofort sieht — und der einen Text, der Sorgfalt
 * behauptet, in einem Wort unglaubwürdig macht.
 *
 * Die Suche danach fand fünf weitere Stellen. Deshalb eine Funktion und
 * nicht fünf einzelne Korrekturen: die sechste kommt sonst mit dem
 * nächsten Satz.
 */
export function plural(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * „Es fehlt ein Thema" gegen „Es fehlen zwei Themen".
 *
 * Im Deutschen beugt sich auch das Verb. Ein Satz, der nur beim
 * Substantiv aufpasst, ist halb richtig — und halb richtig liest sich
 * schlechter als durchgehend schlampig, weil man die Mühe sieht.
 */
export function pluralVerb(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
