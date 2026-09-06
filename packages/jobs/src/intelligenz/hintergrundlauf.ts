import { and, desc, eq, lt, sql } from "drizzle-orm";
import { schema, withUser, type Database } from "@paycheck/db";
import { faelligeProfile, syntheseFaellig, type Anlass } from "./hintergrund.ts";
import { profilsynthese } from "./synthese.ts";

/**
 * Der Hintergrundlauf: wer ansteht, und was ihn davon abhält, zu viel
 * zu tun.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum kein eigener Zeitplan
 * ══════════════════════════════════════════════════════════════
 *
 * Es gibt bereits einen Arbeiter, der alle fünfzehn Minuten läuft und
 * sechs Aufgaben abarbeitet (`apps/worker`). Ein zweiter Zeitplan
 * daneben wäre ein zweiter Ort, an dem etwas hängen bleibt, ein
 * zweites Protokoll und eine zweite Antwort auf „läuft das noch".
 *
 * Diese Datei ist deshalb kein Dienst, sondern eine Funktion. Was sie
 * antreibt, entscheidet der Aufrufer.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Rechnung, die diese Datei verhindert
 * ══════════════════════════════════════════════════════════════
 *
 * Bei hunderttausend Nutzern und einem Lauf alle fünfzehn Minuten
 * wären das, ohne Grenzen, 9,6 Millionen Aufrufe des tiefen Modells
 * am Tag. Es gibt vier Bremsen, und jede allein würde die Rechnung
 * nicht verhindern:
 *
 *   1. `faelligeProfile`   nur Profile mit frischer Aktivität
 *   2. `syntheseFaellig`   nur bei geändertem Belegstand
 *   3. der Anspruch        nie dasselbe Profil zweimal gleichzeitig
 *   4. das Aufrufbudget    harte Obergrenze je Lauf
 *
 * Die vierte ist die einzige, die auch dann hält, wenn die anderen
 * drei einen Fehler haben. Deshalb ist sie eine Zahl und keine Regel.
 */

/** Wie viele Profile ein Lauf höchstens ansieht. */
export const STAPEL = 25;

/**
 * Wie viele Synthesen gleichzeitig laufen.
 *
 * Drei, nicht mehr: Jede hält eine Datenbankverbindung und einen
 * offenen Modellaufruf. Bei zehn gleichzeitig läuft der Verbindungs-
 * pool leer, und der Webserver — der sich denselben Pool teilt —
 * wartet auf eine Verbindung, während im Hintergrund gerechnet wird.
 */
export const GLEICHZEITIG = 3;

/**
 * Die harte Obergrenze an Modellaufrufen je Lauf.
 *
 * Sie steht über allem anderen. Wenn eine der drei anderen Bremsen
 * einen Fehler hat — ein Fingerabdruck, der sich immer ändert, ein
 * Anspruch, der nicht greift —, ist das hier die Zahl, die zwischen
 * einem auffälligen Protokolleintrag und einer Rechnung steht.
 */
export const MODELLAUFRUFE_MAX = 20;

/** Nach wie vielen Fehlschlägen in Folge ein Profil ruht. */
export const VERSUCHE_MAX = 3;

/**
 * Ab wann ein laufender Anspruch als hängengeblieben gilt.
 *
 * Ein abgestürzter Arbeiter hinterlässt eine Zeile im Zustand
 * `laeuft`, und ohne diese Frist bliebe das Profil für immer
 * gesperrt. Fünfzehn Minuten sind grosszügig — eine Synthese dauert
 * Sekunden.
 */
export const STAU_MINUTEN = 15;

export interface Modellantwort {
  ergebnis: Record<string, unknown>;
  modell: string;
  konfidenz: number;
  /** Was der Aufruf gekostet hat, falls der Aufrufer es weiss. */
  kostenCent?: number;
}

export interface Hintergrundoptionen {
  /** Der Modellaufruf. Ohne ihn läuft nichts — das ist Absicht. */
  rufer: (fakten: string) => Promise<Modellantwort>;
  promptFassung?: string;
  stapel?: number;
  gleichzeitig?: number;
  modellaufrufeMax?: number;
  /** Nur Profile mit Aktivität in diesem Zeitfenster. */
  seitStunden?: number;
  /**
   * Nur diese Profile — statt der fälligen aus der Suche.
   *
   * ── Wofür das da ist ────────────────────────────────────────
   *
   * Für die ausdrückliche Bitte: Jemand sagt „schau dir mein Profil
   * noch mal an", und dann soll nicht bis zum nächsten Viertelstunden-
   * takt gewartet werden. Die Fälligkeitsprüfung läuft trotzdem —
   * auch eine Bitte rechtfertigt keinen zweiten Aufruf für denselben
   * Belegstand.
   */
  nurProfile?: readonly string[];
  /** Ob die Fälligkeitsprüfung als ausdrücklich gilt. */
  ausdruecklich?: boolean;
  jetzt?: Date;
}

export interface Hintergrundbefund {
  /** Wie viele Profile überhaupt angesehen wurden. */
  geprueft: number;
  /** Davon fällig. */
  faellig: number;
  /** Davon tatsächlich angefasst — Budget und Anspruch abgezogen. */
  bearbeitet: number;
  gelungen: number;
  fehlgeschlagen: number;
  /** Anspruch lag bei jemand anderem, oder das Profil ruht. */
  uebersprungen: number;
  /** Aufrufe des tiefen Modells. */
  solAufrufe: number;
  /**
   * Aufrufe des Ultra-Modells.
   *
   * Im Hintergrund immer null: Eine zweite Meinung entsteht nur in
   * der Karriereanalyse, und die läuft hier nicht. Das Feld steht
   * trotzdem da, weil „null" eine Aussage ist und ein fehlendes Feld
   * keine.
   */
  astraAufrufe: number;
  dauerMs: number;
  /** `null`, wenn kein Aufrufer Kosten gemeldet hat. */
  kostenCent: number | null;
  /** Warum Profile nicht bearbeitet wurden — für die Betriebsbeobachtung. */
  zurueckgehalten: Record<string, number>;
}

/* ═══════════════════════════════════════════════════════════════
   Der Anspruch
   ═══════════════════════════════════════════════════════════════ */

/**
 * Hängengebliebene Ansprüche freigeben.
 *
 * Läuft vor allem anderen und über alle Nutzer: Ein Anspruch, der
 * niemandem mehr gehört, ist keine Nutzerdatenfrage, sondern
 * Betriebszustand.
 */
async function stauAufloesen(db: Database, jetzt: Date): Promise<number> {
  const grenze = new Date(jetzt.getTime() - STAU_MINUTEN * 60_000);
  const raus = (await db.execute(sql`
    update profil_laeufe
       set zustand = 'abgebrochen', beendet_am = ${jetzt}, fehler = 'haengengeblieben'
     where zustand = 'laeuft' and begonnen_am < ${grenze}
    returning id
  `)) as unknown as { rows: unknown[] };
  return raus.rows.length;
}

/**
 * Den Anspruch nehmen — oder feststellen, dass ihn jemand anders hat.
 *
 * ── Warum das der einzige Weg ist ─────────────────────────────
 *
 * Der Unique-Index lässt genau eine Zeile im Zustand `laeuft` je
 * Profil und Art zu. Ein zweiter Arbeiter bekommt einen Konflikt und
 * damit `null` — er geht weiter, ohne dass jemand etwas koordinieren
 * musste.
 */
async function anspruchNehmen(
  db: Database,
  userId: string,
  art: string,
  anlass: Anlass,
  versuch: number,
  jetzt: Date,
): Promise<string | null> {
  try {
    const [zeile] = await withUser(db, userId, (tx) =>
      tx
        .insert(schema.profilLaeufe)
        .values({ userId, art, anlass, versuch, zustand: "laeuft", begonnenAm: jetzt })
        .onConflictDoNothing()
        .returning({ id: schema.profilLaeufe.id }),
    );
    return zeile?.id ?? null;
  } catch {
    /*
     * `onConflictDoNothing` deckt den Unique-Index ab; ein anderer
     * Fehler beim Anspruch ist ein Datenbankproblem und kein Grund,
     * den ganzen Lauf abzubrechen. Dann eben dieses Profil nicht.
     */
    return null;
  }
}

async function anspruchSchliessen(
  db: Database,
  userId: string,
  laufId: string,
  zustand: "fertig" | "fehler" | "uebersprungen",
  jetzt: Date,
  angaben: { modell?: string | null; modellaufrufe?: number; fehler?: string | null } = {},
): Promise<void> {
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.profilLaeufe)
      .set({
        zustand,
        beendetAm: jetzt,
        modell: angaben.modell ?? null,
        modellaufrufe: angaben.modellaufrufe ?? 0,
        fehler: angaben.fehler ?? null,
      })
      .where(
        and(eq(schema.profilLaeufe.id, laufId), eq(schema.profilLaeufe.userId, userId)),
      ),
  );
}

/**
 * Wie oft dieses Profil zuletzt hintereinander gescheitert ist.
 *
 * ── Warum „in Folge" und nicht „insgesamt" ────────────────────
 *
 * Weil ein Profil, das vor drei Wochen einmal gescheitert ist, kein
 * kaputtes Profil ist. Gezählt wird die Serie seit dem letzten
 * gelungenen Lauf — sie bricht ab, sobald einer durchgeht.
 */
async function fehlserie(db: Database, userId: string, art: string): Promise<number> {
  const zeilen = await withUser(db, userId, (tx) =>
    tx
      .select({ zustand: schema.profilLaeufe.zustand })
      .from(schema.profilLaeufe)
      .where(and(eq(schema.profilLaeufe.userId, userId), eq(schema.profilLaeufe.art, art)))
      .orderBy(desc(schema.profilLaeufe.begonnenAm))
      .limit(VERSUCHE_MAX),
  );

  let n = 0;
  for (const z of zeilen) {
    if (z.zustand === "fehler") n++;
    else break;
  }
  return n;
}

/**
 * Ob die Fehlserie lange genug her ist, um es wieder zu versuchen.
 *
 * Ein Profil ruht nicht für immer. Nach einem Tag ist die Lage eine
 * andere: neue Belege, ein anderes Modell, ein behobener Fehler.
 */
async function ruhtNoch(
  db: Database,
  userId: string,
  art: string,
  jetzt: Date,
): Promise<boolean> {
  const [letzte] = await withUser(db, userId, (tx) =>
    tx
      .select({ begonnenAm: schema.profilLaeufe.begonnenAm })
      .from(schema.profilLaeufe)
      .where(
        and(
          eq(schema.profilLaeufe.userId, userId),
          eq(schema.profilLaeufe.art, art),
          eq(schema.profilLaeufe.zustand, "fehler"),
        ),
      )
      .orderBy(desc(schema.profilLaeufe.begonnenAm))
      .limit(1),
  );
  if (!letzte) return false;
  return jetzt.getTime() - letzte.begonnenAm.getTime() < 24 * 3600_000;
}

/* ═══════════════════════════════════════════════════════════════
   Der Lauf
   ═══════════════════════════════════════════════════════════════ */

/**
 * Ein Durchgang: fällige Profile finden, synthetisieren, protokollieren.
 *
 * ── Warum ein Fehler nichts abbricht ──────────────────────────
 *
 * Weil ein einzelnes Profil mit einer kaputten Beleglage sonst alle
 * anderen mitnähme. Der Fehler landet als Klasse im Protokoll, das
 * Profil zählt als fehlgeschlagen, der Lauf geht weiter.
 */
export async function hintergrundSynthese(
  db: Database,
  optionen: Hintergrundoptionen,
): Promise<Hintergrundbefund> {
  const jetzt = optionen.jetzt ?? new Date();
  const beginn = Date.now();
  const art = "profilsynthese";
  const budget = optionen.modellaufrufeMax ?? MODELLAUFRUFE_MAX;

  const befund: Hintergrundbefund = {
    geprueft: 0,
    faellig: 0,
    bearbeitet: 0,
    gelungen: 0,
    fehlgeschlagen: 0,
    uebersprungen: 0,
    solAufrufe: 0,
    astraAufrufe: 0,
    dauerMs: 0,
    kostenCent: null,
    zurueckgehalten: {},
  };

  const haelt = (grund: string) => {
    befund.zurueckgehalten[grund] = (befund.zurueckgehalten[grund] ?? 0) + 1;
  };

  const abgebrochen = await stauAufloesen(db, jetzt);
  if (abgebrochen > 0) befund.zurueckgehalten.haengengeblieben_freigegeben = abgebrochen;

  const kandidaten =
    optionen.nurProfile && optionen.nurProfile.length > 0
      ? [...optionen.nurProfile].slice(0, optionen.stapel ?? STAPEL)
      : await faelligeProfile(db, {
          grenze: optionen.stapel ?? STAPEL,
          seitStunden: optionen.seitStunden,
          jetzt,
        });
  befund.geprueft = kandidaten.length;

  /*
   * Erst prüfen, dann arbeiten.
   *
   * Die Prüfung kostet zwei Abfragen und keinen Modellaufruf. Sie
   * vorzuziehen bedeutet, dass das Budget nur an Profile geht, die es
   * auch brauchen — und nicht an die ersten zwanzig der Liste.
   */
  const anstehend: { userId: string; anlass: Anlass }[] = [];
  for (const userId of kandidaten) {
    const f = await syntheseFaellig(db, userId, {
      art,
      jetzt,
      ausdruecklich: optionen.ausdruecklich,
    });
    if (!f.faellig) {
      haelt(f.anlass);
      continue;
    }
    befund.faellig++;
    anstehend.push({ userId, anlass: f.anlass });
  }

  let verbraucht = 0;
  let kosten: number | null = null;

  async function einesBearbeiten(eintrag: { userId: string; anlass: Anlass }): Promise<void> {
    /*
     * Das Budget wird VOR dem Anspruch geprüft und nach jedem Aufruf
     * neu. Ein Anspruch ohne Aufruf wäre eine Sperre ohne Arbeit —
     * und beim nächsten Lauf stünde das Profil auf `laeuft`, ohne
     * dass je jemand gerechnet hätte.
     */
    /*
     * ══════════════════════════════════════════════════════════════
     * Der Platz wird belegt, bevor gearbeitet wird
     * ══════════════════════════════════════════════════════════════
     *
     * Die erste Fassung prüfte hier nur und zählte erst nach dem
     * Anspruch hoch. Dazwischen lagen drei `await` — und drei
     * gleichzeitige Läufer lasen alle denselben Stand „null
     * verbraucht" und kamen alle durch. Ein Budget von zwei liess
     * drei Aufrufe zu.
     *
     * Prüfen und Belegen stehen deshalb ohne `await` dazwischen. In
     * einer Ereignisschleife ist das die einzige Art von Atomarität,
     * die es gibt — und sie genügt, solange nichts unterbricht.
     *
     * Wer den Platz danach nicht braucht, gibt ihn zurück.
     */
    if (verbraucht >= budget) {
      haelt("budget");
      return;
    }
    verbraucht++;

    if (await ruhtNoch(db, eintrag.userId, art, jetzt)) {
      const serie = await fehlserie(db, eintrag.userId, art);
      if (serie >= VERSUCHE_MAX) {
        haelt("ruht_nach_fehlern");
        befund.uebersprungen++;
        verbraucht--;
        return;
      }
    }

    const versuch = (await fehlserie(db, eintrag.userId, art)) + 1;
    const laufId = await anspruchNehmen(
      db,
      eintrag.userId,
      art,
      eintrag.anlass,
      versuch,
      jetzt,
    );
    if (!laufId) {
      haelt("anspruch_bei_anderem");
      befund.uebersprungen++;
      verbraucht--;
      return;
    }

    befund.bearbeitet++;

    let modell: string | null = null;
    try {
      const ergebnis = await profilsynthese(db, {
        userId: eintrag.userId,
        rufer: async (fakten) => {
          const a = await optionen.rufer(fakten);
          befund.solAufrufe++;
          if (typeof a.kostenCent === "number") kosten = (kosten ?? 0) + a.kostenCent;
          return a;
        },
        promptFassung: optionen.promptFassung,
        jetzt,
      });
      modell = ergebnis.modell;

      /*
       * Nicht jede Bearbeitung endet in einem Modellaufruf: Zu wenige
       * Belege, oder der Stand hat sich zwischen Prüfung und Anspruch
       * doch nicht geändert. Das ist kein Fehler — nur nichts zu tun.
       */
      await anspruchSchliessen(
        db,
        eintrag.userId,
        laufId,
        ergebnis.neuGerechnet ? "fertig" : "uebersprungen",
        new Date(),
        { modell, modellaufrufe: ergebnis.neuGerechnet ? 1 : 0 },
      );
      if (ergebnis.neuGerechnet) befund.gelungen++;
      else {
        befund.uebersprungen++;
        /* Der Aufruf ist nicht passiert — das Budget bekommt ihn zurück. */
        verbraucht--;
      }
    } catch (fehler) {
      befund.fehlgeschlagen++;
      await anspruchSchliessen(db, eintrag.userId, laufId, "fehler", new Date(), {
        modell,
        modellaufrufe: 1,
        /*
         * Die Klasse, nicht die Meldung.
         *
         * Eine Modellmeldung kann Teile des Prompts enthalten, und der
         * Prompt enthält, was die Person über sich gesagt hat.
         */
        fehler: fehler instanceof Error ? fehler.name : "unbekannt",
      }).catch(() => {});
    }
  }

  /*
   * Gleichzeitig, aber begrenzt.
   *
   * Ein einfacher Arbeiterpool: `GLEICHZEITIG` Läufer nehmen sich
   * reihum den nächsten Eintrag. Eine Bibliothek dafür wäre eine
   * Abhängigkeit für zwölf Zeilen.
   */
  let naechster = 0;
  const laeufer = Array.from(
    { length: Math.min(optionen.gleichzeitig ?? GLEICHZEITIG, Math.max(1, anstehend.length)) },
    async () => {
      for (;;) {
        const i = naechster++;
        if (i >= anstehend.length) return;
        await einesBearbeiten(anstehend[i]!);
      }
    },
  );
  await Promise.all(laeufer);

  befund.kostenCent = kosten;
  befund.dauerMs = Date.now() - beginn;
  return befund;
}

/**
 * Ansprüche eines Profils — für die Betriebsbeobachtung und die Tests.
 */
export async function laeufeLesen(
  db: Database,
  userId: string,
  grenze = 10,
): Promise<
  { art: string; anlass: string; zustand: string; versuch: number; fehler: string | null }[]
> {
  return withUser(db, userId, (tx) =>
    tx
      .select({
        art: schema.profilLaeufe.art,
        anlass: schema.profilLaeufe.anlass,
        zustand: schema.profilLaeufe.zustand,
        versuch: schema.profilLaeufe.versuch,
        fehler: schema.profilLaeufe.fehler,
      })
      .from(schema.profilLaeufe)
      .where(eq(schema.profilLaeufe.userId, userId))
      .orderBy(desc(schema.profilLaeufe.begonnenAm))
      .limit(grenze),
  );
}
