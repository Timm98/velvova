import { and, eq, inArray, sql } from "drizzle-orm";
import { schema, withUser, type Database } from "@paycheck/db";
import {
  entdoppeln,
  freigeben,
  darfJetzt,
  gelegenheitenAusKlaerungen,
  gelegenheitenAusSignalen,
  gelegenheitenAusStellenlage,
  interesseAusEreignissen,
  klasseVon,
  eineFrage,
  meldungBuendeln,
  musterAusEreignissen,
  offeneFragen,
  vergleichBauen,
  vergleichsgelegenheit,
  type Ereignis,
  type Erkenntniskontext,
  type Freigabe,
  type Gelegenheit,
  type Verhaltenssignal,
  type Zustand,
} from "@paycheck/matching";
import { ereignisseLaden, remoteMerkmale, stellenangabenKurz } from "./ereignisse.ts";
import { zustandLaden, nachrichtVermerken } from "./einstellungen.ts";
import { analyselageLaden, klaerungsstaendeLaden, stellenlageLaden } from "./erkenntnislage.ts";

/**
 * Ein Durchgang von Ninas Eigeninitiative.
 *
 * ══════════════════════════════════════════════════════════════
 * Ohne Modellaufruf
 * ══════════════════════════════════════════════════════════════
 *
 * „Stelle dreimal geöffnet, Gehalt und Anforderungen angesehen" führt
 * zu genau einer sinnvollen Handlung. Ein Sprachmodell zu fragen
 * kostete Geld, dauerte Sekunden und lieferte bei jedem Lauf eine
 * andere Formulierung derselben Sache — die Person läse dieselbe
 * Beobachtung dreimal verschieden und hielte es für drei
 * verschiedene Feststellungen.
 *
 * Das Modell kommt später dazu, für die Fälle mit mehreren
 * plausiblen Handlungen. Diese Schicht muss ohne es auskommen, sonst
 * ist die Grundfunktion an einen Anbieter gekoppelt.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Reihenfolge, und warum sie so ist
 * ══════════════════════════════════════════════════════════════
 *
 *   1. Ereignisse lesen, entdoppeln
 *   2. Signale ableiten und schreiben
 *   3. Gelegenheiten bilden
 *   4. Policy und Zurückhaltung prüfen
 *   5. Handlung schreiben, Wirkung ausführen
 *
 * Schritt 4 steht zwischen Absicht und Wirkung, nicht daneben. Was
 * die Prüfung nicht passiert, wird nicht geschrieben — und was
 * geschrieben ist, hat sie passiert.
 */

export interface Proaktivbefund {
  ereignisse: number;
  signale: number;
  gelegenheiten: number;
  ausgefuehrt: number;
  /** Davon ohne Nachricht — Nina hat gearbeitet, aber nichts gesagt. */
  still: number;
  vorgeschlagen: number;
  /** Wie viele Meldungen daraus entstanden. Höchstens eine je Art. */
  meldungen: number;
  /** Warum eine Gelegenheit nicht durchkam — für die Betriebsbeobachtung. */
  zurueckgehalten: Record<string, number>;
}

const LEER: Proaktivbefund = {
  ereignisse: 0,
  signale: 0,
  gelegenheiten: 0,
  ausgefuehrt: 0,
  still: 0,
  vorgeschlagen: 0,
  meldungen: 0,
  zurueckgehalten: {},
};

/* ═══════════════════════════════════════════════════════════════
   Signale schreiben
   ═══════════════════════════════════════════════════════════════ */

/**
 * Ein abgeleitetes Signal ablegen — ohne eine Entscheidung der Person
 * zu überschreiben.
 *
 * ── Warum `confirmed` und `rejected` unangetastet bleiben ─────
 *
 * Beides sind Antworten der Person. Sie durch einen neuen Lauf auf
 * `inferred` zurückzusetzen hiesse, ihr Wort gegen frische
 * Beobachtungen einzutauschen — und zwar lautlos, denn nach aussen
 * sähe es aus, als hätte Nina einfach neu nachgedacht.
 */
async function signalSchreiben(
  db: Database,
  userId: string,
  s: Verhaltenssignal,
  jetzt: Date,
): Promise<void> {
  await withUser(db, userId, async (tx) => {
    await tx
      .insert(schema.verhaltenssignale)
      .values({
        userId,
        art: s.art,
        jobId: s.jobId,
        staerke: s.staerke,
        belege: s.belege,
        beobachtung: s.beobachtung,
        status: s.status,
        gueltigBis: s.gueltigBis,
      })
      .onConflictDoUpdate({
        target: [
          schema.verhaltenssignale.userId,
          schema.verhaltenssignale.art,
          schema.verhaltenssignale.jobId,
        ],
        set: {
          staerke: s.staerke,
          belege: s.belege,
          beobachtung: s.beobachtung,
          gueltigBis: s.gueltigBis,
          aktualisiertAm: jetzt,
        },
        /*
         * Zwei Bedingungen, zwei verschiedene Gefahren.
         *
         * `status = 'inferred'` schützt die Antwort der Person: Was
         * sie bestätigt oder verworfen hat, wird von einem neuen Lauf
         * nicht auf „vermutet" zurückgesetzt.
         *
         * `aktualisiert_am <= jetzt` schützt vor einem alten Lauf.
         * Ein Arbeiter, der eine Minute hing und dann schreibt,
         * überschriebe sonst frischere Beobachtungen mit seinen
         * älteren — und die Stärke spränge ohne erkennbaren Grund
         * zurück.
         */
        setWhere: sql`${schema.verhaltenssignale.status} = 'inferred'
                  and ${schema.verhaltenssignale.aktualisiertAm} <= ${jetzt}`,
      });
  });
}

/* ═══════════════════════════════════════════════════════════════
   Handlung schreiben
   ═══════════════════════════════════════════════════════════════ */

/**
 * Ob dieselbe Handlung schon offen oder erledigt dasteht.
 *
 * Ohne diese Frage entstünde bei jedem Lauf eine neue Zeile für
 * dieselbe Beobachtung — und in „Von Nina automatisch" stünde
 * fünfmal dasselbe.
 */
async function schonDa(
  db: Database,
  userId: string,
  handlung: string,
  jobId: string | null,
  schluessel: string | null = null,
): Promise<boolean> {
  const zeilen = await withUser(db, userId, (tx) =>
    tx
      .select({ id: schema.ninaHandlungen.id })
      .from(schema.ninaHandlungen)
      .where(
        and(
          eq(schema.ninaHandlungen.userId, userId),
          eq(schema.ninaHandlungen.handlung, handlung),
          jobId === null
            ? sql`${schema.ninaHandlungen.jobId} is null`
            : eq(schema.ninaHandlungen.jobId, jobId),
          /*
           * Der Schlüssel unterscheidet, was die Stellen-ID nicht kann.
           *
           * Zwei Widersprüche sind beide `klaerung_ansprechen` ohne
           * Stelle. Ohne diese Bedingung wäre der zweite ein Duplikat
           * des ersten und käme nie zur Sprache — dieselbe Handlungs-
           * art, dieselbe leere Stelle.
           */
          schluessel === null
            ? sql`true`
            : eq(schema.ninaHandlungen.schluessel, schluessel),
          inArray(schema.ninaHandlungen.zustand, ["vorgeschlagen", "ausgefuehrt", "zugestimmt"]),
        ),
      )
      .limit(1),
  );
  return zeilen.length > 0;
}

async function handlungSchreiben(
  db: Database,
  userId: string,
  f: Freigabe,
  jetzt: Date,
  ergebnis: Record<string, unknown> | null = null,
): Promise<string | null> {
  const klasse = klasseVon(f.handlung);
  if (klasse === null || klasse === "explicit_only") return null;

  return withUser(db, userId, async (tx) => {
    const [zeile] = await tx
      .insert(schema.ninaHandlungen)
      .values({
        userId,
        handlung: f.handlung,
        klasse,
        jobId: f.jobId,
        begruendung: f.begruendung,
        belegEreignisse: f.belegEreignisse,
        policyFassung: f.policyFassung,
        /*
         * Was Zustimmung braucht, ist nicht getan, bis sie da ist.
         * Die Datenbank erzwingt dieselbe Unterscheidung über eine
         * Prüfbedingung — hier steht sie noch einmal, weil der
         * Unterschied das ganze Modul trägt.
         */
        zustand: f.brauchtZustimmung ? "vorgeschlagen" : "ausgefuehrt",
        nachricht: f.nachricht,
        schluessel: f.schluessel,
        ergebnis,
        erstelltAm: jetzt,
      })
      .returning({ id: schema.ninaHandlungen.id });
    return zeile?.id ?? null;
  });
}

/**
 * Die Wirkung einer ausgeführten Handlung.
 *
 * ── Warum nur zwei Fälle hier stehen ──────────────────────────
 *
 * Weil die anderen acht automatischen Handlungen noch keine Wirkung
 * haben — Vergleiche, Gruppierungen, offene Fragen kommen später.
 * Eine Handlung ohne Wirkung zu schreiben wäre ein Eintrag in „Von
 * Nina automatisch", hinter dem nichts steht.
 *
 * Deshalb: Was hier keinen Zweig hat, wird gar nicht erst zur
 * Gelegenheit. Die Prüfung dafür steht in `gelegenheitenAusSignalen`.
 */
async function wirkungAusfuehren(
  db: Database,
  userId: string,
  f: Freigabe,
  handlungId: string,
): Promise<void> {
  if (f.handlung === "job_vormerken" && f.jobId) {
    await withUser(db, userId, (tx) =>
      tx
        .insert(schema.ninaVormerkungen)
        .values({
          userId,
          jobId: f.jobId!,
          art: "interessant",
          handlungId,
          begruendung: f.begruendung,
        })
        .onConflictDoNothing(),
    );
    return;
  }

  if (f.handlung === "hypothese_merken") {
    /*
     * Die Hypothese steht bereits als Signal in `verhaltenssignale`
     * mit Status `inferred`. Hier ist nichts weiter zu tun — und
     * insbesondere wird kein bestätigtes Suchprofil angefasst.
     */
    return;
  }

  /*
   * `vergleich_vorbereiten`, `offene_fragen_sammeln` und
   * `treffer_melden` haben ihr Ergebnis bereits beim Schreiben
   * mitbekommen. Sie stehen hier, weil eine leere Verzweigung
   * ehrlicher ist als das Fehlen einer — beim Lesen sieht man, dass
   * an sie gedacht wurde.
   *
   * Bei `treffer_melden` IST die Nachricht die ganze Wirkung: Die
   * Stellen stehen ohnehin in der Liste, Nina sagt nur, dass
   * ungewöhnlich gute dabei sind. Sie zusätzlich zu verschieben oder
   * zu markieren wäre eine Änderung an der Reihenfolge, die niemand
   * verlangt hat.
   */
}

/* ═══════════════════════════════════════════════════════════════
   Ergebnisse vorbereiten
   ═══════════════════════════════════════════════════════════════ */

/**
 * Was eine Handlung an Inhalt hervorbringt, bevor sie geschrieben wird.
 *
 * ── Warum vorher und nicht nachher ────────────────────────────
 *
 * Weil eine Handlung ohne Ergebnis ein Eintrag in „Von Nina
 * automatisch" wäre, hinter dem nichts steht. Gibt es nichts zu
 * zeigen — keine offene Frage, kein Unterschied zwischen den Stellen
 * —, entsteht die Handlung gar nicht erst.
 */
async function ergebnisBauen(
  db: Database,
  f: Freigabe,
): Promise<{ weiter: boolean; ergebnis: Record<string, unknown> | null }> {
  if (f.handlung === "offene_fragen_sammeln" && f.jobId) {
    const angaben = await stellenangabenKurz(db, [f.jobId]);
    const stelle = angaben.get(f.jobId);
    if (!stelle) return { weiter: false, ergebnis: null };
    const fragen = offeneFragen(stelle);
    /* Eine vollständige Anzeige lässt nichts offen — dann kein Eintrag. */
    if (fragen.length === 0) return { weiter: false, ergebnis: null };
    return { weiter: true, ergebnis: { fragen } };
  }

  if (f.handlung === "treffer_melden") {
    /*
     * Ohne Stellen keine Meldung. Die Zahl IST die Nachricht — sie
     * hier zu verlieren ergäbe einen Eintrag, hinter dem nichts steht.
     */
    if (f.stellen.length === 0) return { weiter: false, ergebnis: null };
    return { weiter: true, ergebnis: { stellen: f.stellen } };
  }

  if (f.handlung === "vergleich_vorbereiten") {
    const angaben = await stellenangabenKurz(db, f.stellen);
    const stellen = f.stellen.map((id) => angaben.get(id)).filter((s) => s !== undefined);
    const vergleich = vergleichBauen(stellen);
    if (!vergleich) return { weiter: false, ergebnis: null };
    /*
     * Ein Vergleich ohne Unterschiede hilft niemandem. Zwei Stellen,
     * die in jedem bekannten Merkmal gleich sind, unterscheiden sich
     * in dem, was nicht dasteht — und dafür gibt es die offenen Fragen.
     */
    if (vergleich.unterschiede.length === 0) return { weiter: false, ergebnis: null };
    return { weiter: true, ergebnis: { vergleich } };
  }

  return { weiter: true, ergebnis: null };
}

/**
 * Eine Freigabe wieder als Gelegenheit lesen — nur für die Prüfung.
 *
 * `darfJetzt` fragt nach einer Gelegenheit, `freigeben` gibt eine
 * Freigabe zurück. Für die Prüfung der fertigen Meldung braucht es
 * die Form davor.
 */
function leitGelegenheit(f: Freigabe) {
  return {
    handlung: f.handlung,
    begruendung: f.begruendung,
    jobId: f.jobId,
    belegEreignisse: f.belegEreignisse,
    brauchtZustimmung: f.brauchtZustimmung,
    dringlichkeit: "niedrig" as const,
    nachricht: null as string | null,
  };
}

/** Die gebündelte Meldung an die führende Handlung hängen. */
async function nachrichtSetzen(
  db: Database,
  userId: string,
  handlungId: string,
  satz: string,
): Promise<void> {
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.ninaHandlungen)
      .set({ nachricht: satz })
      .where(
        and(eq(schema.ninaHandlungen.id, handlungId), eq(schema.ninaHandlungen.userId, userId)),
      ),
  );
}

/* ═══════════════════════════════════════════════════════════════
   Der Durchgang
   ═══════════════════════════════════════════════════════════════ */

export async function proaktivLauf(
  db: Database,
  userId: string,
  optionen: {
    jetzt?: Date;
    sitzungId?: string | null;
    /**
     * Womit die Person gerade beschäftigt ist.
     *
     * Mitten in einer Bewerbung ist eine Profilfrage eine
     * Unterbrechung, und die Antwort fällt schlechter aus, weil die
     * Person schnell weiterwill. Die Gelegenheit geht dabei nicht
     * verloren — sie kommt beim nächsten Lauf wieder.
     */
    beschaeftigtMit?: "bewerbung" | "stellensuche" | "gespraech" | null;
  } = {},
): Promise<Proaktivbefund> {
  const jetzt = optionen.jetzt ?? new Date();
  const zustand: Zustand = await zustandLaden(db, userId, optionen.sitzungId ?? null);

  /*
   * Abgeschaltet heisst abgeschaltet.
   *
   * Die Prüfung steht hier und nicht nur in `darfJetzt`, damit ein
   * Lauf für eine Person, die keine Eigeninitiative will, gar nicht
   * erst Signale schreibt. Beobachten ohne zu handeln wäre die
   * unangenehmste Variante von beidem.
   */
  const einstellung = await withUser(db, userId, (tx) =>
    tx
      .select({ aktiv: schema.ninaEigeninitiative.aktiv })
      .from(schema.ninaEigeninitiative)
      .where(eq(schema.ninaEigeninitiative.userId, userId))
      .limit(1),
  );
  if (einstellung[0]?.aktiv === false) return LEER;

  /* ── 1. Ereignisse ────────────────────────────────────────── */
  const roh = await ereignisseLaden(db, userId, jetzt);
  const ereignisse = entdoppeln(roh);

  /* ── 2. Signale ───────────────────────────────────────────── */
  const signale: Verhaltenssignal[] = [];

  /*
   * ══════════════════════════════════════════════════════════════
   * Warum hier kein früher Ausstieg mehr steht
   * ══════════════════════════════════════════════════════════════
   *
   * Bis eben brach der Lauf ab, wenn es keine Ereignisse gab: keine
   * Klicks, nichts zu tun. Das galt, solange Nina nur Klicks kannte.
   *
   * Seit der Intelligenzschicht ist es falsch. Ein Widerspruch
   * zwischen einer Aussage und dem bisherigen Verhalten entsteht aus
   * BELEGEN, nicht aus frischen Klicks — und wer eine Woche nichts
   * angesehen hat, ist genau der, dem die offene Frage am meisten
   * bringt.
   */
  if (ereignisse.length > 0) {
    const stellen = [
      ...new Set(ereignisse.map((e) => e.jobId).filter((x): x is string => x !== null)),
    ];
    const remote = await remoteMerkmale(db, stellen);

    for (const jobId of stellen) {
      const s = interesseAusEreignissen(jobId, ereignisse, jetzt);
      if (s) signale.push(s);
    }
    signale.push(...musterAusEreignissen(ereignisse, { remote }, jetzt));

    for (const s of signale) await signalSchreiben(db, userId, s, jetzt);
  }

  /* ── 3.–5. Gelegenheiten, Prüfung, Wirkung ───────────────── */
  const gelegenheiten: Gelegenheit[] = gelegenheitenAusSignalen(signale);
  const vergleich = vergleichsgelegenheit(signale);
  if (vergleich) gelegenheiten.push(vergleich);

  /*
   * ══════════════════════════════════════════════════════════════
   * Die Naht zur Intelligenzschicht
   * ══════════════════════════════════════════════════════════════
   *
   * Widersprüche, Wissenslücken und die Uneinigkeit zweier
   * Analyseläufe standen bisher in `profil_klaerungen` und blieben
   * dort liegen. Sie gehen jetzt durch dieselbe Prüfung wie alles
   * andere: Handlungsklasse, Zurückhaltung, Entdopplung, Protokoll.
   *
   * Kein zweiter Weg an der Policy vorbei — das ist der Punkt.
   */
  const analyselage = await analyselageLaden(db, userId);
  const kontext: Erkenntniskontext = {
    beschaeftigtMit: optionen.beschaeftigtMit ?? null,
    unsicherheit: analyselage.unsicherheit,
    analyseBlockiert: analyselage.analyseBlockiert,
  };

  const klaerungen = await klaerungsstaendeLaden(db, userId);
  gelegenheiten.push(...gelegenheitenAusKlaerungen(klaerungen, kontext));

  const seitStellen = new Date(jetzt.getTime() - 24 * 60 * 60 * 1000);
  const stellenlage = await stellenlageLaden(db, userId, seitStellen);
  gelegenheiten.push(...gelegenheitenAusStellenlage(stellenlage, kontext));

  if (gelegenheiten.length === 0) {
    return { ...LEER, ereignisse: ereignisse.length, signale: signale.length };
  }

  /*
   * Nach Relevanz, nicht nach Entstehungsreihenfolge.
   *
   * Es gibt genau einen Meldeplatz je Durchgang. Ohne diese
   * Sortierung bekäme ihn, was zufällig zuerst gerechnet wurde — und
   * „drei neue Stellen passen gut" verdrängte „deine Wunschstelle
   * liegt unter deiner Untergrenze".
   *
   * Gelegenheiten ohne Relevanzwert stammen aus Verhaltenssignalen.
   * Sie bekommen 0,5: über dem, was die Erkenntnisschicht knapp
   * durchlässt, unter dem, was sie für dringend hält.
   */
  gelegenheiten.sort((a, b) => (b.relevanz ?? 0.5) - (a.relevanz ?? 0.5));

  const befund: Proaktivbefund = {
    ...LEER,
    ereignisse: ereignisse.length,
    signale: signale.length,
    gelegenheiten: gelegenheiten.length,
    zurueckgehalten: {},
  };

  /*
   * Der Zustand wandert durch die Schleife mit.
   *
   * Ohne das käme in einem Durchgang jede Gelegenheit durch: Die
   * Prüfung sähe immer denselben Stand „null Nachrichten in dieser
   * Sitzung" und liesse alle durch — genau die Flut, die die Regeln
   * verhindern sollen.
   */
  /*
   * ══════════════════════════════════════════════════════════════
   * Erst alles tun, dann einmal reden
   * ══════════════════════════════════════════════════════════════
   *
   * Die erste Fassung entschied je Gelegenheit einzeln, ob geredet
   * wird. Bei zwei Vormerkungen, einem Vergleich und zwei
   * Fragenlisten hätte Nina in einem Durchgang bis zu fünfmal etwas
   * gesagt — für einen Vorgang.
   *
   * Jetzt läuft es in zwei Runden. Erst werden alle Handlungen
   * ausgeführt, still. Danach entsteht daraus höchstens ein Satz und
   * höchstens eine Frage.
   *
   * Handeln und Reden sind zweierlei: Intern dürfen weiter vier
   * Handlungen entstehen; nach aussen ist es eine Meldung.
   */
  let laufenderZustand = zustand;
  const ausgefuehrte: { freigabe: Freigabe; handlungId: string; ergebnis: Record<string, unknown> | null }[] = [];
  const vorschlaege: { freigabe: Freigabe; ergebnis: Record<string, unknown> | null }[] = [];

  for (const g of gelegenheiten) {
    if (await schonDa(db, userId, g.handlung, g.jobId, g.schluessel ?? null)) {
      befund.zurueckgehalten.schon_vorhanden = (befund.zurueckgehalten.schon_vorhanden ?? 0) + 1;
      continue;
    }

    /*
     * Nur was Nina selbst tun darf, geht stumm in die Prüfung.
     *
     * Für diese Handlungen entsteht die Nachricht erst am Ende, aus
     * allen zusammen — die Sprechpausen gelten dann ihr, nicht der
     * einzelnen Handlung.
     *
     * Eine Frage behält ihren Wortlaut. Die erste Fassung nahm ihn
     * auch weg, und `freigeben` fiel auf die Begründung zurück: Aus
     * „Soll ich Stellen mit genannter Vergütung weiter oben zeigen?"
     * wurde „Du hast bei 3 Stellen zuerst das Gehalt geöffnet." —
     * eine Feststellung mit zwei Antwortknöpfen darunter.
     */
    const stumm = klasseVon(g.handlung) === "auto_allowed";
    const f = freigeben(stumm ? { ...g, nachricht: null } : g, laufenderZustand, jetzt);
    if (!f) {
      befund.zurueckgehalten.policy = (befund.zurueckgehalten.policy ?? 0) + 1;
      continue;
    }

    const { weiter, ergebnis } = await ergebnisBauen(db, f);
    if (!weiter) {
      befund.zurueckgehalten.ohne_ergebnis = (befund.zurueckgehalten.ohne_ergebnis ?? 0) + 1;
      continue;
    }

    if (f.brauchtZustimmung) {
      vorschlaege.push({ freigabe: f, ergebnis });
      continue;
    }

    const handlungId = await handlungSchreiben(db, userId, f, jetzt, ergebnis);
    if (!handlungId) continue;
    await wirkungAusfuehren(db, userId, f, handlungId);
    ausgefuehrte.push({ freigabe: f, handlungId, ergebnis });
    befund.ausgefuehrt++;
    befund.still++;
  }

  /* ── Die eine Meldung ─────────────────────────────────────── */
  const satz = meldungBuendeln(
    ausgefuehrte.map((a) => ({
      handlung: a.freigabe.handlung,
      jobId: a.freigabe.jobId,
      ergebnis: a.ergebnis,
    })),
  );

  if (satz !== null) {
    /*
     * Die Meldung hängt an einer Handlung — der aussagekräftigsten.
     *
     * Ein Vergleich führt, sonst die erste Vormerkung. Eine eigene
     * Meldungstabelle wäre sauberer getrennt und hätte eine zweite
     * Stelle geschaffen, an der Rechteprüfung und Rücknahme hängen.
     */
    const leit =
      ausgefuehrte.find((a) => a.freigabe.handlung === "vergleich_vorbereiten") ??
      ausgefuehrte.find((a) => a.freigabe.handlung === "job_vormerken") ??
      ausgefuehrte[0];

    if (leit) {
      const darf = darfJetzt(
        { ...leitGelegenheit(leit.freigabe), nachricht: satz },
        laufenderZustand,
        jetzt,
      );
      if (darf.erlaubt) {
        await nachrichtSetzen(db, userId, leit.handlungId, satz);
        await nachrichtVermerken(db, userId, optionen.sitzungId ?? null, jetzt);
        befund.meldungen++;
        befund.still--;
        laufenderZustand = {
          ...laufenderZustand,
          letzteNachricht: jetzt,
          inSitzung: laufenderZustand.inSitzung + 1,
          themenDerSitzung: new Set([...laufenderZustand.themenDerSitzung, leit.freigabe.handlung]),
        };
      } else {
        befund.zurueckgehalten.zurueckhaltung =
          (befund.zurueckgehalten.zurueckhaltung ?? 0) + 1;
      }
    }
  }

  /* ── Die eine Frage ───────────────────────────────────────── */
  const { jetzt: gefragt, wartend } = eineFrage(vorschlaege.map((v) => v.freigabe));

  for (const v of vorschlaege) {
    const istDieFrage = gefragt !== null && v.freigabe.handlung === gefragt.handlung;
    /*
     * Die wartenden Fragen gehen nicht verloren. Sie stehen als
     * Vorschlag ohne Nachricht in „Von Nina vorbereitet“ — und nach
     * einer Antwort wird neu bewertet, welche davon noch gilt.
     */
    const id = await handlungSchreiben(
      db,
      userId,
      { ...v.freigabe, nachricht: istDieFrage ? v.freigabe.nachricht : null },
      jetzt,
      v.ergebnis,
    );
    if (!id) continue;
    befund.vorgeschlagen++;
    if (istDieFrage && v.freigabe.nachricht !== null) {
      await nachrichtVermerken(db, userId, optionen.sitzungId ?? null, jetzt);
      befund.meldungen++;
    }
  }

  return befund;
}
