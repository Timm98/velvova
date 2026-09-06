import { sql } from "drizzle-orm";
import { getDb, withSystem } from "@paycheck/db";
import { STANDARDSUCHEN } from "./sources/bundesagentur.ts";

/**
 * Der Suchwortschatz für die Jobbörse — aus ihrem eigenen Vokabular.
 *
 * ── Das Problem ───────────────────────────────────────────────
 *
 * Die Jobbörse der Bundesagentur führt **999.398 Anzeigen**. Im
 * Bestand standen 327 davon. Der Grund war weder eine Sperre noch ein
 * Limit der Schnittstelle, sondern eine Liste mit fünf Suchwörtern im
 * Adapter — „Sachbearbeitung", „Kundenbetreuung", „Disposition",
 * „Büromanagement", „Vertriebsinnendienst". Gefunden wurde, wonach
 * gefragt wurde.
 *
 * ── Warum ausgerechnet die amtlichen Bezeichnungen ────────────
 *
 * Ein selbst ausgedachter Wortschatz hätte dieselbe Schwäche in
 * grösser: Er bildet ab, woran der Autor gedacht hat. Die
 * Berufsbezeichnungen der Klassifikation der Berufe sind dagegen
 * genau das Vokabular, mit dem die Jobbörse ihre Anzeigen selbst
 * verschlagwortet — jede Anzeige trägt eine. Danach zu suchen findet
 * sie zuverlässig.
 *
 * Sie stehen ohnehin schon da: `beruf_zuordnung` hat sie beim Aufbau
 * der Gehalts-Referenz gesammelt. Zwei Aufgaben, ein Wortschatz.
 *
 * ── Die Reihenfolge ist Absicht ───────────────────────────────
 *
 * Zuerst die Berufe, auf die die meisten eigenen Stellen zeigen. Wird
 * ein Lauf abgebrochen, ist der Zwischenstand dann kein Zufall,
 * sondern der nützlichste Ausschnitt.
 */
export async function berufsabfragen(grenze = 400): Promise<string[]> {
  const db = await getDb();

  /*
   * ── Zuerst der geerntete Wortschatz ───────────────────────
   *
   * `beruf_wortschatz` enthält Bezeichnungen aus den Anzeigen der
   * Jobbörse selbst — aus `hauptberuf` und `alleBerufe`. Er ist um ein
   * Vielfaches grösser als das, was der eigene Bestand hergibt: 2.629
   * gegenüber 236, und er wächst mit jeder Ernte.
   *
   * ── Warum die ergiebigsten zuerst ─────────────────────────
   *
   * `anzeigen` ist die Trefferzahl, die die Jobbörse zu diesem Begriff
   * meldet. Wer mit den grössten anfängt, holt mit denselben Anfragen
   * mehr Anzeigen — und ein abgebrochener Lauf hat trotzdem die
   * ergiebigen Begriffe erwischt.
   *
   * Begriffe ohne bekannte Trefferzahl kommen danach: Sie sind nicht
   * schlechter, nur ungefragt.
   */
  /*
   * ── Nie verwendete zuerst ─────────────────────────────────
   *
   * Vorher galt allein die Ergiebigkeit: die Begriffe mit den meisten
   * Anzeigen zuerst. Das ist für den ersten Lauf richtig und für jeden
   * weiteren falsch — er beginnt wieder am Anfang und holt, was längst
   * da ist.
   *
   * Gemessen nach mehreren Läufen: **12 neue Stellen aus 3.000
   * geholten**. Der Rest war „unverändert". Von 12.304 Begriffen waren
   * zu dem Zeitpunkt erst 3.600 überhaupt je abgefragt worden.
   *
   * Jetzt entscheidet zuerst `zuletzt_geholt` — nie verwendete voran,
   * dann die am längsten nicht verwendeten. Innerhalb derselben Stufe
   * bleibt die Ergiebigkeit die Reihenfolge.
   */
  const geerntet = await withSystem(db, (tx) =>
    tx.execute(sql`
      select beruf from beruf_wortschatz
      order by zuletzt_geholt asc nulls first, coalesce(anzeigen, -1) desc, vorkommen desc, beruf
      limit ${grenze}
    `),
  ).catch(() => ({ rows: [] }) as never);

  const ausWortschatz = ((geerntet as unknown as { rows: { beruf: string }[] }).rows ?? []).map(
    (r) => r.beruf,
  );
  if (ausWortschatz.length > 0) return ausWortschatz;

  /*
   * Rückfall: die Berufe des eigenen Bestands.
   *
   * Sie waren die erste Quelle des Wortschatzes und bleiben der Weg,
   * wenn noch nie geerntet wurde. Der Zirkelschluss — wir finden nur,
   * was wir schon haben — ist damit nicht behoben, nur überbrückt.
   */
  const zeilen = await withSystem(db, (tx) =>
    tx.execute(sql`
      select beruf, count(*)::int n from beruf_zuordnung
      where beruf is not null group by 1 order by 2 desc, 1 limit ${grenze}
    `),
  ).catch((e) => {
    console.error("[berufsabfragen] Tabelle nicht lesbar:", e);
    return { rows: [] } as never;
  });

  const berufe = ((zeilen as unknown as { rows: { beruf: string }[] }).rows ?? []).map(
    (r) => r.beruf,
  );

  /*
   * Leere Tabellen heissen frische Datenbank, nicht „keine Suche".
   *
   * Der erste Lauf auf einem leeren System hätte sonst gar nichts
   * geholt — und danach stünde nichts da, woraus beim zweiten Lauf ein
   * Wortschatz entstehen könnte. Eine Henne-Ei-Sperre, die sich selbst
   * nie öffnet.
   */
  return berufe.length > 0 ? berufe : [...STANDARDSUCHEN];
}

/**
 * Englische Suchbegriffe — für Quellen ausserhalb des deutschen Raums.
 *
 * ── Warum getrennt vom deutschen Wortschatz ───────────────────
 *
 * Reed, USAJOBS und Findwork nach „Zerspanungsmechaniker/in" zu
 * durchsuchen findet nichts. Ohne Begriff blättern sie nur durch die
 * ersten Seiten: USAJOBS lieferte 1.755 neue Stellen und danach nur
 * Wiederholungen, Reed 985.
 *
 * Geerntet werden sie aus den Titeln, die dieselben Quellen geliefert
 * haben — dieselbe Mechanik wie beim deutschen Wortschatz, nur in der
 * Sprache der Quelle.
 */
export async function englischeAbfragen(grenze = 400): Promise<string[]> {
  const db = await getDb();
  const zeilen = await withSystem(db, (tx) =>
    tx.execute(sql`
      select beruf from beruf_wortschatz where quelle = 'englisch'
      order by vorkommen desc, beruf limit ${grenze}
    `),
  ).catch(() => ({ rows: [] }) as never);
  return ((zeilen as unknown as { rows: { beruf: string }[] }).rows ?? []).map((r) => r.beruf);
}

/**
 * Vermerken, dass diese Begriffe verwendet wurden.
 *
 * Ohne diesen Vermerk beginnt der nächste Lauf wieder bei denselben
 * Begriffen — und holt dieselben Anzeigen. Der Aufruf gehört deshalb
 * ans Ende jedes Importlaufs, nicht in die Auswahl: Erst wenn etwas
 * geholt wurde, ist der Begriff verbraucht.
 */
export async function abfragenVermerken(berufe: string[]): Promise<void> {
  if (berufe.length === 0) return;
  const db = await getDb();
  for (let i = 0; i < berufe.length; i += 500) {
    const teil = berufe.slice(i, i + 500);
    await withSystem(db, (tx) =>
      tx.execute(sql`
        update beruf_wortschatz set zuletzt_geholt = now()
        where beruf in (${sql.join(
          teil.map((b) => sql`${b}`),
          sql`, `,
        )})
      `),
    ).catch((e) => console.error("[berufsabfragen] Vermerk fehlgeschlagen:", e));
  }
}
