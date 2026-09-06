/**
 * Was beim Hochfahren einmal geprüft wird.
 *
 * Nur Konfiguration, kein Netzzugriff. Ein Server, der zum Starten
 * fremde Dienste braucht, startet so langsam wie der langsamste davon —
 * und fällt mit ihm aus.
 *
 * Die Ausgabe ist bewusst je Anbieter eine Zeile. „6 von 9 aktiv"
 * beantwortet nicht die Frage, welche drei fehlen, und genau die hat
 * jemand, der gerade einen Schlüssel eingetragen hat.
 */
export async function register(): Promise<void> {
  // Nur im Node-Lauf. Die Edge-Umgebung hat weder die Variablen noch
  // einen Grund, das zu wissen.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { protokolliereStart } = await import("@paycheck/jobs");
    protokolliereStart();
  } catch (e) {
    /*
     * Eine gescheiterte Auskunft darf den Start nicht verhindern.
     *
     * Sie ist Diagnose, kein Betriebsmittel. Ein Fehler hier — eine
     * kaputte Umgebungsvariable, ein fehlendes Paket — würde sonst die
     * ganze Anwendung am Hochfahren hindern, wegen einer Zeile Protokoll.
     */
    console.warn("[jobquellen] Startprüfung nicht möglich:", e instanceof Error ? e.message : e);
  }
}
