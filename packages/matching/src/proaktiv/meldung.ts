import type { Freigabe } from "./engine.ts";

/**
 * Aus mehreren Handlungen eine Meldung.
 *
 * ══════════════════════════════════════════════════════════════
 * Handeln und Reden sind zweierlei
 * ══════════════════════════════════════════════════════════════
 *
 * In einem Durchgang können vier Dinge geschehen: zwei Stellen
 * vorgemerkt, ein Vergleich vorbereitet, offene Fragen gesammelt.
 * Alle vier sind nützlich. Viermal davon zu erzählen ist es nicht.
 *
 * Monday soll im Hintergrund arbeiten und sich selten melden. Vier
 * Einblendungen für einen Vorgang machen aus einer Assistentin ein
 * Benachrichtigungszentrum — und das schaltet man ab.
 *
 * ══════════════════════════════════════════════════════════════
 * Was der Satz sagen darf
 * ══════════════════════════════════════════════════════════════
 *
 * Nur was tatsächlich geschehen ist, und nur was in den Daten steht.
 * „Bei einer sind Gehalt und Arbeitszeiten noch nicht klar" ist
 * zulässig, wenn genau diese beiden Fragen offen sind — und sonst
 * nicht.
 *
 * Ein zusammengefasster Satz ist besonders anfällig dafür: Er klingt
 * flüssiger, wenn man ihn rundet, und jede Rundung ist eine
 * Behauptung, die die Daten nicht tragen.
 */

export interface Handlungsbeleg {
  handlung: string;
  jobId: string | null;
  ergebnis: Record<string, unknown> | null;
}

/** Wie viele Merkmale ein zusammengefasster Satz nennen darf. */
const MERKMALE_IM_SATZ = 2;

function anzahlwort(n: number, eins: string, mehr: string): string {
  return n === 1 ? `eine ${eins}` : `${n === 2 ? "zwei" : n === 3 ? "drei" : String(n)} ${mehr}`;
}

function fragenListe(belege: readonly Handlungsbeleg[]): string[] {
  const raus: string[] = [];
  for (const b of belege) {
    if (b.handlung !== "offene_fragen_sammeln") continue;
    const e = b.ergebnis as { fragen?: { schluessel: string }[] } | null;
    for (const f of e?.fragen ?? []) raus.push(f.schluessel);
  }
  return [...new Set(raus)];
}

const FRAGENWORT: Record<string, string> = {
  gehalt: "das Gehalt",
  gehaltsspanne: "die Gehaltsspanne",
  stunden: "die Arbeitszeit",
  schicht: "die Arbeitszeiten",
  buerotage: "die Bürotage",
  arbeitsmodell: "das Arbeitsmodell",
  vertrag: "die Vertragsart",
};

/**
 * Der eine Satz für einen ganzen Durchgang.
 *
 * `null` heisst: Es gibt nichts zu sagen. Das ist ein gültiges und
 * häufiges Ergebnis — Monday hat gearbeitet, und die Person erfährt es,
 * wenn sie in „Von Monday vorbereitet“ nachsieht.
 */
export function meldungBuendeln(belege: readonly Handlungsbeleg[]): string | null {
  if (belege.length === 0) return null;

  const vergleiche = belege.filter((b) => b.handlung === "vergleich_vorbereiten");
  const treffer = belege.filter((b) => b.handlung === "treffer_melden");
  const fragen = fragenListe(belege);

  /*
   * ══════════════════════════════════════════════════════════════
   * Wann Monday überhaupt etwas sagt
   * ══════════════════════════════════════════════════════════════
   *
   * Nur wenn sie etwas vorbereitet hat, das die Person auf der Seite
   * vor sich NICHT sehen kann. Das sind heute zwei Dinge: der
   * Vergleich über mehrere Stellen hinweg — und mehrere neue Stellen,
   * die ungewöhnlich gut passen.
   *
   * Der zweite Fall ist der Grund, warum diese Liste überhaupt eine
   * Liste ist und keine Ausnahme: Neue Treffer stehen woanders in
   * einer langen Liste, und wer gerade eine Anzeige liest, sieht sie
   * nicht.
   *
   * ── Warum eine blosse Vormerkung schweigt ───────────────────
   *
   * „Ich habe diese Stelle für dich vorgemerkt" — gesagt zu jemandem,
   * der gerade auf ebendieser Stelle steht und sie zum dritten Mal
   * liest. Das ist keine Auskunft, sondern ein Echo. Er weiss, dass
   * er interessiert ist; deshalb ist er da.
   *
   * Dass Monday vorgemerkt hat, steht in „Von Monday vorbereitet". Wer
   * es wissen will, findet es. Wer es nicht wissen will, wird nicht
   * unterbrochen.
   *
   * ── Und warum offene Fragen allein auch schweigen ───────────
   *
   * Aus demselben Grund. Dass die Anzeige kein Gehalt nennt, sieht
   * man ihr an. Als Zusatz zu einem Vergleich ist es nützlich — dort
   * hat man zwei Anzeigen nebeneinander und übersieht es leicht.
   */
  if (vergleiche.length === 0 && treffer.length === 0) return null;

  const teile: string[] = [];

  for (const t of treffer.slice(0, 1)) {
    const e = t.ergebnis as { stellen?: string[] } | null;
    const anzahl = e?.stellen?.length ?? 0;
    /*
     * Ohne Zahl kein Satz.
     *
     * „Es gibt neue passende Stellen" ohne Angabe, wie viele, wäre
     * eine Ankündigung ohne Inhalt — und die Person müsste nachsehen,
     * um zu erfahren, ob sich das Nachsehen lohnt.
     */
    if (anzahl > 0) {
      teile.push(
        `${anzahl === 1 ? "Eine neue Stelle passt" : `${anzahl} neue Stellen passen`} ` +
          `ungewöhnlich gut zu dem, was du suchst.`,
      );
    }
  }

  if (vergleiche.length > 0) {
    const e = vergleiche[0]!.ergebnis as
      | { vergleich?: { jobIds?: string[]; unterschiede?: string[] } }
      | null;
    const anzahl = e?.vergleich?.jobIds?.length ?? 2;
    teile.push(`Ich habe ${anzahlwort(anzahl, "Stelle", "Stellen")} für dich gegenübergestellt.`);

    const unterschiede = e?.vergleich?.unterschiede ?? [];
    if (unterschiede.length > 0) {
      /*
       * Höchstens zwei Merkmale nennen. Bei fünf ist es keine
       * Zusammenfassung mehr, sondern die Tabelle in Satzform.
       */
      /*
       * Die Merkmale bleiben, wie sie geschrieben stehen.
       *
       * Ein `.toLowerCase()` machte daraus „bei ort und vertrag" —
       * im Deutschen werden Substantive grossgeschrieben, und ein
       * Satz, der das nicht tut, sieht aus wie von einer Maschine.
       */
      const genannt = unterschiede.slice(0, MERKMALE_IM_SATZ);
      teile.push(
        genannt.length === 1
          ? `Sie unterscheiden sich vor allem beim ${genannt[0]}.`
          : `Sie unterscheiden sich vor allem bei ${genannt[0]} und ${genannt[1]}.`,
      );
    }
  }

  /*
   * Offene Fragen nur nennen, wenn sie benannt werden können.
   *
   * „Bei einer ist noch etwas unklar" wäre ein Satz, der beunruhigt,
   * ohne zu helfen. Steht kein Wort für die Frage bereit, bleibt sie
   * in der Liste und nicht im Satz.
   */
  const benennbar = fragen.map((f) => FRAGENWORT[f]).filter((w): w is string => w !== undefined);
  if (benennbar.length > 0) {
    const genannt = benennbar.slice(0, MERKMALE_IM_SATZ);
    teile.push(
      genannt.length === 1
        ? `Offen ist noch ${genannt[0]}.`
        : `Offen sind noch ${genannt[0]} und ${genannt[1]}.`,
    );
  }

  if (teile.length === 0) return null;
  return teile.join(" ");
}

/* ═══════════════════════════════════════════════════════════════
   Eine Frage zur Zeit
   ═══════════════════════════════════════════════════════════════ */

/**
 * Wie dringend eine Frage ist — je grösser, desto eher.
 *
 * ── Warum überhaupt eine Rangfolge ────────────────────────────
 *
 * Weil sonst die Reihenfolge entscheidet, in der die Signale
 * zufällig entstanden sind. Vier Fragen auf einmal wären eine
 * Umfrage; eine willkürlich gewählte wäre Zufall. Eine begründet
 * gewählte ist eine Frage.
 */
const FRAGENRANG: Record<string, number> = {
  /* Eine Suche, die nichts findet, ist das dringendste Problem. */
  umkreis_erweitern: 7,
  /*
   * Ein Widerspruch steht so weit oben, weil er alles darunter
   * verfälscht. Solange unklar ist, ob Vertrieb ausgeschlossen bleibt,
   * ist jede Empfehlung darunter auf Sand gebaut — und jede weitere
   * Frage klärt ein Detail an einem Bild, das im Kern nicht stimmt.
   */
  klaerung_ansprechen: 6,
  gehalt_lockern: 5,
  /*
   * Die Rückfrage zur laufenden Suche steht weit oben.
   *
   * Sie bezieht sich auf das, was die Person GERADE tut — und eine
   * Frage zum aktuellen Vorgang ist immer dringlicher als eine zum
   * Profil im Allgemeinen.
   */
  suchfrage_stellen: 5,
  wissensluecke_fragen: 4,
  richtung_aufnehmen: 3,
  /*
   * Uneinigkeit zweier Läufe ist keine dringende Frage, sondern eine
   * ehrliche Auskunft. Sie darf warten, bis nichts Wichtigeres ansteht.
   */
  unsicherheit_melden: 3,
  suchauftrag_aendern: 2,
  profil_uebernehmen: 2,
  mail_aktivieren: 1,
  mail_haeufiger: 1,
};

/**
 * Die eine Frage, die gestellt wird — und welche warten.
 *
 * Die wartenden gehen nicht verloren: Sie werden als Vorschlag
 * abgelegt und stehen in „Von Monday vorbereitet“. Nach einer Antwort
 * wird neu bewertet, welche davon überhaupt noch gilt.
 */
export function eineFrage(vorschlaege: readonly Freigabe[]): {
  jetzt: Freigabe | null;
  wartend: Freigabe[];
} {
  const fragen = vorschlaege.filter((f) => f.brauchtZustimmung);
  if (fragen.length === 0) return { jetzt: null, wartend: [] };

  const sortiert = [...fragen].sort((a, b) => {
    const rang = (FRAGENRANG[b.handlung] ?? 0) - (FRAGENRANG[a.handlung] ?? 0);
    /* Bei gleichem Rang die Handlungsart — damit zwei Läufe mit
       denselben Daten dieselbe Frage stellen. */
    return rang !== 0 ? rang : a.handlung.localeCompare(b.handlung);
  });

  return { jetzt: sortiert[0]!, wartend: sortiert.slice(1) };
}
