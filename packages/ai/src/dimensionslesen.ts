import { ARBEITSDIMENSIONEN, type Arbeitsdimension } from "@paycheck/domain";

/**
 * Aus einer Gesprächsantwort Achsenwerte lesen.
 *
 * ── Warum das überhaupt nötig ist ─────────────────────────────
 *
 * Monday stellt längst die richtigen Fragen: „Welche Entscheidungen
 * möchtest du selbst treffen dürfen?", „Bevorzugst du klare Abläufe
 * oder möchtest du lieber etwas Neues aufbauen?" Die Antworten wurden
 * als Fliesstext abgelegt und nie zu etwas, womit sich rechnen liess.
 *
 * Der Career Twin blieb deshalb leer, bis jemand von Hand zehn Regler
 * bewegte — und daran hängen Passung, Alltagsvergleich und Rollenkarte.
 *
 * ── Warum ein Leser und kein Sprachmodell ─────────────────────
 *
 * Ein Modell würde für jede Antwort zehn Zahlen liefern, auch für „weiss
 * nicht". Diese Zahlen wären nicht nachvollziehbar, nicht wiederholbar
 * und nicht prüfbar — und sie stünden anschliessend als Aussage über
 * einen Menschen in seinem Profil.
 *
 * Der Leser hier sagt in den meisten Fällen nichts. Das ist die
 * gewünschte Eigenschaft: Eine Achse, zu der die Antwort nichts hergibt,
 * bleibt offen und fällt aus dem Vergleich, statt ihn zu verwässern.
 *
 * ── Warum die Frage mitzählt ──────────────────────────────────
 *
 * „Klare Abläufe" heisst in der Antwort auf `structure_vs_building`
 * etwas anderes als in der Antwort auf `avoided_tasks`. Ohne die Frage
 * würde derselbe Satz zweimal verschieden gedeutet — und mindestens
 * einmal falsch.
 */

interface Zeichen {
  muster: RegExp;
  /** Wohin es zeigt. */
  richtung: 0 | 1;
}

/** Welche Frage auf welche Achsen zeigen kann, und woran man es erkennt. */
const LESER: Record<string, Partial<Record<Arbeitsdimension, Zeichen[]>>> = {
  own_decisions: {
    autonomie: [
      { muster: /alles|selbst entscheid|freie hand|eigenverantwort|niemanden fragen|ohne r[üu]cksprache/i, richtung: 1 },
      { muster: /nicht so viel|lieber abstimm|r[üu]cksprache|klare ansage|vorgesetzt|angeleitet|nichts entscheiden/i, richtung: 0 },
    ],
  },
  responsibility_wanted: {
    verantwortung: [
      { muster: /f[üu]hrung|team leiten|personalverantwortung|projektleitung|budget|gesamtverantwortung/i, richtung: 1 },
      { muster: /keine f[üu]hrung|fachlich bleiben|nicht leiten|kein team|nur meine aufgabe|keine verantwortung f[üu]r andere/i, richtung: 0 },
    ],
  },
  structure_vs_building: {
    struktur: [
      { muster: /klare abl[äa]ufe|struktur|geregelt|vorgaben|routine|planbar/i, richtung: 1 },
      { muster: /aufbauen|neues|gestalten|von null|frei|offene/i, richtung: 0 },
    ],
    wiederholung: [
      { muster: /klare abl[äa]ufe|routine|eingespielt|immer gleich/i, richtung: 1 },
      { muster: /neues|abwechslung|nicht immer dasselbe|jeden tag anders/i, richtung: 0 },
    ],
  },
  exchange_vs_focus: {
    teamarbeit: [
      { muster: /viel austausch|im team|gemeinsam|mit anderen|besprech/i, richtung: 1 },
      { muster: /ungest[öo]rt|allein|f[üu]r mich|ruhe|konzentr/i, richtung: 0 },
    ],
  },
  depth_vs_breadth: {
    wiederholung: [
      { muster: /ein thema|lange an|in die tiefe|vertiefen/i, richtung: 1 },
      { muster: /mehrere|abwechsl|verschiedene|kurze aufgaben/i, richtung: 0 },
    ],
  },
  shifting_priorities: {
    belastung: [
      { muster: /kein problem|gewohnt|macht mir nichts|geh[öo]rt dazu|komme gut|reizt mich/i, richtung: 1 },
      { muster: /stresst|[üu]berfordert|mag ich nicht|anstrengend|belastet|schwer/i, richtung: 0 },
    ],
    tempo: [
      { muster: /schnell umschalt|flexibel|spontan/i, richtung: 1 },
      { muster: /brauche zeit|in ruhe|gr[üu]ndlich|nicht hetzen/i, richtung: 0 },
    ],
  },
  value_ranking: {
    sicherheit: [
      { muster: /^[^.]*sicherheit/i, richtung: 1 },
      { muster: /sicherheit.{0,40}(zuletzt|unwichtig|egal)/i, richtung: 0 },
    ],
    lernen: [{ muster: /^[^.]*lernen/i, richtung: 1 }],
    autonomie: [{ muster: /^[^.]*autonomie/i, richtung: 1 }],
    teamarbeit: [{ muster: /^[^.]*team/i, richtung: 1 }],
  },
  lost_track_of_time: {
    lernen: [{ muster: /neues?|gelernt|ausprobiert|t[üu]fteln|verstehen wollte|einarbeit/i, richtung: 1 }],
    wiederholung: [{ muster: /immer wieder|routine|eingespielt/i, richtung: 1 }],
    kundenkontakt: [{ muster: /gespr[äa]ch|mit (?:dem )?kunden|beraten|zuh[öo]ren/i, richtung: 1 }],
  },
  easy_for_you: {
    kundenkontakt: [{ muster: /mit menschen|kunden|erkl[äa]ren|pr[äa]sentier|vermitteln/i, richtung: 1 }],
    struktur: [{ muster: /ordnen|sortieren|strukturieren|planen|organisieren/i, richtung: 1 }],
    verantwortung: [{ muster: /entscheiden|f[üu]hren|koordinieren|delegieren/i, richtung: 1 }],
  },
  quit_after_three_months: {
    /*
     * „Was würde dich nach drei Monaten gehen lassen?" ist die
     * ehrlichste Frage im ganzen Gespräch — sie fragt nach dem, was
     * jemand NICHT aushält, und darauf antworten Menschen deutlicher
     * als auf die Frage nach ihren Wünschen.
     */
    belastung: [{ muster: /druck|stress|[üu]berstunden|hektik|ausgebrannt|[üu]berlast/i, richtung: 0 }],
    autonomie: [{ muster: /mikromanag|kontrolliert|keine freiheit|alles vorgegeben|nichts entscheiden/i, richtung: 1 }],
    struktur: [{ muster: /chaos|kein plan|unorganisiert|durcheinander/i, richtung: 1 }],
    kundenkontakt: [{ muster: /kundengespr[äa]ch|beschwerden|reklamation|telefondienst/i, richtung: 0 }],
    teamarbeit: [{ muster: /schlechtes? (?:team|klima)|ellenbogen|einzelk[äa]mpfer/i, richtung: 1 }],
    wiederholung: [{ muster: /langweilig|monoton|immer dasselbe|eint[öo]nig/i, richtung: 0 }],
    verantwortung: [{ muster: /zu viel verantwortung|[üu]berfordert|allein gelassen/i, richtung: 0 }],
  },
  non_negotiables: {
    sicherheit: [{ muster: /unbefristet|sicherer? (?:arbeitsplatz|stelle)|festanstellung|planbar/i, richtung: 1 }],
    belastung: [{ muster: /keine (?:[üu]berstunden|nachtschicht|wochenend)|geregelte (?:arbeits)?zeit/i, richtung: 0 }],
  },
  potential_blocked: {
    autonomie: [{ muster: /nicht entscheiden|keine freiheit|vorgesetzt|genehmig/i, richtung: 1 }],
    lernen: [{ muster: /keine (?:weiterbildung|entwicklung)|nichts gelernt|stillstand/i, richtung: 1 }],
    verantwortung: [{ muster: /mehr verantwortung|f[üu]hrung [üu]bernehmen|leiten d[üu]rfen/i, richtung: 1 }],
  },
  learning_goal_year: {
    lernen: [{ muster: /lernen|weiterbild|zertifikat|studium|kurs|qualifi/i, richtung: 1 }],
  },
  concrete_result: {
    verantwortung: [{ muster: /verantwortlich|geleitet|gef[üu]hrt|budget|projekt.{0,20}leitung/i, richtung: 1 }],
    teamarbeit: [{ muster: /\bteam\b|gemeinsam|zusammen mit/i, richtung: 1 }],
  },
  tools_and_methods: {
    struktur: [{ muster: /checkliste|standard|prozess|vorlage|dokumentation/i, richtung: 1 }],
    tempo: [{ muster: /agil|sprint|schnell|kanban|scrum/i, richtung: 1 }],
  },
  salary_tradeoffs: {
    sicherheit: [{ muster: /sicherheit|unbefristet|planbar/i, richtung: 1 }],
    lernen: [{ muster: /lernen|entwicklung|weiterbild/i, richtung: 1 }],
    belastung: [{ muster: /weniger (?:stress|druck)|ruhiger|work.?life/i, richtung: 0 }],
  },
  location_options: {
    /*
     * Heimarbeit sagt etwas über Teamarbeit — aber nur, wenn jemand
     * sie ausdrücklich will, nicht wenn er sie nur duldet.
     */
    teamarbeit: [
      { muster: /nur homeoffice|ausschliesslich (?:remote|homeoffice)|voll remote/i, richtung: 0 },
      { muster: /gern (?:vor ort|im b[üu]ro)|pr[äa]senz/i, richtung: 1 },
    ],
  },
  avoided_tasks: {
    kundenkontakt: [
      { muster: /kunden|telefon|kundengespr[äa]ch|reklamation|beschwerde/i, richtung: 0 },
    ],
    wiederholung: [{ muster: /monoton|immer dasselbe|eint[öo]nig|langweilig/i, richtung: 0 }],
  },
  draining_but_able: {
    kundenkontakt: [{ muster: /kunden|telefon|pr[äa]sentation|verhandl/i, richtung: 0 }],
    belastung: [{ muster: /druck|hektik|deadline|termindruck/i, richtung: 0 }],
  },
};

/*
 * Verneinungen drehen die Richtung um.
 *
 * ── Der Fehler, den die Tests gefunden haben ──────────────────
 *
 * „Am liebsten freie Hand, ohne Rücksprache für jede Kleinigkeit."
 * Das Muster für WENIG Autonomie enthält „rücksprache" und traf — im
 * Satz „ohne Rücksprache", der genau das Gegenteil sagt. Zusammen mit
 * dem Treffer auf „freie Hand" ergab das einen Widerspruch, und die
 * Achse fiel heraus. Die eindeutigste Antwort im ganzen Test wurde
 * damit als unklar behandelt.
 *
 * Dasselbe bei „keine Führung übernehmen": Das Muster für VIEL
 * Verantwortung enthält „führung".
 *
 * Deutsch verneint vorangestellt und dicht am Wort. Zwölf Zeichen
 * davor genügen für „ohne", „keine", „nicht", „nie", „kaum".
 */
const VERNEINUNG = /\b(ohne|kein|keine|keinen|keiner|nicht|nie|niemals|kaum|ungern)\s+\S{0,6}$/i;

function gedreht(text: string, m: RegExpMatchArray, richtung: 0 | 1): 0 | 1 {
  const davor = text.slice(Math.max(0, (m.index ?? 0) - 24), m.index ?? 0);
  return VERNEINUNG.test(davor) ? ((1 - richtung) as 0 | 1) : richtung;
}

export interface Gelesen {
  dimension: Arbeitsdimension;
  /** 0 oder 1 — die Antwort zeigt eine Richtung, keinen Feinwert. */
  wert: number;
  /** Die Textstelle, an der es erkannt wurde. Ohne sie ist es nicht prüfbar. */
  beleg: string;
}

/**
 * Was eine Antwort über die Achsen sagt — oder nichts.
 *
 * Widersprüchliche Funde auf derselben Achse ergeben KEINEN Mittelwert,
 * sondern gar nichts. Wer sagt „ich mag klare Abläufe, aber auch mal
 * etwas Neues", hat zur Struktur nichts Verwertbares gesagt — und eine
 * 0,5 daraus wäre eine Zahl, die niemand geäussert hat.
 */
export function dimensionenAusAntwort(frageKey: string, antwort: string): Gelesen[] {
  const leser = LESER[frageKey];
  if (!leser) return [];
  const text = antwort.trim();
  /* Zu kurze Antworten tragen nichts. „Ja." ist keine Auskunft. */
  if (text.length < 12) return [];

  const raus: Gelesen[] = [];
  for (const d of ARBEITSDIMENSIONEN) {
    const zeichen = leser[d];
    if (!zeichen) continue;

    const treffer = zeichen
      .map((z) => {
        const m = text.match(z.muster);
        return m === null ? null : { z, m, richtung: gedreht(text, m, z.richtung) };
      })
      .filter((x): x is { z: Zeichen; m: RegExpMatchArray; richtung: 0 | 1 } => x !== null);
    if (treffer.length === 0) continue;

    const richtungen = new Set(treffer.map((t) => t.richtung));
    if (richtungen.size > 1) continue;

    raus.push({
      dimension: d,
      wert: treffer[0]!.richtung,
      beleg: `im Gespräch gesagt: „${treffer.map((t) => t.m[0]).join("“, „")}“`,
    });
  }
  return raus;
}

/**
 * Welche Achsen eine Frage überhaupt treffen kann.
 *
 * Damit lässt sich die Reihenfolge der Fragen danach richten, was noch
 * fehlt: Wer schon gesagt hat, wie viel Autonomie er will, muss nicht
 * als Nächstes danach gefragt werden — und wer zu keiner Achse etwas
 * gesagt hat, bekommt zuerst die Frage, die am meisten hergibt.
 *
 * Abgeleitet aus dem Leser selbst, nicht daneben gepflegt: Eine zweite
 * Liste liefe irgendwann auseinander, und dann fragte Monday nach etwas,
 * das sie gar nicht lesen kann.
 */
export const ACHSEN_JE_FRAGE: Record<string, Arbeitsdimension[]> = Object.fromEntries(
  Object.entries(LESER).map(([frage, achsen]) => [frage, Object.keys(achsen) as Arbeitsdimension[]]),
);

/**
 * Wie viele noch offene Achsen eine Frage treffen könnte.
 *
 * Null heisst: Diese Frage bringt für den Career Twin nichts mehr. Sie
 * kann trotzdem sinnvoll sein — sie liefert Belege, Fähigkeiten und
 * Erfahrungen, die mit den Achsen nichts zu tun haben.
 */
export function offeneAchsenTreffer(frageKey: string, offen: readonly Arbeitsdimension[]): number {
  const kann = ACHSEN_JE_FRAGE[frageKey];
  if (!kann) return 0;
  return kann.filter((d) => offen.includes(d)).length;
}
