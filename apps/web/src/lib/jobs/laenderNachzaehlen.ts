import { sql } from "drizzle-orm";
import { getDb } from "@paycheck/db";

/**
 * Was `db.execute` zurückgibt, soweit es hier gebraucht wird.
 *
 * Der Rückgabetyp hängt am Treiber und ist im Zusammenspiel mit
 * Drizzle `unknown`. Statt an jeder Stelle zu casten steht die Form
 * einmal hier — mit dem einzigen Feld, das gelesen wird.
 */
type Ergebnis<T> = { rows: T[] };

/**
 * Stellen je Land nachzählen — im Pflegelauf, ein Stück pro Durchgang.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das hier steht und nicht mehr nur im Skript
 * ══════════════════════════════════════════════════════════════
 *
 * `scripts/laender-zaehlen.mjs` gab es schon, und darüber stand, es
 * laufe „im stündlichen Pflegelauf". Es lief dort nie: Der Zeitplan
 * ruft `/api/jobs/refresh`, und diese Route kannte das Skript nicht.
 *
 * Zwei Fehler übereinander. Das Skript schrieb sein Ergebnis gar nicht
 * erst weg, und selbst als es das tat, hätte es niemand aufgerufen.
 * Der Fuss zeigte am 8. September 2026 2.498.075 Stellen, während der
 * Bestand bei 3.486.049 lag.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nicht alle Länder auf einmal
 * ══════════════════════════════════════════════════════════════
 *
 * Gemessen an der Produktionsdatenbank: eine Zählung für die Schweiz
 * mit 77.393 Stellen braucht 16,6 Sekunden, für Deutschland mit 1,2
 * Millionen entsprechend länger. Zweiundzwanzig Länder am Stück
 * überschreiten das, was neben dem Abruf im selben Aufruf Platz hat.
 *
 * Deshalb dieselbe Lösung wie bei den Quellen: Der Takt ist der
 * Zeiger. Jeder Lauf nimmt ein paar Länder, beginnend dort, wo der
 * vorige aufgehört hätte. Nach ein paar Stunden ist jedes einmal dran
 * gewesen, ohne dass irgendwo ein Zustand gespeichert werden muss.
 *
 * ══════════════════════════════════════════════════════════════
 * Und warum hier nichts gelöscht wird
 * ══════════════════════════════════════════════════════════════
 *
 * Das Skript entfernt Länder ohne Stellen — richtig, weil es alle
 * zählt. Ein rotierender Lauf sieht immer nur einen Ausschnitt. Würde
 * er löschen, was er gerade nicht gezählt hat, bliebe im Fuss nach
 * jedem Durchgang genau eine Handvoll Länder stehen.
 *
 * Aufräumen bleibt deshalb Sache des vollständigen Laufs.
 */

export interface Zaehlergebnis {
  /** Die Länder, die dieser Lauf angefasst hat. */
  gezaehlt: { land: string; stellen: number }[];
  /** Länder, deren Zählung fehlschlug — mit Grund. */
  fehler: { land: string; grund: string }[];
  /** Wurde wegen der Zeit abgebrochen? */
  abgebrochen: boolean;
  dauerMs: number;
}

/** So viele Länder höchstens je Lauf. */
export const LAENDER_JE_LAUF = 4;

/**
 * Wie lange eine einzelne Zählung höchstens laufen darf.
 *
 * Auch wenn das Budget mehr hergibt. Eine Zählung über ein Land mit
 * Millionen Zeilen bringt keine bessere Zahl, wenn sie eine Minute
 * dauert — sie bringt dieselbe Zahl später, und in der Zwischenzeit
 * hängt der ganze Abruf daran.
 */
export const MAX_ABFRAGE_MS = 20_000;

export async function laenderNachzaehlen(opt: {
  /** Der Rotationszeiger des Laufs — dieselbe Zahl wie bei den Quellen. */
  takt: number;
  /** Was an Zeit übrig ist. Darunter wird gar nicht erst begonnen. */
  budgetMs: number;
  /**
   * Länder, die dazukommen könnten — aus den Namen der Adapter, die
   * gerade gelaufen sind.
   *
   * Ohne sie zählt diese Funktion nur, was schon einmal gezählt
   * wurde, und ein neues Land bliebe unsichtbar. Siehe unten.
   */
  zusaetzlicheLaender?: readonly string[];
}): Promise<Zaehlergebnis> {
  const beginn = Date.now();
  const gezaehlt: Zaehlergebnis["gezaehlt"] = [];
  const fehler: Zaehlergebnis["fehler"] = [];
  let abgebrochen = false;

  const db = await getDb();

  /*
   * ══════════════════════════════════════════════════════════════
   * Welche Länder es gibt — und warum nicht mehr aus `jobs`
   * ══════════════════════════════════════════════════════════════
   *
   * Hier stand `select distinct country from jobs` mit dem Kommentar
   * „läuft über den Index und ist billig". Beides war falsch.
   *
   * Gemessen am 9. September 2026 gegen die Produktionsdatenbank:
   *
   *     count(*) jobs                 Abbruch nach 40 s
   *     distinct country              33.100 ms  → 22 Länder
   *     Sprunglauf über den Index     Abbruch nach 40 s
   *     select land from laenderbestand   277 ms  → 22 Länder
   *
   * Dieselben zweiundzwanzig Länder, in einem Hundertzwanzigstel der
   * Zeit. `DISTINCT` liest den Index VOLLSTÄNDIG — Millionen Einträge,
   * um zweiundzwanzig Werte zu finden. Ein Index hilft beim Suchen,
   * nicht beim Durchzählen.
   *
   * ── Der Einwand, der dagegen stand ─────────────────────────────
   *
   * „Sonst kann ein Land, das über eine Quelle hereinkommt, nie
   * hinzukommen: Es steht ja noch nicht drin." Der Einwand ist
   * richtig, und deshalb wird er beantwortet statt übergangen.
   *
   * Nicht mit einem Suchlauf über die Stellen — auch ein Zeitfenster
   * von zwei Stunden brach nach 30 Sekunden ab. Sondern mit dem, was
   * der Aufrufer ohnehin weiss: Die Adapter, die gerade gelaufen
   * sind, heissen `adzuna_de`, `careerjet_fr`, `jooble_pl`. Ihr Land
   * steht im Namen und kostet nichts.
   *
   * Ein neu hinzugekommenes Land taucht damit im selben Lauf auf, in
   * dem seine erste Stelle hereinkommt — und nicht erst, wenn jemand
   * eine halbe Minute lang die ganze Tabelle liest.
   */
  let bekannteLaender: string[] = [];
  try {
    const zeilen = (await db.execute(
      sql`select land from laenderbestand`,
    )) as Ergebnis<{ land: string }>;
    bekannteLaender = zeilen.rows.map((z) => z.land);
  } catch (e) {
    /*
     * Die Liste fehlt, die Adapterländer nicht.
     *
     * Steht `laenderbestand` nicht zur Verfügung, zählt der Lauf
     * wenigstens die Länder, aus denen gerade etwas hereinkam — statt
     * gar nichts zu tun.
     */
    fehler.push({ land: "*", grund: e instanceof Error ? e.message : String(e) });
  }

  let vorhanden = [...new Set([...bekannteLaender, ...(opt.zusaetzlicheLaender ?? [])])]
    .filter((l) => typeof l === "string" && l.length === 2)
    .sort();

  /*
   * Der erste Lauf einer frischen Installation.
   *
   * Dann ist `laenderbestand` leer, und wenn die laufenden Adapter kein
   * Land im Namen tragen — `arbeitnow`, `bundesagentur` —, bliebe die
   * Liste leer und die Tabelle für immer ungefüllt. Ein Henne-Ei-Fall,
   * den der schnelle Weg allein nicht auflöst.
   *
   * Nur dann, und nur dann, der teure Suchlauf. Er kostet auf einem
   * gewachsenen Bestand über dreissig Sekunden — auf einem leeren
   * kostet er nichts, und genau dort wird er gebraucht.
   */
  if (vorhanden.length === 0) {
    try {
      const alle = (await db.execute(
        sql`select distinct country from jobs where country is not null`,
      )) as Ergebnis<{ country: string }>;
      vorhanden = alle.rows.map((z) => z.country).filter(Boolean).sort();
    } catch (e) {
      fehler.push({ land: "*", grund: e instanceof Error ? e.message : String(e) });
    }
  }

  if (vorhanden.length === 0) {
    return { gezaehlt, fehler, abgebrochen: false, dauerMs: Date.now() - beginn };
  }

  const versatz = takterVersatz(opt.takt, vorhanden.length);

  for (let n = 0; n < Math.min(LAENDER_JE_LAUF, vorhanden.length); n++) {
    if (Date.now() - beginn > opt.budgetMs) {
      abgebrochen = true;
      break;
    }
    const land = vorhanden[(versatz + n) % vorhanden.length]!;

    /*
     * Die Frist gehört in die Datenbank, nicht in die Schleife.
     *
     * Die Prüfung oben steht ZWISCHEN zwei Ländern. Eine laufende
     * Abfrage bricht sie nicht ab — ein JS-Zeitgeber kann eine
     * Postgres-Abfrage nicht abbrechen, er kann nur aufhören, auf sie
     * zu warten. Und das tut hier niemand: `await` wartet, bis die
     * Antwort da ist, egal was die Uhr sagt.
     *
     * Gemessen am 9. September 2026: Der Aufruf hing volle 240
     * Sekunden, obwohl das Budget der Route bei 200 liegt. Der
     * Kommentar zwei Zeilen weiter unten misst den Grund selbst — 91
     * Sekunden für EINE Zählung, bevor der Filter dazukam.
     *
     * `statement_timeout` sagt es dem Server. Der bricht die eigene
     * Abfrage ab und antwortet mit einem Fehler, und daraus wird ein
     * sauberer Abbruch statt einer Blockade.
     *
     * `set local` und damit in einer Transaktion: Ohne `local` bliebe
     * die Einstellung an der Verbindung hängen, und die kommt aus
     * einem Pool — die nächste Abfrage eines ganz anderen Aufrufers
     * hätte plötzlich dieselbe Frist.
     */
    const frist = Math.round(
      Math.max(2_000, Math.min(opt.budgetMs - (Date.now() - beginn), MAX_ABFRAGE_MS)),
    );

    try {
      /*
       * Der Ablauf-Filter steht mit im `where`, und das ist kein
       * Beiwerk: Gemessen war die Zählung damit 16,6 statt 91,1
       * Sekunden — er schränkt früher ein. Inhaltlich gehört er ohnehin
       * dazu, weil der Fuss zu einer Trefferliste führt.
       */
      const antwort = (await db.transaction(async (tx) => {
        await tx.execute(sql.raw(`set local statement_timeout = ${frist}`));
        return await tx.execute(sql`
          select count(*)::bigint n from jobs
          where is_demo = false and country = ${land}
            and (expires_at is null or expires_at > now())`);
      })) as Ergebnis<{ n: string | number }>;
      const stellen = Number(antwort.rows[0]?.n ?? 0);

      if (stellen > 0) {
        await db.execute(sql`
          insert into laenderbestand (land, stellen, berechnet_am)
          values (${land}, ${stellen}, now())
          on conflict (land) do update
            set stellen = excluded.stellen, berechnet_am = excluded.berechnet_am`);
        gezaehlt.push({ land, stellen });
      } else {
        /* Ein Land, das leer geworden ist, verschwindet — aber nur
           dieses eine, das gerade gezählt wurde. Siehe oben. */
        await db.execute(sql`delete from laenderbestand where land = ${land}`);
      }
    } catch (e) {
      /*
       * Eine abgelaufene Frist ist kein Fehler der Zählung.
       *
       * Postgres meldet sie mit 57014. Sie als Fehler dieses Landes zu
       * führen hiesse, beim nächsten Lauf dasselbe Land als kaputt zu
       * behandeln — dabei ist es nur gross.
       */
      const nachrichtRoh = e instanceof Error ? e.message : String(e);
      const abgelaufen = istFristfehler(e);
      if (abgelaufen) {
        abgebrochen = true;
        break;
      }
      fehler.push({ land, grund: nachrichtRoh });
    }
  }

  return { gezaehlt, fehler, abgebrochen, dauerMs: Date.now() - beginn };
}

/**
 * Wo dieser Lauf zu zählen beginnt.
 *
 * Der Zeiger springt um die Zahl der Länder je Lauf weiter, nicht um
 * eins: Sonst überschnitten sich aufeinanderfolgende Läufe zu drei
 * Vierteln und ein Land käme erst nach vier Stunden wieder dran, statt
 * nach der Runde.
 */
export function takterVersatz(takt: number, anzahl: number): number {
  if (anzahl <= 0) return 0;
  return ((takt * LAENDER_JE_LAUF) % anzahl + anzahl) % anzahl;
}

/**
 * War das eine abgelaufene Frist?
 *
 * ── Warum die Ursachenkette abgelaufen wird ─────────────────────
 *
 * Drizzle verpackt den Treiberfehler: Nach aussen heisst er nur
 * "Failed query: select count(*) …", und der Postgres-Code steht eine
 * Ebene tiefer unter `cause`.
 *
 * Genau daran ist die erste Fassung dieser Prüfung gescheitert. Sie
 * sah auf `e.code` und den Text, fand nichts, und die überschrittene
 * Frist landete als Fehler des Landes im Protokoll — als wäre `DE`
 * kaputt. Es ist nur gross.
 */
function istFristfehler(e: unknown): boolean {
  /* Höchstens fünf Ebenen. Eine Kette, die sich im Kreis dreht, ist
     selten, aber eine Endlosschleife im Fehlerpfad wäre besonders
     ärgerlich. */
  for (let tiefe = 0, aktuell: unknown = e; tiefe < 5 && aktuell; tiefe += 1) {
    const o = aktuell as { code?: unknown; message?: unknown; cause?: unknown };
    if (o.code === "57014") return true;
    if (typeof o.message === "string" && /statement timeout|canceling statement/i.test(o.message)) {
      return true;
    }
    aktuell = o.cause;
  }
  return false;
}
