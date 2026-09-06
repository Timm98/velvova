/**
 * Beschäftigungsformen, für die eine Vollzeitspanne nicht gilt.
 *
 * ── Der Fehler, den das verhindert ────────────────────────────
 *
 * „Werkstudent Vertrieb" bekam die Spanne der Gruppe `sales`:
 * 50.000 – 77.500 €. Für einen Werkstudenten ist das um ein Vielfaches
 * daneben — und die Zahl stand formatiert und mit Quellenangabe da,
 * sah also aus wie eine Auskunft.
 *
 * Die Berufsgruppe sagt, WAS jemand tut. Sie sagt nichts darüber, in
 * welchem Umfang und auf welcher Stufe. Wo der Titel das erkennbar
 * anders beantwortet, gibt es keinen Vergleichswert.
 *
 * ── Was die erste Fassung übersah ─────────────────────────────
 *
 * Sie war auf Deutsch geschrieben und begann mit `\b`. Beides hat
 * gekostet, gemessen am Bestand von 2.506 Stellen:
 *
 *   • **54 Stellen** rutschten durch. Der grösste Teil heisst
 *     „Working Student" — der Bestand ist zweisprachig, die Sperre war
 *     es nicht. Dazu jedes „Pflichtpraktikum", weil `\bpraktik` an der
 *     Wortmitte nicht greift, und jedes „Werkstudium".
 *
 *   • Umgekehrt fing `master` ohne Kontext echte Vollzeitstellen:
 *     „Masterplaner Logistik", „Scrum Master", „Master Data
 *     Specialist". Deshalb steht dort jetzt der Studienbezug —
 *     `masterarbeit`, `masterand`, `masterstudium` — statt des blossen
 *     Worts.
 *
 * Beide Richtungen sind teuer, aber verschieden sichtbar: Die zu
 * lockere Sperre zeigt eine falsche Zahl, die zu strenge zeigt keine.
 * Eine falsche Zahl ist schlimmer, weil sie wie eine Auskunft aussieht.
 *
 * ── Warum das eine eigene Datei ist ───────────────────────────
 *
 * Zwei Module brauchen dieselbe Sperre: die Statistik aus dem eigenen
 * Bestand und die Referenz nach amtlichem Beruf. Läge sie in einem der
 * beiden, importierten sie einander im Kreis — und eine Sperre, die je
 * nach Ladereihenfolge `undefined` ist, ist keine.
 *
 * Der Worker führt aus demselben Grund eine wortgleiche Kopie;
 * `beschaeftigungsform.test.ts` hält beide aneinander.
 */
export const KEIN_VOLLZEITVERGLEICH =
  /(werkstudent|werkstudium|werkstudierend|working\s+student|praktikum|praktikant|\bpraktika\b|\binternship\b|\bintern\b|\bausbildung\b|ausbildungsplatz|ausbildungsstelle|ausbildungs-|\bauszubildend|\bazubi\b|dual(?:es)? studium|bachelorstudium|masterstudium|trainee|\baushilfe\b|\bminijob\b|geringf[üu]gig|bachelorand|masterand|bachelorarbeit|masterarbeit|(?:bachelor|master)[-\s]?thesis|\bthesis\b|abschlussarbeit|\bschüler|\bferienjob\b|volontariat|volontär)/i;
