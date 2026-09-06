import "server-only";

import { absichtErkennen, type Absicht } from "./absicht";
import { alsFaktwunsch, bedingungenLesen } from "./gespraechsextraktion";
import { faktSchreiben } from "@/lib/karriere/fakten";
import { praeferenzSchreiben } from "@/lib/karriere/praeferenzen";
import { ereignisSchreiben } from "./ereignisse";

/**
 * Die eine Stelle, durch die jede Nachricht an Nina geht.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es nur eine gibt
 * ══════════════════════════════════════════════════════════════
 *
 * Sprache und Text müssen denselben Weg nehmen:
 *
 *   Sprache: Ton → Text → HIER → Antwort → Ton
 *   Text:            Text → HIER → Antwort
 *
 * Zwei Wege hiessen zwei Ninas. Der Unterschied fiele nicht beim
 * Bauen auf, sondern erst, wenn jemand beides benutzt und merkt, dass
 * die gesprochene Nina eine Angabe speichert, die die geschriebene
 * überhört — oder umgekehrt.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier NICHT entschieden wird
 * ══════════════════════════════════════════════════════════════
 *
 * Ob eine Angabe eine bestehende ersetzt. Das macht `faktenregeln`,
 * und diese Datei ruft es auf, statt es nachzubauen. Wer die Regel
 * hier zum zweiten Mal formuliert, hat zwei Regeln — und eine davon
 * ist irgendwann veraltet.
 */

export type Verarbeitung = {
  absicht: Absicht;
  /** Woran die Absicht erkannt wurde. */
  grund: string;
  /** Wie viele Angaben ins Profil geschrieben wurden. */
  uebernommen: number;
  /**
   * Rückfragen, die entstanden sind.
   *
   * Sie entstehen, wenn eine neue Angabe einer bestätigten
   * widerspricht. Nina stellt sie im nächsten Zug — nicht sofort
   * mitten im Satz.
   */
  rueckfragen: string[];
  /** Ob das Modell mitgelesen hat oder nur die Regeln. */
  gedeutet: boolean;
};

/**
 * Eine Nachricht verarbeiten — vor der Antwort, nicht danach.
 *
 * Die Reihenfolge ist wichtig: Was der Mensch gerade gesagt hat, muss
 * im Profil stehen, BEVOR Nina antwortet. Sonst antwortet sie auf
 * einen Stand, den sie im selben Zug überholt hat.
 */
export async function verarbeite(
  userId: string,
  text: string,
): Promise<Verarbeitung> {
  const { absicht, grund } = absichtErkennen(text);

  const leer: Verarbeitung = {
    absicht,
    grund,
    uebernommen: 0,
    rueckfragen: [],
    gedeutet: false,
  };

  /*
   * Nur bei einer Angabe wird gelesen.
   *
   * Die Extraktion bei jedem Satz laufen zu lassen wäre bequemer und
   * teurer — ein Modellaufruf je Nachricht, auch bei „danke". Und sie
   * würde häufiger etwas finden, wo nichts ist: Ein Modell, das nach
   * Bedingungen sucht, findet welche.
   */
  if (absicht !== "profil_angabe") return leer;

  const gelesen = await bedingungenLesen(text);
  if (!gelesen.ok) return leer;

  const rueckfragen: string[] = [];
  let uebernommen = 0;

  for (const b of gelesen.bedingungen) {
    const ergebnis = await faktSchreiben(userId, alsFaktwunsch(b));
    if (ergebnis.entscheidung.art === "ersetzen") uebernommen++;
    if (ergebnis.frage) rueckfragen.push(ergebnis.frage);

    /*
     * Dieselbe Angabe zusätzlich als Vorliebe ablegen.
     *
     * Die beiden Tabellen sind keine Verdopplung, sie beantworten
     * verschiedene Fragen. `profile_facts` ist Ninas Gedächtnis: „Was
     * weiss ich über diesen Menschen?" `preferences` ist der Eingang
     * zum Matching: „Was darf eine Stelle ausschliessen und wie schwer
     * wiegt der Rest?"
     *
     * Ohne diesen Schritt wüsste Nina im Gespräch von der Bedingung,
     * und die Bewertung wüsste nichts davon — die Person sagt „unter
     * 60.000 nicht" und bekommt weiter Stellen für 48.000.
     *
     * `bestaetigt: false` ist der Punkt, an dem es nicht kippt: Aus
     * dem Gespräch Gelesenes senkt nur den Wert. Ausschliessen darf es
     * erst, wenn ein Mensch es bestätigt hat.
     */
    await praeferenzSchreiben(userId, {
      kind: b.schluessel,
      wert: String(b.wert),
      harteBedingung: b.harteBedingung,
      quelle: "gespraech",
      konfidenz: Math.min(85, Math.round(b.konfidenz * 100)),
      bestaetigt: false,
    });
  }

  /*
   * Eine offene Rückfrage ist ein Ereignis.
   *
   * Damit geht sie nicht verloren, wenn das Gespräch an dieser Stelle
   * endet — und sie taucht im Briefing auf, wenn sie liegen bleibt.
   * Eine Frage, die nur im Verlauf steht, stellt sich nie wieder.
   */
  for (const frage of rueckfragen) {
    await ereignisSchreiben(userId, {
      art: "angabe_fehlt",
      titel: frage,
      prioritaet: 2,
      bezugsart: "profil",
      nutzlast: { frage, anlass: "widerspruch" },
    });
  }

  return { absicht, grund, uebernommen, rueckfragen, gedeutet: true };
}
