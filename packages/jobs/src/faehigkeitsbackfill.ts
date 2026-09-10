import { sql } from "drizzle-orm";
import { getDb, withSystem } from "@paycheck/db";
import {
  KATALOG,
  VERWERTUNG,
  ausBeleg,
  darfSkillTragen,
  eigenerBeitragErkennbar,
  istOrientierungsprobe,
  schluesselFinden,
  stufenrang,
  type Belegart,
  type EvidenceNodeType,
  type Kategoriezaehlung,
  type Koennensstufe,
} from "@paycheck/domain";

/**
 * ══════════════════════════════════════════════════════════════════
 * Den Katalog anlegen und Belege verdichten
 * ══════════════════════════════════════════════════════════════════
 *
 * Zwei Läufe, die zusammengehören und getrennt bleiben müssen:
 *
 *   `katalogSaeen`    schreibt `skills`. Ohne diese Zeilen greift der
 *                     Fremdschlüssel von `profile_skills`, und es
 *                     liesse sich keine einzige Fähigkeit ablegen.
 *   `belegeVerdichten` liest bestätigte Belege und legt daraus
 *                     Fähigkeitsaussagen an.
 *
 * ── Warum `user_confirmed` auf false bleibt ─────────────────────
 *
 * Der Mensch hat den BELEG bestätigt — den Satz über seine Arbeit.
 * Er hat nicht bestätigt, dass daraus „Wundversorgung, Stufe sicher"
 * folgt. Das ist eine Ableitung, und sie so abzulegen, als hätte er
 * sie abgenickt, wäre genau die stille Aufwertung, die das Produkt
 * nicht machen darf.
 *
 * Er sieht sie, kann sie bestätigen oder streichen. Bis dahin zählt
 * sie mit niedrigerer Konfidenz.
 *
 * ── Warum `ai_hypothesis` gar nicht erst hereinkommt ────────────
 *
 * Ein Beleg, den ein Modell vermutet hat, ist kein Beleg. Aus ihm
 * eine Fähigkeit abzuleiten hiesse, eine Vermutung über eine
 * Vermutung zu legen — und am Ende stünde im Profil etwas, das
 * niemand je gesagt hat.
 *
 * ── Warum wiederholbar ──────────────────────────────────────────
 *
 * Beide Läufe sind idempotent: `on conflict do nothing` beim Katalog,
 * und eine Prüfung auf vorhandene Zeile je (Nutzer, Fähigkeit, Beleg)
 * bei den Aussagen. Ein zweiter Lauf ändert nichts, ein abgebrochener
 * lässt sich fortsetzen.
 */

export interface Katalogbericht {
  angelegt: number;
  vorhanden: number;
}

/**
 * Den Fähigkeitskatalog in `skills` schreiben.
 *
 * `escoUri` bleibt leer und `taxonomy` steht auf `internal`: Der
 * Startbestand ist kuratiert, nicht aus ESCO abgeleitet. Ihn als ESCO
 * auszugeben wäre eine Herkunftsangabe, die nicht stimmt.
 */
export async function katalogSaeen(): Promise<Katalogbericht> {
  const db = await getDb();
  let angelegt = 0;

  for (const k of KATALOG) {
    const ergebnis = (await withSystem(db, (tx) =>
      tx.execute(sql`
        insert into skills (key, label_de, label_en, synonyms, kind, related_keys, taxonomy)
        values (
          ${k.schluessel},
          ${k.bezeichnung},
          ${k.bezeichnung},
          ${JSON.stringify(k.synonyme)}::jsonb,
          'technical',
          '[]'::jsonb,
          'internal'
        )
        on conflict (key) do nothing
        returning key`),
    )) as unknown as { rows: unknown[] };
    if (ergebnis.rows.length > 0) angelegt++;
  }

  return { angelegt, vorhanden: KATALOG.length - angelegt };
}

/**
 * Die Belegart aus der Herkunft des Belegs.
 *
 * `null` heisst: taugt nicht als Grundlage. Das gilt für die
 * Modellvermutung — und für alles, was hier künftig dazukommt und
 * nicht ausdrücklich zugeordnet wurde.
 */
export function belegartAus(sourceType: string): Belegart | null {
  switch (sourceType) {
    case "work_sample":
      return "arbeitsprobe";
    case "document_extract":
      return "lebenslauf";
    case "external_source":
      return "zertifikat";
    case "user_stated":
    case "user_confirmed":
      return "nutzer_aussage";
    default:
      /* `ai_hypothesis` und alles Unbekannte. */
      return null;
  }
}

/** Wie sicher eine abgeleitete Aussage ist, je nach Belegart. */
export function konfidenzAus(art: Belegart): number {
  switch (art) {
    case "arbeitsprobe":
      return 85;
    case "zertifikat":
      return 75;
    case "lebenslauf":
      return 60;
    case "nutzer_aussage":
      return 55;
  }
}

/** Auf die Skala von `profile_skills.self_assessed_level` (1–4). */
export function stufeAlsZahl(s: Koennensstufe): number {
  return stufenrang(s) + 1;
}

export interface Verdichtungsbericht {
  belegeGelesen: number;
  ohneBelegart: number;
  /**
   * Belege, die durften und trotzdem nicht zugeordnet wurden.
   *
   * Bis zum 11.09.2026 standen hier auch die 113 Vorlieben, Motive
   * und Rollenbezeichnungen — der Lauf meldete damit eine
   * Fehlerquote, die die Zusammensetzung des Bestands beschrieb.
   */
  ohneKatalogeintrag: number;
  /** Belege, deren Art keine Fähigkeit tragen darf. Kein Fehler. */
  bewusstNichtVerdichtet: number;
  /** Ergebnissätze ohne erkennbaren eigenen Anteil. */
  ohneEigenenBeitrag: number;
  angelegt: number;
  schonVorhanden: number;
  /** Je Belegart, für den Bericht. */
  jeKategorie: Kategoriezaehlung[];
}

/**
 * Aus bestätigten Belegen Fähigkeitsaussagen machen.
 *
 * ── Warum die vorgeschlagene Stufe hier fest ist ────────────────
 *
 * Sie steht auf `sicher` und wird von `ausBeleg()` auf das gedeckelt,
 * was die Belegart trägt. Eine feinere Einstufung müsste aus dem Text
 * kommen, und das wäre ein Modellurteil über einen Menschen — genau
 * das, was `faehigkeiten.ts` ausschliesst.
 *
 * Wer es genauer will, sagt es selbst: Die Aussage steht im Profil
 * und ist änderbar.
 */
export async function belegeVerdichten(grenze = 500): Promise<Verdichtungsbericht> {
  const db = await getDb();
  const bericht: Verdichtungsbericht = {
    belegeGelesen: 0,
    ohneBelegart: 0,
    ohneKatalogeintrag: 0,
    bewusstNichtVerdichtet: 0,
    ohneEigenenBeitrag: 0,
    angelegt: 0,
    schonVorhanden: 0,
    jeKategorie: [],
  };

  const belege = (await withSystem(db, (tx) =>
    tx.execute(sql`
      select id, user_id as "userId", statement, type,
             source_type as "sourceType", source_ref as "sourceRef"
      from evidence_items
      where user_confirmed = true and user_rejected = false
      order by created_at
      limit ${grenze}`),
  )) as unknown as {
    rows: {
      id: string; userId: string; statement: string; type: string;
      sourceType: string; sourceRef: string | null;
    }[];
  };

  const zaehlung = new Map<string, Kategoriezaehlung>();
  const zaehle = (art: EvidenceNodeType) => {
    const z = zaehlung.get(art) ?? {
      art,
      weg: VERWERTUNG[art],
      gesamt: 0,
      uebernommen: 0,
      bewusstNicht: 0,
      nichtZugeordnet: 0,
    };
    zaehlung.set(art, z);
    return z;
  };

  for (const b of belege.rows) {
    bericht.belegeGelesen++;
    const nodeArt = b.type as EvidenceNodeType;
    const z = zaehle(nodeArt);
    z.gesamt++;

    /*
     * ── Die Art entscheidet vor allem anderen ──────────────────
     *
     * Eine Vorliebe ist kein misslungener Fähigkeitsbeleg. Sie gehört
     * in den Wunsch-Abgleich, und sie hier als Fehlschlag zu zählen
     * hiesse, die Zusammensetzung des Bestands als Fehlerquote
     * auszugeben.
     */
    if (!darfSkillTragen(nodeArt)) {
      bericht.bewusstNichtVerdichtet++;
      z.bewusstNicht++;
      continue;
    }

    /*
     * Eine Orientierungsprobe tritt gar nicht erst an. Sie dürfte
     * antreten und könnte nie durchkommen — und stünde damit dauerhaft
     * als Fehlschlag in der Bilanz.
     */
    if (istOrientierungsprobe(b.sourceRef)) {
      bericht.bewusstNichtVerdichtet++;
      z.bewusstNicht++;
      continue;
    }

    const art = belegartAus(b.sourceType);
    if (art === null) {
      bericht.ohneBelegart++;
      z.bewusstNicht++;
      continue;
    }

    /*
     * Ein Ergebnis trägt eine Fähigkeit nur mit erkennbarem eigenem
     * Anteil. „Der Bereich hat die Durchlaufzeit halbiert" sagt
     * nichts darüber, wer das getan hat.
     */
    if (VERWERTUNG[nodeArt] === "nur_mit_beitrag" && !eigenerBeitragErkennbar(b.statement)) {
      bericht.ohneEigenenBeitrag++;
      z.nichtZugeordnet++;
      continue;
    }

    const schluessel = schluesselFinden(b.statement);
    if (schluessel === null) {
      bericht.ohneKatalogeintrag++;
      z.nichtZugeordnet++;
      continue;
    }

    const aussage = ausBeleg(
      { id: b.id, aussage: b.statement, herkunft: art, bestaetigt: true },
      schluessel,
      "sicher",
    );
    if (aussage === null) {
      /* Bedingung oder Leerformel — `ausBeleg` hat sie abgewiesen. */
      bericht.ohneKatalogeintrag++;
      z.nichtZugeordnet++;
      continue;
    }

    const eingefuegt = (await withSystem(db, (tx) =>
      tx.execute(sql`
        insert into profile_skills
          (user_id, skill_key, self_assessed_level, evidence_item_id, user_confirmed, quelle, konfidenz)
        select ${b.userId}::uuid, ${schluessel}, ${stufeAlsZahl(aussage.stufe)},
               ${b.id}::uuid, false, ${art}, ${konfidenzAus(art)}
        where not exists (
          select 1 from profile_skills p
          where p.user_id = ${b.userId}::uuid
            and p.skill_key = ${schluessel}
            and p.evidence_item_id = ${b.id}::uuid
        )
        returning id`),
    )) as unknown as { rows: unknown[] };

    if (eingefuegt.rows.length > 0) bericht.angelegt++;
    else bericht.schonVorhanden++;
    z.uebernommen++;
  }

  bericht.jeKategorie = [...zaehlung.values()].sort((a, b) => b.gesamt - a.gesamt);
  return bericht;
}
