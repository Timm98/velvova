/**
 * Der Umkreis in Stufen — für „such mal weiter" und „geh näher ran".
 *
 * ══════════════════════════════════════════════════════════════
 * Warum eine Leiter und kein Faktor
 * ══════════════════════════════════════════════════════════════
 *
 * Gemeldet am 8. September 2026: Umkreis 30 km um Karlsruhe, dann
 * „kannst mehr suchen" — und es kamen Stellen aus Köln. Das sind 250
 * Kilometer. Der Satz hat den Filter nicht erweitert, er hat ihn
 * entfernt.
 *
 * Verdoppeln wäre die naheliegende Reparatur und trotzdem falsch:
 * 30 → 60 → 120 → 240 ist nach drei Sätzen wieder Köln, und
 * dazwischen stehen Zahlen, die niemand so sagt.
 *
 * Eine Leiter aus den Werten, die Menschen wirklich nennen, wächst
 * dagegen langsamer, je weiter sie kommt — und jede Stufe ist eine
 * Zahl, die man auch selbst eingetippt hätte.
 *
 * ── Warum sie oben und unten endet ──────────────────────────
 *
 * Bei 300 km, weil darüber der Umkreis keine Aussage mehr ist: Von
 * Karlsruhe aus liegt dann halb Deutschland drin, und wer das will,
 * nimmt den Ortsfilter weg statt ihn aufzublähen.
 *
 * Bei 10 km, weil darunter die Ortsangaben der Anzeigen nicht mehr
 * genau genug sind. Eine Grenze vorzutäuschen, die die Daten nicht
 * tragen, wäre schlimmer als keine.
 */
const LEITER = [10, 25, 50, 75, 100, 150, 200, 300] as const;

/**
 * Was gilt, wenn ein Ort gesetzt ist, aber kein Umkreis.
 *
 * Ohne Umkreis filtert heute der ORTSTEXT: Was „Karlsruhe" im
 * Ortsfeld stehen hat, bleibt. Das ist ungefähr die Stadt und ihr
 * Umland — deshalb ist 25 der ehrlichste Startwert für den ersten
 * Schritt nach draussen. „Weiter" landet damit auf 50, und das ist
 * spürbar mehr, ohne die Gegend zu verlassen.
 */
const OHNE_ANGABE = 25;

/**
 * Eine Stufe weiter oder enger.
 *
 * `jetzt` ist der eingestellte Umkreis oder `null`, wenn keiner
 * dasteht. Zurück kommt immer eine Zahl aus der Leiter — auch dann,
 * wenn `jetzt` ein krummer Wert aus einer früheren Eingabe war
 * („32 km"): Gesucht wird die nächste Stufe in die gewünschte
 * Richtung, nicht die nächstgelegene.
 */
export function umkreisStufe(jetzt: number | null, richtung: "weiter" | "enger"): number {
  const von = jetzt !== null && Number.isFinite(jetzt) && jetzt > 0 ? jetzt : OHNE_ANGABE;

  if (richtung === "weiter") {
    return LEITER.find((k) => k > von) ?? LEITER[LEITER.length - 1]!;
  }
  /*
   * Nach innen wird von hinten gesucht — die grösste Stufe, die noch
   * kleiner ist als der aktuelle Wert.
   */
  for (let i = LEITER.length - 1; i >= 0; i--) {
    const k = LEITER[i]!;
    if (k < von) return k;
  }
  return LEITER[0]!;
}
