import { WISSENSFELDER } from "../naechstefrage.ts";
import { ANSPRECHEN_AB } from "../widersprueche.ts";
import type { Gelegenheit } from "./engine.ts";
import {
  neuheitNach,
  nochEinAnlauf,
  relevanz,
  RELEVANZ_SCHWELLE,
  type Relevanzlage,
} from "./relevanz.ts";

/**
 * Was Nina über einen Menschen weiss — und wann sie es anspricht.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Naht zwischen zwei Systemen
 * ══════════════════════════════════════════════════════════════
 *
 * Die Intelligenzschicht erkennt Widersprüche, Wissenslücken und
 * Uneinigkeit zwischen zwei Analyseläufen. Sie schrieb sie bisher in
 * `profil_klaerungen` — und dort blieben sie liegen. Die
 * Proaktiv-Engine wiederum wusste nur von Klicks auf Stellenanzeigen.
 *
 * Zwei fertige Systeme, die einander nicht kannten. Diese Datei ist
 * die Naht: Sie übersetzt Erkenntnisse in Gelegenheiten, damit sie
 * durch dieselbe Prüfung gehen wie alles andere — Handlungsklasse,
 * Zurückhaltung, Rücknahme, Protokoll.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum keine davon `auto_allowed` ist
 * ══════════════════════════════════════════════════════════════
 *
 * Weil alle drei Fragen sind. Ein Widerspruch wird angesprochen, nicht
 * aufgelöst; eine Lücke wird erfragt, nicht geschätzt; eine
 * Uneinigkeit wird zugegeben, nicht durch das teurere Modell
 * entschieden.
 *
 * Was daraus folgt, ist eine Aussage der Person über sich selbst —
 * und die kann Nina nicht an ihrer Stelle treffen.
 */

export interface Klaerungsstand {
  /** frage · widerspruch */
  art: string;
  schluessel: string;
  frage: string;
  /** Bei Widersprüchen: wie stark. Bei Fragen: `null`. */
  staerke: number | null;
  /** Wie oft dieselbe Klärung schon angesprochen wurde. */
  malGezeigt: number;
}

/**
 * Was gerade sonst noch los ist.
 *
 * ── Warum die Frage vom Kontext abhängt ───────────────────────
 *
 * „Was musst du mindestens verdienen?" ist eine gute Frage, wenn
 * jemand Stellen durchsieht. Mitten in einer Bewerbung ist es eine
 * Unterbrechung, und die Antwort fällt schlechter aus, weil die
 * Person schnell weiterwill.
 */
export interface Erkenntniskontext {
  /**
   * Womit die Person gerade beschäftigt ist.
   *
   * `null` heisst: nichts Bestimmtes — dann ist alles zulässig.
   */
  beschaeftigtMit?: "bewerbung" | "stellensuche" | "gespraech" | null;
  /**
   * Ob die Karriereanalyse an genau dieser einen Angabe hängt.
   *
   * Der Fall aus dem Auftrag: „Karriereentscheidung blockiert durch
   * genau eine wichtige Information." Dann ist die Frage nicht
   * Neugier, sondern der Weg aus der Sackgasse.
   */
  analyseBlockiert?: boolean;
  /** Der Hinweis aus einer uneinigen Karriereanalyse, falls es einen gibt. */
  unsicherheit?: string | null;
}

/**
 * Wie schwer eine Wissenslücke wiegt.
 *
 * Aus dem Gewicht des Wissensfeldes, nicht aus einer eigenen Zahl:
 * `arbeitsort` wiegt 10, `entwicklung` wiegt 4 — und genau dieser
 * Unterschied entscheidet, ob gefragt wird. Eine zweite Rangfolge
 * daneben würde irgendwann von der ersten abweichen.
 */
function feldgewicht(schluessel: string): number {
  const feld = WISSENSFELDER.find((f) => f.schluessel === schluessel);
  return (feld?.gewicht ?? 5) / 10;
}

export interface Erkenntnisgelegenheit extends Gelegenheit {
  /** Woran die Klärung hängt — der Schlüssel für die Entdopplung. */
  schluessel: string;
  relevanz: number;
}

/**
 * Aus offenen Klärungen werden Gelegenheiten.
 *
 * Was unter der Schwelle bleibt, kommt gar nicht erst zurück: Eine
 * Gelegenheit, die niemals gezeigt werden darf, ist ein Eintrag ohne
 * Zweck.
 */
export function gelegenheitenAusKlaerungen(
  klaerungen: readonly Klaerungsstand[],
  kontext: Erkenntniskontext = {},
): Erkenntnisgelegenheit[] {
  const raus: Erkenntnisgelegenheit[] = [];

  for (const k of klaerungen) {
    /* Einmal fragen, einmal nachfassen, dann still sein. */
    if (!nochEinAnlauf(k.malGezeigt)) continue;
    const neuheit = neuheitNach(k.malGezeigt);

    if (k.art === "widerspruch") {
      /*
       * Die Schwelle des Widerspruchsmoduls gilt weiter.
       *
       * `profil_klaerungen` hält JEDEN erkannten Widerspruch, auch die
       * schwachen — dort ist es ein Befund, kein Vorhaben. Ob er
       * angesprochen wird, entscheidet `ANSPRECHEN_AB`, und diese
       * Zahl gehört zum Widerspruchsmodul.
       *
       * Ohne diese Zeile hätte die Relevanzrechnung eine zweite,
       * niedrigere Schwelle danebengestellt — und ein Widerspruch aus
       * drei schwachen Hinweisen wäre zu einer Rückfrage geworden.
       * Das ist eine Unterstellung, und dagegen war die Zahl gedacht.
       */
      if ((k.staerke ?? 0) < ANSPRECHEN_AB) continue;

      /*
       * Eine Beobachtung und eine Frage — keine Anschuldigung.
       *
       * Der Wortlaut steht bereits in der Klärung; er wurde beim
       * Erkennen des Widerspruchs formuliert und ist dort belegt.
       * Ihn hier neu zu bauen ergäbe zwei Fassungen derselben Frage.
       */
      const lage: Relevanzlage = {
        /*
         * Ein Widerspruch wiegt schwerer als eine Wissenslücke.
         *
         * Nicht weil er interessanter wäre, sondern weil er die
         * Empfehlungen VERFÄLSCHT, die schon laufen: Solange unklar
         * ist, ob Vertrieb ausgeschlossen bleibt, ist jede Stelle in
         * der Liste auf Sand gebaut. Eine fehlende Angabe macht die
         * Empfehlungen nur gröber.
         *
         * Die Zahl hält damit dieselbe Reihenfolge wie `FRAGENRANG`
         * in `meldung.ts`. Zwei Rangfolgen, die sich widersprechen,
         * wären ein Fehler, den man erst im Betrieb sieht.
         */
        wirkung: 0.8,
        konfidenz: k.staerke ?? 0.5,
        neuheit,
        dringlichkeit: 0.4,
        handelbar: true,
        /* Mitten in einer Bewerbung ist das die falsche Unterhaltung. */
        passtZumKontext: kontext.beschaeftigtMit !== "bewerbung",
        schonGezeigt: false,
      };
      const wert = relevanz(lage);
      if (wert < RELEVANZ_SCHWELLE) continue;

      raus.push({
        handlung: "klaerung_ansprechen",
        begruendung:
          "Eine ausdrückliche Angabe und dein bisheriges Verhalten passen nicht zusammen.",
        jobId: null,
        belegEreignisse: [],
        brauchtZustimmung: true,
        dringlichkeit: "mittel",
        nachricht: k.frage,
        schluessel: k.schluessel,
        relevanz: wert,
      });
      continue;
    }

    if (k.art === "frage") {
      const lage: Relevanzlage = {
        wirkung: kontext.analyseBlockiert ? 0.9 : feldgewicht(k.schluessel),
        /*
         * Dass die Angabe fehlt, ist sicher. Dass GENAU DIESE die
         * nützlichste ist, ist eine Rangordnung aus acht Feldern —
         * gut begründet, aber keine Messung.
         */
        konfidenz: kontext.analyseBlockiert ? 0.9 : 0.6,
        neuheit,
        dringlichkeit: kontext.analyseBlockiert ? 0.7 : 0.2,
        handelbar: true,
        /*
         * Wer gerade eine Bewerbung schreibt, beantwortet keine
         * Profilfrage. Wer Stellen durchsieht, sehr wohl — dort hilft
         * die Antwort unmittelbar.
         */
        passtZumKontext: kontext.beschaeftigtMit !== "bewerbung",
        schonGezeigt: false,
      };
      const wert = relevanz(lage);
      if (wert < RELEVANZ_SCHWELLE) continue;

      raus.push({
        handlung: "wissensluecke_fragen",
        begruendung: kontext.analyseBlockiert
          ? "Ohne diese Angabe kann ich dir keine belastbare Einschätzung geben."
          : "Diese Angabe fehlt mir, und sie ändert viel an dem, was ich dir zeige.",
        jobId: null,
        belegEreignisse: [],
        brauchtZustimmung: true,
        dringlichkeit: kontext.analyseBlockiert ? "hoch" : "niedrig",
        nachricht: k.frage,
        schluessel: k.schluessel,
        relevanz: wert,
      });
    }
  }

  /* ── Die Uneinigkeit zweier Läufe ─────────────────────────── */
  if (kontext.unsicherheit) {
    const lage: Relevanzlage = {
      /* Eine Einschätzung, auf die sich niemand verlassen kann, wiegt schwer. */
      wirkung: 0.8,
      konfidenz: 0.7,
      neuheit: 1,
      dringlichkeit: 0.3,
      handelbar: true,
      passtZumKontext: kontext.beschaeftigtMit !== "bewerbung",
      schonGezeigt: false,
    };
    const wert = relevanz(lage);
    if (wert >= RELEVANZ_SCHWELLE) {
      raus.push({
        handlung: "unsicherheit_melden",
        begruendung: "Zwei Durchgänge kommen zu verschiedenen Ergebnissen.",
        jobId: null,
        belegEreignisse: [],
        brauchtZustimmung: true,
        dringlichkeit: "mittel",
        nachricht: kontext.unsicherheit,
        schluessel: "karriere:unsicherheit",
        relevanz: wert,
      });
    }
  }

  return raus.sort((a, b) => b.relevanz - a.relevanz);
}

/* ═══════════════════════════════════════════════════════════════
   Was die Stellenlage beiträgt
   ═══════════════════════════════════════════════════════════════ */

export interface HarterKonflikt {
  jobId: string;
  titel: string;
  /** Der verletzte Punkt, in der Sprache der Person. */
  einwand: string;
  /** Wie gut die Stelle abgesehen davon passt, 0 bis 100. */
  passung: number;
}

export interface Stellenlage {
  harteKonflikte: readonly HarterKonflikt[];
  /** Neue Stellen, die deutlich besser passen als das Übliche. */
  starkeTreffer: readonly { jobId: string; titel: string; passung: number }[];
}

/**
 * Ab welcher Passung eine blockierte Stelle es wert ist, sie zu erwähnen.
 *
 * ── Warum überhaupt eine Grenze ───────────────────────────────
 *
 * Weil fast jede Stelle irgendeine Bedingung verletzt. „Diese Stelle
 * zahlt zu wenig" ist erst dann eine Nachricht, wenn die Stelle
 * ansonsten ungewöhnlich gut passt — sonst ist es der Normalfall der
 * Stellensuche, und den kennt die Person selbst.
 */
export const KONFLIKT_AB_PASSUNG = 75;

/** Ab welcher Passung ein Treffer als stark gilt. */
export const TREFFER_AB_PASSUNG = 80;

/** Wie viele starke Treffer zusammenkommen müssen, damit Nina es sagt. */
export const TREFFER_AB_ANZAHL = 3;

/**
 * Aus der Stellenlage werden Gelegenheiten.
 *
 * ── Warum der Gehaltsfall zu `gehalt_lockern` führt ───────────
 *
 * Weil daraus eine echte Entscheidung folgt: Die Untergrenze bleibt,
 * oder sie fällt. Eine eigene Handlungsart „Konflikt melden" wäre
 * eine Nachricht ohne Ausgang — und die Person müsste selbst
 * herausfinden, was sie damit anfangen soll.
 */
export function gelegenheitenAusStellenlage(
  lage: Stellenlage,
  kontext: Erkenntniskontext = {},
): Erkenntnisgelegenheit[] {
  const raus: Erkenntnisgelegenheit[] = [];

  for (const k of lage.harteKonflikte) {
    if (k.passung < KONFLIKT_AB_PASSUNG) continue;

    const r: Relevanzlage = {
      /* Eine sehr gut passende Stelle, die an einer Bedingung scheitert. */
      wirkung: 0.9,
      konfidenz: 0.95,
      neuheit: 1,
      /* Anzeigen laufen ab. Das ist der eine Fall, in dem es wirklich eilt. */
      dringlichkeit: 0.8,
      handelbar: true,
      passtZumKontext: true,
      schonGezeigt: false,
    };
    const wert = relevanz(r);
    if (wert < RELEVANZ_SCHWELLE) continue;

    raus.push({
      handlung: "gehalt_lockern",
      begruendung: `„${k.titel}" passt zu ${k.passung} von 100 — aber ${k.einwand}`,
      jobId: k.jobId,
      belegEreignisse: [],
      brauchtZustimmung: true,
      dringlichkeit: "hoch",
      nachricht:
        `Eine Stelle passt ungewöhnlich gut zu dir, verletzt aber eine deiner Bedingungen: ` +
        `„${k.titel}" — ${k.einwand} Soll ich sie dir trotzdem zeigen?`,
      schluessel: `konflikt:${k.jobId}`,
      relevanz: wert,
    });
  }

  const stark = lage.starkeTreffer.filter((t) => t.passung >= TREFFER_AB_PASSUNG);
  if (stark.length >= TREFFER_AB_ANZAHL) {
    const r: Relevanzlage = {
      wirkung: 0.7,
      konfidenz: 0.85,
      neuheit: 1,
      dringlichkeit: 0.5,
      handelbar: true,
      passtZumKontext: kontext.beschaeftigtMit !== "bewerbung",
      schonGezeigt: false,
    };
    const wert = relevanz(r);
    if (wert >= RELEVANZ_SCHWELLE) {
      raus.push({
        handlung: "treffer_melden",
        begruendung: `${stark.length} neue Stellen passen deutlich besser als das Übliche.`,
        jobId: null,
        belegEreignisse: [],
        brauchtZustimmung: false,
        dringlichkeit: "mittel",
        nachricht: `${stark.length} neue Stellen passen ungewöhnlich gut zu dem, was du suchst.`,
        schluessel: `treffer:${stark.map((t) => t.jobId).sort().join(",").slice(0, 200)}`,
        relevanz: wert,
        stellen: stark.map((t) => t.jobId),
      });
    }
  }

  return raus.sort((a, b) => b.relevanz - a.relevanz);
}
