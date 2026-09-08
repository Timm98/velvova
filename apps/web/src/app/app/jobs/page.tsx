import type { Metadata } from "next";
import { plural } from "@paycheck/domain";
import type { SortKey } from "@paycheck/matching";
import Link from "next/link";
import { Suspense } from "react";
import { Columns3, Compass } from "lucide-react";
import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { ortNachschlagen } from "@paycheck/jobs";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { listJobsForUser, type ScoredJob } from "@/lib/matching";
import { buildDecisionBrief } from "@/lib/applications/decision-brief";
import { loadGate } from "@/lib/gate";
import { Badge, Button, Skeleton, SkeletonText } from "@/components/ui";
import { EmptyState, PageHeader } from "@/components/ui/states";
import type { JobRowData } from "@/components/jobs/JobRow";
import { Jobalarm } from "@/components/jobs/Jobalarm";
import { Vertrauensbereich } from "@/components/shell/Vertrauensbereich";
import { JobFilters } from "./JobFilters";
import { JobPagination } from "./JobPagination";
import { Rollrastung } from "./Rollrastung";
import { FilterChips } from "./FilterChips";
import { JobSplitView } from "./JobSplitView";
import { workspaceDaten } from "./nina/daten";
import { zukunftLaden } from "@/lib/jobs/zukunft";
import { NinaSteuerungProvider } from "./NinaSteuerung";
import { JobDetailPanel } from "./JobDetailPanel";
import { NinaSearchComposer } from "@/components/jobs/NinaSearchComposer";
import { ScrollUebergang } from "@/components/nina/ScrollUebergang";
import { SuchdialogProvider, Suchrueckfrage } from "@/components/jobs/Suchrueckfrage";
import { titelOhneEmoji } from "@/lib/jobs/titel";
import { gehaltszeileFuer, referenzFinden, zeilenAusStellen } from "@/lib/jobs/zeilen";
import { fahrzeitMinuten } from "@/lib/jobs/fahrzeit";
import { entfernungKm } from "@paycheck/matching";
import { besucherHerkunft } from "@/lib/herkunft";
import { nurFilter } from "@/lib/jobs/listenfilter";
import { zweigeLesen, zweigeSchreiben, type Suchzweig } from "@/lib/jobs/zweige";
import { trifftSuche } from "@/lib/jobs/textsuche";
import { Suchrichtungen } from "@/components/jobs/Suchrichtungen";
import { suchrichtungen } from "@paycheck/matching";
import { abdeckungssatz, ladeQuellenabdeckung } from "@/lib/jobs/coverage";
import { grundlagenzahlen } from "@/lib/jobs/grundlagen";
import { kursstand } from "@/lib/waehrung/kurse";
import { LAND_ZU_WAEHRUNG } from "@paycheck/jobs/waehrung";
import { stellenseitendaten } from "@/lib/jobs/seitendaten";
import { listensignale } from "@/lib/jobs/listensignale";
import { gehaltsanzeige } from "@/lib/jobs/gehaltsanzeige";
import { referenzenFuerKldb, referenzenFuerTitel } from "@/lib/jobs/berufsreferenz";
import {
  beschaeftigungsart,
  BESCHAEFTIGUNGSARTEN,
  type Beschaeftigungsart,
} from "@/lib/jobs/beschaeftigungsart";

export const metadata: Metadata = { title: "Matches" };
export const dynamic = "force-dynamic";

/**
 * Die Adresse der nächsten Seite.
 *
 * Alle bestehenden Parameter bleiben erhalten — wer gefiltert hat, will
 * beim Blättern nicht von vorn anfangen. `job` fällt weg: die Auswahl
 * der alten Seite auf die neue mitzunehmen wäre verwirrend.
 */
/**
 * Der Verweis auf „mehr anzeigen".
 *
 * Er trägt die ANZAHL, nicht die Seitennummer. Der Unterschied ist die
 * ganze Umstellung: `?anzahl=50` zeigt fünfzig Stellen, also die
 * bisherigen plus fünfundzwanzig neue darunter. `?seite=2` hätte die
 * ersten fünfundzwanzig ersetzt.
 *
 * Damit gibt es kein Zurück, keine Seitenzahl und kein „25 von 719" —
 * eine Liste, die wächst, braucht das alles nicht.
 */
function mehrParams(params: Record<string, string | undefined>, anzahl: number): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && k !== "anzahl" && k !== "seite" && k !== "job") next.set(k, v);
  }
  next.set("anzahl", String(anzahl));
  return next.toString();
}

const SORT_KEYS: SortKey[] = [
  "best_overall", "highest_fit", "best_job_quality", "highest_salary",
  "future_robust", "shortest_commute", "newest",
];

/**
 * Die Stellenliste.
 *
 * Keine endlose Ergebnisseite, sondern drei begründete Gruppen:
 *
 *   1. Beste Treffer — wenige, mit Grund und Vorbehalt.
 *   2. Mutige Alternativen — angrenzende Rollen, auf die man beim
 *      Suchen nach dem eigenen Jobtitel nie stößt. Das ist der eigentliche
 *      Grund, warum vorher ein Gespräch stattfindet.
 *   3. Neu diese Woche — was seit Kurzem dazugekommen ist.
 *
 * Ausgeschlossene Stellen erscheinen nicht in der Auswahl, sind aber auf
 * Wunsch sichtbar — mit konkretem Grund. Etwas stillschweigend
 * wegzufiltern wäre schlechter, als es zu begründen.
 */
async function Stellenliste({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const { t, brand } = await getPageContext();
  const adresse = await searchParams;

  /*
   * ══════════════════════════════════════════════════════════════
   * Der zuletzt eingestellte Stand, wenn die Adresse nichts sagt
   * ══════════════════════════════════════════════════════════════
   *
   * Die Filter standen bisher nur in der Adresse. Ein geteilter Link
   * trug sie mit, ein frischer Besuch nicht: Wer gestern Umkreis,
   * Gehalt und Vertragsart eingestellt hatte, fing heute bei null an
   * und musste dasselbe noch einmal eintippen.
   *
   * ── Warum die Adresse gewinnt, sobald sie etwas sagt ────────
   *
   * Weil sie dann von einer Handlung stammt: einem Klick auf einen
   * Chip, einer Eingabe, einem geteilten Link. Den gespeicherten Stand
   * darüberzulegen hiesse, eine gerade getroffene Entscheidung durch
   * eine ältere zu ersetzen.
   *
   * ── Und warum es einen Ausweg gibt ──────────────────────────
   *
   * Wer den letzten Filter entfernt, landet auf einer Adresse ohne
   * Filter — und bekäme den gespeicherten Stand zurück, den er gerade
   * losgeworden ist. `?leer=1` sagt: Ich will wirklich nichts.
   */
  const eigene = nurFilter(adresse);

  /*
   * Alles gleichzeitig, was nicht voneinander abhängt.
   *
   * ── Warum das so viel ausmacht ────────────────────────────
   *
   * Diese Seite bezahlt keine Rechenzeit, sondern Netzrunden. Gemessen
   * gegen die Datenbank:
   *
   *   eine Abfrage                     43 ms
   *   `withUser` mit einer Abfrage    174 ms   (BEGIN, Rolle, Abfrage, COMMIT)
   *   drei Abfragen parallel           46 ms
   *
   * Der Riegel, das Profil und die gemerkten Stellen sind drei
   * `withUser`-Aufrufe. Nacheinander sind das über 500 Millisekunden,
   * in denen nichts gerechnet wird — die Verbindung wartet.
   *
   * Sie hängen nicht voneinander ab: Der Riegel liest Interviewsitzungen,
   * das Profil liest Bedingungen und Belege, die gemerkten Stellen lesen
   * eine Kennungsliste. Nebeneinander kosten sie so viel wie der
   * langsamste von ihnen.
   *
   * Die Stellenliste bleibt danach, weil sie das Profil braucht.
   */
  const db = await getDb();
  /*
   * Die beiden Rechner brauchen drei Angaben.
   *
   * `ladeGehaltsangaben` und `ladeLebenshaltung` für den Nettorechner,
   * der Wohnort für den Arbeitsweg. Alle drei laufen in derselben
   * Runde wie der Rest — nacheinander wären es drei weitere Umläufe
   * gegen Supabase, und die kosten je rund 170 Millisekunden.
   */
  /*
   * ══════════════════════════════════════════════════════════════
   * Drei Transaktionen, nicht sieben und nicht eine
   * ══════════════════════════════════════════════════════════════
   *
   * Diese Seite bezahlt keine Rechenzeit, sondern Netzrunden. Eine
   * `withUser`-Transaktion sind vier davon gegen Supabase — BEGIN,
   * Rolle setzen, Abfrage, COMMIT, je rund 44 Millisekunden.
   *
   * Erst stand hier jeder Lesevorgang in einer eigenen Transaktion:
   * Riegel, Profil, gemerkte Stellen, Wohnort, Steuerangaben,
   * Lebenshaltung, gespeicherte Filter. Sieben Stück, davon achtzehn
   * Runden reine Verwaltung.
   *
   * Der naheliegende Schluss war, alles in EINE zu legen. Gemessen
   * wurde es dadurch langsamer:
   *
   *     sieben Transaktionen, nebeneinander    422 ms
   *     eine Transaktion, alles darin          575 ms
   *     drei Transaktionen, nebeneinander      357 ms
   *
   * Der Grund: Eine Transaktion läuft auf EINER Verbindung, und eine
   * Verbindung arbeitet ihre Abfragen nacheinander ab. `Promise.all`
   * darin sieht nach Gleichzeitigkeit aus und ist keine — sechs
   * Abfragen sind dort sechs Runden hintereinander. Nebeneinander
   * laufende Transaktionen überlappen ihre Wartezeit dagegen
   * wirklich.
   *
   * Die Mitte gewinnt. Die fünf kleinen Lesevorgänge — je eine Zeile
   * — teilen sich eine Transaktion, weil ihre Verwaltung mehr kostet
   * als ihre Abfragen. Riegel und Profil bekommen eigene, weil sie
   * selbst mehrere Abfragen haben und sonst hinter den kleinen
   * anstehen müssten.
   *
   * ── Was NICHT hineingehört ──────────────────────────────────
   *
   * `ladeQuellenabdeckung` ist zwischengespeichert und braucht meist
   * gar keine Datenbank. Die Sitzungsbedingungen kommen aus einem
   * Keks. Beides wird vorher gelesen — eine offene Verbindung soll
   * nicht auf etwas warten, das nicht aus der Datenbank kommt.
   */
  /* Zwischengespeichert, braucht meist gar keine Datenbank. */
  const abdeckung = await ladeQuellenabdeckung();

  /*
   * Der Wohnort wird nachgeschlagen, sobald er bekannt ist — nicht
   * danach.
   *
   * `ortNachschlagen` stand unter der Sammelrunde und lief allein,
   * obwohl es nur die eine Zeile aus `user_settings` braucht. Das war
   * eine weitere Netzrunde in Reihe, während nebenan noch drei
   * Gruppen unterwegs waren.
   *
   * Jetzt hängt es direkt an der Gruppe, die diese Zeile liest, und
   * verschwindet in deren Schatten: Die anderen Gruppen brauchen
   * ohnehin länger.
   */
  /*
   * ══════════════════════════════════════════════════════════════
   * Alles über die Person auf einmal — und womöglich schon fertig
   * ══════════════════════════════════════════════════════════════
   *
   * Riegel, Profil, gemerkte Stellen, abgelegte Stellen, Wohnort,
   * Steuerangaben, Lebenshaltung, gespeicherte Filter: gemessen 366
   * Millisekunden, fast ausschliesslich Netzrunden gegen Supabase.
   *
   * Sie stehen jetzt in `lib/jobs/seitendaten.ts` und werden dort
   * zwanzig Sekunden lang vorgehalten. Während jemand mit Monday
   * spricht, holt `POST /api/jobs/vorwaermen` sie im Hintergrund —
   * kommt der Wechsel, sind sie da und dieser Aufruf kostet nichts.
   *
   * Ist nichts vorgewärmt, holt diese Zeile sie wie bisher selbst.
   * Das Vorwärmen ist ein Angebot, keine Voraussetzung.
   */
  const {
    gate,
    ctx,
    saved,
    gemerkteFilter,
    abgelegt,
    gehaltsangaben,
    lebenshaltung,
    wohnpunkt,
    wohnort,
  } = await stellenseitendaten(user.id);

  /*
   * Wer gerade selbst gefiltert hat, behält seinen Stand.
   *
   * Den gespeicherten darüberzulegen hiesse, eine eben getroffene
   * Entscheidung durch eine ältere zu ersetzen. `?leer=1` sagt
   * ausdrücklich: Ich will wirklich nichts.
   */
  const gemerkt =
    Object.keys(eigene).length > 0 || adresse.leer === "1" ? {} : gemerkteFilter;

  const params: Record<string, string | undefined> = { ...gemerkt, ...adresse };

  /*
   * Wie viele Stellen die Seite zeigen soll — aus der Adresse.
   *
   * Sie wird hier gebraucht, bevor die Liste geladen wird: Die Zahl
   * entscheidet, wie viele Kandidaten überhaupt bewertet werden
   * müssen. Weiter unten wird sie noch einmal geklammert, dann gegen
   * die tatsächliche Trefferzahl.
   */
  const gewuenschteAnzahl = (() => {
    const roh = Number.parseInt(params.anzahl ?? "", 10);
    return Number.isFinite(roh) ? Math.max(roh, 25) : 25;
  })();

  /*
   * ══════════════════════════════════════════════════════════════
   * Welches Land gilt für diese Suche
   * ══════════════════════════════════════════════════════════════
   *
   * Vier Quellen, in dieser Reihenfolge — und jede schlägt die
   * folgende:
   *
   *   1. `?land=` in der Adresse      diese eine Suche
   *   2. das Profil                    im Gespräch gesagt
   *   3. Netz oder Sprache             was die Anfrage mitbringt
   *   4. nichts                        dann überall
   *
   * Der Normalfall ist zwei: Wer das Interview gemacht hat, hat es
   * gesagt. Drei ist für den, der direkt auf die Stellen geht —
   * `besucherHerkunft` liest den Ländercode, den das CDN ohnehin
   * mitschickt, sonst die Sprachregion aus `Accept-Language`.
   *
   * ── Warum das sichtbar sein muss ────────────────────────────
   *
   * Ein Ländercode aus dem Netz ist eine VERMUTUNG. Wer über ein
   * Firmen-VPN kommt, im Urlaub ist oder gerade umzieht, bekommt die
   * falsche. Genau deshalb ist die alte Vorgabe „DE" so lange
   * unbemerkt geblieben: Sie stand nirgends.
   *
   * Eine abgeleitete Einschränkung steht deshalb als Plättchen über
   * der Liste und lässt sich mit einem Klick wegnehmen —
   * `?land=alle`.
   */
  const herkunft =
    ctx.constraints.country === null && params.land === undefined
      ? await besucherHerkunft().catch(() => ({ code: null, quelle: "unbekannt" as const }))
      : { code: null, quelle: "unbekannt" as const };

  const landWahl =
    params.land === "alle"
      ? null
      : /^[A-Za-z]{2}$/.test(params.land ?? "")
        ? params.land!.toUpperCase()
        : (ctx.constraints.country ?? herkunft.code);

  /*
   * Die Bedingung gilt nur für diese Suche.
   *
   * Geschrieben wird nichts: Eine Vermutung aus einer Kopfzeile im
   * Profil abzulegen hiesse, sie beim nächsten Mal für eine Aussage
   * der Person zu halten.
   */
  const ctxSuche =
    landWahl === (ctx.constraints.country ?? null)
      ? ctx
      : { ...ctx, constraints: { ...ctx.constraints, country: landWahl } };

  const includeBlocked = params.blocked === "1";
  const sort = (SORT_KEYS as string[]).includes(params.sort ?? "")
    ? (params.sort as SortKey)
    : "best_overall";

  const { jobs, klaerung, blockedCount, staleCount } = await listJobsForUser(user.id, ctxSuche, {
    sort,
    includeBlocked,
    /* Schon gelesen — siehe die Sammelrunde oben. */
    abgelegt,
    /*
     * Wie tief gesucht wird, hängt daran, wie viel gezeigt wird.
     *
     * Vorher wurden immer 2.000 Stellen bewertet — auch für die
     * fünfundzwanzig auf dem Bildschirm. Gemessen kostet das 397 ms
     * gegenüber 90 ms für 600, und bezahlt wird es für Zeilen, die
     * niemand sieht.
     */
    sichtbar: gewuenschteAnzahl,
    suche: params.q ?? null,
    /*
     * Mehrere Berufe mit eigenem Gehalt.
     *
     * Sie stehen als EIN Adressparameter da — `zweige=beruf~betrag;…`
     * —, weil die ganze Filterkette dieser Seite mit
     * `Record<string, string>` arbeitet: die Adresse, das Blättern,
     * das Merken. Ein wiederholter Parameter käme als `string[]` an
     * und hätte alle drei aufgebrochen.
     */
    zweige: zweigeLesen(params.zweige),
    /*
     * Der Ort geht in die Datenbank, nicht mehr in den Nachfilter.
     *
     * Vorher lieferte die Abfrage die neuesten 2.000 Anzeigen
     * bundesweit, und erst danach behielt JavaScript die aus
     * Karlsruhe. Bei „Bayern" blieb davon fast nichts — und die
     * Liste sah aus, als gäbe es dort kaum Stellen.
     */
    ort: params.ort ?? null,
  });

  const savedIds = new Set(saved.map((s) => s.jobId));

  /*
   * Die Suchrichtungen aus dem Profil.
   *
   * Reine Rechnung auf schon geladenen Daten — kein Netzzugriff, keine
   * Datenbankabfrage, kein Modellaufruf. Sie darf deshalb im
   * Seitenaufbau stehen, ohne ihn zu verlangsamen.
   *
   * ── Derzeit ohne Abnehmer ─────────────────────────────────
   *
   * Die Plättchen unter dem Eingabefeld sind entfernt (siehe weiter
   * unten). Die Rechnung bleibt stehen, weil sie nichts kostet und
   * weil das Wiedereinsetzen sonst zwei Schritte wären statt einem.
   * Wer sie endgültig nicht mehr braucht, nimmt sie samt Einbindung
   * von `Suchrichtungen` heraus.
   */
  const richtungen = suchrichtungen(
    {
      evidence: ctx.evidence,
      energisingTasks: ctx.energisingTasks,
      drainingTasks: ctx.drainingTasks,
      statedInterests: ctx.statedInterests,
      constraints: ctx.constraints,
    },
    5,
  );
  /*
   * Der Wohnort in Koordinaten — für den Fahrzeitfilter.
   *
   * Nur wenn er gebraucht wird: Ohne `pendelzeit` in der Adresse ist
   * das eine Datenbankrunde für nichts.
   */
  /*
   * Der Wohnort in Koordinaten — für den Filter UND für die Angabe
   * an jeder Stelle.
   *
   * Vorher wurde er nur aufgelöst, wenn jemand nach der Fahrzeit
   * filterte. Jetzt trägt jede Zeile, wie weit es ist — dafür muss
   * er immer da sein, sobald ein Wohnort im Profil steht.
   */
  /*
   * ══════════════════════════════════════════════════════════════
   * Der Mittelpunkt des Umkreises
   * ══════════════════════════════════════════════════════════════
   *
   * `umkreisKm` stand bis zum 8. September 2026 in den gespeicherten
   * Filtern, wurde als Plättchen „30 km Umkreis" angezeigt und vom
   * Deuter gesetzt — und dann von keiner einzigen Zeile angewendet.
   * Gefiltert hat in Wahrheit der ORTSTEXT: `location` enthält
   * „Karlsruhe". Ettlingen liegt zwölf Kilometer entfernt und fiel
   * heraus, Köln lag draussen und kam herein, sobald der Text
   * wegfiel.
   *
   * Für eine echte Entfernung braucht es den Mittelpunkt in
   * Koordinaten. Den gibt es — `ortNachschlagen` löst ihn auf, und
   * `wohnpunkt` entsteht nebenan auf demselben Weg.
   *
   * ── Warum nur bei gesetztem Umkreis ─────────────────────────
   *
   * Weil es eine Abfrage kostet, und diese Seite zählt ihre
   * Netzrunden. Ohne Umkreis gibt es nichts zu rechnen — dann bleibt
   * es beim Ortstext, der für „Stellen in Karlsruhe" auch richtig
   * ist.
   */
  const suchpunkt =
    params.ort && params.umkreisKm
      ? await ortNachschlagen(await getDb(), params.ort)
          .then((a) =>
            /*
             * Genau oder auf Stadtebene — wie beim Wohnort. `ambiguous`
             * ausdrücklich nicht: Ein falscher Mittelpunkt verschiebt
             * nicht eine Anzeige, sondern die ganze Suche.
             */
            (a.status === "resolved_exact" || a.status === "resolved_city") &&
            a.latitude !== null &&
            a.longitude !== null
              ? { latitude: a.latitude, longitude: a.longitude }
              : null,
          )
          .catch(() => null)
      : null;

  /*
   * Die Zuordnung Zeile → Zweig, für die Kennzeichen in der Liste.
   *
   * Sie benutzt `zweigTrifft` — dieselbe Prüfung, mit der oben
   * gefiltert wurde. Eine eigene Regel dafür wäre eine zweite
   * Wahrheit: Dann könnte eine Zeile in der Liste stehen und
   * behaupten, aus einem Zweig zu stammen, der sie gar nicht
   * hereingelassen hat.
   */
  const zweigeFuerNamen = zweigeLesen(params.zweige);
  const zweigNamen: Record<string, string> = {};

  const { jobs: filtered, ohneAngabe } = applyFilters(
    jobs,
    params,
    wohnpunkt,
    ctx.constraints.commuteMode ?? null,
    suchpunkt,
  );
  const blockedJobs = includeBlocked
    ? filtered.filter((j) => j.constraints.overall === "blocked")
    : [];
  const eligible = filtered.filter((j) => j.constraints.overall !== "blocked");

  // Drei Gruppen, überschneidungsfrei: was oben steht, steht nicht
  // unten noch einmal.
  const grouped = sort === "best_overall";
  const top = grouped ? eligible.slice(0, 8) : eligible.slice(0, 20);
  const topIds = new Set(top.map((j) => j.jobId));

  const alternatives = grouped
    ? eligible.filter((j) => !topIds.has(j.jobId) && j.fit.band === "exploratory").slice(0, 4)
    : [];
  const altIds = new Set(alternatives.map((j) => j.jobId));

  const weekAgo = Date.now() - 7 * 86_400_000;
  const fresh = grouped
    ? eligible
        .filter(
          (j) =>
            !topIds.has(j.jobId) &&
            !altIds.has(j.jobId) &&
            (j.job.publishedAt?.getTime() ?? 0) >= weekAgo,
        )
        .slice(0, 6)
    : [];

  if (zweigeFuerNamen.length > 0) {
    for (const j of filtered) {
      const treffer = zweigeFuerNamen.find((z) => zweigTrifft(j, z));
      if (!treffer) continue;
      zweigNamen[j.jobId] =
        treffer.gehaltAb === undefined
          ? treffer.q
          : `${treffer.q} ab ${treffer.gehaltAb.toLocaleString("de-DE")} €`;
    }
  }

  const realCount = filtered.length;

  /*
   * Serverseitige Seitenteilung.
   *
   * Vorher ging `filtered` vollständig in die Liste — bei 994 Stellen
   * waren das 9.291 DOM-Elemente und sechs Sekunden bis zum ersten
   * Bild. Die Seite „laggte" nicht wegen einer Animation, sondern weil
   * der Browser tausend Zeilen bauen musste, von denen man zwölf sieht.
   *
   * 25 je Seite. Wer mehr will, klickt weiter — und bekommt dann auch
   * nur 25 mehr. Eine unendliche Liste ist bequemer zu bauen und
   * teurer zu benutzen.
   */
  const SCHRITT = 25;
  /*
   * Wie viele gerade sichtbar sind — aus der Adresse, geklammert.
   *
   * Ohne obere Klammer könnte `?anzahl=999999` die ganze Liste
   * erzwingen; ohne untere käme bei `?anzahl=0` eine leere Seite
   * heraus, die wie ein Fehler aussieht.
   */
  const anzahl = Number.isFinite(gewuenschteAnzahl)
    ? Math.min(Math.max(gewuenschteAnzahl, SCHRITT), Math.max(filtered.length, SCHRITT))
    : SCHRITT;
  const sichtbar = filtered.slice(0, anzahl);
  const nochOffen = Math.max(0, filtered.length - sichtbar.length);

  // Die Auswahl steht im Suchparameter, damit sie verlinkbar ist und der
  // Zurück-Knopf das Erwartete tut.
  const requested = params.job;
  /*
   * Die Auswahl darf auch außerhalb der aktuellen Seite liegen: ein
   * verlinkter Job muss sich öffnen lassen, egal auf welcher Seite er
   * steht. Deshalb wird in `filtered` gesucht, nicht in `sichtbar`.
   */
  const angefordert = requested
    ? /*
       * Auch im Klärungsabschnitt suchen.
       *
       * Seit offene Bedingungen eine eigene Gruppe haben, steht ein
       * Teil der Stellen nicht mehr in `filtered`. Ein Klick dort
       * führte auf `/app/jobs?job=<id>` — und die geteilte Ansicht fand
       * die Stelle nicht, zeigte stattdessen die erste der Hauptliste
       * und daneben den Hinweis, die angeforderte Stelle sei
       * ausgeschlossen. Sie ist nicht ausgeschlossen; sie steht nur in
       * der anderen Gruppe.
       *
       * Eine Stelle ist eine Stelle. In welcher Gruppe sie steht, ist
       * eine Frage der Darstellung und darf nicht darüber entscheiden,
       * ob sie sich öffnen lässt.
       */
      (filtered.find((j) => j.jobId === requested) ??
      klaerung.find((j) => j.jobId === requested))
    : undefined;
  const selected: ScoredJob | null = angefordert ?? sichtbar[0] ?? null;

  /*
   * Der Fall, in dem die Adresse etwas anderes sagt als die Anzeige.
   *
   * Wer einen Link zu einer Stelle öffnet, die der aktuelle Filter
   * ausschliesst — etwa weil ein Ausschlusskriterium greift —, bekam
   * bisher stillschweigend die erste Stelle der Liste zu sehen. Titel,
   * Gehalt, Analyse: alles gehörte zu einer anderen Anzeige, und in
   * der Adresszeile stand weiterhin die angeforderte Kennung.
   *
   * Das ist die unangenehmste Sorte Fehler: nichts sieht kaputt aus,
   * und die Person trifft eine Entscheidung über die falsche Stelle.
   * Jetzt steht ein Satz darüber.
   */
  const auswahlVerfehlt = Boolean(requested) && !angefordert;

  /*
   * Eine Grössenordnung auch für die Stellen ohne Zahl.
   *
   * ── Warum die Liste sie braucht ───────────────────────────
   *
   * Nur 190 von 2.506 Anzeigen nennen ein Gehalt. In der Liste stand
   * bei allen übrigen „Gehalt nicht angegeben" — bei 92 % der Zeilen
   * also nichts, wonach man vergleichen könnte. Wer eine Liste
   * überfliegt, überfliegt sie nach Zahlen.
   *
   * Eine Sammelabfrage für die sichtbaren Zeilen, kein Aufruf je
   * Zeile. Was keine tragfähige Referenz hat, behält den ehrlichen
   * Satz — geschätzt wird nichts.
   */
  const ohneGehalt = [...sichtbar, ...klaerung.slice(0, 10)].filter(
    (j) => j.job.salary.min === null && j.job.salary.max === null,
  );

  /*
   * Zwei Wege zur Referenz, in dieser Reihenfolge.
   *
   * Über die amtliche Kennung ist es ein Nachschlag in 752 Zeilen —
   * exakt, ohne Schwellenwert. Über den Titel ist es eine
   * Normalisierung mit allen Unsicherheiten deutscher Berufsnamen.
   * Wo beides möglich ist, gewinnt die Kennung.
   *
   * Beide laufen als eine Sammelabfrage, nicht je Zeile.
   */
  const [nachKldb, nachTitel] = await Promise.all([
    referenzenFuerKldb(ohneGehalt.map((j) => j.job.kldb)).catch(() => new Map()),
    referenzenFuerTitel(ohneGehalt.map((j) => j.job.title)).catch(() => new Map()),
  ]);

  /**
   * Die Referenz zu einer Stelle — Kennung vor Titel.
   *
   * Eine Stelle, zwei mögliche Quellen: Die amtliche Kennung ist ein
   * exakter Nachschlag, der normalisierte Titel eine Näherung. An drei
   * Stellen in dieser Datei wird sie gebraucht; ohne diese Funktion
   * stünde die Reihenfolge dreimal da und könnte dreimal auseinanderlaufen.
   */
  /* Aus dem Bestand gezählt, halbstündig zwischengespeichert. */

  const referenz = (j: ScoredJob) => referenzFinden(j, nachKldb, nachTitel);

  /** Was in einer Zeile als Gehalt steht — echte Angabe oder Referenz. */
  /*
   * ══════════════════════════════════════════════════════════════
   * In welcher Währung die Liste rechnet
   * ══════════════════════════════════════════════════════════════
   *
   * Nach dem Land, in dem die Person sucht — nicht nach dem Land der
   * Stelle. Eine Stelle in Zürich schreibt Franken aus; wer in
   * Deutschland sucht, kann 95.000 CHF nicht neben 70.000 € einordnen,
   * ohne im Kopf zu rechnen.
   *
   * Umgerechnet wird ein AUSGESCHRIEBENER Betrag. Das ist etwas
   * anderes als das, wogegen `lib/landeslage.ts` argumentiert: Dort
   * geht es darum, ein deutsches Beispielgehalt per Kurs zu einem
   * schweizerischen zu machen — eine Behauptung über ein Lohnniveau,
   * die niemand geprüft hat. Hier steht eine Zahl, die ein
   * Arbeitgeber genannt hat, nur in einer anderen Einheit.
   *
   * `landWahl === null` heisst „überall suchen". Dann bleibt Euro,
   * weil es keine Landeswährung gibt, nach der man sich richten
   * könnte — und weil die Person, die überall sucht, von irgendwo
   * kommt und die vorige Wahl behält.
   */
  const kurse = await kursstand();
  const zielWaehrung = LAND_ZU_WAEHRUNG[(landWahl ?? "DE").toUpperCase()] ?? "EUR";
  const waehrung =
    Object.keys(kurse.kurse).length > 0
      ? { ziel: zielWaehrung, kurse: kurse.kurse, stand: kurse.stand }
      : undefined;

  const gehaltszeile = (j: ScoredJob) => gehaltszeileFuer(j, referenz, waehrung);

  /*
   * Steht überhaupt eine fremde Währung in der Liste?
   *
   * Ohne diese Frage stünde der Kurshinweis auf jeder Seite — auch
   * bei einer reinen Deutschlandsuche, wo nichts umgerechnet wurde.
   * Ein Hinweis, der immer da ist, wird nicht gelesen; einer, der nur
   * bei Bedarf erscheint, erklärt genau dann etwas.
   *
   * Gefragt wird über die sichtbaren Stellen, nicht über den
   * Bestand: Was nicht in der Liste steht, braucht keine Fussnote.
   */
  const fremdwaehrungInListe =
    waehrung !== undefined &&
    sichtbar.some(
      (j) =>
        (j.job.salary.min !== null || j.job.salary.max !== null) &&
        (j.job.salary.currency ?? "").toUpperCase() !== waehrung.ziel.toUpperCase(),
    );

  const fortbewegung = ctx.constraints.commuteMode ?? null;

  /*
   * Die Zeilen baut `lib/jobs/zeilen.ts`.
   *
   * Sie standen hier: rund hundertzwanzig Zeilen mit jeder Entscheidung
   * darüber, was eine Stellenzeile zeigt. Sobald eine zweite Stelle
   * dieselben Zeilen zeigt, gibt es nur zwei Möglichkeiten — dieselbe
   * Funktion, oder zwei Fassungen, die beim nächsten Feld
   * auseinanderlaufen.
   *
   * Das Laden bleibt hier: Wohnort, Referenzgehälter und abgelegte
   * Stellen holt die Seite, die Funktion rechnet nur.
   */

  const rows: JobRowData[] = zeilenAusStellen(sichtbar, {
    wohnpunkt,
    fortbewegung,
    savedIds,
    nachKldb,
    nachTitel,
    vertragsarten: CONTRACT,
    waehrung,
  });

  /*
   * Mondays Lesart der ausgewählten Stelle.
   *
   * Einmal gerechnet, von Mitte und Panel gemeinsam benutzt. `null`,
   * solange keine Stelle gewählt ist — dann gibt es nichts zu deuten.
   */

  /*
   * Die Zukunftseinschätzung der Berufsgruppe.
   *
   * Eine Abfrage je Seitenaufbau, nur für die ausgewählte Stelle.
   * Sie ist das, was Monday sagen kann, wenn sie über die Person zu
   * wenig weiss — dann steht dort etwas über den Beruf statt dreimal
   * „kenne dich noch nicht".
   */
  const zukunftAngabe = selected
    ? await zukunftLaden(selected.job.kldb ?? null).catch(() => null)
    : null;

  const ninaLesart = selected
    ? workspaceDaten(selected, {
        assistentin: brand.assistantName,
        gemerkt: savedIds.has(selected.jobId),
        wunschgehalt: ctx.constraints.minSalaryPerYear,
        marktspanne: (() => {
          const r = referenz(selected);
          if (!r) return null;
          const f = (n: number) => n.toLocaleString("de-DE");
          return `${f(r.q1)} – ${f(r.q3)} €`;
        })(),
        /* Vergleichen lässt sich erst ab zwei Stellen. Den Knopf
           vorher anzubieten hiesse, in eine Ansicht zu führen, die
           nichts gegenüberstellen kann. */
        hatVergleichsstelle: filtered.length > 1,
        /* Ohne Wohnort gibt es keinen Arbeitsweg zu rechnen, nur eine
           Aufforderung, ihn einzutragen. */
        hatWohnort: Boolean(ctx.constraints.baseLocation),
      })
    : null;


  return (
    /*
     * `grid-cols-[minmax(0,1fr)]` statt der Vorgabe.
     *
     * Eine Rasterspalte ist standardmässig `auto` und wächst auf die
     * grösste Mindestbreite ihrer Kinder — hier auf 351 Pixel in einem
     * 328 Pixel breiten Behälter. Alle neun Abschnitte wurden dadurch
     * mitgezogen, und die Seite lief auf einem 360-Pixel-Gerät sieben
     * Pixel über.
     *
     * `minmax(0, 1fr)` erlaubt der Spur, kleiner zu werden als ihr
     * Inhalt. Das ist dieselbe Lehre, die weiter unten schon für die
     * Jobliste steht — sie gilt für jedes Raster, nicht nur für das
     * mit den langen Titeln.
     */
/* `gap-4`: Zwanzig Pixel zwischen Titel, Eingabe, Zahlenzeile und
       Liste waren viermal Luft, bevor die erste Stelle kam. Sechzehn
       genügen, und die gesparten Pixel sind zusammen eine halbe
       Stellenzeile. */
    /* `bloecke-auftritt`: Was hier nachkommt, erscheint einzeln
       nacheinander statt auf einen Schlag — siehe globals.css. */
    <div className="bloecke-auftritt grid grid-cols-[minmax(0,1fr)] gap-4">

      {/*
        Filter erst aus dem Gespräch.
        
        `FilterChips` gibt `null` zurück, solange keine Bedingung
        gesetzt ist — auf einer frischen Suchseite steht hier also
        nichts. Erst wenn jemand Monday etwas gesagt hat („Vertrieb in
        Karlsruhe, höchstens 30 Kilometer"), erscheinen genau die
        Bedingungen, die daraus wurden, und lassen sich einzeln
        zurücknehmen.
        
        Das ist der Unterschied zum gelöschten Filterblock darunter:
        Der stand immer da, für jede Suche gleich, und bot Felder für
        Dinge an, nach denen niemand gefragt hatte. Diese hier sind
        eine Antwort auf das, was gerade gesucht wird.
      */}
      <FilterChips
        ohneAngabe={ohneAngabe}
        /*
         * Ein abgeleitetes Land steht sichtbar da — mit seiner Quelle.
         *
         * „Österreich" allein wäre eine Behauptung. „Österreich, aus
         * deiner Spracheinstellung" ist eine Auskunft, der man
         * widersprechen kann.
         */
        abgeleitetesLand={
          herkunft.code && landWahl === herkunft.code
            ? { code: herkunft.code, quelle: herkunft.quelle }
            : null
        }
      />

      {/*
        Hier standen die Suchrichtungen — Plättchen mit Berufsbildern
        aus dem Profil, direkt unter dem Eingabefeld.

        Sie sahen aus wie Filter, waren aber keine: Sie kamen aus dem
        Profil und nicht aus dem, was gerade gesucht wird. Unter einem
        Feld, in das man Monday etwas schreibt, liest sich das als
        Vorauswahl, die man erst wegklicken muss.

        Was unter der Eingabe bleibt, entsteht ausschliesslich aus dem
        Gespräch: `FilterChips` zeigt die Bedingungen, die aus dem
        Gesagten wurden, und ist leer, solange nichts gesagt wurde.

        Die Richtungen selbst gibt es weiter — `Suchrichtungen` liegt
        unverändert daneben und wird aus dem Profil gespeist. Wenn sie
        wieder auftauchen sollen, dann an einer Stelle, an der sie ein
        Angebot sind und keine Vorbelegung.
      */}

      {/*
        Hier stand `JobFilters` — ein Block mit Feldern für Ort,
        Umkreis, Vertragsart, Gehalt und Arbeitsmodell.

        Er ist weg, und nicht, weil Filtern schlecht wäre. Sondern
        weil er zweimal dasselbe anbot: Wer „Vertrieb in Karlsruhe,
        höchstens 30 Kilometer" in die Zeile darüber schreibt, hat
        gefiltert — und sah danach dieselben Bedingungen noch einmal
        als leere Felder darunter.

        Was bleibt, ist die Reihenfolge, in der es entsteht: erst die
        Eingabe, dann die Bedingungen, die daraus wurden, als Chips
        (`FilterChips`), dann die Richtungen, die Monday daraus ableitet
        (`Suchrichtungen`). Jeder Filter, der erscheint, hat einen
        Anlass in dem, was gerade gesucht wird — statt in einer Liste,
        die für jede Suche gleich aussieht.

        Die Felder selbst gibt es weiterhin: `JobFilters` liegt
        unverändert daneben, und die Adressparameter, die es gesetzt
        hat, werden weiter gelesen. Was fehlt, ist der Block, der sie
        ungefragt auf jeden Bildschirm stellte.
      */}

      {/*
        Was wirklich durchsucht wurde — mit gezählten Zahlen.
        „23 Stellen" sagt nichts darüber, ob 23 von 30 oder 23 von
        30.000 übrig blieben. Und bei einer aktiven Quelle steht „1
        Quelle" da, nicht „das ganze Internet".
      */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {/*
                 * Die Zahl, die zählt, zuerst — der Rest kleiner daneben.
                 *
                 * Hier stand „7 Quellen durchsucht · 1.489 Stellen
                 * geprüft · 719 erfüllen deine Bedingungen". Drei Zahlen
                 * in einer Zeile, und die relevante stand hinten. Wer
                 * die Liste öffnet, will wissen, wie viele für IHN
                 * übrig bleiben.
                 */}
                {/*
                  * Die Zahl sagt, worauf sie sich bezieht.
                  *
                  * ── Warum das nötig war ───────────────────────
                  *
                  * Hier stand „1.961 passende Stellen". Das las sich
                  * wie eine Zahl über den ganzen Bestand — tatsächlich
                  * ist es die Zahl aus den geprüften Kandidaten, und
                  * die sind auf 2.000 begrenzt.
                  *
                  * Eine echte Zählung wäre ehrlicher und ist nicht zu
                  * bezahlen: gemessen 12 bis 44 Sekunden für
                  * `count(*) where country = 'DE'` über 1,02 Millionen
                  * deutsche Anzeigen — auch mit eigenem Index, denn
                  * eine Million Einträge muss gelesen werden, egal wie
                  * sortiert.
                  *
                  * Also nennt die Zeile die Grundlage mit. Eine
                  * ungenaue Zahl, die sagt, woher sie kommt, ist
                  * besser als eine genaue Zahl über etwas anderes.
                  */}
                {/*
                  * ══════════════════════════════════════════════════
                  * Die Zahl darf nicht nach Bestand klingen
                  * ══════════════════════════════════════════════════
                  *
                  * Hier stand „1.995 passende Stellen", darunter klein
                  * „von 2.000 geprüften". Gelesen wurde nur die grosse
                  * Zahl — und die las sich wie eine Aussage über den
                  * ganzen Bestand. Bei 2,6 Millionen Anzeigen ist
                  * „1.995 passende Stellen" dann eine sehr schlechte
                  * Nachricht über einen Arbeitsmarkt, der sie nicht
                  * verdient hat.
                  *
                  * Jetzt trägt die grosse Zahl ihren Bezug selbst:
                  * „1.995 der 2.000 neuesten passen". Das ist genau
                  * das, was gerechnet wurde.
                  *
                  * ── Warum nicht die echte Zahl ────────────────────
                  *
                  * Sie ist nicht zu bezahlen. Gemessen am
                  * 6. September 2026, nach allen Indexarbeiten:
                  *
                  *   count(*) über die deutschen Anzeigen   > 60 s
                  *   gedeckelt bei 10.000                    16 s
                  *   gedeckelt bei 1.000                    2,2 s
                  *
                  * Eine Million Zeilen müssen gelesen werden, egal wie
                  * sortiert. „Über 1.000" wäre bezahlbar und sagt
                  * weniger als der Satz, der jetzt dasteht.
                  */}
                <span className="grid gap-0.5">
                  <span className="text-[15px] font-medium text-ink">
                    {filtered.length.toLocaleString("de-DE")} der{" "}
                    {(jobs.length + blockedCount).toLocaleString("de-DE")} neuesten passen
                  </span>
                  <span className="text-2xs text-ink-3">
                    Monday prüft die neuesten Anzeigen, nicht den ganzen Bestand ·{" "}
                    {abdeckungssatz(abdeckung, realCount, jobs.length + blockedCount)}
                  </span>
                  {/*
                    ══════════════════════════════════════════════
                    Woher der Kurs kommt und wann der nächste kommt
                    ══════════════════════════════════════════════

                    Sie steht nur da, wenn wirklich umgerechnet wird —
                    also wenn Stellen in einer anderen Währung
                    ausgeschrieben sind als der, in der die Liste
                    rechnet. Wer nur in Deutschland sucht, liest sie
                    nie.

                    Zwei Daten, weil sie Verschiedenes sagen: Der
                    Stand ist der Tag, für den die EZB rechnet — an
                    Werktagen gegen 16 Uhr, am Sonntag also zwei Tage
                    alt. Die nächste Aktualisierung ist unsere, alle
                    zwölf Stunden.

                    Klein und in der Fussnotenzeile, weil es eine
                    Fussnote ist. Wer ein Gehalt liest, will die Zahl;
                    wer ihr nicht traut, will wissen, worauf sie
                    beruht — und findet es an derselben Stelle.
                  */}
                  {waehrung && fremdwaehrungInListe && (
                    <span className="text-2xs text-ink-3">
                      Fremde Währungen in {waehrung.ziel} umgerechnet
                      {kurse.stand ? ` · EZB-Kurs vom ${new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" }).format(new Date(kurse.stand))}` : ""}
                      {kurse.naechsteAktualisierung
                        ? ` · nächste Aktualisierung ${new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(kurse.naechsteAktualisierung)} Uhr`
                        : ""}
                    </span>
                  )}
                </span>
        {/* Der Zeitstempel steht ganz rechts. Er ist eine Fussnote zur
            Zahl links, keine Angabe, die man sucht — dazwischen wäre
            er ein Hindernis auf dem Weg zur Liste. */}
        {abdeckung.zuletzt && (
          <span className="ml-auto text-ink-3">
            zuletzt aktualisiert{" "}
            {new Intl.DateTimeFormat("de-DE", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }).format(abdeckung.zuletzt)}
          </span>
        )}
        {/* „Quellen ansehen" stand hier und ist weg. Der Weg zu den
            Quellen bleibt: `/app/settings/integrations` ist über die
            Einstellungen erreichbar. Über einer Stellenliste ist er
            eine Frage, die sich beim Suchen nicht stellt. */}
      </div>

      {/*
        Der Provider umschliesst die ganze Spaltenaufteilung.

        Nicht nur Mondays Panel: `open_job` und `filter_jobs` wirken auf
        die Liste links und die Anzeige in der Mitte. Läge der Kontext
        nur um die rechte Spalte, könnte Monday genau das nicht — und
        Abschnitt 6 des Auftrags verlangt es ausdrücklich.

        Eine Client-Komponente um serverseitig gerenderte Kinder ist
        unbedenklich: Die Kinder sind fertige Knoten und werden
        durchgereicht, nicht erneut ausgeführt.
      */}
      {/*
        Mondays Lesart wird EINMAL gerechnet und zweimal gezeigt.
        
        Die Mitte zeigt die Zusammenfassung, das Panel rechts die
        Aufschlüsselung — aber es sind dieselben Zahlen aus derselben
        Berechnung. Sie an zwei Stellen zu rechnen hiesse, zwei Stände
        zu haben, die auseinanderlaufen können: Die Mitte sagte dann
        86 %, das Panel 84, und beide hätten recht.
      */}
      <NinaSteuerungProvider jobId={selected?.jobId ?? null}>
      <JobSplitView
        rows={rows}
        /*
         * Welche Zeile aus welchem Zweig kommt.
         *
         * Gerechnet wird hier und nicht in der Zeile: Nur hier stehen
         * die Zweige und dieselbe Prüfung, die auch gefiltert hat
         * (`zweigTrifft`). Eine zweite Regel im Bauteil wäre eine
         * zweite Wahrheit — und die erste, die auseinanderläuft.
         *
         * Der ERSTE passende Zweig gewinnt. Eine Stelle kann zu
         * beiden passen („Elektriker" in einem Landratsamt); zwei
         * Kennzeichen an einer Zeile erklären dann weniger als eines.
         */
        zweigNamen={zweigNamen}
        selectedId={selected?.jobId ?? null}
        explicitSelection={Boolean(requested)}
        /*
         * Mondays Spalte, serverseitig gefüllt.
         *
         * Die Zahlen darin — Passung, Faktoren, Gehaltsvergleich —
         * sind dieselben, die die Mitte zeigt. Sie stammen aus
         * derselben Berechnung, statt über eine zweite Schnittstelle
         * noch einmal geholt zu werden: Ein zweiter Weg zur selben
         * Zahl ist ein zweiter Stand, der auseinanderlaufen kann.
         */
        /*
         * Das Monday-Panel wird hier nicht mehr gerendert.
         *
         * Es lief nach der Rücknahme des Drei-Spalten-Rasters über die
         * volle Breite unter beiden Spalten und war dort ein grosser
         * heller Block, der die Seite unten abschloss, ohne dass ihn
         * jemand gesucht hätte.
         *
         * Die Bausteine bleiben: `NinaPanel`, `NinaPanelRahmen`, die
         * Ansichten und die Steuerung stehen bereit, sobald es eine
         * Spalte gibt, in die sie gehören. Mondays Lesart wird weiterhin
         * gerechnet — die Mitte zeigt sie als Analyse unter dem Kopf.
         */
        blaetterung={
          nochOffen > 0 ? (
            <JobPagination
              weitereAnzahl={Math.min(SCHRITT, nochOffen)}
              weiterHref={`/app/jobs?${mehrParams(params, anzahl + SCHRITT)}`}
            />
          ) : null
        }
        emptyState={
          /*
           * Die leere Liste erklärt sich (§16.4).
           *
           * Zwei Dinge stehen hier bewusst NICHT: keine ähnlichen
           * Stellen „die auch interessant sein könnten", und keine
           * automatisch gelockerte Bedingung. Eine Suche, die von
           * selbst weiter wird, wenn sie nichts findet, ist keine
           * Suche mehr — sie liefert dann Ergebnisse, die niemand
           * verlangt hat, und der Mensch hält sie für Treffer.
           *
           * Stattdessen: welche Bedingungen gerade gelten, und je ein
           * Angebot, genau eine davon fallen zu lassen. Erweitert wird
           * erst nach einem Klick.
           */
          <EmptyState
            icon={<Compass className="size-5" strokeWidth={1.7} />}
            title={
              klaerung.length > 0
                ? "Keine Stelle, bei der deine Bedingungen belegt erfüllt sind"
                : "Mit diesen Bedingungen finde ich aktuell keine bestätigte Stelle"
            }
            body={
              /*
               * Der Unterschied zwischen „es gibt nichts" und „nichts
               * ist belegt".
               *
               * Wer eine Gehaltsuntergrenze setzt, bekommt hier
               * schnell eine leere Hauptliste — nicht weil es keine
               * passenden Stellen gäbe, sondern weil deutsche
               * Anzeigen selten ein Gehalt nennen. Diese beiden Fälle
               * sehen gleich aus und sind völlig verschieden, und wer
               * sie verwechselt, hält die Suche für kaputt.
               *
               * Also: die Zahl der offenen Stellen nennen und sagen,
               * woran es liegt.
               */
              klaerung.length > 0
                ? `${klaerung.length} ${klaerung.length === 1 ? "Stelle sagt" : "Stellen sagen"} zu mindestens einer deiner Bedingungen nichts — sie ${klaerung.length === 1 ? "steht" : "stehen"} weiter unten. Es wird nichts ausgedacht, um die Liste zu füllen.`
                : aktiveBedingungen(params).length > 0
                  ? `Es gilt gerade: ${aktiveBedingungen(params)
                      .map((b) => b.label)
                      .join(", ")}. Soll ich eine davon einmalig weglassen? Es wird nichts ausgedacht, um die Liste zu füllen.`
                  : "Es wird nichts ausgedacht, um die Liste zu füllen."
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {aktiveBedingungen(params).map((b) => (
                  <Button key={b.key} asChild variant="secondary">
                    <Link href={`/app/jobs?${b.adresse ?? ohneBedingung(params, b.key)}`}>
                      Ohne „{b.label}“
                    </Link>
                  </Button>
                ))}
                <Button asChild variant="secondary">
                  <Link href="/app/jobs">Alle Filter zurücksetzen</Link>
                </Button>
                {klaerung.length > 0 && (
                  <Button asChild variant="secondary">
                    <Link href="/app/settings/matching">Offene Angaben mitzeigen</Link>
                  </Button>
                )}
              </div>
            }
          />
        }
        detail={
          selected ? (
            <>
              {auswahlVerfehlt && (
                <div
                  role="status"
                  className="mx-5 mt-5 rounded-(--radius-md) bg-caution-soft px-4 py-3 text-sm leading-relaxed text-ink-2 lg:mx-7"
                >
                  Die verlinkte Stelle passt nicht zu deinen aktuellen Filtern — hier steht
                  stattdessen die erste aus der Liste.{" "}
                  <Link href="/app/jobs?blocked=1" className="text-accent-text underline underline-offset-[3px]">
                    Auch ausgeschlossene Stellen zeigen
                  </Link>
                </div>
              )}
            {/*
              Wieder die vollständigen Informationen.
              
              Zwischenzeitlich stand hier nur `JobWorkspace`: Fakten
              oben, alles Weitere auf Nachfrage. Der Gedanke war, die
              Seite ruhig zu halten — das Ergebnis war eine Seite, auf
              der man nach dem suchen musste, was vorher dastand.
              
              Jetzt beides: `JobDetailPanel` mit allem, was über die
              Stelle bekannt ist, und darin `NinaAnalyse` als
              Zusammenfassung oben. Mondays Ansichten bleiben über die
              Blase unten rechts erreichbar.
            */}
            <JobDetailPanel
              /* Dieselbe Lesart wie in Mondays Ansichten — eine
                 Rechnung, zwei Anzeigen. */
              ninaDaten={ninaLesart}
              wunschgehalt={ctx.constraints.minSalaryPerYear}
              maxPendelzeit={ctx.constraints.maxCommuteMinutes}
              zukunft={zukunftAngabe}
              scored={selected}
              wohnort={wohnort}
              /* Dieselben Zahlen wie an der Zeile links — eine
                 Rechnung, zwei Anzeigen. */
              fahrzeitMin={
                selected.job.workModel === "remote"
                  ? null
                  : fahrzeitMinuten(wohnpunkt, selected.job, fortbewegung)
              }
              entfernungKm={
                wohnpunkt && selected.job.latitude !== null && selected.job.longitude !== null
                  ? Math.round(
                      entfernungKm(
                        wohnpunkt.latitude,
                        wohnpunkt.longitude,
                        selected.job.latitude,
                        selected.job.longitude,
                      ),
                    )
                  : null
              }
              gehaltsangaben={gehaltsangaben}
              lebenshaltung={lebenshaltung}
              t={t}
              saved={savedIds.has(selected.jobId)}
              assistantName={brand.assistantName}
              labels={{ save: t("jobs.save"), saved: t("jobs.saved") }}
            />
            </>
          ) : null
        }
      />
      </NinaSteuerungProvider>


      {/*
       * Blättern statt endlos scrollen.
       *
       * Serverseitige Links, keine Client-Zustandsmaschine: jede Seite
       * hat eine eigene Adresse, der Zurück-Knopf tut das Erwartete,
       * und ein geteilter Link führt dorthin, wo der Absender war.
       */}
      {/* Die Blätterung steht jetzt IN der Liste — siehe die
          Eigenschaft `blaetterung` am `JobSplitView` weiter oben. Hier
          stand sie unter der ganzen Aufteilung und hätte nach der
          Begrenzung der Listenhöhe nie wieder ausgelöst. */}

      {/* ── Offene Bedingungen, eigener Abschnitt ─────────────── */}
      {klaerung.length > 0 && (
        /*
         * Warum diese Stellen nicht oben stehen.
         *
         * Bei ihnen ist eine harte Bedingung offen — die Anzeige sagt
         * nichts dazu. Sie verletzen nichts, aber sie sind auch nicht
         * geprüft, und zwischen den geprüften sähen sie geprüft aus.
         * Genau dieser Eindruck war der teuerste Fehler der bisherigen
         * Liste: Passungswert, Empfehlung, alles wie gewohnt — und die
         * eigene Gehaltsuntergrenze bei dieser Stelle schlicht ungeklärt.
         *
         * Also: sichtbar, aber getrennt, und mit dem offenen Punkt
         * dabei. Wer es anders will, stellt es in den Einstellungen um.
         */
        <section aria-labelledby="klaerung" className="grid gap-4 border-t border-line pt-8">
          <div>
            <h2 id="klaerung" className="text-xl font-semibold">
              {plural(klaerung.length, "Stelle", "Stellen")}, bei {klaerung.length === 1 ? "der" : "denen"} etwas offen ist
            </h2>
            <p className="mt-1.5 max-w-prose leading-relaxed text-ink-2">
              Diese Anzeigen widersprechen keiner deiner Bedingungen — sie sagen nichts dazu. Sie
              stehen deshalb hier und nicht oben zwischen den geprüften.
            </p>
          </div>
          <ul className="grid gap-3">
            {klaerung.slice(0, 10).map((j) => {
              const offenePunkte = j.constraints.checks.filter((c) => c.verdict === "uncertain");
              return (
                <li key={j.jobId}>
                  <Link
                    href={`/app/jobs/${j.jobId}`}
                    /* Dieselbe Kennung wie in der Hauptliste: eine Stelle
                       ist eine Stelle, gleich in welcher Gruppe sie steht. */
                    data-job-id={j.jobId}
                    className="block rounded-(--radius-surface) bg-raised px-5 py-4 transition-colors hover:bg-soft"
                  >
                    <p className="font-medium">{j.job.title}</p>
                    <p className="mt-0.5 text-sm text-ink-2">
                      {j.job.companyName} · {j.job.location}
                    </p>
                    {/*
                     * Auch hier eine Grössenordnung.
                     *
                     * Diese Karte zeigte gar kein Gehalt — auch nicht,
                     * wo die Anzeige eines nennt. „Bei jeder
                     * angezeigten Stelle" heisst auch bei denen, bei
                     * denen etwas offen ist; sonst hinge die Auskunft
                     * daran, in welche Gruppe eine Stelle gerutscht
                     * ist.
                     */}
                    {(() => {
                      const g = gehaltszeile(j);
                      if (!g) return null;
                      return (
                        <p className="mt-1 text-sm text-ink-2">
                          {g.text}
                          {g.geschaetzt && (
                            <span className="ml-1.5 rounded-(--radius-pill) bg-inset px-1.5 py-px text-[11px] text-ink-3">
                              Marktspanne
                            </span>
                          )}
                        </p>
                      );
                    })()}
                    <p className="mt-2 text-sm leading-relaxed text-ink-3">
                      Offen:{" "}
                      {offenePunkte.map((c) => c.label).join(", ") || "eine deiner Bedingungen"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
          {klaerung.length > 10 && (
            <p className="text-sm text-ink-3">
              und {klaerung.length - 10} weitere.
            </p>
          )}
          <p className="text-sm text-ink-3">
            <Link
              href="/app/settings/matching"
              className="inline-flex min-h-6 items-center text-accent-text underline underline-offset-[3px]"
            >
              Ändern, wie mit offenen Angaben umgegangen wird
            </Link>
          </p>
        </section>
      )}

      {/*
       * Die Datenqualität steht nicht mehr dauerhaft unter der Liste.
       *
       * Hier standen zwei Absätze: „19 Anzeigen sind abgelaufen oder
       * nicht mehr erreichbar …" und „770 Stellen verletzen eine deiner
       * harten Bedingungen …". Beides ist wahr und beides war als
       * Ehrlichkeit gemeint.
       *
       * Auf dem Bildschirm wirkte es anders. Wer eine Jobliste öffnet,
       * will Stellen sehen; darunter zwei Absätze über Anzeigen, die er
       * NICHT sieht, lesen sich als Betriebsprotokoll. Und die Zahl 770
       * ohne Kontext klingt nach einem Fehler, nicht nach einer
       * Filterleistung.
       *
       * Die Zahlen bleiben — sie werden weiterhin berechnet und stehen
       * im Trichter unter „Chancenraum", wo jede Stufe einzeln
       * heruntergezählt wird. Dort beantworten sie eine Frage, die
       * jemand gestellt hat. Hier beantworteten sie eine, die niemand
       * gestellt hatte.
       */}

      {/*
        * Die Bereiche unter der Trefferliste.
        *
        * Sie stehen NACH den Ergebnissen, nicht davor: Wer die
        * Stellenseite öffnet, sucht Stellen. Ein Marketingbereich über
        * der Liste kostet ihn jedes Mal einen Bildlauf.
        */}
      {/*
        ── Der Balken zwischen Jobs und Erklärung ────────────────
        
        Hier standen `mt-32` und `pt-16` mit einer Trennlinie
        dazwischen: 192 Pixel Abstand, dazu `gap-20` zwischen den
        Abschnitten darunter. Auf einem hellen Grund liest sich das als
        Luft. Im Dunkelmodus ist leerer Raum aber die dunkelblaue
        Seitenfläche — und 192 Pixel davon am Stück sind kein Abstand
        mehr, sondern ein Balken quer über den Bildschirm.
        
        Genau dort, wo jemand nach der letzten Stelle weiterliest,
        stand damit ein Block, der nichts sagt und ein Sechstel des
        Bildschirms kostet.
        
        Der Weg dorthin, weil die Zahl mehrfach falsch war: 128 Pixel
        über der Linie, dann 48, dann 96 — jedes Mal zu viel.
        
        Der Grund ist der Dunkelmodus. Leerer Raum ist dort keine
        Luft, sondern eine dunkelblaue Fläche, und ab etwa fünfzig
        Pixel liest sie sich nicht mehr als Abstand, sondern als
        Balken quer über den Bildschirm — genau an der Stelle, wo
        jemand nach der letzten Stelle weiterlesen will.
        
        Jetzt 40 Pixel über der Linie und 40 darunter. Die Linie
        trägt die Trennung; sie braucht keinen langen Vorlauf. Was
        Abstand schafft, ist der Strich selbst — die Fläche davor darf
        ihn ankündigen, aber nicht ersetzen.
      */}
      <div className="mt-10 grid gap-12 border-t border-line pt-10">
        {/*
          Hier stand „Alles für deinen nächsten Karriereschritt" —
          eine Kachelreihe mit Verweisen auf Gehalt, Lebenslauf,
          Vorbereitung und Weiteres.

          Sie stand unter der Stellenliste und bot alles an ausser der
          nächsten Stelle. Wer bis dorthin gescrollt hat, sucht weiter
          — und bekam ein Inhaltsverzeichnis des Produkts. Die Wege
          selbst gibt es unverändert in der Navigation.
        */}
        {/*
          Hier stand „Berufsfelder mit den meisten offenen Stellen".

          Eine Rangliste der grössten Felder beantwortet die Frage, wo
          es viel gibt — nicht die, wo es etwas für DIESE Person gibt.
          Das ist der Unterschied, um den es diesem Produkt geht, und
          ein Abschnitt, der ihn übergeht, arbeitet gegen den Rest der
          Seite.
        */}
        {/*
          * Der Suchauftrag steht wieder oben in diesem Block.
          *
          * Er stand hier, wanderte dann unter den Erklärungsabschnitt
          * — mit dem Gedanken, erst zu erklären, dann zu handeln —
          * und steht jetzt wieder hier.
          *
          * Der Grund für die Rückkehr: Wer bis unter die letzte Stelle
          * gescrollt hat, hat die Treffer gesehen. War nichts
          * Passendes dabei, ist „Monday sucht weiter" die nächste
          * sinnvolle Handlung — und die gehört vor einen Abschnitt,
          * der erklärt, wie das Produkt gedacht ist.
          */}
        {/*
          Das Ziel des Hinweises oben in der Leiste.
          
          Ein zweiter Kasten mit demselben Versprechen stand hier
          kurz — bis auffiel, dass `Jobalarm` genau das seit Langem
          tut, und zwar mit einem Knopf, der den Auftrag aus den
          aktuellen Filtern wirklich anlegt.
          
          `scroll-mt` wegen der Leiste oben: Ohne den Abstand landet
          die Überschrift beim Ankersprung darunter.
        */}
        <div id="nachts" className="scroll-mt-24">
        <Jobalarm
          params={params}
          vorschlag={
            [params.q, params.ort].filter(Boolean).join(" in ") || "Meine Suche"
          }
        />
        </div>

        <Vertrauensbereich zahlen={await grundlagenzahlen()} />


      </div>

    </div>
  );
}

const CONTRACT: Record<string, string> = {
  permanent: "Unbefristet",
  fixed_term: "Befristet",
  internship: "Praktikum",
  working_student: "Werkstudium",
  apprenticeship: "Ausbildung",
  freelance: "Freiberuflich",
  temp_agency: "Zeitarbeit",
};

/** Alter in Worten. „vor 3 Tagen" liest sich schneller als ein Datum. */

/**
 * Filter auf der bereits bewerteten Liste.
 *
 * Das Suchfeld nimmt normale Sprache: gesucht wird über Titel,
 * Unternehmen, Ort und Aufgaben. Bewusst keine Deutung von Absichten —
 * eine Suche, die etwas anderes tut als eingegeben, ist schlimmer als
 * eine, die zu wenig findet.
 */
/**
 * Die eingetippten Filter anwenden — und mitzählen, was mangels
 * Angabe herausfällt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Zahl mit hinaus muss
 * ══════════════════════════════════════════════════════════════
 *
 * Seit die eingetippten Filter streng sind, verschwinden Anzeigen,
 * die zur Sache nichts sagen — bei „Teilzeit" etwa die 46 Prozent
 * ohne Stundenangabe.
 *
 * Ohne die Zahl sieht das aus wie ein kleiner Arbeitsmarkt. Mit ihr
 * ist es eine Auskunft über die ANZEIGEN: „acht ausgeblendet, weil
 * sie dazu nichts sagen" ist etwas völlig anderes als „es gibt nur
 * zwei Stellen".
 */
/**
 * Der Text, in dem gesucht wird.
 *
 * Bewusst breiter als die Datenbankabfrage: Sie kann nur Titel und
 * Ortsfeld indiziert durchsuchen, hier stehen auch Arbeitgeber,
 * Branche und Kernaufgaben zur Verfügung. Der Nachfilter darf mehr
 * finden als die Auswahl — er darf ihr nur nichts wegnehmen, was sie
 * behalten wollte.
 */
function textbasis(j: ScoredJob): string {
  return [
    j.job.title,
    j.job.companyName,
    j.job.location,
    j.job.industry ?? "",
    ...j.job.coreTasks,
  ].join(" ");
}

/** Der Jahresbetrag einer Anzeige, oder `null`, wenn keiner dasteht. */
function jahresgehalt(j: ScoredJob): number | null {
  const von = j.job.salary.min ?? j.job.salary.max;
  if (typeof von !== "number") return null;
  return j.job.salary.period === "month"
    ? von * 12
    : j.job.salary.period === "hour"
      ? von * 40 * 52
      : von;
}

/**
 * Passt die Stelle zu DIESEM Zweig?
 *
 * Beruf und Gehalt zusammen — das ist der ganze Sinn der Zweige. Wer
 * „Bürokaufmann ab 40k, Elektriker ab 50k" sagt, will keinen
 * Bürokaufmann für 50.000 ausschliessen und keinen Elektriker für
 * 42.000 einschliessen.
 *
 * Ohne Gehaltsangabe fällt die Stelle heraus — wie beim gewöhnlichen
 * Gehaltsfilter eine Zeile weiter unten. Sie wird dort als
 * „schweigsam" gezählt, damit die Zahl unter der Liste erklärt, wo
 * sie geblieben ist.
 */
function zweigTrifft(j: ScoredJob, z: Suchzweig): boolean {
  if (!trifftSuche(textbasis(j), z.q)) return false;
  if (z.gehaltAb === undefined) return true;
  const proJahr = jahresgehalt(j);
  return proJahr !== null && proJahr >= z.gehaltAb;
}

function applyFilters(
  jobs: ScoredJob[],
  params: Record<string, string | undefined>,
  /**
   * Wo die Person wohnt, in Koordinaten.
   *
   * `null` heisst: nicht auflösbar. Dann kann die Fahrzeit nicht
   * gefiltert werden, und der Filter greift gar nicht — besser als
   * eine leere Liste aus einer Zahl, die niemand berechnen konnte.
   */
  wohnpunkt: { latitude: number; longitude: number } | null = null,
  fortbewegung: string | null = null,
  /**
   * Der Mittelpunkt für `umkreisKm`, in Koordinaten.
   *
   * `null` heisst: nicht auflösbar oder kein Umkreis verlangt. Dann
   * wird NICHT nach Entfernung gefiltert — eine Grenze aus einem
   * Mittelpunkt, den niemand bestimmen konnte, wäre geraten, und
   * geratene Grenzen leeren Listen ohne sichtbaren Grund.
   */
  suchpunkt: { latitude: number; longitude: number } | null = null,
): { jobs: ScoredJob[]; ohneAngabe: number } {
  let result = jobs;

  /*
   * Gezählt wird je Stelle höchstens einmal.
   *
   * Wer Teilzeit UND ein Gehalt verlangt, blendet dieselbe schweigsame
   * Anzeige an zwei Stellen aus. Zweimal gezählt ergäbe eine Zahl,
   * die grösser ist als die Zahl der Stellen — und dann glaubt sie
   * niemand mehr.
   */
  const schweigsam = new Set<string>();
  const zaehleStumme = (vorher: ScoredJob[], stumm: (j: ScoredJob) => boolean) => {
    for (const j of vorher) if (stumm(j)) schweigsam.add(j.jobId);
  };

  /*
   * ══════════════════════════════════════════════════════════════
   * Der Nachfilter und die Datenbank müssen dasselbe meinen
   * ══════════════════════════════════════════════════════════════
   *
   * Hier stand `words.every(...)` über den ROHEN Wörtern des Satzes.
   * Bei „landratsamt karlsruhe sozialen bereich" musste also jedes
   * dieser vier Wörter buchstäblich vorkommen — „bereich" ist ein
   * Füllwort, und „sozialen" steht so in keiner Anzeige; sie schreibt
   * „Sozialarbeiter" oder „Sozialer Dienst". Ergebnis: null Treffer
   * für einen Satz, den jeder versteht.
   *
   * Die Datenbank machte es längst besser: `plainto_tsquery('german',
   * …)` wirft Füllwörter weg und führt Beugungen zusammen. Der
   * Nachfilter zog danach wieder enger — zwei Regeln für eine Frage,
   * und die strengere gewann.
   *
   * `trifft` gleicht beides an: Füllwörter fallen weg, und verglichen
   * wird über einen Wortstamm statt buchstäblich.
   */
  const zweige = zweigeLesen(params.zweige);
  if (zweige.length > 0) {
    /*
     * Mehrere Berufe: ODER dazwischen, wie in der Datenbank.
     *
     * Wer „Bürokaufmann und auch Elektriker" sagt, will Stellen aus
     * beiden Berufen — nicht Stellen, die beides zugleich sind. Und
     * das Gehalt gehört zum Zweig: Der eine soll ab 40.000 gelten,
     * der andere ab 50.000.
     */
    if (zweige.some((z) => z.gehaltAb !== undefined)) {
      zaehleStumme(result, (j) => jahresgehalt(j) === null);
    }
    result = result.filter((j) => zweige.some((z) => zweigTrifft(j, z)));
  } else {
    const q = params.q?.trim();
    if (q) result = result.filter((j) => trifftSuche(textbasis(j), q));
  }

  /*
   * Ausschlüsse.
   *
   * Ein Wort aus dieser Liste im Titel, in den Aufgaben oder in der
   * Branche schliesst die Stelle aus. Bewusst dieselbe Textbasis wie
   * die Suche — sonst hiesse „ohne Kaltakquise" etwas anderes als
   * „Kaltakquise".
   */
  const nicht = params.nicht?.trim().toLowerCase();
  if (nicht) {
    const verboten = nicht.split(/\s+/).filter((w) => w.length > 2);
    result = result.filter((j) => {
      const haystack = [j.job.title, j.job.industry ?? "", ...j.job.coreTasks]
        .join(" ")
        .toLowerCase();
      return !verboten.some((w) => haystack.includes(w));
    });
  }

  /*
   * Der Ort als eigener Filter.
   *
   * Vorher landete er im Volltext und traf damit auch Firmen, die eine
   * Stadt im Namen tragen — „Berlin" fand die „Berlin Brands Group" in
   * Hamburg. Auf das Ortsfeld angewandt trifft er das, was gemeint ist.
   */
  const ort = params.ort?.trim().toLowerCase();
  if (ort) {
    /*
     * „Nur Karlsruhe" ist enger als „rund um Karlsruhe".
     *
     * ── Warum der Unterschied zählt ───────────────────────────
     *
     * `includes` auf dem Ortsfeld trifft „Karlsruhe" auch in
     * „Karlsruhe-Durlach" und „Landkreis Karlsruhe" — das ist bei
     * „rund um" gewollt. Wer ausdrücklich „nur" sagt, meint die
     * Stadt selbst.
     *
     * Verglichen wird das erste Segment des Ortsfelds: „Karlsruhe,
     * Baden-Württemberg" ist Karlsruhe, „Bruchsal, Baden-Württemberg"
     * nicht.
     */
    /*
     * ══════════════════════════════════════════════════════════
     * Mit Umkreis zählt die Entfernung, nicht das Ortsfeld
     * ══════════════════════════════════════════════════════════
     *
     * „30 km um Karlsruhe" hiess bis zum 8. September 2026 in
     * Wahrheit „im Ortsfeld steht Karlsruhe". Das ist etwas anderes,
     * und der Unterschied geht in beide Richtungen:
     *
     *   Ettlingen, 12 km   →  fiel heraus, obwohl im Umkreis
     *   Landkreis Karlsruhe → kam herein, auch von weit her
     *
     * Mit einem Mittelpunkt wird gerechnet statt verglichen.
     *
     * ── Anzeigen ohne Koordinaten fallen nicht durch ────────
     *
     * Nicht jede Anzeige trägt sie. Sie deshalb wegzuwerfen hiesse,
     * einen Umkreis zu setzen und dabei still die halbe Stadt zu
     * verlieren. Für sie gilt weiterhin der Ortstext — dieselbe
     * Regel wie bisher, nur noch als Rückfall.
     */
    const km = Number(params.umkreisKm);
    if (suchpunkt && Number.isFinite(km) && km > 0) {
      result = result.filter((j) => {
        if (j.job.latitude === null || j.job.longitude === null) {
          return j.job.location.toLowerCase().includes(ort);
        }
        return (
          entfernungKm(
            suchpunkt.latitude,
            suchpunkt.longitude,
            j.job.latitude,
            j.job.longitude,
          ) <= km
        );
      });
    } else {
      result =
        params.ortGenau === "1"
          ? result.filter((j) => {
              const stadt = j.job.location.split(",")[0]?.trim().toLowerCase() ?? "";
              return stadt === ort;
            })
          : result.filter((j) => j.job.location.toLowerCase().includes(ort));
    }
  }

  /*
   * Arbeitszeit — nur wo sie in der Anzeige steht.
   *
   * Gemessen sind 65,2 Prozent der deutschen Stellen mit
   * Wochenstunden versehen. Bei den übrigen ist nichts bekannt, und
   * eine unbekannte Angabe ist keine erfüllte: Sie fällt hier NICHT
   * heraus, aber die Zeile sagt, dass sie offen ist — dieselbe Regel
   * wie bei allen anderen unklaren Bedingungen.
   *
   * Die Grenze bei 35 Stunden ist die übliche deutsche Trennung
   * zwischen Vollzeit und Teilzeit.
   */
  /*
   * ══════════════════════════════════════════════════════════════
   * Ein eingetippter Filter filtert wirklich
   * ══════════════════════════════════════════════════════════════
   *
   * Hier stand `weeklyHours === null || …` — eine Anzeige ohne
   * Stundenangabe kam durch. Das folgte der Regel, die für die
   * BEDINGUNGEN AUS DEM PROFIL gilt und dort richtig ist:
   * Unbekanntes ist kein Widerspruch, und eine Anzeige, die nichts
   * zum Gehalt sagt, verletzt keine Gehaltsuntergrenze.
   *
   * Für einen Filter, den jemand gerade selbst eingetippt hat, ist
   * sie falsch. „Teilzeit" ist keine Vermutung über die Person,
   * sondern ein Auftrag — und wer ihn erteilt und danach zur Hälfte
   * Vollzeitstellen und Anzeigen ohne Angabe sieht, hält den Filter
   * für kaputt.
   *
   * Der Unterschied ist die ganze Regel:
   *
   *   Profilbedingung   tolerant — Schweigen ist kein Verstoss
   *   Eingetippt        streng   — Schweigen ist keine Erfüllung
   *
   * ── Was das kostet, gemessen ────────────────────────────────
   *
   * An den 8.000 neuesten deutschen Anzeigen der letzten 21 Tage
   * (6. September 2026):
   *
   *   Wochenstunden genannt    54 %
   *   Schichtarbeit angegeben  59 %
   *   Vertragsart angegeben    55 %
   *   Gehalt angegeben         32 %
   *   Arbeitsmodell angegeben 100 %
   *
   * Ein Zeitfilter halbiert die Liste also etwa. Das ist der Preis
   * dafür, dass die Liste hält, was der Filter verspricht — und wer
   * ihn nicht setzt, sieht weiterhin alles.
   */
  if (params.arbeitszeit === "vollzeit" || params.arbeitszeit === "teilzeit") {
    zaehleStumme(result, (j) => j.job.weeklyHours === null);
    result = result.filter((j) =>
      params.arbeitszeit === "vollzeit"
        ? j.job.weeklyHours !== null && j.job.weeklyHours >= 35
        : j.job.weeklyHours !== null && j.job.weeklyHours < 35,
    );
  }

  /*
   * Keine Schichtarbeit — was bestätigt ist, fällt raus.
   *
   * Nur 5,9 Prozent der Anzeigen sagen überhaupt etwas dazu, davon
   * 488 mit „ja". Diese fallen heraus. Die 94 Prozent Schweigen als
   * „keine Schicht" zu lesen wäre die bequeme Auslegung — und genau
   * der Fehler, den die Vorgabe benennt: Unbekanntes ist nicht
   * automatisch erfüllt. Es bleibt sichtbar und ungeklärt.
   */
  if (params.schicht === "0") {
    /*
     * Nachgemessen — und die alte Begründung stimmt nicht mehr.
     *
     * Hier stand `shiftWork !== true` mit dem Argument, 94 Prozent
     * der Anzeigen sagten nichts zur Schichtarbeit; strenger zu
     * filtern hätte die Liste geleert.
     *
     * Am 6. September 2026 an den 8.000 neuesten deutschen Anzeigen
     * nachgezählt: 59 Prozent machen eine Angabe. Der Bestand ist ein
     * anderer geworden, und damit die Antwort auch.
     *
     * „Keine Schichtarbeit" heisst jetzt: Die Anzeige sagt, dass es
     * keine gibt. Schweigen ist keine Zusage — und für jemanden mit
     * festen Abholzeiten ist der Unterschied nicht akademisch.
     */
    zaehleStumme(result, (j) => j.job.shiftWork === null || j.job.shiftWork === undefined);
    result = result.filter((j) => j.job.shiftWork === false);
  }

  /*
   * Die Art der Beschäftigung.
   *
   * ── Warum das ein Filter sein muss ────────────────────────
   *
   * Praktika, Werkstudien, Ausbildungen und Minijobs standen bisher
   * unsortiert zwischen den festen Stellen. Wer eines davon SUCHT,
   * musste sie aus der Liste fischen; wer keines will, bekam sie
   * trotzdem.
   *
   * Mehrere Arten sind mit Komma erlaubt: `art=praktikum,werkstudium`.
   * Ohne Angabe wird nichts gefiltert — der bisherige Zustand bleibt
   * die Voreinstellung, damit niemand stillschweigend weniger sieht.
   */
  const arten = params.art
    ?.split(",")
    .map((a) => a.trim())
    .filter((a): a is Beschaeftigungsart =>
      (BESCHAEFTIGUNGSARTEN as readonly string[]).includes(a),
    );
  if (arten && arten.length > 0) {
    result = result.filter((j) => arten.includes(beschaeftigungsart(j.job.title)));
  }

  if (params.remote) result = result.filter((j) => j.job.workModel === params.remote);
  if (params.contract) {
    zaehleStumme(result, (j) => j.job.contractType === null);
    result = result.filter((j) => j.job.contractType === params.contract);
  }
  if (params.salary === "disclosed") result = result.filter((j) => j.job.salary.disclosed);

  /*
   * Mindestgehalt.
   *
   * Geprüft wird die Untergrenze der Spanne: eine Stelle mit
   * 42.000–55.000 erfüllt „ab 45.000" nicht sicher, und eine Suche
   * darf nicht optimistisch runden. Stellen ohne Angabe fallen hier
   * nicht heimlich durch — dafür sorgt `salary=disclosed`, das die
   * Sucherkennung zusammen mit dem Betrag setzt.
   */
  /*
   * ══════════════════════════════════════════════════════════════
   * Die Fahrzeit
   * ══════════════════════════════════════════════════════════════
   *
   * „Keine längere Autofahrt als 170 Minuten" wurde bisher gar nicht
   * verstanden: Der Satz wanderte als Ganzes in die Volltextsuche,
   * und die fand nichts. Die Zahl gibt es längst — `commuteMinutes`
   * steht an jeder bewerteten Stelle.
   *
   * Streng wie jeder eingetippte Filter: Eine Stelle, deren Fahrzeit
   * sich nicht berechnen lässt, erfüllt „höchstens 45 Minuten" nicht.
   * Sie zählt in die Zahl der ausgeblendeten Anzeigen — dort ist das
   * eine Auskunft, hier wäre es ein stilles Durchwinken.
   */
  const pendelzeit = Number(params.pendelzeit);
  if (Number.isFinite(pendelzeit) && pendelzeit > 0) {
    /*
     * ══════════════════════════════════════════════════════════════
     * Aus Koordinaten, nicht aus einer Tabelle mit vier Städten
     * ══════════════════════════════════════════════════════════════
     *
     * `commuteMinutes` kam aus `DISTANCE_MINUTES` — Hamburg, Berlin,
     * München, Köln. Für jede andere Stadt: `null`.
     *
     * Solange die Zahl nur in eine Bewertung einging, fiel das kaum
     * auf. Als sie zum Filter wurde, war die Folge sofort da:
     * „höchstens 120 Minuten" liess NICHTS übrig, weil für fast jede
     * Stelle gar keine Fahrzeit bekannt war.
     *
     * Die Koordinaten gibt es längst — 90 Prozent der Anzeigen tragen
     * sie, seit die Geodaten nachgezogen wurden.
     *
     * Ohne auflösbaren Wohnort greift der Filter gar nicht. Eine
     * leere Liste aus einer Zahl, die niemand berechnen konnte, wäre
     * die schlechtere Antwort.
     */
    if (wohnpunkt) {
      const minuten = (j: ScoredJob) =>
        j.job.workModel === "remote"
          ? 0
          : (fahrzeitMinuten(wohnpunkt, j.job, fortbewegung) ?? j.commuteMinutes ?? null);

      zaehleStumme(result, (j) => typeof minuten(j) !== "number");
      result = result.filter((j) => {
        const m = minuten(j);
        return typeof m === "number" && m <= pendelzeit;
      });
    }
  }

  const gehaltAb = Number(params.gehaltAb);
  if (Number.isFinite(gehaltAb) && gehaltAb > 0) {
    zaehleStumme(result, (j) => typeof (j.job.salary.min ?? j.job.salary.max) !== "number");
    result = result.filter((j) => {
      const von = j.job.salary.min ?? j.job.salary.max;
      if (typeof von !== "number") return false;
      /*
       * Auf ein Jahr umrechnen, bevor verglichen wird.
       *
       * Anzeigen nennen Monats-, Stunden- und Jahresbeträge bunt
       * gemischt. Ein Vergleich der rohen Zahl gegen 45.000 wirft jede
       * Stelle raus, die „4.000 € im Monat" schreibt — also 48.000 im
       * Jahr und damit genau das, was gesucht war.
       */
      const proJahr =
        j.job.salary.period === "month"
          ? von * 12
          : j.job.salary.period === "hour"
            ? von * 40 * 52
            : von;
      return proJahr >= gehaltAb;
    });
  }

  const sinceDays = Number(params.since);
  if (Number.isFinite(sinceDays) && sinceDays > 0) {
    const cutoff = Date.now() - sinceDays * 86_400_000;
    result = result.filter((j) => (j.job.publishedAt?.getTime() ?? 0) >= cutoff);
  }

  /*
   * Gezählt wird nur, was am Ende auch fehlt.
   *
   * Eine Anzeige ohne Stundenangabe, die schon am Ort gescheitert
   * ist, war nicht wegen ihres Schweigens draussen. Sie mitzuzählen
   * hiesse, dem Filter etwas anzulasten, was er nicht getan hat.
   */
  const uebrig = new Set(result.map((j) => j.jobId));
  let ohneAngabe = 0;
  for (const id of schweigsam) if (!uebrig.has(id)) ohneAngabe++;

  return { jobs: result, ohneAngabe };
}

/**
 * Welche Bedingungen gerade gelten — in Worten, nicht als Feldnamen.
 *
 * Sie stehen in der leeren Liste, damit niemand raten muss, warum sie
 * leer ist. Der häufigste Grund für „die Suche ist kaputt" ist ein
 * Filter, den man vor zwei Minuten gesetzt und längst vergessen hat.
 */
/**
 * Eine Bedingung, die man wieder wegnehmen kann.
 *
 * `adresse` steht nur dort, wo das Wegnehmen nicht bedeutet, einen
 * ganzen Parameter zu löschen: Von zwei Berufen soll EINER gehen, der
 * andere bleiben. `ohneBedingung` kann das nicht ausdrücken — es
 * kennt nur Schlüssel.
 */
type Bedingung = { key: string; label: string; adresse?: string };

function aktiveBedingungen(params: Record<string, string | undefined>): Bedingung[] {
  const raus: Bedingung[] = [];
  const arbeitsmodell: Record<string, string> = {
    remote: "nur remote",
    hybrid: "höchstens zwei Bürotage",
    onsite: "vor Ort",
  };
  const vertrag: Record<string, string> = {
    permanent: "unbefristet",
    temporary: "befristet",
    freelance: "freiberuflich",
    internship: "Praktikum oder Werkstudium",
  };

  if (params.q) raus.push({ key: "q", label: params.q });
  if (params.nicht) raus.push({ key: "nicht", label: `ohne ${params.nicht}` });
  if (params.ort) raus.push({ key: "ort", label: `rund um ${params.ort}` });
  if (params.remote && arbeitsmodell[params.remote]) {
    raus.push({ key: "remote", label: arbeitsmodell[params.remote]! });
  }
  if (params.contract && vertrag[params.contract]) {
    raus.push({ key: "contract", label: vertrag[params.contract]! });
  }
  if (params.pendelzeit) {
    raus.push({ key: "pendelzeit", label: `höchstens ${params.pendelzeit} Min. Fahrt` });
  }
  if (params.gehaltAb) {
    raus.push({
      key: "gehaltAb",
      label: `ab ${Number(params.gehaltAb).toLocaleString("de-DE")} €`,
    });
  }
  if (params.since) raus.push({ key: "since", label: `aus den letzten ${params.since} Tagen` });

  /*
   * ══════════════════════════════════════════════════════════════
   * Jeder Beruf ein eigenes Plättchen
   * ══════════════════════════════════════════════════════════════
   *
   * Sie stehen zusammen in EINEM Adressparameter, aber sie sind zwei
   * Entscheidungen. Ein gemeinsames Plättchen „zwei Berufe" hiesse:
   * Wer den Elektriker nicht mehr will, verliert auch den
   * Bürokaufmann — und muss den ganzen Satz noch einmal tippen.
   *
   * Deshalb trägt jedes Plättchen seine eigene Adresse: dieselbe
   * Suche ohne genau diesen Zweig. Bleibt danach nur einer übrig,
   * wird er zur gewöhnlichen Suche mit `q` und `gehaltAb` — dort, wo
   * die Filterknöpfe ihn finden.
   */
  const zweige = zweigeLesen(params.zweige);
  for (const [i, z] of zweige.entries()) {
    const rest = zweige.filter((_, j) => j !== i);
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || k === "zweige") continue;
      next.set(k, v);
    }
    const alsZweige = zweigeSchreiben(rest);
    if (alsZweige !== null) next.set("zweige", alsZweige);
    else if (rest[0]) {
      next.set("q", rest[0].q);
      if (rest[0].gehaltAb !== undefined) next.set("gehaltAb", String(rest[0].gehaltAb));
    }
    raus.push({
      key: `zweig:${z.q}`,
      label:
        z.gehaltAb === undefined
          ? z.q
          : `${z.q} ab ${z.gehaltAb.toLocaleString("de-DE")} €`,
      adresse: next.toString(),
    });
  }

  return raus;
}

/** Dieselbe Adresse ohne genau eine Bedingung. */
function ohneBedingung(params: Record<string, string | undefined>, key: string): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || k === key) continue;
    /*
     * Ein Mindestgehalt bringt „nur mit Gehaltsangabe" mit. Fällt der
     * Betrag weg, muss die Angabe mitfallen — sonst bleibt eine
     * Bedingung stehen, die niemand gesetzt hat und die in der Liste
     * der aktiven Bedingungen gar nicht auftaucht.
     */
    if (key === "gehaltAb" && k === "salary") continue;
    next.set(k, v);
  }
  return next.toString();
}

/* ═══════════════════════════════════════════════════════════════
   Der Seitenkopf — er wartet auf nichts
   ═══════════════════════════════════════════════════════════════

   Bis hierher war die ganze Seite EINE Serverkomponente. Nichts davon
   erreichte den Browser, bevor die letzte Abfrage zurück war —
   gemessen 705 Millisekunden, davon zwei Drittel Netzrunden zur
   Datenbank.

   Beim ersten Klick nach dem Laden fiel das besonders auf: Der
   Zwischenspeicher des Routers ist dann leer, der Übergang friert das
   Bild ein, bis die Adresse steht, und bis dahin verging fast eine
   Sekunde.

   Jetzt gibt dieser Kopf sofort zurück, was an keiner Abfrage hängt:
   Überschrift, Rückweg ins Gespräch, Suchfeld. Alles darunter kommt
   in eigenen Strömen nach. Die Adresse steht damit, sobald der Server
   den ersten Teil geschrieben hat — nicht erst, wenn alles fertig
   gerechnet ist.

   Was gestreamt wird, braucht ein Gerüst mit der RICHTIGEN Höhe:
   Sonst springt beim Eintreffen der Daten alles darunter, und das
   Suchfeld — das der Übergang gerade an seinen Platz gefahren hat —
   springt mit.
   ═══════════════════════════════════════════════════════════════ */
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  /* Nur diese beiden. `getPageContext` liest Sprache und Marke,
     `requireUser` die Sitzung — zusammen gemessen 58 ms, keine
     Stellenabfrage. */
  const { brand } = await getPageContext();

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <PageHeader
        /*
         * Kein Eyebrow mehr.
         *
         * „Entdecken" stand über „Deine besten Möglichkeiten" und sagte
         * dasselbe wie der aktive Punkt in der Navigation zwei Zeilen
         * darüber. Zwei Angaben desselben Ortes untereinander kosten
         * hier vierundzwanzig Pixel — und Pixel über der Liste sind auf
         * dieser Seite das knappste Gut.
         */
        className="uebergang-stellen-titel"
        title="Deine besten Möglichkeiten"
        /*
         * Kein Vorspann mehr — auf keiner Breite.
         *
         * Er war schon auf dem Telefon ausgeblendet, mit einer
         * Begründung, die auf dem Rechner genauso gilt: Dieselbe
         * Auskunft steht drei Zeilen weiter unten genauer, direkt über
         * der Liste — „X passende Stellen von Y geprüften". Der
         * Vorspann sagte dasselbe in Prosa und kostete dabei rund
         * siebzig Pixel, also eine Stellenzeile.
         *
         * Auf einer Seite namens „Jobs" gewinnt ein Job gegen einen
         * Satz über Jobs.
         */
        actions={
          // Wer die Stelle woanders gefunden hat, soll sie hier
          // trotzdem prüfen lassen können. Ohne diesen Weg endet jede
          // Empfehlung an der Grenze unserer Quellen.
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {/*
              Hier standen „Wie viele davon sind echte Chancen?" und
              „Job-Link analysieren".

              Beide Wege gibt es weiterhin — `/app/opportunities` und
              `/app/jobs/import` sind unverändert erreichbar. Was weg
              ist, sind zwei Verweise über der Liste, die eine Frage
              beantworteten, die an dieser Stelle niemand stellt: Wer
              gerade Stellen durchsieht, will die nächste sehen und
              nicht erklärt bekommen, wie viele davon nichts taugen.
            */}
            {/* Nur mit gemerkten Stellen — ein Vergleich ohne etwas zu
                vergleichen führt auf eine leere Seite. */}
            {/* Eigener Strom: Der Link hängt an einer Abfrage, die
                Überschrift nicht. Ohne die Trennung wartet der ganze
                Seitenkopf auf die gemerkten Stellen. */}
            <Suspense fallback={null}>
              <Vergleichslink />
            </Suspense>
          </div>
        }
      />

      {/* Der Hinweiskasten hängt am Riegel, also an einer Abfrage.
          Sein Platz wird reserviert, damit das Suchfeld darunter nicht
          springt, wenn er eintrifft. */}
      {/*
        Die Höhe ist gemessen, nicht geschätzt: 81 Pixel ab `sm`, 130
        auf dem Telefon, wo der Satz auf vier Zeilen umbricht. Stimmt
        sie nicht, springt beim Eintreffen alles darunter — und das
        Suchfeld, das der Übergang gerade an seinen Platz gefahren hat,
        springt mit.
      */}
      <Suspense fallback={<div className="h-[130px] sm:h-[81px]" aria-hidden />}>
        <Hinweisstreifen />
      </Suspense>

      {/* Zuerst der Weg in Worten, danach die Filter. Wer eine
          Bedingung nennen kann, die kein Feld abbildet, soll sie nicht
          erst in Felder übersetzen müssen. */}
      {/*
        Die Suchzeile und Mondays Rückfrage gehören zusammen.

        Der Provider hält genau einen Zustand: die offene Frage oder
        keine. Er steht hier und nicht weiter oben, weil ausserhalb
        der Stellenseite niemand danach fragt — und ein Kontext, der
        überall liegt, wird irgendwann überall benutzt.
      */}
      {/*
        Der Rückweg ins Gespräch — dieselbe Geste, andere Richtung.

        Er steht ÜBER dem Suchfeld, nicht darunter: Nach oben zu
        scrollen führt nach oben aus der Seite heraus, und der Hinweis
        gehört an die Kante, an der man ankommt.
      */}
      <ScrollUebergang
        ziel="/app/monday"
        richtung="hoch"
        hinweis={`Nach oben scrollen, um mit ${brand.assistantName} zu sprechen`}
      />

      <SuchdialogProvider>
        <NinaSearchComposer assistantName={brand.assistantName} />
        <Suchrueckfrage assistantName={brand.assistantName} />
      </SuchdialogProvider>

      <Rollrastung />

      <Suspense fallback={<Listengeruest />}>
        <Stellenliste searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/**
 * Der Hinweis, dass die Reihenfolge noch nicht zugeschnitten ist.
 *
 * Eigener Strom, weil er den Riegel braucht — eine Abfrage, auf die
 * die Überschrift darüber nicht warten muss.
 */
async function Hinweisstreifen() {
  const [{ t }, user] = await Promise.all([getPageContext(), requireUser()]);
  const gate = await loadGate(user.id);
  {/*
   * Die Sperre sperrt die PERSONALISIERUNG, nicht die Seite.
   *
   * Vorher ersetzte sie die ganze Jobliste durch einen Hinweis: wer
   * sein Gespräch noch nicht weit genug geführt hatte, sah gar keine
   * Stellen. Das war zu viel. Die Anzeigen sind echt und öffentlich
   * — sie zurückzuhalten schützt niemanden. Was ohne belegtes Profil
   * nicht geht, ist die Reihenfolge zu begründen, und genau das
   * steht hier.
   */}
  return gate.unlocked ? null : (
    <div className="uebergang-stellen-hinweis rounded-(--radius-surface) bg-accent-soft px-5 py-4">
      <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
        <span className="font-medium text-ink">
          Diese Reihenfolge ist noch nicht auf dich zugeschnitten.
        </span>{" "}
        {gate.reason}{" "}
        {/*
         * Der Weg richtet sich danach, WAS fehlt.
         *
         * Vorher hing er allein an `profileConfirmed` — und schickte
         * damit zum Bestätigen, wer noch gar nichts zu bestätigen
         * hatte. Wem Angaben fehlen, dem hilft kein Formular, sondern
         * das Gespräch, aus dem sie sich ergeben.
         */}
        <Link
          href={gate.missingStages.length > 0 ? "/app/monday" : "/app/career"}
          className="text-accent-text underline underline-offset-[3px]"
        >
          {gate.missingStages.length > 0
            ? t("jobs.lockedCta")
            : "Profil ansehen und bestätigen"}
        </Link>
      </p>
    </div>
  );
}

/**
 * „Gemerkte vergleichen" — nur ab zwei gemerkten Stellen.
 *
 * Ein Vergleich ohne etwas zu vergleichen führt auf eine leere Seite.
 */
async function Vergleichslink() {
  const user = await requireUser();
  const db = await getDb();
  const zeilen = await withUser(db, user.id, (tx) =>
    tx
      .select({ jobId: schema.savedJobs.jobId })
      .from(schema.savedJobs)
      .where(eq(schema.savedJobs.userId, user.id)),
  ).catch(() => []);
  if (zeilen.length < 2) return null;
  return (
    <Link
      href={`/app/jobs/vergleich?ids=${zeilen.slice(0, 3).map((z) => z.jobId).join(",")}`}
      className="inline-flex min-h-6 items-center gap-1.5 text-sm text-accent-text underline underline-offset-[3px]"
    >
      <Columns3 aria-hidden className="size-3.5" strokeWidth={1.9} />
      Gemerkte vergleichen
    </Link>
  );
}

/**
 * Was an der Stelle der Liste steht, solange sie gerechnet wird.
 *
 * Vier Zeilen — genug, damit die Seite als Liste lesbar ist, und kein
 * Versprechen über die Zahl der Treffer, das wir hier nicht geben
 * können. Dieselbe Form wie in `loading.tsx`, damit der Wechsel vom
 * einen Gerüst zum anderen nicht auffällt.
 */
function Listengeruest() {
  return (
    <div className="uebergang-stellen-liste grid gap-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">Stellen werden geladen</span>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="grid gap-2.5 rounded-(--radius-surface) border border-line p-4">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3.5 w-1/4" />
          <Skeleton className="h-3.5 w-3/5" />
        </div>
      ))}
    </div>
  );
}
