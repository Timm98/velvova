/**
 * Eigener Umgebungstyp statt des globalen NodeJS-Namensraums. Das haelt
 * die Konfiguration testbar - ein Test uebergibt einfach ein Objekt - und
 * unabhängig davon, ob gerade Node-, Browser- oder Edge-Typen geladen sind.
 */
export type Env = Readonly<Record<string, string | undefined>>;

/** Liest die Umgebung, ohne einen Laufzeitkontext vorauszusetzen. */
export function currentEnv(): Env {
  return typeof process !== "undefined" && process.env ? process.env : {};
}
