/**
 * ══════════════════════════════════════════════════════════════════
 * Wann ein Satz ein Vorhaben ist — und wann nur eine Frage
 * ══════════════════════════════════════════════════════════════════
 *
 * „Ich suche einen Remote-Vertriebsjob ab 70.000 Euro" ist ein
 * berufliches Vorhaben. „Wie formuliere ich diesen Satz im Lebenslauf
 * besser?" ist eine Frage. Der Unterschied entscheidet, ob ein
 * Arbeitsbereich entsteht oder ob jemand einfach eine Antwort bekommt.
 *
 * ── Warum das Modell nur vorschlägt ─────────────────────────────
 *
 * Weil ein Projekt Daten anlegt. Ein Modell, das aus einem Halbsatz
 * eine Struktur baut, legt an einem schlechten Tag drei Projekte für
 * dieselbe Suche an — und niemand sieht ihm das an, weil jedes
 * einzelne plausibel aussieht.
 *
 * Deshalb: Das Modell schlägt eine Zuordnung vor, `zuordnungPruefen`
 * entscheidet. Die Prüfung ist rein und liegt hier, damit sie ohne
 * Netz und ohne Kosten geprüft werden kann.
 *
 * ── Die fünf Fälle ──────────────────────────────────────────────
 *
 *   neues_projekt     Ein eigenständiges Vorhaben. Legt an.
 *   verfeinern        Bedingung zum laufenden Vorhaben. Ändert.
 *   vorhandenes       Gehört zu einem anderen, schon offenen.
 *   gespraech         Eine Frage. Legt nichts an.
 *   rueckfrage        Uneindeutig. Monday fragt nach.
 *
 * `rueckfrage` ist kein Ausweichen, sondern der ehrliche Fall: Wer
 * „und in München wäre auch interessant" schreibt, kann eine zweite
 * Suche meinen oder eine Erweiterung der ersten. Zu raten heisst,
 * jedes zweite Mal falsch zu liegen — und die falsche Hälfte muss
 * jemand von Hand aufräumen.
 */

export type Zuordnungsart =
  | "neues_projekt"
  | "verfeinern"
  | "vorhandenes"
  | "gespraech"
  | "rueckfrage";

/** Was das Modell vorschlägt. Ungeprüft. */
export interface Zuordnungsvorschlag {
  art: Zuordnungsart;
  /** Bei `vorhandenes`: welches. */
  projektId?: string | null;
  /** Bei `neues_projekt`: ein kurzer Name. */
  name?: string | null;
  /** Was verstanden wurde — der Wunsch in einem Satz. */
  ziel?: string | null;
  /** Bei `rueckfrage`: was Monday fragen soll. */
  frage?: string | null;
  begruendung?: string | null;
}

export interface Projektkurz {
  id: string;
  name: string;
  ziel: string | null;
}

/**
 * Was für die Entscheidung bekannt sein muss.
 *
 * Heisst nicht `Lage` — der Name gehört im Paket bereits der
 * Team-Aufstellung, und zwei gleichnamige Typen im selben Export
 * lassen den späteren stillschweigend gewinnen.
 */
export interface Projektlage {
  /** Die offenen Projekte der Person. */
  projekte: readonly Projektkurz[];
  /** Welches gerade geöffnet ist, falls eines. */
  offenesProjekt?: string | null;
}

export interface Zuordnung {
  art: Zuordnungsart;
  projektId: string | null;
  name: string | null;
  ziel: string | null;
  frage: string | null;
  /** Warum die Prüfung so entschieden hat. Fürs Protokoll. */
  grund: string;
}

export interface Projektgrenzen {
  /** Mehr offene Projekte als das legt niemand sinnvoll an. */
  maxProjekte: number;
  /** Kürzer als das ist kein Name. */
  minNameZeichen: number;
  maxNameZeichen: number;
}

/* Eigener Name, weil `GRENZEN` im Paket schon der Team-Aufstellung
   gehört — sonst gewinnt im gemeinsamen Export der spätere still. */
export const PROJEKTGRENZEN: Projektgrenzen = { maxProjekte: 12, minNameZeichen: 3, maxNameZeichen: 60 };

/** Grobe Normalform für den Namensvergleich. */
function schluessel(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Wie ähnlich sind zwei Projektnamen?
 *
 * Anteil gemeinsamer Wörter am kleineren der beiden. Grob mit Absicht:
 * „Vertrieb Remote ab 70k" und „Vertrieb remote 70000" sollen als
 * dasselbe gelten, „Vertrieb München" und „Vertrieb Remote" nicht.
 */
export function aehnlichkeit(a: string, b: string): number {
  const wa = new Set(schluessel(a).split(" ").filter((w) => w.length > 2));
  const wb = new Set(schluessel(b).split(" ").filter((w) => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  let gemeinsam = 0;
  for (const w of wa) if (wb.has(w)) gemeinsam += 1;
  return gemeinsam / Math.min(wa.size, wb.size);
}

/**
 * Ab hier gilt ein Vorschlag als Dublette eines vorhandenen Vorhabens.
 *
 * ── Warum 0,6 und nicht 0,7 ─────────────────────────────────────
 *
 * Nachgerechnet an dem Fall, um den es geht:
 *
 *   „Vertrieb Remote 70000"   gegen  „Vertrieb · Remote · ab 70k"
 *   gemeinsam: vertrieb, remote — 2 von 3        → 0,67
 *
 * Für einen Menschen ist das dieselbe Suche. Bei 0,7 wäre es ein
 * zweites Vorhaben geworden, und die Bewerbungen lägen auf beiden.
 *
 * Nach unten hält die Grenze trotzdem:
 *
 *   „Vertrieb München"        gegen  „Vertrieb Remote"
 *   gemeinsam: vertrieb — 1 von 2                → 0,50
 *
 * Zwischen 0,50 und 0,67 liegt genug Luft, dass die Zahl nicht auf
 * dem Rand steht.
 */
export const DUBLETTE_AB = 0.6;

/**
 * Den Vorschlag prüfen und entscheiden.
 *
 * Rein: keine Datenbank, kein Netz, kein Zufall. Alles, was gebraucht
 * wird, steht in `lage`.
 */
export function zuordnungPruefen(
  vorschlag: Zuordnungsvorschlag,
  lage: Projektlage,
  grenzen: Projektgrenzen = PROJEKTGRENZEN,
): Zuordnung {
  const leer: Omit<Zuordnung, "art" | "grund"> = {
    projektId: null,
    name: null,
    ziel: null,
    frage: null,
  };
  const ziel = vorschlag.ziel?.trim() || null;

  /* ── Gespräch: der Regelfall, und er legt nichts an ─────────── */
  if (vorschlag.art === "gespraech") {
    return { ...leer, art: "gespraech", ziel, grund: "Keine eigenständige Absicht erkannt." };
  }

  /* ── Rückfrage ─────────────────────────────────────────────── */
  if (vorschlag.art === "rueckfrage") {
    const frage = vorschlag.frage?.trim();
    /*
     * Eine Rückfrage ohne Frage ist keine. Sie würde als stumme
     * Pause erscheinen — Monday tut nichts und sagt nicht, warum.
     */
    if (!frage) {
      return { ...leer, art: "gespraech", ziel, grund: "Rückfrage ohne Frage — als Gespräch behandelt." };
    }
    return { ...leer, art: "rueckfrage", ziel, frage, grund: "Absicht ist mehrdeutig." };
  }

  /* ── Ein vorhandenes Projekt ───────────────────────────────── */
  if (vorschlag.art === "vorhandenes") {
    const id = vorschlag.projektId?.trim();
    const treffer = lage.projekte.find((p) => p.id === id);
    /*
     * Eine Kennung, die es nicht gibt, ist keine Zuordnung.
     * Zurückzufallen auf „neues Projekt" wäre bequem und falsch: Das
     * Modell wollte etwas Vorhandenes treffen und hat sich geirrt —
     * daraus einen neuen Arbeitsbereich zu machen, verdoppelt den
     * Irrtum.
     */
    if (!treffer) {
      return { ...leer, art: "gespraech", ziel, grund: "Unbekannte Projektkennung." };
    }
    return { ...leer, art: "vorhandenes", projektId: treffer.id, ziel, grund: "Gehört zu einem offenen Vorhaben." };
  }

  /* ── Verfeinern ────────────────────────────────────────────── */
  if (vorschlag.art === "verfeinern") {
    const id = vorschlag.projektId?.trim() || lage.offenesProjekt?.trim();
    const treffer = lage.projekte.find((p) => p.id === id);
    /*
     * Verfeinern braucht etwas zu verfeinern. Ohne offenes Projekt
     * ist „höchstens zehn Prozent Reisetätigkeit" eine Aussage über
     * nichts — dann ist es Gespräch, und Monday kann nachfragen,
     * worauf es sich bezieht.
     */
    if (!treffer) {
      return { ...leer, art: "gespraech", ziel, grund: "Kein Vorhaben offen, das verfeinert werden könnte." };
    }
    return { ...leer, art: "verfeinern", projektId: treffer.id, ziel, grund: "Bedingung zum offenen Vorhaben." };
  }

  /* ── Neues Projekt: die einzige Art, die etwas anlegt ──────── */
  const name = vorschlag.name?.trim() ?? "";

  if (name.length < grenzen.minNameZeichen || name.length > grenzen.maxNameZeichen) {
    return { ...leer, art: "gespraech", ziel, grund: "Kein brauchbarer Name für ein Vorhaben." };
  }

  if (lage.projekte.length >= grenzen.maxProjekte) {
    /*
     * Nicht stillschweigend anlegen und nicht stillschweigend
     * verwerfen. Wer zwölf offene Vorhaben hat, hat eher den
     * Überblick verloren als ein dreizehntes Ziel.
     */
    return {
      ...leer,
      art: "rueckfrage",
      ziel,
      frage: "Du hast schon viele offene Vorhaben. Soll das ein weiteres werden oder zu einem bestehenden gehören?",
      grund: `Grenze von ${grenzen.maxProjekte} offenen Vorhaben erreicht.`,
    };
  }

  /*
   * Fast derselbe Name wie ein vorhandenes?
   *
   * Dann ist es mit grosser Wahrscheinlichkeit dasselbe Vorhaben,
   * anders formuliert. Zwei Arbeitsbereiche für eine Suche sind der
   * Fehler, den man erst nach Wochen bemerkt — und dann sind
   * Bewerbungen auf beide verteilt.
   */
  const dublette = lage.projekte.find(
    (p) => aehnlichkeit(name, p.name) >= DUBLETTE_AB || (p.ziel && ziel && aehnlichkeit(ziel, p.ziel) >= DUBLETTE_AB),
  );
  if (dublette) {
    return {
      ...leer,
      art: "rueckfrage",
      ziel,
      frage: `Meinst du dein Vorhaben „${dublette.name}" oder soll das etwas Eigenes werden?`,
      grund: "Sehr ähnlich zu einem offenen Vorhaben.",
    };
  }

  return { ...leer, art: "neues_projekt", name, ziel, grund: "Eigenständiges Vorhaben erkannt." };
}

/* ══════════════════════════════════════════════════════════════════
   Die Anweisung an das Modell
   ══════════════════════════════════════════════════════════════════ */

export const ZIELERKENNUNG_ANWEISUNG = `Du ordnest die letzte Nachricht einer Person einem beruflichen Vorhaben zu.

Ein Vorhaben ist ein eigenständiges berufliches Ziel — etwa eine Suche nach einer bestimmten Art Stelle. Es ist NICHT jede Nachricht und nicht jede Frage.

Wähle genau eine Art:

neues_projekt  Die Person beschreibt ein NEUES eigenständiges Ziel, das zu keinem offenen passt. Gib einen kurzen Namen (drei bis sechs Wörter, Form: "Rolle · Ort oder Modell · Bedingung") und das Ziel in einem Satz.
verfeinern     Die Nachricht ergänzt oder ändert eine Bedingung des GERADE OFFENEN Vorhabens.
vorhandenes    Sie gehört zu einem anderen, bereits offenen Vorhaben. Gib dessen Kennung.
gespraech      Eine Frage, eine Bitte um Formulierungshilfe, Smalltalk, eine Rückfrage zu einer Antwort. Der Regelfall.
rueckfrage     Es ist ernsthaft unklar, ob ein neues Vorhaben gemeint ist. Gib die Frage an, die Monday stellen soll.

Regeln:
- Im Zweifel gespraech oder rueckfrage. Ein zu viel angelegtes Vorhaben kostet die Person Aufräumarbeit; ein nicht angelegtes kostet einen Satz.
- Erfinde keine Angaben. Gehalt, Ort und Rolle stehen nur im Ziel, wenn sie in der Nachricht stehen.
- Der Name enthält keine Anführungszeichen und keine erfundenen Zahlen.`;
