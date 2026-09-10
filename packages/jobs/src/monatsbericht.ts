import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb, withSystem } from "@paycheck/db";
import {
  berichtsmonat,
  berichtslage,
  ebenenrang,
  laufAufnehmbar,
  monatsanfang,
  staendeVergleichen,
  unabhaengigeQuellen,
  type Laufzustand,
  type Themenstand,
} from "@paycheck/domain";

/**
 * ══════════════════════════════════════════════════════════════════
 * Der Monatslauf
 * ══════════════════════════════════════════════════════════════════
 *
 * Einmal je Organisation und Berichtsmonat. Der Bericht vergleicht
 * den heutigen Stand mit dem, was im Bericht des Vormonats
 * festgehalten wurde — nicht mit dem heutigen Bestand von damals.
 * Sonst schriebe eine spätere Änderung die Vergangenheit um.
 *
 * ── Warum der Lauf zuerst die Zeile beansprucht ─────────────────
 *
 * Ein Cron-Auslöser allein ist keine zuverlässige Monatsverarbeitung.
 * Er feuert, und niemand sieht nach, ob etwas ankam; wird er zweimal
 * ausgelöst, liefe der Bericht zweimal. Deshalb steht am Anfang ein
 * `insert … on conflict do nothing` gegen einen eindeutigen Index.
 * Wer die Zeile bekommt, rechnet; wer sie nicht bekommt, sieht nach,
 * ob der andere Lauf hängt — und nimmt ihn erst nach der Totzeit auf.
 *
 * ── Warum ein Fehler die Zeile nicht löscht ─────────────────────
 *
 * Sie bleibt auf `abgebrochen` stehen, mit dem Fehlertext. Ein
 * gelöschter Fehlversuch ist von einem Monat ohne Auslöser nicht zu
 * unterscheiden.
 */

export interface Laufbericht {
  organisationen: number;
  gerechnet: number;
  uebersprungen: number;
  fehlgeschlagen: number;
  monat: string;
}

interface Einstellung {
  organizationId: string;
  zeitzone: string;
  umfang: string;
}

/**
 * Alle aktivierten Organisationen für einen Monatslauf.
 *
 * `aktiv = true` ist der einzige Filter, und er steht auf false, bis
 * jemand ihn setzt. Ein Bericht, den ein Betrieb nicht bestellt hat,
 * ist Werbung — auch wenn er stimmt.
 */
async function aktivierte(): Promise<Einstellung[]> {
  const db = await getDb();
  const r = (await withSystem(db, (tx) =>
    tx.execute(sql`
      select organization_id as "organizationId", zeitzone, umfang
      from monatsbericht_einstellungen
      where aktiv = true`),
  )) as unknown as { rows: Einstellung[] };
  return r.rows;
}

/**
 * Der Stand aller Themen einer Organisation.
 *
 * ── Warum die Quellenzahl NICHT in die Methodenkennung geht ─────
 *
 * Weil eine zweite Quelle zu besorgen genau die Arbeit ist, die einen
 * Befund trägt. Zählte sie als Methodenwechsel, wäre jeder ehrliche
 * Fortschritt „nicht vergleichbar" — und der Schutz gegen erfundene
 * Verbesserungen würde die echten mitverschlucken.
 *
 * Die Kennung trägt deshalb den Umfang: den Ausschnitt, den die
 * Organisation betrachten lässt. Ändert der sich, ist der Vergleich
 * tatsächlich ausgesetzt.
 */
async function staendeLesen(orgId: string, umfang: string): Promise<Themenstand[]> {
  const db = await getDb();
  const r = (await withSystem(db, (tx) =>
    tx.execute(sql`
      select
        v.id            as "schluessel",
        v.titel         as "titel",
        v.ebene         as "ebene",
        coalesce((
          select b.stand from bedarfsbefunde b
          where b.vorgang_id = v.id
          order by b.erstellt_am desc
          limit 1
        ), 'kein_befund') as "befundstand",
        coalesce((
          select array_agg(distinct lower(trim(q.eigentuemer)) || '|' || lower(trim(q.art)))
          from bedarfsquellen q where q.vorgang_id = v.id
        ), '{}') as "quellenpaare"
      from bedarfsvorgaenge v
      where v.organization_id = ${orgId}
      order by v.erstellt_am`),
  )) as unknown as {
    rows: {
      schluessel: string;
      titel: string;
      ebene: string;
      befundstand: string;
      quellenpaare: string[];
    }[];
  };

  return r.rows.map((z) => ({
    schluessel: z.schluessel,
    titel: z.titel,
    ebene: z.ebene,
    befundstand: z.befundstand,
    /* Die Datenbank hat schon entdoppelt; `unabhaengigeQuellen` hält
       dieselbe Regel für alles, was nicht aus dieser Abfrage kommt. */
    quellen: unabhaengigeQuellen(
      (z.quellenpaare ?? []).map((p) => {
        const [eigentuemer = "", art = ""] = p.split("|");
        return { id: p, eigentuemer, art, zeitraum: "", abdeckung: null };
      }),
    ),
    methodenkennung: umfang,
  }));
}

/** Die Stände aus dem letzten fertigen Bericht davor. */
async function vorstaende(orgId: string, monat: string): Promise<Themenstand[]> {
  const db = await getDb();
  const r = (await withSystem(db, (tx) =>
    tx.execute(sql`
      select staende
      from monatsberichte
      where organization_id = ${orgId}
        and art = 'monatslauf'
        and zustand = 'fertig'
        and berichtsmonat < ${monatsanfang(monat)}::date
      order by berichtsmonat desc
      limit 1`),
  )) as unknown as { rows: { staende: Themenstand[] }[] };
  return r.rows[0]?.staende ?? [];
}

/**
 * Die Zeile für diesen Monat beanspruchen.
 *
 * `null` heisst: ein anderer Lauf hat sie, und er ist nicht alt genug,
 * um ihn aufzugeben.
 */
async function beanspruchen(
  e: Einstellung,
  monat: string,
  jetzt: Date,
): Promise<{ id: string; kennung: string } | null> {
  const db = await getDb();
  const kennung = randomUUID();

  const neu = (await withSystem(db, (tx) =>
    tx.execute(sql`
      insert into monatsberichte
        (organization_id, berichtsmonat, zeitzone, umfang, art, lauf_kennung, zustand, begonnen_am)
      values
        (${e.organizationId}, ${monatsanfang(monat)}::date, ${e.zeitzone}, ${e.umfang},
         'monatslauf', ${kennung}, 'laeuft', ${jetzt.toISOString()}::timestamptz)
      on conflict (organization_id, berichtsmonat) where art = 'monatslauf'
      do nothing
      returning id`),
  )) as unknown as { rows: { id: string }[] };

  if (neu.rows.length > 0) return { id: neu.rows[0]!.id, kennung };

  /* Die Zeile gibt es schon. Hängt sie? */
  const alt = (await withSystem(db, (tx) =>
    tx.execute(sql`
      select id, zustand, begonnen_am as "begonnenAm"
      from monatsberichte
      where organization_id = ${e.organizationId}
        and berichtsmonat = ${monatsanfang(monat)}::date
        and art = 'monatslauf'
      limit 1`),
  )) as unknown as { rows: { id: string; zustand: string; begonnenAm: string | Date }[] };

  const z = alt.rows[0];
  if (!z) return null;

  const antwort = laufAufnehmbar(z.zustand as Laufzustand, new Date(z.begonnenAm), jetzt);
  if (!antwort.ja) return null;

  await withSystem(db, (tx) =>
    tx.execute(sql`
      update monatsberichte
      set zustand = 'laeuft', lauf_kennung = ${kennung}, begonnen_am = ${jetzt.toISOString()}::timestamptz,
          fehler = ${antwort.grund}
      where id = ${z.id}`),
  );
  return { id: z.id, kennung };
}

/** Einen Monatsbericht für alle aktivierten Organisationen rechnen. */
export async function monatsberichteLaufen(jetzt = new Date()): Promise<Laufbericht> {
  const db = await getDb();
  const liste = await aktivierte();
  const bericht: Laufbericht = {
    organisationen: liste.length,
    gerechnet: 0,
    uebersprungen: 0,
    fehlgeschlagen: 0,
    monat: "",
  };

  for (const e of liste) {
    const monat = berichtsmonat(jetzt, e.zeitzone);
    bericht.monat ||= monat;

    const anspruch = await beanspruchen(e, monat, jetzt);
    if (anspruch === null) {
      bericht.uebersprungen++;
      continue;
    }

    try {
      const jetztStaende = await staendeLesen(e.organizationId, e.umfang);
      const vorher = await vorstaende(e.organizationId, monat);
      const veraenderungen = staendeVergleichen(vorher, jetztStaende, (x) =>
        ebenenrang(x as never),
      );
      const lage = berichtslage(veraenderungen);

      await withSystem(db, (tx) =>
        tx.execute(sql`
          update monatsberichte
          set zustand = 'fertig',
              fertig_am = now(),
              fehler = null,
              staende = ${JSON.stringify(jetztStaende)}::jsonb,
              veraenderungen = ${JSON.stringify(veraenderungen)}::jsonb,
              lage = ${lage.art},
              grund = ${lage.art === "kein_neuer_stand" ? lage.grund : null}
          where id = ${anspruch.id}`),
      );
      bericht.gerechnet++;
    } catch (fehler) {
      const text = fehler instanceof Error ? fehler.message : String(fehler);
      await withSystem(db, (tx) =>
        tx.execute(sql`
          update monatsberichte
          set zustand = 'abgebrochen', fehler = ${text.slice(0, 500)}
          where id = ${anspruch.id}`),
      ).catch(() => undefined);
      console.error("[monatsbericht] fehlgeschlagen:", e.organizationId, text);
      bericht.fehlgeschlagen++;
    }
  }

  return bericht;
}
