import { NextResponse } from "next/server";
import { getDb, schema, withUser } from "@paycheck/db";
import { desc, eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth";
import { PHASEN, phasentext, ringbild, type Phase } from "@paycheck/domain";

export const dynamic = "force-dynamic";

/**
 * Was Monday gerade tut — für den Ring.
 *
 * ── Warum ein Endpunkt und kein Serverwert im Seitenaufbau ──────
 *
 * Weil die Monday-Seite stehenbleibt, während der Lauf weitergeht.
 * Ein Wert, der beim Aufbau gelesen wird, ist eine Minute später
 * falsch — und ein Ring, der eine Stunde lang „prüft Muss-Kriterien"
 * anzeigt, obwohl längst nichts mehr läuft, ist genau die Art
 * Fortschrittsanzeige, die dieses Produkt nicht haben soll.
 *
 * ── Warum so wenig zurückkommt ──────────────────────────────────
 *
 * Phase, eine Zeile, ein Ringbild. Keine Zahlen zu einzelnen Stellen,
 * keine Arbeitgebernamen: Der Ring ist auf jedem Bildschirm sichtbar,
 * auch neben jemandem im Zug. Was dort steht, muss man mitlesen
 * dürfen.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ phase: "ruhe", zeile: null, ring: "idle" });

  const db = await getDb();
  const [lauf] = await withUser(db, user.id, (tx) =>
    tx
      .select({
        phase: schema.nachtLaeufe.phase,
        gefunden: schema.nachtLaeufe.gefunden,
        nachFiltern: schema.nachtLaeufe.nachFiltern,
        geprueft: schema.nachtLaeufe.geprueft,
        gesehenAm: schema.nachtLaeufe.gesehenAm,
        begonnenAm: schema.nachtLaeufe.begonnenAm,
      })
      .from(schema.nachtLaeufe)
      .where(eq(schema.nachtLaeufe.userId, user.id))
      .orderBy(desc(schema.nachtLaeufe.begonnenAm))
      .limit(1),
  ).catch(() => []);

  if (!lauf) return NextResponse.json({ phase: "ruhe", zeile: null, ring: "idle" });

  const phase: Phase = (PHASEN as readonly string[]).includes(lauf.phase)
    ? (lauf.phase as Phase)
    : "fehler";

  /*
   * Ein gelesener Bericht ist kein laufender Prozess.
   *
   * Ohne diese Zeile stünde „dein Morgenbericht liegt bereit" auch
   * noch abends unter dem Ring — und der Ring wäre eine Anzeige, die
   * man nach dem dritten Tag nicht mehr liest.
   */
  if (phase === "bereit" && lauf.gesehenAm !== null) {
    return NextResponse.json({ phase: "ruhe", zeile: null, ring: "idle" });
  }

  return NextResponse.json({
    phase,
    zeile: phase === "ruhe" ? null : phasentext(phase, lauf),
    ring: ringbild(phase),
    /* Nur bei „bereit" führt der Weg irgendwohin. */
    ziel: phase === "bereit" ? "/app/morgen" : null,
  });
}
