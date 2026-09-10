"use server";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import {
  EBENEN,
  EBENENSATZ,
  LOESUNGSWEGE,
  aufstiegPruefen,
  befundPruefen,
  brauchtMenschen,
  ebenenrang,
  ebenensignal,
  klaerungsfragen,
  quellePruefen,
  unabhaengigeQuellen,
  type Aufstiegslage,
  type Ebene,
  type Loesungsart,
  type Quellenangabe,
  type Quellenbezug,
  type Zweck,
} from "@paycheck/domain";
import { protokolliere, verlangeRolle } from "./zugang";

/**
 * ══════════════════════════════════════════════════════════════════
 * Der Bedarfsvorgang — die Klärung, die eine Sitzung überlebt
 * ══════════════════════════════════════════════════════════════════
 *
 * `bedarfsebenen.ts` rechnet, `bedarfsvorgaenge` erinnert sich.
 *
 * ── Warum jede Entscheidung hier durch die Domäne geht ──────────
 *
 * Weil sonst nach drei Umbauten eine zweite, freundlichere Fassung
 * derselben Regel im Code steht. Die Ebene wird nirgends direkt
 * gesetzt: `ebeneHeben` fragt `aufstiegPruefen`, schreibt den Schritt
 * — auch den abgelehnten — und ändert die Ebene nur, wenn die Antwort
 * ja lautet.
 *
 * ── Warum der abgelehnte Schritt mitgeschrieben wird ────────────
 *
 * Der Grund einer Ablehnung ist die nützlichste Zeile im Vorgang: Er
 * sagt, was noch fehlt. Eine Geschichte, in der nur die gelungenen
 * Schritte stehen, sieht aus, als hätte nie etwas gefehlt.
 */

/** Der Titel kommt aus den Worten des Menschen, nicht aus einem Modell. */
function titelAus(text: string): string {
  const sauber = text.trim().replace(/\s+/g, " ");
  if (sauber.length <= 70) return sauber;
  const schnitt = sauber.slice(0, 70);
  const luecke = schnitt.lastIndexOf(" ");
  return `${luecke > 40 ? schnitt.slice(0, luecke) : schnitt}…`;
}

export interface Vorgangslage {
  id: string;
  titel: string;
  ausgangslage: string;
  ebene: Ebene;
  ebenensatz: string;
  weg: Loesungsart | null;
  freigabeVon: string | null;
  /** Was jetzt zu klären wäre. Leer, sobald die Ebene darüber hinaus ist. */
  fragen: string[];
  quellen: { id: string; art: string; eigentuemer: string; zweck: string | null; erlaubt: boolean; grund: string | null }[];
  unabhaengig: number;
  befunde: { id: string; beobachtung: string; stand: string; alternativen: string[]; gegenbelege: string[] }[];
  schritte: { von: string; nach: string; erlaubt: boolean; grund: string | null; am: Date }[];
  /** Ob aus diesem Stand ein Angebot entstehen dürfte. */
  darfAngebot: boolean;
}

function alsEbene(roh: string): Ebene {
  return (EBENEN as readonly string[]).includes(roh) ? (roh as Ebene) : "beduerfnis";
}

function alsWeg(roh: string | null): Loesungsart | null {
  if (roh === null) return null;
  return (LOESUNGSWEGE as readonly string[]).includes(roh) ? (roh as Loesungsart) : null;
}

/**
 * Einen Vorgang anlegen.
 *
 * Die Ebene kommt aus `ebenensignal` — und wo es schweigt, aus der
 * niedrigsten. Ein Vorgang, der zu hoch beginnt, überspringt genau
 * die Schritte, die ihn getragen hätten.
 */
export async function vorgangAnlegen(
  orgId: string,
  ausgangslage: string,
): Promise<{ id: string; ebene: Ebene; fragen: string[] }> {
  const { user } = await verlangeRolle(orgId, "admin");
  const roh = ausgangslage.trim().slice(0, 6000);
  if (roh.length < 20) throw new Error("Dafür ist der Text zu kurz.");

  const signal = ebenensignal(roh);
  const ebene: Ebene = signal === "beobachtung" ? "beobachtung" : "beduerfnis";

  const db = await getDb();
  const [zeile] = await withUser(db, user.id, (tx) =>
    tx
      .insert(schema.bedarfsvorgaenge)
      .values({
        organizationId: orgId,
        angelegtVon: user.id,
        titel: titelAus(roh),
        ausgangslage: roh,
        ebene,
      })
      .returning({ id: schema.bedarfsvorgaenge.id }),
  );

  await protokolliere(user.id, orgId, "bedarfsvorgang_angelegt", zeile!.id, { ebene });
  return { id: zeile!.id, ebene, fragen: klaerungsfragen(ebene) };
}

/**
 * Eine Quelle hinterlegen.
 *
 * `quellePruefen` entscheidet, ob sie für die Unternehmensanalyse
 * überhaupt gelesen werden darf. Abgewiesen wird sie trotzdem
 * gespeichert — mit dem Grund. Sonst verschwände die Angabe, und
 * jemand trüge sie beim nächsten Mal noch einmal ein.
 */
export async function quelleHinterlegen(
  orgId: string,
  vorgangId: string,
  angabe: Quellenangabe,
): Promise<{ erlaubt: boolean; grund: string | null; hinweise: string[] }> {
  const { user } = await verlangeRolle(orgId, "admin");
  const pruefung = quellePruefen(angabe, "unternehmensanalyse");

  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx.insert(schema.bedarfsquellen).values({
      organizationId: orgId,
      vorgangId,
      art: angabe.art,
      eigentuemer: angabe.eigentuemer,
      zweck: angabe.zweck,
      zeitraum: angabe.zeitraum,
      alterTage: angabe.alterTage,
      sichtbarFuer: [...angabe.sichtbarFuer],
      technischVerbunden: angabe.technischVerbunden,
      betrieblichBerechtigt: angabe.betrieblichBerechtigt,
      rechtsgrundlage: angabe.rechtsgrundlage,
      aufVorgangsebene: angabe.aufVorgangsebene,
    }),
  );

  await protokolliere(user.id, orgId, "bedarfsquelle_hinterlegt", vorgangId, {
    art: angabe.art,
    erlaubt: pruefung.erlaubt,
  });

  return pruefung.erlaubt
    ? { erlaubt: true, grund: null, hinweise: [...pruefung.hinweise] }
    : { erlaubt: false, grund: pruefung.grund, hinweise: [] };
}

/**
 * Einen Befund eintragen.
 *
 * Der Stand wird beim Schreiben gerechnet und mitgespeichert — damit
 * ein später geänderter Massstab einen früheren Bericht nicht still
 * umschreibt.
 */
export async function befundEintragen(
  orgId: string,
  vorgangId: string,
  eingabe: {
    beobachtung: string;
    quellenIds: readonly string[];
    alternativen: readonly string[];
    gegenbelege: readonly string[];
    gegenbelegeGeprueft: boolean;
    vomUnternehmenBestaetigt: boolean;
  },
): Promise<{ stand: string; fehlt: string | null }> {
  const { user } = await verlangeRolle(orgId, "admin");
  const db = await getDb();

  const bezuege = await quellenbezuege(orgId, user.id, eingabe.quellenIds);
  const lage = befundPruefen({
    beobachtung: eingabe.beobachtung,
    quellen: bezuege,
    alternativen: eingabe.alternativen,
    gegenbelege: eingabe.gegenbelege,
    gegenbelegeGeprueft: eingabe.gegenbelegeGeprueft,
    vomUnternehmenBestaetigt: eingabe.vomUnternehmenBestaetigt,
  });

  await withUser(db, user.id, (tx) =>
    tx.insert(schema.bedarfsbefunde).values({
      organizationId: orgId,
      vorgangId,
      beobachtung: eingabe.beobachtung.trim(),
      quellenIds: bezuege.map((b) => b.id),
      alternativen: [...eingabe.alternativen],
      gegenbelege: [...eingabe.gegenbelege],
      gegenbelegeGeprueft: eingabe.gegenbelegeGeprueft,
      vomUnternehmenBestaetigt: eingabe.vomUnternehmenBestaetigt,
      stand: lage.stand,
    }),
  );

  await protokolliere(user.id, orgId, "bedarfsbefund_eingetragen", vorgangId, { stand: lage.stand });
  return { stand: lage.stand, fehlt: lage.stand === "hypothese" ? lage.fehlt : null };
}

/** Die Quellen eines Vorgangs als `Quellenbezug`, tote Kennungen fallen weg. */
async function quellenbezuege(
  orgId: string,
  userId: string,
  ids: readonly string[],
): Promise<Quellenbezug[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  const zeilen = await withUser(db, userId, (tx) =>
    tx
      .select({
        id: schema.bedarfsquellen.id,
        eigentuemer: schema.bedarfsquellen.eigentuemer,
        art: schema.bedarfsquellen.art,
        zeitraum: schema.bedarfsquellen.zeitraum,
      })
      .from(schema.bedarfsquellen)
      .where(
        and(
          eq(schema.bedarfsquellen.organizationId, orgId),
          inArray(schema.bedarfsquellen.id, [...ids]),
        ),
      ),
  );
  return zeilen.map((z) => ({
    id: z.id,
    eigentuemer: z.eigentuemer,
    art: z.art,
    zeitraum: z.zeitraum ?? "",
    abdeckung: null,
  }));
}

/** Den Lösungsweg festlegen. Ohne ihn geht es nicht auf `loesungsbedarf`. */
export async function wegWaehlen(
  orgId: string,
  vorgangId: string,
  weg: Loesungsart,
): Promise<void> {
  const { user } = await verlangeRolle(orgId, "admin");
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.bedarfsvorgaenge)
      .set({ weg, aktualisiertAm: new Date() })
      .where(
        and(
          eq(schema.bedarfsvorgaenge.id, vorgangId),
          eq(schema.bedarfsvorgaenge.organizationId, orgId),
        ),
      ),
  );
  await protokolliere(user.id, orgId, "bedarfsweg_gewaehlt", vorgangId, { weg });
}

/**
 * Eine Ebene aufsteigen — wenn die Lage es trägt.
 *
 * Die Lage wird aus dem Bestand gelesen, nicht vom Aufrufer behauptet.
 * Ein Aufrufer, der `vomUnternehmenBestaetigt: true` mitschicken darf,
 * hebelt die ganze Prüfung aus.
 */
export async function ebeneHeben(
  orgId: string,
  vorgangId: string,
  nach: Ebene,
  freigabeVon?: string,
): Promise<{ erlaubt: boolean; grund: string | null; ebene: Ebene }> {
  const { user } = await verlangeRolle(orgId, "admin");
  const db = await getDb();

  const [v] = await withUser(db, user.id, (tx) =>
    tx
      .select({
        ebene: schema.bedarfsvorgaenge.ebene,
        weg: schema.bedarfsvorgaenge.weg,
        freigabeVon: schema.bedarfsvorgaenge.freigabeVon,
      })
      .from(schema.bedarfsvorgaenge)
      .where(
        and(
          eq(schema.bedarfsvorgaenge.id, vorgangId),
          eq(schema.bedarfsvorgaenge.organizationId, orgId),
        ),
      )
      .limit(1),
  );
  if (!v) throw new Error("Diesen Vorgang gibt es nicht.");

  const von = alsEbene(v.ebene);
  const lage = await aufstiegslage(orgId, user.id, vorgangId, {
    weg: alsWeg(v.weg),
    freigabeVon: freigabeVon?.trim() || v.freigabeVon,
  });
  const antwort = aufstiegPruefen(von, nach, lage);

  await withUser(db, user.id, (tx) =>
    tx.insert(schema.bedarfsschritte).values({
      organizationId: orgId,
      vorgangId,
      wer: user.id,
      vonEbene: von,
      nachEbene: nach,
      erlaubt: antwort.erlaubt,
      grund: antwort.erlaubt ? null : antwort.grund,
    }),
  );

  if (!antwort.erlaubt) {
    return { erlaubt: false, grund: antwort.grund, ebene: von };
  }

  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.bedarfsvorgaenge)
      .set({
        ebene: nach,
        aktualisiertAm: new Date(),
        ...(nach === "freigegebene_moeglichkeit"
          ? { freigabeVon: lage.freigabeVon, freigabeAm: new Date() }
          : {}),
      })
      .where(eq(schema.bedarfsvorgaenge.id, vorgangId)),
  );

  await protokolliere(user.id, orgId, "bedarfsebene_gehoben", vorgangId, { von, nach });
  return { erlaubt: true, grund: null, ebene: nach };
}

/** Was für einen Aufstieg vorliegt — aus dem Bestand, nicht aus der Eingabe. */
async function aufstiegslage(
  orgId: string,
  userId: string,
  vorgangId: string,
  fest: { weg: Loesungsart | null; freigabeVon: string | null },
): Promise<Aufstiegslage> {
  const db = await getDb();
  const [quellen, befunde] = await Promise.all([
    withUser(db, userId, (tx) =>
      tx
        .select({
          id: schema.bedarfsquellen.id,
          eigentuemer: schema.bedarfsquellen.eigentuemer,
          art: schema.bedarfsquellen.art,
          zeitraum: schema.bedarfsquellen.zeitraum,
        })
        .from(schema.bedarfsquellen)
        .where(
          and(
            eq(schema.bedarfsquellen.organizationId, orgId),
            eq(schema.bedarfsquellen.vorgangId, vorgangId),
          ),
        ),
    ),
    withUser(db, userId, (tx) =>
      tx
        .select({
          alternativen: schema.bedarfsbefunde.alternativen,
          gegenbelegeGeprueft: schema.bedarfsbefunde.gegenbelegeGeprueft,
          vomUnternehmenBestaetigt: schema.bedarfsbefunde.vomUnternehmenBestaetigt,
        })
        .from(schema.bedarfsbefunde)
        .where(
          and(
            eq(schema.bedarfsbefunde.organizationId, orgId),
            eq(schema.bedarfsbefunde.vorgangId, vorgangId),
          ),
        ),
    ),
  ]);

  return {
    unabhaengigeBelege: unabhaengigeQuellen(
      quellen.map((q) => ({
        id: q.id,
        eigentuemer: q.eigentuemer,
        art: q.art,
        zeitraum: q.zeitraum ?? "",
        abdeckung: null,
      })),
    ),
    /* Eine Prüfung auf Gegenbelege zählt, sobald ein Befund sie hat. */
    gegenbelegeGeprueft: befunde.some((b) => b.gegenbelegeGeprueft),
    alternativen: befunde.flatMap((b) => b.alternativen ?? []),
    vomUnternehmenBestaetigt: befunde.some((b) => b.vomUnternehmenBestaetigt),
    freigabeVon: fest.freigabeVon,
    weg: fest.weg,
  };
}

/** Den vollständigen Stand eines Vorgangs lesen. */
export async function vorgangLesen(orgId: string, vorgangId: string): Promise<Vorgangslage | null> {
  const { user } = await verlangeRolle(orgId, "viewer");
  const db = await getDb();

  const [v] = await withUser(db, user.id, (tx) =>
    tx
      .select()
      .from(schema.bedarfsvorgaenge)
      .where(
        and(
          eq(schema.bedarfsvorgaenge.id, vorgangId),
          eq(schema.bedarfsvorgaenge.organizationId, orgId),
        ),
      )
      .limit(1),
  );
  if (!v) return null;

  const [quellen, befunde, schritte] = await Promise.all([
    withUser(db, user.id, (tx) =>
      tx
        .select()
        .from(schema.bedarfsquellen)
        .where(eq(schema.bedarfsquellen.vorgangId, vorgangId))
        .orderBy(asc(schema.bedarfsquellen.erstelltAm)),
    ),
    withUser(db, user.id, (tx) =>
      tx
        .select()
        .from(schema.bedarfsbefunde)
        .where(eq(schema.bedarfsbefunde.vorgangId, vorgangId))
        .orderBy(desc(schema.bedarfsbefunde.erstelltAm)),
    ),
    withUser(db, user.id, (tx) =>
      tx
        .select()
        .from(schema.bedarfsschritte)
        .where(eq(schema.bedarfsschritte.vorgangId, vorgangId))
        .orderBy(asc(schema.bedarfsschritte.erstelltAm)),
    ),
  ]);

  const ebene = alsEbene(v.ebene);
  const weg = alsWeg(v.weg);

  return {
    id: v.id,
    titel: v.titel,
    ausgangslage: v.ausgangslage,
    ebene,
    ebenensatz: EBENENSATZ[ebene],
    weg,
    freigabeVon: v.freigabeVon,
    fragen: ebenenrang(ebene) <= ebenenrang("beobachtung") ? klaerungsfragen(ebene) : [],
    quellen: quellen.map((q) => {
      const angabe: Quellenangabe = {
        art: q.art,
        eigentuemer: q.eigentuemer,
        zweck: (q.zweck ?? null) as Zweck | null,
        zeitraum: q.zeitraum,
        alterTage: q.alterTage,
        sichtbarFuer: q.sichtbarFuer ?? [],
        technischVerbunden: q.technischVerbunden,
        betrieblichBerechtigt: q.betrieblichBerechtigt,
        rechtsgrundlage: q.rechtsgrundlage,
        aufVorgangsebene: q.aufVorgangsebene,
      };
      const p = quellePruefen(angabe, "unternehmensanalyse");
      return {
        id: q.id,
        art: q.art,
        eigentuemer: q.eigentuemer,
        zweck: q.zweck,
        erlaubt: p.erlaubt,
        grund: p.erlaubt ? null : p.grund,
      };
    }),
    unabhaengig: unabhaengigeQuellen(
      quellen.map((q) => ({
        id: q.id,
        eigentuemer: q.eigentuemer,
        art: q.art,
        zeitraum: q.zeitraum ?? "",
        abdeckung: null,
      })),
    ),
    befunde: befunde.map((b) => ({
      id: b.id,
      beobachtung: b.beobachtung,
      stand: b.stand,
      alternativen: b.alternativen ?? [],
      gegenbelege: b.gegenbelege ?? [],
    })),
    schritte: schritte.map((s) => ({
      von: s.vonEbene,
      nach: s.nachEbene,
      erlaubt: s.erlaubt,
      grund: s.grund,
      am: s.erstelltAm,
    })),
    darfAngebot: ebene === "freigegebene_moeglichkeit" && weg !== null && brauchtMenschen(weg),
  };
}

/** Die Vorgänge einer Organisation, neueste zuerst. */
export async function vorgaengeListen(orgId: string) {
  const { user } = await verlangeRolle(orgId, "viewer");
  const db = await getDb();
  return withUser(db, user.id, (tx) =>
    tx
      .select({
        id: schema.bedarfsvorgaenge.id,
        titel: schema.bedarfsvorgaenge.titel,
        ebene: schema.bedarfsvorgaenge.ebene,
        erstelltAm: schema.bedarfsvorgaenge.erstelltAm,
      })
      .from(schema.bedarfsvorgaenge)
      .where(eq(schema.bedarfsvorgaenge.organizationId, orgId))
      .orderBy(desc(schema.bedarfsvorgaenge.erstelltAm))
      .limit(50),
  );
}
