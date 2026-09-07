/**
 * Die Karte, die auf jeder Anmeldeseite gleich aussieht.
 *
 * ── Warum eine feste Mindesthöhe ──────────────────────────────
 *
 * Die Seiten tragen unterschiedlich viel: Die Anmeldung hat zwei
 * Felder und drei Knöpfe, „Passwort vergessen" hat ein Feld. Ohne
 * Mindesthöhe war die eine hochkant und die andere ein Streifen —
 * gemessen 540 × 649 gegen 540 × 91.
 *
 * Beim Wechsel zwischen ihnen sprang damit alles: Der Schriftzug oben
 * blieb stehen, die Karte darunter schrumpfte auf ein Sechstel, und
 * die Fusszeile sprang eine halbe Seite nach oben.
 *
 * ── Warum nicht gestreckt, aber mittig ────────────────────────
 *
 * `min-height` und nicht `height`: Eine Karte, die ihren Inhalt auf
 * die volle Höhe VERTEILT (`content-between`), reisst zwischen
 * Überschrift und Feldern Lücken auf, die niemand gesetzt hat — und
 * je weniger drinsteht, desto grösser werden sie. Das bleibt
 * ausgeschlossen.
 *
 * `content-center` verteilt nichts. Es rückt den ganzen Block als
 * Ganzes in die Mitte; die Abstände darin bleiben exakt die
 * gesetzten.
 *
 * Vorher stand hier `content-start`, und die Luft sammelte sich
 * unten. Gemessen bei 420 Breite: Registrierung 780 (füllt die
 * Karte), Einloggen 760, „Passwort vergessen" 430. Bei der letzten war fast die halbe
 * Karte unter dem letzten Element leer — das liest sich nicht als
 * Ruhe, sondern als abgeschnittene Seite.
 *
 * Mittig verteilt sich dieselbe Luft auf oben und unten. Sie wird
 * dadurch nicht weniger, aber sie sieht gewollt aus.
 *
 * ── Warum 420 breit und 780 hoch ──────────────────────────────
 *
 * Hochkant ist ein Verhältnis, kein Wert. Bei 540 Breite und 650 Höhe
 * stand die Anmeldung bei 1,20 — das liest sich als Quadrat mit
 * Toleranz. 480 zu 760 sind 1,58, und der Unterschied ist zu sehen.
 *
 * 760 ist die Höhe der längsten Karte — der Registrierung, gemessen
 * 756. Sie als Mindestmass zu nehmen heisst: Keine Karte muss dafür
 * wachsen, alle kürzeren holen auf. Umgekehrt — den Mittelwert nehmen
 * und die längste überlaufen lassen — hätte genau die Seite mit dem
 * meisten Inhalt zerrissen.
 *
 * Der Wert muss mitwachsen, wenn eine Karte länger wird. Er steht
 * deshalb an einer Stelle und nicht in fünf Seiten.
 *
 * ── Warum es hier keine Ausnahme gibt ─────────────────────────
 *
 * Für die Code-Eingabe stand hier kurz ein `kompakt`, das die
 * Mindesthöhe zurücknahm — auf Wunsch, mit einer guten Begründung:
 * sechs Felder brauchen keine 760 Pixel.
 *
 * Es ist wieder weg, und die Begründung dafür ist stärker: Das Mass
 * dieser Karte ist keine Gestaltungsfrage mehr, sondern eine Zusage.
 * Fünf Seiten, ein Format, kein Springen dazwischen — und jede
 * Ausnahme, so gut sie einzeln begründet ist, macht aus der Zusage
 * eine Gewohnheit mit Sonderfällen.
 *
 * Wer die kompakte Fassung doch will: eine Zeile, hier, und dann für
 * alle fünf.
 */
export function Karte({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[780px] content-center gap-6 rounded-[12px] border border-line-3 px-6 py-8 sm:px-9 sm:py-9">
      {children}
    </div>
  );
}

/** Die Überschrift — überall dieselbe Grösse und derselbe Abstand. */
export function Titel({ children }: { children: React.ReactNode }) {
  return (
    /*
       Grösser und leichter als vorher.

       Die Vorlage setzt die Überschrift bei rund 40 Pixeln in
       normaler Strichstärke. Fett wirkt sie auf einer Karte mit
       genau einer Aufgabe wie eine Warnung; die Grösse allein
       trägt den Rang schon.
    */
    <h1 className="font-display text-[clamp(1.9rem,4.5vw,2.4rem)] font-normal tracking-[-0.02em]">
      {children}
    </h1>
  );
}
