import { NextResponse } from "next/server";
import { loadRuntimeConfig } from "@paycheck/config";
import { getDb } from "@paycheck/db";
import { durchlaufAusfuehren } from "@paycheck/jobs";
import { mailBereit, versendeMail } from "@/lib/mail/versand";
import { abmeldeKopfzeilen } from "@/lib/suchauftrag/abmeldung";
import {
  einbetter,
  einbettungsmodell,
  modellBereit,
  modellrufer,
  PROMPT_MAILTEXT,
  PROMPT_MATCHBELEGE,
} from "@/lib/suchauftrag/modellrufer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Der Zeitplan ruft hier an.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Endpunkt und kein pg_cron
 * ══════════════════════════════════════════════════════════════
 *
 * `pg_cron` kann nur SQL. Um den Dienst zu starten, bräuchte es
 * zusätzlich `pg_net` und einen Endpunkt — also genau diesen hier,
 * nur mit einer Erweiterung mehr in der Produktionsdatenbank.
 *
 * Der Stellenabruf läuft in diesem Projekt bereits so: Wecker in
 * GitHub Actions, Arbeit im Server. Ein zweites Verfahren daneben
 * hiesse zwei Orte, an denen man nachsieht, warum nichts lief.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum stündlich und nicht nachts
 * ══════════════════════════════════════════════════════════════
 *
 * Weil „08:00" die Ortszeit der Person ist. Ein einzelner nächtlicher
 * Lauf träfe das Fenster für Mitteleuropa und für sonst niemanden.
 *
 * Doppelt zu laufen schadet nicht: Der Fensterschlüssel ist in der
 * Datenbank eindeutig, und ein zweiter Lauf im selben Fenster erzeugt
 * keine zweite Zusammenfassung.
 */
export async function POST(request: Request) {
  const geheimnis = process.env.JOBS_REFRESH_SECRET;
  const kopf = request.headers.get("authorization");
  if (!geheimnis || kopf !== `Bearer ${geheimnis}`) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 401 });
  }

  const url = new URL(request.url);
  const trocken = url.searchParams.get("trocken") === "1";
  const stapel = Number(url.searchParams.get("stapel") ?? 20);

  const cfg = loadRuntimeConfig();
  const stand = mailBereit();
  const db = await getDb();

  /*
   * Ohne eingerichteten Anbieter wird nichts versendet — und das
   * steht in der Antwort, statt still ausgelassen zu werden.
   *
   * Ein Zeitplan, der jede Nacht „ok" meldet, während seit Wochen
   * keine Mail hinausgeht, ist schlimmer als einer, der rot ist.
   */
  const versender =
    trocken || !stand.bereit
      ? undefined
      : async (a: Parameters<NonNullable<Parameters<typeof durchlaufAusfuehren>[1]["versender"]>>[0]) => {
          const antwort = await versendeMail({
            an: a.an,
            betreff: a.betreff,
            html: a.html,
            text: a.text,
            /* Ohne Abmeldeadresse keine Kopfzeile — eine erfundene
               wäre schlimmer als keine. */
            kopfzeilen: a.abmeldeUrl ? abmeldeKopfzeilen(a.abmeldeUrl) : undefined,
          });
          if (antwort.ok) {
            return {
              ok: true as const,
              anbieterId: antwort.id ?? null,
              anbieter: antwort.entwurf ? "entwurf" : cfg.mail.provider,
            };
          }
          return {
            ok: false as const,
            /* Ein Konfigurationsfehler wiederholt sich nicht von selbst. */
            art: antwort.grund === "konfiguration" ? ("dauerhaft" as const) : ("vorübergehend" as const),
            text: antwort.text,
          };
        };

  /*
   * Ohne eingerichtetes Modell läuft der deterministische Weg — und
   * das steht in der Antwort. Ein Zeitplan, der „ok" meldet, während
   * seit Wochen der Ersatztext verschickt wird, verbirgt genau das,
   * wofür er da ist.
   */
  const modell = await modellBereit();
  const bericht = await durchlaufAusfuehren(db, {
    basisUrl: cfg.appUrl,
    stapel: Number.isFinite(stapel) ? Math.min(Math.max(stapel, 1), 200) : 20,
    versender,
    rufer: modell.bereit ? modellrufer() : undefined,
    prompt3: PROMPT_MAILTEXT,
    prompt2: PROMPT_MATCHBELEGE,
    /*
     * Der semantische Schritt braucht dasselbe Modell wie alles
     * andere. Fehlt es, entfällt er — und das steht in der Antwort,
     * statt still zu passieren.
     */
    einbetter: modell.bereit ? einbetter() : undefined,
    einbettungsmodell: einbettungsmodell(),
  });

  return NextResponse.json({
    ...bericht,
    modell: modell.bereit ? "eingerichtet" : `deterministisch: ${modell.grund}`,
    versandGrund:
      bericht.versandGrund === null
        ? null
        : trocken
          ? "trockenlauf"
          : `nicht eingerichtet: ${stand.fehlt.join(", ") || "Anbieter fehlt"}`,
  });
}
