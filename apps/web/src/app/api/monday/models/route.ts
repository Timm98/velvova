import { anbietbareModelle, type Anbieter } from "@paycheck/ai";
import { requireUser } from "@/lib/auth";

/**
 * ══════════════════════════════════════════════════════════════════
 * Welche Modelle ein Mensch auswählen darf
 * ══════════════════════════════════════════════════════════════════
 *
 * Die Auswahl unten rechts im Gespräch holt ihre Liste hier. Nicht aus
 * einer Datei im Frontend — sonst stünden Modellnamen im Browser-Bundle
 * und liefen bei der nächsten Modelländerung auseinander.
 *
 * ── Was diese Route NICHT verrät ────────────────────────────────
 *
 * Die API-Kennung des Modells. Sie ist kein Geheimnis, aber sie im
 * Browser zu haben lädt genau dazu ein, sie irgendwo einzutragen — und
 * dann steht ein Anbietername in einer Komponente, obwohl der ganze
 * Aufbau darauf beruht, dass er das nicht tut.
 *
 * Das Frontend bekommt `internId` und einen Anzeigenamen. Welches
 * Modell dahintersteht, entscheidet der Server.
 *
 * Ebenfalls nicht: die gesperrten Modelle und ihre Gründe. Wer eine
 * Kennung rät, soll aus der Antwort nicht schliessen können, was es
 * intern sonst noch gibt. Die Gründe stehen in `modellzustaende()` und
 * gehören ins Betriebsprotokoll, nicht in eine Antwort ans Netz.
 */

export const dynamic = "force-dynamic";

/** Wie die Gruppen heissen. Der Nutzer sieht sie nur in der Auswahl. */
const GRUPPENNAME: Record<Anbieter, string> = {
  openai: "OpenAI",
  anthropic: "Claude",
  google: "Gemini",
};

/** Die Reihenfolge der Gruppen. Fest, damit die Liste nicht springt. */
const REIHENFOLGE: readonly Anbieter[] = ["openai", "anthropic", "google"];

export async function GET(): Promise<Response> {
  /*
   * Angemeldet sein muss man.
   *
   * Nicht weil die Liste geheim wäre, sondern weil sie den
   * Betriebszustand dieser Installation verrät: welche Anbieter
   * eingerichtet und freigegeben sind. Das geht Besucher nichts an.
   */
  await requireUser();

  const modelle = anbietbareModelle();

  const gruppen = REIHENFOLGE.map((anbieter) => ({
    anbieter,
    name: GRUPPENNAME[anbieter],
    modelle: modelle
      .filter((m) => m.anbieter === anbieter)
      .map((m) => ({
        id: m.internId,
        name: m.anzeigename,
        beschreibung: m.beschreibung,
        vorschau: m.lebenszyklus === "vorschau",
        kosten: m.kostenklasse,
        tempo: m.tempoklasse,
      })),
  })).filter((g) => g.modelle.length > 0);

  return Response.json(
    {
      /*
       * `auto` ist immer da, auch wenn kein Modell freigegeben ist.
       *
       * Sonst zeigte die Auswahl bei einer frischen Installation gar
       * nichts an, und niemand wüsste, ob die Funktion fehlt oder die
       * Einrichtung. So steht dort „Automatisch" und darunter nichts —
       * das ist eine Auskunft.
       */
      auto: {
        id: "auto",
        name: "Automatisch",
        beschreibung: "Monday wählt passend zur Aufgabe.",
      },
      gruppen,
      /*
       * Ob überhaupt etwas zur Auswahl steht.
       *
       * Ausdrücklich als Feld und nicht als `gruppen.length === 0`
       * abzuleiten: Die Oberfläche soll unterscheiden können zwischen
       * „nichts freigegeben" und „Liste noch nicht geladen".
       */
      auswahlMoeglich: gruppen.length > 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
