import type { Entgeltreferenz } from "@/lib/jobs/berufsreferenz";
import type { JobRowData } from "@/components/jobs/JobRow";
import type { ScoredJob } from "@/lib/matching";
import { entfernungKm } from "@paycheck/matching";
import { fahrzeitMinuten } from "@/lib/jobs/fahrzeit";
import { gehaltsanzeige } from "@/lib/jobs/gehaltsanzeige";
import { listensignale } from "@/lib/jobs/listensignale";
import { titelOhneEmoji } from "@/lib/jobs/titel";

/**
 * Aus bewerteten Stellen werden Listenzeilen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das hier steht und nicht in der Jobseite
 * ══════════════════════════════════════════════════════════════
 *
 * Die Abbildung stand mitten in `app/jobs/page.tsx`: rund hundertzwanzig
 * Zeilen, und in ihnen jede Entscheidung darüber, was eine Stellenzeile
 * zeigt — welches Gehalt, was ohne Koordinaten passiert, welche
 * Etiketten in eine Zeile passen, wann eine Anzeige „frisch" heisst.
 *
 * Sobald eine zweite Stelle dieselben Zeilen zeigen soll, gibt es genau
 * zwei Möglichkeiten: dieselbe Funktion — oder zwei Fassungen, die beim
 * nächsten Feld auseinanderlaufen. Dann steht auf der einen Seite ein
 * Gehalt und auf der anderen nicht, und niemand weiss, welche stimmt.
 *
 * Die Begründungen sind wörtlich mitgewandert. Sie gehören zu den
 * Entscheidungen, nicht zu der Datei, in der sie zufällig standen.
 *
 * ── Was NICHT hierher gehört ──────────────────────────────────
 *
 * Das Laden. Wohnort, Referenzgehälter und abgelegte Stellen holt die
 * Seite; diese Funktion rechnet nur. So bleibt sie ohne Datenbank
 * prüfbar, und jede Seite entscheidet selbst, wie viel sie lädt.
 */

/** Wohnort als Punkt — Grundlage für Entfernung und Fahrzeit. */
export interface Wohnpunkt {
  latitude: number;
  longitude: number;
}

export interface Zeilenlage {
  /** Wohnort, oder `null`, wenn keiner hinterlegt oder auflösbar ist. */
  wohnpunkt: Wohnpunkt | null;
  /** Verkehrsmittel aus den Bedingungen. */
  fortbewegung: string | null;
  /** Welche Stellen der Mensch abgelegt hat. */
  savedIds: Set<string>;
  /** Referenzgehälter nach amtlicher Kennung. */
  nachKldb: Map<string, Entgeltreferenz>;
  /** Referenzgehälter nach normalisiertem Titel. */
  nachTitel: Map<string, Entgeltreferenz>;
  /** Anzeigenamen der Vertragsarten. */
  vertragsarten: Record<string, string>;
}

/**
 * Wie alt eine Anzeige ist, in Worten.
 *
 * Stand als lokale Funktion am Ende der Jobseite. Sie gehört zur
 * Zeile, nicht zur Seite: „vor 3 Tagen" ist eine Aussage über die
 * Anzeige, und dieselbe Aussage muss überall gleich lauten.
 */
function relativeAge(date: Date | null): { label: string | null; fresh: boolean } {
  if (!date) return { label: null, fresh: false };
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return { label: "heute", fresh: true };
  if (days === 1) return { label: "gestern", fresh: true };
  if (days < 7) return { label: `vor ${days} Tagen`, fresh: true };
  if (days < 30) return { label: `vor ${Math.floor(days / 7)} Wochen`, fresh: false };
  return { label: `vor ${Math.floor(days / 30)} Monaten`, fresh: false };
}

export function zeilenAusStellen(stellen: ScoredJob[], lage: Zeilenlage): JobRowData[] {
  const { wohnpunkt, fortbewegung, savedIds, nachKldb, nachTitel } = lage;
  const CONTRACT = lage.vertragsarten;

  const referenz = (j: ScoredJob) => referenzFinden(j, nachKldb, nachTitel);

  const gehaltszeile = (j: ScoredJob) => gehaltszeileFuer(j, referenz);

  return stellen.map((j) => ({
    id: j.jobId,
    /*
     * Ohne Emojis.
     *
     * Sie stehen in den Anzeigen, nicht bei uns — gemessen in 2 von
     * 400 Titeln, meist als Blickfang um eine Gehaltsangabe. In einer
     * Liste aus fünfundzwanzig Zeilen schreien damit zwei und
     * dreiundzwanzig nicht, und die Reihenfolge sagt bereits, was
     * wichtig ist.
     *
     * Gespeichert bleibt der Titel des Arbeitgebers unverändert:
     * Was wir zeigen, ist unsere Entscheidung; was wir speichern,
     * seine Angabe.
     */
    title: titelOhneEmoji(j.job.title),
    /* Entscheidet über das Berufssymbol links in der Zeile. */
    kldb: j.job.kldb ?? null,
    /*
     * Wie weit es ist — geschätzt aus Koordinaten.
     *
     * `null`, wenn der Wohnort nicht aufgelöst werden konnte oder
     * die Stelle keine Koordinaten trägt. Dann steht in der Zeile
     * nichts; eine erfundene Zahl wäre schlimmer als eine fehlende.
     */
    fahrzeitMin:
      j.job.workModel === "remote" ? 0 : fahrzeitMinuten(wohnpunkt, j.job, fortbewegung),
    entfernungKm:
      wohnpunkt && j.job.latitude !== null && j.job.longitude !== null
        ? Math.round(
            entfernungKm(wohnpunkt.latitude, wohnpunkt.longitude, j.job.latitude, j.job.longitude),
          )
        : null,
    companyName: j.job.companyName,
    location: j.job.location,
    workModel: j.job.workModel,
    contractType: CONTRACT[j.job.contractType ?? ""] ?? null,
    /*
     * Eine Formatierung für alle Stellen, aus `geld.ts`.
     *
     * Hier stand `Intl.NumberFormat("de-DE")` mit angehängtem Kürzel —
     * „60.000–80.000 EUR". Das Jobdetail nebenan setzte das Symbol
     * davor. Dieselbe Stelle sah an zwei Orten verschieden aus, und
     * beide Fassungen schrieben jede Währung deutsch.
     */
    /*
     * Der Betrag entscheidet, nicht `disclosed`.
     *
     * `disclosed` heisst „der Arbeitgeber hat es offengelegt". Als
     * Anzeigeschalter verwendet, versteckte es die siebzig Gehälter,
     * die aus den Stellenbeschreibungen gelesen wurden — und liess die
     * Liste 1.446 Mal „nicht angegeben" schreiben, obwohl in siebzig
     * Anzeigen eine Zahl stand.
     */
    salaryLabel: gehaltsanzeige(j.job.salary)?.betrag ?? null,
    /*
     * Die Referenzspanne — getrennt vom echten Gehalt.
     *
     * Bewusst ein eigenes Feld und nicht `salaryLabel`. Wären beide
     * dasselbe, sähe eine Schätzung in der Liste aus wie eine Zusage,
     * und der Unterschied hinge an einem Kürzel daneben. Zwei Felder
     * heisst: die Zeile kann sie nicht verwechseln.
     */
    referenzSpanne: (() => {
      const r = referenz(j);
      if (!r) return null;
      const f = (n: number) => n.toLocaleString("de-DE");
      return `${f(r.q1)} – ${f(r.q3)} €`;
    })(),
    referenzQuelle: referenz(j)?.quelle ?? null,
    /*
     * Die Herkunft gehört auf die Karte, nicht nur ins Detail.
     *
     * „75.000 €" und „75.000 €" sehen in einer Liste gleich aus. Das
     * eine hat ein Arbeitgeber geschrieben, das andere hat ein Portal
     * geschätzt. Wer die Liste überfliegt und sich eine Zahl merkt,
     * merkt sich sonst eine Vermutung als Tatsache.
     */
    salaryHerkunft: gehaltsanzeige(j.job.salary)?.herkunftKurz ?? null,
    salaryZugesagt: gehaltsanzeige(j.job.salary)?.zugesagt ?? false,
    ageLabel: relativeAge(j.job.publishedAt ?? j.job.fetchedAt).label,
    isFresh: relativeAge(j.job.publishedAt ?? j.job.fetchedAt).fresh,
    sourceName: j.source?.displayName ?? "unbekannt",
    score: j.fit.score,
    band: j.fit.band,
    confidence: j.confidence.level,
    /*
     * Was die Zahl auf der Karte bedeutet.
     *
     * Ohne bestätigtes Profil gibt es keine Passung — und dann stand bei
     * JEDER Stelle derselbe Strich. Eine Liste, in der alle Zeilen
     * dasselbe anzeigen, ordnet nichts und sagt nichts.
     *
     * Die Jobqualität lässt sich dagegen aus der Anzeige selbst
     * beurteilen: Offenheit, Vertragsart, Flexibilität, Weiterbildung.
     * Sie steht deshalb ein, solange die Passung fehlt — mit eigenem
     * Etikett, damit niemand sie für eine Passung hält.
     */
    /* Transparenz der Anzeige, nicht die Arbeitsbedingungen — dieselbe
       Zahl wie im Kopf der Anzeige. */
    qualitaet: j.anzeige.score,
    /* Dritter Wert der Farbrechnung — dieselbe Formel wie im Kopf. */
    sicherheitWert: j.confidence.score,
    /*
     * Kurze Etiketten statt gekürzter Sätze.
     *
     * Hier standen `topReason` und `topReservation` — Mondays ganze
     * Sätze, in der Zeile auf `line-clamp-1` gestutzt und damit mitten
     * im Wort abgebrochen. Die vollständigen Sätze stehen weiterhin
     * rechts im Detail, wo Platz für sie ist.
     */
    signale: listensignale(j),
    blocked: j.constraints.overall === "blocked",
    /*
     * Nur die Namen, nicht die Begründungen.
     *
     * In einer Zeile ist Platz für „Gehalt nicht angegeben", nicht für
     * den ganzen Satz. Der steht auf der Detailseite. Zwei reichen —
     * bei drei Zeichen daneben liest niemand mehr eines davon.
     */
    offeneBedingungen: j.constraints.checks
      .filter((c) => c.verdict === "uncertain")
      .slice(0, 2)
      .map((c) => c.label),
    saved: savedIds.has(j.jobId),
  }));
}

/**
 * Die Referenz zu einer Stelle — Kennung vor Titel.
 *
 * Eine Stelle, zwei mögliche Quellen: Die amtliche Kennung ist ein
 * exakter Nachschlag, der normalisierte Titel eine Näherung. Ohne
 * diese Funktion stünde die Reihenfolge an mehreren Stellen und
 * könnte mehrfach auseinanderlaufen.
 */
export function referenzFinden(
  j: ScoredJob,
  nachKldb: Map<string, Entgeltreferenz>,
  nachTitel: Map<string, Entgeltreferenz>,
): Entgeltreferenz | null {
  const code = (j.job.kldb ?? "").replace(/\D/g, "").slice(0, 5);
  return (code.length === 5 ? nachKldb.get(code) : null) ?? nachTitel.get(j.job.title) ?? null;
}

/** Was in einer Zeile als Gehalt steht — echte Angabe oder Referenz. */
export function gehaltszeileFuer(
  j: ScoredJob,
  referenz: (j: ScoredJob) => Entgeltreferenz | null,
): { text: string; geschaetzt: boolean } | null {
  const a = gehaltsanzeige(j.job.salary);
  /*
   * „umgerechnet" gehört an die Zahl, nicht in eine Fussnote.
   *
   * Jede Angabe steht jetzt als Jahresgehalt — auch die, die in der
   * Anzeige pro Stunde oder pro Monat stand. Ohne den Zusatz sähe
   * eine hochgerechnete Zahl aus wie eine genannte, und der
   * Unterschied ist genau das, worauf es bei einem Gehalt ankommt.
   */
  if (a) return { text: a.umgerechnet ? `${a.betrag} (umgerechnet)` : a.betrag, geschaetzt: false };
  const r = referenz(j);
  if (!r) return null;
  const f = (n: number) => n.toLocaleString("de-DE");
  return { text: `ca. ${f(r.q1)} – ${f(r.q3)} €`, geschaetzt: true };
}
