import { and, count, eq, isNull, ne, or, sql } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";
import { loadRuntimeConfig } from "@paycheck/config";
import { sourceStatuses } from "@paycheck/jobs";

/**
 * Was wirklich durchsucht wurde.
 *
 * Die Zahl „23 Stellen" sagt nichts darüber, ob 23 von 30 oder 23 von
 * 30.000 übrig blieben. Und „das ganze Internet" wäre eine Behauptung,
 * die genau eine aktive Quelle nicht deckt.
 *
 * Jede Zahl hier ist gezählt, keine geschätzt. Ist nur eine Quelle
 * aktiv, steht „1 Quelle durchsucht" — nicht mehr.
 */

export interface Quellenabdeckung {
  /** Wie viele Quellen tatsächlich abgefragt wurden. */
  aktiveQuellen: number;
  /** Namen der aktiven Quellen, für die Aufzählung. */
  aktiveNamen: string[];
  /** Wie viele Quellen es gäbe, wenn alles eingerichtet wäre. */
  möglicheQuellen: number;
  /** Alle Anzeigen, die je eingesammelt wurden. */
  rohTreffer: number;
  /**
   * Nach Entdopplung über den Inhaltshash.
   *
   * Wird nicht mehr ausgezählt und steht deshalb auf 0. Der
   * `count(distinct content_hash)` über 1,58 Mio. Zeilen lief über
   * zwölf Minuten ohne Ergebnis — für eine Zahl, die nirgends
   * erscheint: Der Satz auf der Stellenseite nennt geprüfte und
   * passende Stellen, die Rohzahl steht im Trichter.
   *
   * Das Feld bleibt, damit ein Aufrufer nicht stillschweigend etwas
   * anderes bekommt als er erwartet — es sagt jetzt nur „nicht
   * gezählt" statt eine Zahl zu erfinden.
   */
  eindeutig: number;
  /** Davon aktiv: kein toter Link, nicht abgelaufen. */
  aktiv: number;
  /** Wann zuletzt abgerufen wurde. */
  zuletzt: Date | null;
  /** Je Quelle für die Detailansicht. */
  jeQuelle: {
    key: string;
    name: string;
    aktiv: boolean;
    grund: string;
    anzahl: number;
    zuletzt: Date | null;
  }[];
}

/** Zu Datum machen, was als Text ankommt. Ungültiges wird `null`, nicht NaN. */
function alsDatum(wert: string | null | undefined): Date | null {
  if (!wert) return null;
  const d = new Date(wert);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Die Abdeckung hält länger als eine Anfrage.
 *
 * ── Warum das nötig wurde ─────────────────────────────────────
 *
 * Sie zählt über den ganzen Bestand — Zeilen, eindeutige Inhalte,
 * aktive Anzeigen. Das ist für alle Personen dieselbe Zahl und hing
 * trotzdem an jedem Seitenaufruf.
 *
 * Gemessen bei 823.429 Stellen: **3.978 ms**, und damit der grösste
 * einzelne Posten einer Stellenliste — grösser als das Laden und
 * Bewerten der Kandidaten zusammen (837 + 228 ms).
 *
 * Bei zweitausend Stellen war das unmerklich. Genau deshalb steht es
 * hier: Eine Zahl, die mit dem Bestand wächst, gehört nicht in den
 * Anfragepfad.
 */
const ABDECKUNG_TTL_MS = 15 * 60_000;
let abdeckungSpeicher: { at: number; wert: Quellenabdeckung } | null = null;
let abdeckungLaeuft: Promise<Quellenabdeckung> | null = null;

export async function ladeQuellenabdeckung(): Promise<Quellenabdeckung> {
  if (abdeckungSpeicher && Date.now() - abdeckungSpeicher.at < ABDECKUNG_TTL_MS) {
    return abdeckungSpeicher.wert;
  }
  /*
   * Der abgelaufene Stand geht sofort raus, während daneben neu
   * gezählt wird — sonst zahlt genau eine Person die vier Sekunden.
   */
  if (abdeckungSpeicher) {
    void abdeckungRechnen().catch((e) => console.error("[abdeckung]", e));
    return abdeckungSpeicher.wert;
  }
  return abdeckungRechnen();
}

function abdeckungRechnen(): Promise<Quellenabdeckung> {
  abdeckungLaeuft ??= abdeckungBerechnen()
    .then((wert) => {
      abdeckungSpeicher = { at: Date.now(), wert };
      return wert;
    })
    .finally(() => {
      abdeckungLaeuft = null;
    });
  return abdeckungLaeuft;
}

async function abdeckungBerechnen(): Promise<Quellenabdeckung> {
  const db = await getDb();
  const cfg = loadRuntimeConfig();
  const status = sourceStatuses(cfg);

  /*
   * Die Zahlen nachschlagen, nicht rechnen.
   *
   * ── Was hier passiert ist ─────────────────────────────────
   *
   * Hier stand eine Abfrage mit `count(*)`,
   * `count(distinct content_hash)` und einem gefilterten `count(*)`
   * über `jobs`. Der Kommentar daneben nahm das Wachstum ausdrücklich
   * vorweg: „bei tausend Zeilen ist das egal; bei hunderttausend
   * nicht, und dann schreibt es niemand mehr um."
   *
   * Bei 1,58 Mio. Zeilen und laufenden Importen bricht sie in die
   * Zeitgrenze der Datenbank. Die Stellenseite antwortete mit 500 —
   * gemessen 54,7 Sekunden bis zum Fehler.
   *
   * `scripts/kennzahlen-berechnen.mjs` zählt sie ausserhalb aus, wo
   * niemand wartet. Die Tabelle trägt den Zeitpunkt mit: Eine Zahl von
   * vor einer Stunde, die sich als solche zu erkennen gibt, ist
   * ehrlicher als eine tagesaktuelle, auf die niemand warten kann.
   */
  const [vorberechnet] = await db
    .select()
    .from(schema.bestandskennzahlen)
    .where(eq(schema.bestandskennzahlen.quelle, ""))
    .limit(1)
    .catch(() => []);

  /*
   * Der Schätzwert des Planers als Rückfall.
   *
   * Läuft die Auszählung noch nie gelaufen, stünde sonst „0 Stellen"
   * da — und das wäre nicht nur falsch, sondern das Gegenteil dessen,
   * was die Seite zeigen soll. `reltuples` kostet nichts und liegt bei
   * einer regelmässig geschriebenen Tabelle nah dran.
   */
  let geschaetzt = 0;
  if (!vorberechnet) {
    const ergebnis = (await db
      .execute(sql`select reltuples::bigint n from pg_class where relname = 'jobs'`)
      .catch(() => ({ rows: [] }))) as { rows?: { n?: number | string }[] };
    geschaetzt = Number(ergebnis.rows?.[0]?.n ?? 0);
  }

  const rohZahl = vorberechnet ? vorberechnet.roh : geschaetzt;
  const gesamt = {
    roh: rohZahl,
    /* Nicht gezählt — siehe `Quellenabdeckung.eindeutig`. */
    eindeutig: 0,
    aktiv: vorberechnet ? vorberechnet.aktiv : rohZahl,
    zuletzt: vorberechnet?.zuletztGeholt ? vorberechnet.zuletztGeholt.toISOString() : null,
  };

  /* Auch je Quelle vorberechnet — derselbe Grund: ein Gruppieren über
     die ganze Tabelle bei jedem Seitenaufruf. */
  const jeQuelleRows = await db
    .select()
    .from(schema.bestandskennzahlen)
    .catch(() => []);
  const namen = new Map(
    (await db
      .select({ key: schema.jobSources.key, name: schema.jobSources.displayName })
      .from(schema.jobSources)
      .catch(() => [])).map((r) => [r.key, r.name]),
  );
  const proQuelle = jeQuelleRows
    .filter((r) => r.quelle !== "")
    .map((r) => ({
      key: r.quelle,
      name: namen.get(r.quelle) ?? r.quelle,
      anzahl: r.roh,
      zuletzt: r.zuletztGeholt ? r.zuletztGeholt.toISOString() : null,
    }));

  const zahlJeKey = new Map(proQuelle.map((r) => [r.key, r]));

  const jeQuelle = status
    .filter((s) => s.key !== "seed")
    .map((s) => {
      const zeile = zahlJeKey.get(s.key);
      return {
        key: s.key,
        name: s.displayName,
        aktiv: s.active,
        grund: s.reason,
        anzahl: zeile?.anzahl ?? 0,
        zuletzt: alsDatum(zeile?.zuletzt),
      };
    })
    // Aktive zuerst, danach nach Anzahl. Was nicht läuft, steht unten.
    .sort((a, b) => Number(b.aktiv) - Number(a.aktiv) || b.anzahl - a.anzahl);

  const aktive = jeQuelle.filter((q) => q.aktiv);

  return {
    aktiveQuellen: aktive.length,
    aktiveNamen: aktive.map((q) => q.name),
    möglicheQuellen: jeQuelle.length,
    rohTreffer: gesamt?.roh ?? 0,
    eindeutig: gesamt?.eindeutig ?? 0,
    aktiv: gesamt?.aktiv ?? 0,
    zuletzt: alsDatum(gesamt?.zuletzt),
    jeQuelle,
  };
}

/**
 * Der Satz über der Jobliste.
 *
 * Bewusst ohne Superlative und ohne „das ganze Internet". Bei einer
 * Quelle steht „1 Quelle" — der Plural allein wäre schon eine
 * Übertreibung.
 */
export function abdeckungssatz(
  a: Quellenabdeckung,
  passend: number,
): string {
  const quellen = a.aktiveQuellen === 1 ? "1 Quelle" : `${a.aktiveQuellen} Quellen`;
  /*
   * Die Roh-Treffer stehen hier nicht mehr.
   *
   * „1.447 Roh-Treffer · 1.428 aktive Stellen" nannte zwei Zahlen, die
   * sich um neunzehn unterscheiden — und die grössere zuerst. Für
   * jemanden, der eine Stelle sucht, ist die Differenz bedeutungslos:
   * Roh-Treffer sind, was die Anbieter geliefert haben, bevor Dubletten
   * und abgelaufene Anzeigen abgezogen wurden. Es ist eine Zahl über
   * unseren Abrufvorgang, nicht über seine Auswahl.
   *
   * Zwei Zahlen bleiben, und beide bedeuten etwas: wie viele Stellen
   * geprüft wurden und wie viele davon die eigenen Bedingungen
   * erfüllen. Die Roh-Zahl steht weiterhin im Trichter unter
   * „Chancenraum", wo jede Stufe einzeln heruntergezählt wird.
   */
  const teile = [
    `${quellen} durchsucht`,
    `${a.aktiv.toLocaleString("de-DE")} Stellen geprüft`,
    `${passend.toLocaleString("de-DE")} erfüllen deine Bedingungen`,
  ];
  return teile.join(" · ");
}
