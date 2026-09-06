import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { pruefeDatei } from "@/lib/documents/dateipruefung";
import { EXTRAKTOR, EXTRAKTOR_VERSION, textAuszug } from "@/lib/documents/textauszug";
import { ablegen, inhaltsKennung, sichererName } from "@/lib/documents/ablage";
import { behauptungenAusText } from "@/lib/documents/behauptungen";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ein Dokument, das eine Person selbst mitbringt.
 *
 * Der Ablauf ist bewusst streng geordnet, und die Reihenfolge ist der
 * Sicherheitsgewinn:
 *
 *   1. Angemeldet? Ohne Konto keine Ablage.
 *   2. Ist die Datei das, was sie behauptet? Magic Bytes, nicht
 *      Content-Type. Fällt sie hier durch, wird sie NICHT abgelegt —
 *      sie verlässt den Arbeitsspeicher nicht.
 *   3. Ablegen, unter einem Pfad, der mit der Nutzerkennung beginnt.
 *   4. Zeile anlegen.
 *   5. Text lesen — serverseitig, nie im Browser gerendert.
 *   6. Behauptungen ableiten, jede mit Fundstelle, keine bestätigt.
 *
 * Schritt 2 vor Schritt 3 ist der Punkt. Eine Datei erst abzulegen und
 * dann zu prüfen hiesse, sie im Zweifel schon zu haben.
 *
 * Was NICHT passiert: nichts wird als bestätigte Evidenz übernommen.
 * Ein hochgeladener Lebenslauf ist eine Behauptung der Person über sich
 * selbst. Er wird zu einem Beleg, wenn sie ihn bestätigt — nicht, weil
 * eine Datei angekommen ist.
 */

/** Wofür die Person die Datei hält. Ihre Angabe, nicht unsere Erkennung. */
const ERLAUBTE_ARTEN = new Set([
  "cv",
  "cover_letter",
  "reference",
  "certificate",
  "job_ad",
  "old_application",
  "rejection",
  "portfolio",
  "work_sample",
  "other",
]);

/** Wie weit die Datei reichen darf. Voreinstellung ist die engste. */
const ERLAUBTE_REICHWEITEN = new Set(["chat_only", "application", "career_profile", "none"]);

export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireUser();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ fehler: "Die Datei konnte nicht gelesen werden." }, { status: 400 });
  }

  const datei = form.get("datei");
  if (!(datei instanceof File)) {
    return NextResponse.json({ fehler: "Es fehlt eine Datei." }, { status: 400 });
  }

  const art = String(form.get("art") ?? "other");
  const reichweite = String(form.get("reichweite") ?? "chat_only");
  if (!ERLAUBTE_ARTEN.has(art) || !ERLAUBTE_REICHWEITEN.has(reichweite)) {
    return NextResponse.json({ fehler: "Unbekannte Angabe." }, { status: 400 });
  }

  const daten = new Uint8Array(await datei.arrayBuffer());

  // ── 2. Prüfen, BEVOR irgendetwas abgelegt wird ─────────────
  const geprueft = pruefeDatei(datei.type, datei.name, daten);
  if (!geprueft.ok) {
    // `intern` bleibt im Protokoll: es hilft nur beim Umgehen der Prüfung.
    console.warn("Upload abgelehnt:", geprueft.intern ?? geprueft.grund);
    return NextResponse.json({ fehler: geprueft.grund }, { status: 400 });
  }

  const db = await getDb();
  const hash = inhaltsKennung(daten);

  // Dieselbe Datei nicht zweimal. Menschen laden ihren Lebenslauf
  // erfahrungsgemäss mehrfach hoch.
  const [vorhanden] = await withUser(db, user.id, (tx) =>
    tx
      .select({ id: schema.userDocuments.id })
      .from(schema.userDocuments)
      .where(
        and(
          eq(schema.userDocuments.userId, user.id),
          eq(schema.userDocuments.contentHash, hash),
          isNull(schema.userDocuments.deletedAt),
        ),
      )
      .limit(1),
  );
  if (vorhanden) {
    return NextResponse.json({
      dokumentId: vorhanden.id,
      hinweis: "Diese Datei hast du schon hochgeladen. Ich nehme die vorhandene.",
      schonDa: true,
    });
  }

  // ── 3. + 4. Ablegen und eintragen ──────────────────────────
  const [zeile] = await withUser(db, user.id, (tx) =>
    tx
      .insert(schema.userDocuments)
      .values({
        userId: user.id,
        declaredKind: art,
        originalFilename: datei.name.slice(0, 255),
        mimeType: datei.type,
        byteSize: daten.length,
        storageBucket: "career-documents",
        storagePath: "",
        contentHash: hash,
        status: "scanning",
      })
      .returning({ id: schema.userDocuments.id }),
  );
  if (!zeile) {
    return NextResponse.json({ fehler: "Das Dokument konnte nicht angelegt werden." }, { status: 500 });
  }

  const pfad = `${user.id}/${zeile.id}/${sichererName(datei.name)}`;
  try {
    await ablegen({ bucket: "career-documents", pfad }, daten);
  } catch (fehler) {
    await withUser(db, user.id, (tx) =>
      tx
        .update(schema.userDocuments)
        .set({ status: "failed", rejectedReason: "Ablage nicht verfügbar", updatedAt: new Date() })
        .where(eq(schema.userDocuments.id, zeile.id)),
    );
    console.error("Ablage fehlgeschlagen:", fehler);
    return NextResponse.json(
      { fehler: "Die Datei konnte nicht gespeichert werden." },
      { status: 503 },
    );
  }

  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.userDocuments)
      .set({ storagePath: pfad, status: "extracting", updatedAt: new Date() })
      .where(eq(schema.userDocuments.id, zeile.id)),
  );

  // ── 5. Text lesen ──────────────────────────────────────────
  const auszug = textAuszug(geprueft.typ!, daten);

  await withUser(db, user.id, (tx) =>
    tx.insert(schema.documentProcessingRuns).values({
      documentId: zeile.id,
      userId: user.id,
      step: "extract",
      status: auszug.ok ? "ok" : "failed",
      detail: auszug.ok ? null : auszug.grund,
      finishedAt: new Date(),
    }),
  );

  if (!auszug.ok) {
    /*
     * Kein Fehler, sondern ein Zustand.
     *
     * Die Datei liegt, sie gehört der Person, sie lässt sich
     * herunterladen und löschen. Nur lesen konnten wir sie nicht — und
     * das steht so da, mitsamt dem Weg drumherum.
     */
    await withUser(db, user.id, (tx) =>
      tx
        .update(schema.userDocuments)
        .set({ status: "ready", rejectedReason: auszug.grund, updatedAt: new Date() })
        .where(eq(schema.userDocuments.id, zeile.id)),
    );
    return NextResponse.json({
      dokumentId: zeile.id,
      gelesen: false,
      hinweis: auszug.grund,
    });
  }

  const [extraktion] = await withUser(db, user.id, (tx) =>
    tx
      .insert(schema.documentExtractions)
      .values({
        documentId: zeile.id,
        userId: user.id,
        kind: art === "other" ? "other" : art,
        plainText: auszug.text,
        pageCount: auszug.seiten ?? null,
        extractor: EXTRAKTOR,
        extractorVersion: EXTRAKTOR_VERSION,
      })
      .returning({ id: schema.documentExtractions.id }),
  );

  // ── 6. Behauptungen — mit Fundstelle, keine bestätigt ──────
  const behauptungen = extraktion ? behauptungenAusText(auszug.text!) : [];
  if (extraktion && behauptungen.length > 0) {
    await withUser(db, user.id, (tx) =>
      tx.insert(schema.documentClaims).values(
        behauptungen.map((b) => ({
          extractionId: extraktion.id,
          userId: user.id,
          kind: b.art,
          statement: b.aussage,
          sourceStart: b.von,
          sourceEnd: b.bis,
          sourceQuote: b.zitat,
          confidence: b.sicherheit,
          userConfirmed: false,
        })),
      ),
    );
  }

  await withUser(db, user.id, async (tx) => {
    await tx.insert(schema.documentPermissions).values({
      documentId: zeile.id,
      userId: user.id,
      scope: reichweite,
    });
    await tx
      .update(schema.userDocuments)
      .set({ status: "ready", updatedAt: new Date() })
      .where(eq(schema.userDocuments.id, zeile.id));
  });

  return NextResponse.json({
    dokumentId: zeile.id,
    gelesen: true,
    seiten: auszug.seiten ?? null,
    zeichen: auszug.text!.length,
    behauptungen: behauptungen.length,
    reichweite,
  });
}

/** Was die Person schon hochgeladen hat. */
export async function GET(): Promise<NextResponse> {
  const user = await requireUser();
  const db = await getDb();

  const zeilen = await withUser(db, user.id, (tx) =>
    tx
      .select({
        id: schema.userDocuments.id,
        name: schema.userDocuments.originalFilename,
        art: schema.userDocuments.declaredKind,
        groesse: schema.userDocuments.byteSize,
        status: schema.userDocuments.status,
        hinweis: schema.userDocuments.rejectedReason,
        angelegt: schema.userDocuments.createdAt,
      })
      .from(schema.userDocuments)
      .where(and(eq(schema.userDocuments.userId, user.id), isNull(schema.userDocuments.deletedAt)))
      .orderBy(desc(schema.userDocuments.createdAt))
      .limit(50),
  );

  return NextResponse.json({ dokumente: zeilen });
}
