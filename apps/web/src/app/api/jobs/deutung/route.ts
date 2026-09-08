import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  AiNotConfiguredError,
  SUCHDEUTUNG_ANWEISUNG,
  SUCHDEUTUNG_FASSUNG,
  SuchdeutungSchema,
  selectProvider,
  type Suchdeutung,
} from "@paycheck/ai";
import { getDb, schema, withUser } from "@paycheck/db";
import { POLICY_FASSUNG } from "@paycheck/matching";
import { requireUser } from "@/lib/auth";
import { deuteSuchintention } from "@/lib/jobs/suchintention";
import { filterMerken } from "@/lib/jobs/listenfilter";
import { filterkonflikte, gepruefteEntfernungen } from "@/lib/jobs/filterkonflikte";
import { deutungZusammenfuehren } from "@/lib/jobs/deutungsmerge";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Was jemand mit einer Zeile in der Suche meint.
 *
 * ══════════════════════════════════════════════════════════════
 * Zwei Hälften, und die schnelle kommt zuerst
 * ══════════════════════════════════════════════════════════════
 *
 *   1. Regelabgleich   kostenlos, sofort, sicher
 *   2. Modell          nur für den Rest, mit Zusammenhang
 *
 * „ab 45.000 €" ist eine Zahl, kein Deutungsproblem. Sie durch ein
 * Modell zu schicken kostet eine Sekunde und ein paar Cent, und es
 * bringt genau nichts — ausser der Möglichkeit, dass daraus 45 wird.
 *
 * Bleibt nach dem Regelabgleich nichts übrig, endet die Anfrage hier.
 * Der häufigste Fall ist der billigste.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Zusammenhang mitgeht
 * ══════════════════════════════════════════════════════════════
 *
 * „doch lieber näher dran" ist ohne den vorigen Satz nicht deutbar.
 * Deshalb bekommt das Modell die letzten Nachrichten und die
 * geltenden Filter — nicht, um daraus etwas abzuleiten, sondern um
 * Bezüge aufzulösen.
 *
 * ── Was NICHT mitgeht ───────────────────────────────────────
 *
 * Das Profil, die Belege, der Lebenslauf. Eine Suchzeile auszulegen
 * braucht den Satz und den Zusammenhang; wer dafür alles über einen
 * Menschen mitschickt, hat den Zweck aus den Augen verloren.
 */

const Anfrage = z.object({
  eingabe: z.string().min(1).max(300),
  /** Die Filter, die gerade gelten — als flaches Objekt aus der Adresse. */
  bestehend: z.record(z.string(), z.string()).default({}),
  conversationId: z.string().uuid().nullable().optional(),
  /**
   * Der Schlüssel der Rückfrage, die hiermit beantwortet wird.
   *
   * Gesetzt, wenn die Eingabe aus dem Fenster unten rechts kommt.
   * Dann ist die Zeile keine neue Suche, sondern die Antwort auf eine
   * gestellte Frage — und die Frage gilt danach als erledigt.
   */
  beantwortet: z.string().max(80).nullable().optional(),
});

/** Wie viele Nachrichten als Zusammenhang mitgehen. */
const VERLAUF_ZEILEN = 6;

/**
 * Gemerkte Deutungen — im Prozess, je Eingabe und Filterstand.
 *
 * ── Warum im Prozess und nicht in der Datenbank ──────────────
 *
 * Weil eine Datenbankrunde 40 bis 170 Millisekunden kostet und die
 * Ersparnis 1.700. Ein Zwischenspeicher, der ein Zehntel dessen
 * kostet, was er spart, ist keiner mehr — und die Deutung ist keine
 * Auskunft, die überleben muss.
 *
 * Zehn Minuten: lang genug für eine Suchsitzung, kurz genug, dass ein
 * geänderter Prompt nicht stundenlang nachwirkt.
 */
const deutungsCache = new Map<string, { at: number; wert: Suchdeutung }>();
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 300;

/**
 * Der Sprung aus dem `try`, wenn der Zwischenspeicher geliefert hat.
 *
 * Ein eigenes Objekt statt eines Fehlers: `catch` muss es von einem
 * echten Fehlschlag unterscheiden können, und ein `Error` mit
 * besonderer Botschaft wäre genau die Unterscheidung über einen Text,
 * die irgendwann schiefgeht.
 */
const MERKZETTEL = Symbol("aus dem Zwischenspeicher");

export async function POST(request: Request) {
  const user = await requireUser();

  const gelesen = Anfrage.safeParse(await request.json().catch(() => null));
  if (!gelesen.success) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const { eingabe, bestehend } = gelesen.data;
  const db0 = await getDb();

  /*
   * Erst die Frage schliessen, dann deuten.
   *
   * Andersherum bliebe sie bei einem Fehler in der Deutung offen
   * stehen — und die Person bekäme dieselbe Frage gleich noch einmal,
   * obwohl sie geantwortet hat. Das ist der Eindruck, den die ganze
   * Kette vermeiden soll.
   */
  if (gelesen.data.beantwortet) {
    await frageSchliessen(db0, user.id, gelesen.data.beantwortet);
  }

  /* ── 1. Die Regeln ────────────────────────────────────────── */
  const regel = deuteSuchintention(eingabe);
  const rest = regel.rest.trim();

  /*
   * ══════════════════════════════════════════════════════════════
   * Das Modell sieht JEDEN Satz — auch den, den die Regeln kennen
   * ══════════════════════════════════════════════════════════════
   *
   * Hier stand eine Abkürzung: Wenn der Regelabgleich alles verstanden
   * hat, gib zurück und spar den Aufruf.
   *
   * Sie war der Grund, warum „Bayern, nicht länger als 170 min Auto"
   * scheiterte. Die Regeln kennen nur, was jemand vorher in sie
   * hineingeschrieben hat — ein Satz mit zwei Angaben, von denen sie
   * eine kennen, sieht für sie vollständig verstanden aus. Der Rest
   * fiel in die Volltextsuche, und die fand nichts.
   *
   * Eine Regel für genau diesen Satz nachzutragen hätte den nächsten
   * nicht gerettet. Also: Die Regeln liefern, was sicher ist — Zahlen
   * vor allem —, und das Modell legt den ganzen Satz darum herum aus.
   *
   * Bezahlt wird das mit einem Aufruf mehr. Er kostet 1,7 Sekunden,
   * die Liste steht trotzdem sofort (der Browser navigiert mit dem
   * Regelergebnis vor), und derselbe Satz wird kein zweites Mal
   * gedeutet.
   */

  /* ── 2. Das Modell für den Rest ───────────────────────────── */
  let provider;
  try {
    provider = await selectProvider();
  } catch (fehler) {
    if (fehler instanceof AiNotConfiguredError) {
      /*
       * Ohne Anbieter bleibt der Regelabgleich — und der Rest wird
       * zur Volltextsuche. Das ist genau das, was vorher immer
       * passiert ist, und es ist nicht kaputt, nur weniger klug.
       */
      return NextResponse.json({
        /*
         * Bei mehreren Berufen trägt `zweige` den Text, nicht `q`.
         *
         * `regel.rest` ist dann die Aneinanderreihung der Berufe —
         * „bürokaufmann elektriker". Als `q` gesetzt verlangte sie
         * beide in EINEM Stellentitel und machte die Zweige daneben
         * wirkungslos.
         */
        filter: { ...regel.filter, ...(rest && !regel.zweige ? { q: rest } : {}) },
        zweige: regel.zweige,
        umkreisSchritt: regel.umkreisSchritt,
        allesEntfernen: regel.allesEntfernen,
        entfernen: regel.entfernen,
        erklaerung: regel.erkannt.length > 0 ? kurz(regel.erkannt) : `sucht nach „${rest}".`,
        rueckfrage: null,
        quelle: "regeln",
      });
    }
    throw fehler;
  }

  const db = db0;
  const verlauf = await letzteNachrichten(db, user.id, gelesen.data.conversationId ?? null);

  /*
   * Der ganze Satz, nicht der Rest.
   *
   * `SICHER` sind die Werte, die der Regelabgleich zweifelsfrei
   * gelesen hat — Zahlen vor allem. Sie gehen als Tatsache mit, damit
   * das Modell sie nicht neu auslegt: „ab 45.000 €" ist eine Zahl,
   * und ein Modell, das sie noch einmal deuten darf, macht daraus
   * gelegentlich 45.
   */
  const sicher = Object.entries(regel.filter)
    .filter(([k]) => k !== "q")
    .map(([k, v]) => `${k}=${String(v)}`);

  const fakten = [
    `EINGABE: ${eingabe}`,
    `SICHER: ${sicher.length > 0 ? sicher.join(", ") : "nichts"}`,
    `BESTEHEND: ${Object.keys(bestehend).length > 0 ? JSON.stringify(bestehend) : "keine Filter gesetzt"}`,
    verlauf.length > 0 ? `VERLAUF:\n${verlauf.join("\n")}` : "VERLAUF: keiner",
  ].join("\n");

  /*
   * ══════════════════════════════════════════════════════════════
   * Dieselbe Zeile ergibt dieselbe Deutung
   * ══════════════════════════════════════════════════════════════
   *
   * Der Aufruf läuft mit `temperature: 0` — bei gleicher Eingabe und
   * gleichem Stand kommt dasselbe heraus. Ihn zu wiederholen kostet
   * 1,7 Sekunden für eine Antwort, die schon dasteht.
   *
   * Das kommt öfter vor, als es klingt: Wer einen Filter wegnimmt und
   * dieselbe Sache noch einmal eintippt, wer im Fenster unten rechts
   * antwortet und danach zurückgeht, wer die Seite neu lädt.
   *
   * ── Was NICHT übersprungen wird ─────────────────────────────
   *
   * Gemerkt wird nur die Antwort des Modells. Der Filterstand wird
   * trotzdem gespeichert, die Rückfrage trotzdem abgelegt — sonst
   * verschwänden beim zweiten Mal die Wirkungen des ersten.
   */
  const schluesselCache = `${eingabe.toLowerCase().trim()}|${JSON.stringify(bestehend)}`;
  const gemerkt = deutungsCache.get(schluesselCache);

  let deutung = gemerkt && Date.now() - gemerkt.at < CACHE_TTL_MS ? gemerkt.wert : undefined;

  try {
    if (deutung) throw MERKZETTEL;
    const antwort = await provider.structuredGenerate({
      system: SUCHDEUTUNG_ANWEISUNG,
      schema: SuchdeutungSchema,
      schemaName: "suchdeutung",
      messages: [{ role: "user", content: fakten }],
      /*
       * Die schnelle Stufe.
       *
       * Eine Suchzeile auszulegen ist keine Abwägung über einen
       * Lebensweg. Sie muss in einer Sekunde da sein, sonst tippt die
       * Person weiter, und die Antwort kommt zu spät.
       */
      tier: "fast",
      temperature: 0,
      timeoutMs: 12_000,
    });
    deutung = antwort.data;
    deutungsCache.set(schluesselCache, { at: Date.now(), wert: deutung });
    /* Der älteste Eintrag fliegt, sobald es zu viele werden. */
    if (deutungsCache.size > CACHE_MAX) {
      const aeltester = deutungsCache.keys().next().value;
      if (aeltester !== undefined) deutungsCache.delete(aeltester);
    }
  } catch (fehler) {
    /* Der Zwischenspeicher hat geliefert — kein Fehler, nur ein Sprung. */
    if (fehler !== MERKZETTEL) {
    /*
     * Ein gescheiterter Modellaufruf ist kein gescheiterter Vorgang.
     *
     * Der Regelabgleich steht, und der Rest wird zur Volltextsuche —
     * dieselbe Antwort wie ohne Anbieter. Die Person bekommt eine
     * Liste, keine Fehlermeldung.
     */
      console.warn("[suchdeutung] Modellaufruf fehlgeschlagen:", fehler);
      return NextResponse.json({
        /*
         * Bei mehreren Berufen trägt `zweige` den Text, nicht `q`.
         *
         * `regel.rest` ist dann die Aneinanderreihung der Berufe —
         * „bürokaufmann elektriker". Als `q` gesetzt verlangte sie
         * beide in EINEM Stellentitel und machte die Zweige daneben
         * wirkungslos.
         */
        filter: { ...regel.filter, ...(rest && !regel.zweige ? { q: rest } : {}) },
        zweige: regel.zweige,
        umkreisSchritt: regel.umkreisSchritt,
        allesEntfernen: regel.allesEntfernen,
        entfernen: regel.entfernen,
        erklaerung: regel.erkannt.length > 0 ? kurz(regel.erkannt) : `sucht nach „${rest}".`,
        rueckfrage: null,
        quelle: "regeln",
      });
    }
  }

  /* Ohne Deutung geht es hier nicht weiter — beide Wege setzen sie. */
  if (!deutung) {
    return NextResponse.json({
      filter: regel.filter,
      entfernen: regel.entfernen,
      erklaerung: kurz(regel.erkannt),
      rueckfrage: null,
      quelle: "regeln",
    });
  }

  /*
   * ══════════════════════════════════════════════════════════════
   * Die Regeln gewinnen
   * ══════════════════════════════════════════════════════════════
   *
   * Das Modell hat das Ergebnis des Regelabgleichs als Tatsache
   * bekommen und soll es nicht wiederholen. Falls es das doch tut,
   * wird sein Wert hier überschrieben — nicht geprüft.
   *
   * Der Unterschied zählt: Eine Prüfung müsste entscheiden, welche
   * der beiden Zahlen stimmt. Diese Reihenfolge muss nichts
   * entscheiden.
   */
  /*
   * ══════════════════════════════════════════════════════════════
   * Löschen ist die einzige Richtung, in der ein Irrtum zerstört
   * ══════════════════════════════════════════════════════════════
   *
   * Ein zu viel gesetzter Filter fällt sofort auf: Die Liste wird
   * kürzer, und der Chip steht sichtbar da. Ein zu viel gelöschter
   * fällt niemandem auf — die Liste wird länger, und der Chip ist weg.
   *
   * Deshalb entscheidet hier nicht, was das Modell für gemeint hält,
   * sondern ob die Person Wörter benutzt hat, mit denen man etwas
   * wegnimmt.
   */
  const entfernen = gepruefteEntfernungen(eingabe, regel.entfernen, deutung.entfernen);

  /*
   * Die Zusammenführung steht in `deutungsmerge.ts` und ist geprüft.
   *
   * Sie stand hier als vier Zeilen zwischen zwanzig anderen — und
   * derselbe Fehler ist zweimal durchgerutscht: Das `q` der Regeln
   * blieb neben dem `ort` des Modells stehen, und dieselbe Eingabe
   * ergab zwei Plättchen.
   */
  const filter = deutungZusammenfuehren({
    eingabe,
    regeln: regel.filter as Record<string, unknown>,
    modell: deutung.filter as Record<string, unknown>,
    entfernen,
  });

  /*
   * ══════════════════════════════════════════════════════════════
   * Ein ganzer Satz ist kein Suchwort
   * ══════════════════════════════════════════════════════════════
   *
   * Die Volltextsuche verlangt, dass JEDES Wort in der Anzeige
   * vorkommt. Bei „keine längere autofahrt als" sind das vier Wörter,
   * die zusammen in keiner Stellenanzeige stehen — garantiert null
   * Treffer.
   *
   * Das ist die Sorte Fehler, die wie ein leerer Arbeitsmarkt
   * aussieht. Vier Wörter sind die Grenze: „Fachkraft für
   * Lagerlogistik" hat drei, „Senior Data Engineer" auch. Was länger
   * ist, ist ein Satz und keine Berufsbezeichnung.
   */
  const wortzahl = String(filter.q ?? "").trim().split(/\s+/).filter(Boolean).length;
  let satzRest: string | null = null;
  if (wortzahl > 4) {
    satzRest = String(filter.q);
    delete filter.q;
  }

  /*
   * ══════════════════════════════════════════════════════════════
   * Was einmal eingestellt wurde, bleibt eingestellt
   * ══════════════════════════════════════════════════════════════
   *
   * Gemerkt wird der VOLLSTÄNDIGE Stand — der bisherige plus die
   * Änderung, minus das Entfernte. Nicht die Änderung allein: Sonst
   * käme ein weggenommener Filter beim nächsten Besuch zurück, und
   * die Person müsste ihn ein zweites Mal entfernen.
   *
   * Es ist ausdrücklich NICHT der Suchauftrag. „Zeig mir mal Bayern"
   * ist keine Beauftragung — wer daraus einen Auftrag machte, schickte
   * morgen früh eine Mail über Stellen in Bayern.
   */
  const vollstaendig: Record<string, string | undefined> = { ...bestehend };
  for (const k of entfernen) delete vollstaendig[k];
  for (const [k, v] of Object.entries(filter)) {
    vollstaendig[k] = typeof v === "boolean" ? (v ? "1" : "0") : String(v);
  }
  await filterMerken(user.id, vollstaendig);

  /* ── 3. Die eine Rückfrage ────────────────────────────────── */
  let rueckfrage: { schluessel: string; frage: string } | null = null;

  /*
   * Ein Widerspruch geht vor jeder anderen Frage.
   *
   * „Nur remote" und „30 km um Karlsruhe" ergeben zusammen eine leere
   * Liste — und die sieht aus wie ein leerer Arbeitsmarkt, nicht wie
   * ein Widerspruch. Danach nach dem Umkreis zu fragen wäre eine
   * Frage zu einem Filter, der ohnehin nichts mehr tut.
   *
   * Die Prüfung läuft auf dem VOLLSTÄNDIGEN Stand, nicht auf der
   * Änderung: Ein Widerspruch entsteht fast immer zwischen etwas
   * Neuem und etwas, das schon stand.
   */
  const konflikt = filterkonflikte(vollstaendig)[0];
  if (konflikt) {
    const schluessel = `suche:konflikt:${konflikt.felder.join("-")}`;
    const angelegt = await frageAblegen(db, user.id, schluessel, konflikt.frage, eingabe);
    if (angelegt) rueckfrage = { schluessel, frage: konflikt.frage };
  }

  /*
   * Was nirgends hinpasste, wird eine Frage — keine leere Liste.
   *
   * `unklar` sagt das Modell selbst; `satzRest` entsteht, wenn es
   * einen ganzen Satz in die Volltextsuche legen wollte. Beides endet
   * hier auf demselben Weg: nachfragen statt raten.
   */
  const nichtVerstanden = deutung.unklar?.trim() || satzRest;
  if (!rueckfrage && nichtVerstanden && !deutung.rueckfrage) {
    const schluessel = "suche:unklar";
    const frage = `„${nichtVerstanden.slice(0, 60)}" habe ich nicht sicher verstanden. Wie meinst du das?`;
    const angelegt = await frageAblegen(db, user.id, schluessel, frage, eingabe);
    if (angelegt) rueckfrage = { schluessel, frage };
  }

  /*
   * Der Umkreis als letzter Rückhalt.
   *
   * Das Modell fragt in aller Regel selbst danach. Diese Zeile greift,
   * wenn es das einmal vergisst — ein neuer Stadtname ohne Umkreis
   * ist die häufigste unvollständige Eingabe überhaupt.
   */
  if (!rueckfrage) {
    const nachfrage = umkreisfrage(
      {
        ort: typeof filter.ort === "string" ? filter.ort : undefined,
        umkreisKm: typeof filter.umkreisKm === "number" ? filter.umkreisKm : undefined,
      },
      bestehend,
    );
    if (nachfrage) {
      const schluessel = "suche:umkreis";
      const angelegt = await frageAblegen(db, user.id, schluessel, nachfrage, eingabe);
      if (angelegt) rueckfrage = { schluessel, frage: nachfrage };
    }
  }

  if (!rueckfrage && deutung.rueckfrage) {
    const schluessel = `suche:${deutung.rueckfrage.schluessel}`;
    const angelegt = await frageAblegen(
      db,
      user.id,
      schluessel,
      deutung.rueckfrage.frage,
      eingabe,
    );
    /*
     * Nur melden, was auch abgelegt wurde.
     *
     * Steht dieselbe Frage schon offen, entsteht keine zweite — und
     * dann soll sie auch nicht ein zweites Mal auftauchen.
     */
    if (angelegt) rueckfrage = { schluessel, frage: deutung.rueckfrage.frage };
  }

  /*
   * Die Zweige kommen aus den Regeln, nicht aus dem Modell.
   *
   * Das Modell kennt nur das flache Filterbild — es würde aus zwei
   * Berufen einen machen und ein Gehalt verlieren. Die Zerlegung ist
   * dagegen eine reine Satzfrage, die die Regeln sicher beantworten.
   *
   * Wo es Zweige gibt, müssen `q` und `gehaltAb` weichen: Sie
   * beantworten dieselbe Frage und würden ein zweites Mal filtern —
   * das Ergebnis wäre eine leere Liste ohne sichtbaren Grund.
   */
  if (regel.zweige) {
    delete filter.q;
    delete filter.gehaltAb;
  }

  return NextResponse.json({
    filter,
    zweige: regel.zweige,
    /*
     * Beides kommt aus den Regeln, nicht aus dem Modell: Es sind
     * Anweisungen auf den bestehenden Stand („eine Stufe weiter",
     * „alles weg"), und der Stand steht erst im Browser fest.
     */
    umkreisSchritt: regel.umkreisSchritt,
    allesEntfernen: regel.allesEntfernen,
    entfernen,
    erklaerung: deutung.erklaerung || (regel.erkannt.length > 0 ? kurz(regel.erkannt) : ""),
    rueckfrage,
    quelle: "modell",
    fassung: SUCHDEUTUNG_FASSUNG,
  });
}

/* ═══════════════════════════════════════════════════════════════
   Hilfen
   ═══════════════════════════════════════════════════════════════ */

function kurz(erkannt: readonly string[]): string {
  if (erkannt.length === 0) return "";
  if (erkannt.length === 1) return `hat ${erkannt[0]} übernommen.`;
  return `hat ${erkannt.slice(0, -1).join(", ")} und ${erkannt.at(-1)} übernommen.`;
}

/**
 * Die letzten Sätze — für Bezüge, nicht für Inhalte.
 *
 * Ohne `conversationId` das neueste Gespräch der Person: Wer oben
 * etwas eintippt, meint fast immer den Faden, an dem er gerade ist.
 */
async function letzteNachrichten(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  conversationId: string | null,
): Promise<string[]> {
  return withUser(db, userId, async (tx) => {
    const gespraech =
      conversationId ??
      (
        await tx
          .select({ id: schema.ninaConversations.id })
          .from(schema.ninaConversations)
          .where(eq(schema.ninaConversations.userId, userId))
          .orderBy(desc(schema.ninaConversations.updatedAt))
          .limit(1)
      )[0]?.id;

    if (!gespraech) return [];

    const zeilen = await tx
      .select({ role: schema.ninaMessages.role, content: schema.ninaMessages.content })
      .from(schema.ninaMessages)
      .where(eq(schema.ninaMessages.conversationId, gespraech))
      .orderBy(desc(schema.ninaMessages.createdAt))
      .limit(VERLAUF_ZEILEN);

    return zeilen
      .reverse()
      .map((z) => `${z.role === "user" ? "Person" : "Monday"}: ${z.content.slice(0, 200)}`);
  }).catch(() => []);
}

/**
 * Die Rückfrage in den bestehenden Kanal legen.
 *
 * ── Warum nicht in die Antwort und fertig ─────────────────────
 *
 * Weil sie dann im selben Moment erschiene, in dem sich die Liste
 * ändert — und die Person zwei Dinge gleichzeitig läse. Über
 * `nina_handlungen` geht sie denselben Weg wie jeder andere Hinweis:
 * unten rechts, wenn gerade nichts anderes läuft, und höchstens einer
 * zur Zeit.
 *
 * `propose_first`: Die Antwort ändert den Suchauftrag, und das ist
 * eine Aussage der Person über das, was sie will.
 */
async function frageAblegen(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  schluessel: string,
  frage: string,
  anlass: string,
): Promise<boolean> {
  return withUser(db, userId, async (tx) => {
    const [offen] = await tx
      .select({ id: schema.ninaHandlungen.id })
      .from(schema.ninaHandlungen)
      .where(
        and(
          eq(schema.ninaHandlungen.userId, userId),
          eq(schema.ninaHandlungen.schluessel, schluessel),
          eq(schema.ninaHandlungen.zustand, "vorgeschlagen"),
        ),
      )
      .limit(1);
    if (offen) return false;

    await tx.insert(schema.ninaHandlungen).values({
      userId,
      handlung: "suchfrage_stellen",
      klasse: "propose_first",
      begruendung: `Nach „${anlass.slice(0, 80)}" fehlt eine Angabe für die Suche.`,
      belegEreignisse: [],
      policyFassung: POLICY_FASSUNG,
      zustand: "vorgeschlagen",
      nachricht: frage,
      schluessel,
    });
    return true;
  }).catch(() => false);
}

/**
 * Eine gestellte Frage als beantwortet vermerken.
 *
 * `zugestimmt`, nicht `ausgefuehrt`: Die Person hat geantwortet, und
 * die Antwort hat den Filter geändert. Was Monday daraus macht, steht
 * in der Adresse und ist rücknehmbar wie jeder andere Filter.
 */
async function frageSchliessen(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  schluessel: string,
): Promise<void> {
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.ninaHandlungen)
      .set({ zustand: "zugestimmt", entschiedenAm: new Date() })
      .where(
        and(
          eq(schema.ninaHandlungen.userId, userId),
          eq(schema.ninaHandlungen.schluessel, schluessel),
          eq(schema.ninaHandlungen.zustand, "vorgeschlagen"),
        ),
      ),
  ).catch(() => undefined);
}

/* ═══════════════════════════════════════════════════════════════
   Die Umkreisfrage — ohne Modell
   ═══════════════════════════════════════════════════════════════ */

/**
 * Regionen, um die es keinen Umkreis gibt.
 *
 * ── Warum eine Liste und keine Erkennung ──────────────────────
 *
 * Weil es sechzehn Bundesländer sind und ein Dutzend gängiger
 * Landschaftsnamen. Sie aufzuzählen ist kürzer als jede Regel, die
 * versucht, „Bayern" von „Bayreuth" zu unterscheiden — und sie irrt
 * sich nicht.
 *
 * „30 km um Bayern" ist keine Frage, sondern ein Missverständnis.
 */
const REGIONEN = new Set([
  "deutschland",
  "österreich",
  "schweiz",
  "baden-württemberg",
  "baden württemberg",
  "bayern",
  "berlin",
  "brandenburg",
  "bremen",
  "hamburg",
  "hessen",
  "mecklenburg-vorpommern",
  "niedersachsen",
  "nordrhein-westfalen",
  "nrw",
  "rheinland-pfalz",
  "saarland",
  "sachsen",
  "sachsen-anhalt",
  "schleswig-holstein",
  "thüringen",
  "ruhrgebiet",
  "rhein-main",
  "rhein-neckar",
  "bodensee",
  "allgäu",
]);

/**
 * Die Frage nach dem Umkreis — oder keine.
 *
 * ── Die drei Bedingungen ──────────────────────────────────────
 *
 *   1. Ein Ort ist gerade dazugekommen
 *   2. Es steht kein Umkreis dabei, auch nicht aus früher
 *   3. Der Ort ist eine Stadt und keine Region
 *
 * Fehlt eine davon, wird nicht gefragt. Eine Rückfrage zu etwas, das
 * schon eingestellt ist, liest sich wie ein System, das nicht
 * mitbekommt, was gerade passiert ist.
 */
export function umkreisfrage(
  filter: { ort?: string; umkreisKm?: number },
  bestehend: Record<string, string>,
): string | null {
  const ort = filter.ort?.trim();
  if (!ort) return null;
  if (filter.umkreisKm !== undefined || bestehend.umkreisKm) return null;
  if (REGIONEN.has(ort.toLowerCase())) return null;

  /*
   * Mit Vorschlag, nicht ins Leere.
   *
   * „Wie gross soll der Umkreis sein?" verlangt eine Zahl aus dem
   * Nichts. „30 km, oder weiter?" lässt sich mit einem Wort
   * beantworten — und wer nichts sagt, bekommt trotzdem etwas
   * Sinnvolles.
   */
  const name = ort.charAt(0).toUpperCase() + ort.slice(1);
  return `Soll ich 30 km um ${name} suchen — oder lieber weiter?`;
}
