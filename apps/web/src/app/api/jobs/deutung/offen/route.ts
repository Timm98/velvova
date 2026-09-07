import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Die offene Rückfrage zur Suche — falls es eine gibt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es diesen Abruf gibt
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Frage entsteht nicht nur, während jemand tippt. Sie kann aus
 * einem Hintergrundlauf stammen, aus einer früheren Sitzung, aus
 * einem anderen Gerät. Ohne diesen Abruf läge sie in
 * `nina_handlungen` und würde nie gestellt — geschrieben, gespeichert,
 * ungefragt.
 *
 * ══════════════════════════════════════════════════════════════
 * Holen und Vermerken in einer Anweisung
 * ══════════════════════════════════════════════════════════════
 *
 * Getrennt läge dazwischen ein Fenster: Zwei offene Tabs holen
 * dieselbe Frage, beide zeigen sie, und die Person beantwortet sie
 * zweimal. Ein `update … returning` mit Unterabfrage erledigt beides;
 * wer zuerst kommt, bekommt sie.
 *
 * ── Warum nur `suche:` ──────────────────────────────────────
 *
 * Dieses Fenster ist der Suchdialog. Eine Frage zum Profil — ein
 * Widerspruch, eine Wissenslücke — gehört ins Gespräch, wo die
 * Antwort ein Beleg wird. Sie hier zu stellen hiesse, zwei
 * verschiedene Sorten Frage gleich aussehen zu lassen.
 */
export async function GET() {
  const user = await requireUser();
  const db = await getDb();

  const zeilen = (await withUser(db, user.id, (tx) =>
    tx.execute(sql`
      update nina_handlungen h
         set gezeigt_am = now()
       where h.id = (
         select k.id from nina_handlungen k
          where k.user_id = ${user.id}
            and k.handlung = 'suchfrage_stellen'
            and k.zustand = 'vorgeschlagen'
            and k.entschieden_am is null
            and k.nachricht is not null
            and k.schluessel is not null
            /*
             * Was schon gezeigt wurde, kommt nicht wieder.
             *
             * Der Abruf setzte gezeigt_am, pruefte es aber nicht --
             * und weil er an jeder Navigation hängt, kam dieselbe
             * Frage nach jedem Filterklick erneut. Für die Person
             * sah es aus, als klebe das Fenster fest.
             *
             * Eine Frage wird einmal gestellt. Wer sie wegklickt,
             * bekommt sie beim nächsten Anlass wieder — nicht beim
             * nächsten Seitenaufbau.
             */
            and k.gezeigt_am is null
            /*
             * Nichts Altes nachreichen.
             *
             * Eine Frage zum Umkreis von gestern passt nicht mehr zu
             * dem, was heute in der Liste steht — und wirkt wie ein
             * System, das nicht mitbekommt, was gerade passiert.
             */
            and k.erstellt_am > now() - interval '2 hours'
          order by k.erstellt_am desc
          limit 1
          for update skip locked
       )
   returning h.schluessel, h.nachricht
    `),
  )) as unknown as { rows: Record<string, unknown>[] };

  const z = zeilen.rows[0];
  if (!z) return NextResponse.json({ frage: null });

  return NextResponse.json({
    frage: { schluessel: String(z.schluessel), frage: String(z.nachricht) },
  });
}
