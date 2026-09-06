import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Job } from "@paycheck/domain";
import { ladeAktuelleStelle } from "@/lib/lebenswert/speicher";
import { nettoAusBrutto } from "@/lib/lebenswert/netto";
import { vergleiche } from "@/lib/lebenswert/rechnung";
import { pendelrechnung } from "@/lib/lebenswert/pendelzeit";
import { stundenvergleich, stundenwert } from "@/lib/lebenswert/stundenwert";

/**
 * Was der Wechsel wirklich bringt.
 *
 * ── Die Frage, die ein Bruttogehalt nicht beantwortet ─────────
 *
 * „70.000 statt 63.000" klingt nach siebentausend. Nach Steuern sind es
 * vielleicht dreihundert Euro im Monat, und wenn der neue Weg täglich
 * zwanzig Minuten länger ist, kostet das im Jahr weitere fünfzig
 * Stunden.
 *
 * Beides zusammen ist die Auskunft, nach der jemand entscheidet — und
 * beides steht sonst nirgends. Die Jobseite zeigt ein Brutto, der
 * Nettorechner darunter eine zweite Zahl, und den Vergleich zum
 * jetzigen Leben muss man im Kopf machen.
 *
 * ── Warum sie nur mit Angaben erscheint ───────────────────────
 *
 * Ohne aktuelle Stelle gibt es nichts zu vergleichen. Dann steht hier
 * ein Satz und ein Verweis — keine Rechnung mit Annahmen, kein
 * „durchschnittliches Gehalt in Deutschland". Eine Differenz, die auf
 * einer erfundenen Gegenseite beruht, sieht genauso aus wie eine echte.
 */
export async function Wechselrechnung({ job }: { job: Job }) {
  const stelle = await ladeAktuelleStelle();

  /*
   * Vier Bedingungen, und alle vier sind nötig.
   *
   * Fehlt eine, wird nicht gerechnet — statt die Lücke mit einer
   * Annahme zu füllen, die niemand geprüft hat.
   */
  /*
   * Nur bei gleicher Währung.
   *
   * 70.000 CHF gegen 63.000 EUR ergibt eine Differenz von siebentausend
   * — und die ist frei erfunden. Ohne Umrechnungskurs, der irgendwo
   * herkommen und datiert sein müsste, gibt es hier keinen Vergleich,
   * und dann steht das da statt einer Zahl.
   */
  const waehrungPasst = stelle === null || stelle.currency.toUpperCase() === job.salary.currency.toUpperCase();

  /*
   * Die Spanne, nicht nur ihr unteres Ende.
   *
   * Die Zeile darüber nennt „46.120 € – 51.991 € netto". Darunter eine
   * einzelne Differenz zu zeigen, die still vom niedrigsten Wert
   * ausgeht, ist nicht bloss unvollständig — es sind zwei verschiedene
   * Auskünfte über dasselbe Gehalt, direkt untereinander.
   */
  const bruttoVon = jahresbrutto(job.salary.min ?? job.salary.max, job.salary.period);
  const bruttoBis = jahresbrutto(job.salary.max ?? job.salary.min, job.salary.period);
  const neuesBrutto = bruttoVon;
  const altesBrutto = stelle ? jahresbrutto(stelle.grossAmount, stelle.salaryPeriod) : null;

  if (!stelle || altesBrutto === null) {
    return (
      <Hinweis>
        Wenn du deine aktuelle Stelle hinterlegst, rechne ich dir aus, was ein Wechsel
        tatsächlich bringt — nach Steuern und Arbeitsweg, nicht nur beim Brutto.
      </Hinweis>
    );
  }

  if (!waehrungPasst) {
    return (
      <Hinweis>
        Diese Stelle zahlt in {job.salary.currency}, deine aktuelle in {stelle.currency}. Einen
        Wechselkurs habe ich nicht — deshalb rechne ich hier keinen Unterschied aus.
      </Hinweis>
    );
  }

  if (neuesBrutto === null) {
    return (
      <Hinweis>
        Für diese Stelle ist kein Gehalt angegeben. Sobald eines bekannt ist, vergleiche ich es
        mit deiner aktuellen Stelle.
      </Hinweis>
    );
  }

  const [neu, neuOben, alt] = await Promise.all([
    nettoAusBrutto(neuesBrutto, job.country || "DE"),
    nettoAusBrutto(bruttoBis ?? neuesBrutto, job.country || "DE"),
    nettoAusBrutto(altesBrutto, "DE"),
  ]);

  if (neu.nettoMonat === null || alt.nettoMonat === null) {
    return <Hinweis>{neu.grund ?? alt.grund ?? "Die Nettorechnung ist hier nicht möglich."}</Hinweis>;
  }

  const v = vergleiche({ nettoMonat: neu.nettoMonat }, { nettoMonat: alt.nettoMonat });
  const vOben =
    neuOben.nettoMonat !== null && neuOben.nettoMonat !== neu.nettoMonat
      ? vergleiche({ nettoMonat: neuOben.nettoMonat }, { nettoMonat: alt.nettoMonat })
      : null;

  /*
   * Die Zeit steht neben dem Geld, nicht darunter.
   *
   * Ein Wechsel, der 700 Euro mehr bringt und vierzig Stunden mehr
   * Pendeln kostet, ist keine reine Gehaltsfrage. Wer nur die Euros
   * sieht, entscheidet mit der halben Information.
   *
   * Was hier steht, ist die EINE Seite, die wir kennen: der jetzige
   * Weg, so wie er eingetragen wurde. Für die neue Stelle gibt es keine
   * Fahrzeit — kein Routingdienst ist angebunden, und in der Anzeige
   * steht sie nicht. Eine Differenz zu bilden hiesse, die andere Seite
   * zu erfinden, und sie ginge direkt in die Rechnung ein.
   */
  const jetzigerWeg =
    stelle.commuteMinutes !== null &&
    stelle.commuteMinutes > 0 &&
    stelle.officeDaysPerWeek !== null &&
    stelle.officeDaysPerWeek > 0
      ? pendelrechnung(stelle.commuteMinutes, stelle.officeDaysPerWeek)
      : null;

  /*
   * Und die Zahl, die zwei Stellen wirklich vergleicht.
   *
   * Netto je Monat ist die halbe Auskunft: Sie sagt nicht, wie viel
   * Lebenszeit dafür draufgeht. Mehr Gehalt bei mehr Stunden und
   * längerem Weg kann je aufgewendeter Stunde WENIGER sein — und genau
   * dieser Fall ist der Grund, warum es die Rechnung gibt.
   *
   * Beide Seiten müssen gleich gemessen sein, sonst gibt
   * `stundenvergleich` nichts zurück. Für die neue Stelle ist der Weg
   * unbekannt; also wird für beide ohne Weg gerechnet, und der Weg
   * steht als eigene Auskunft darunter.
   */
  const stundeNeu = stundenwert(neu.nettoMonat, job.weeklyHours ?? null).wert;
  const stundeNeuOben = stundenwert(neuOben.nettoMonat, job.weeklyHours ?? null).wert;
  const stundeAlt = stundenwert(alt.nettoMonat, stelle.weeklyHours).wert;
  const jeStunde = stundenvergleich(stundeNeu, stundeAlt);
  const jeStundeOben =
    stundeNeuOben && stundeNeuOben.proArbeitsstunde !== stundeNeu?.proArbeitsstunde
      ? stundenvergleich(stundeNeuOben, stundeAlt)
      : null;

  return (
    <section className="grid gap-4 rounded-(--radius-surface) bg-soft p-6">
      <div className="grid gap-1">
        <h3 className="text-sm font-semibold">Was der Wechsel bringt</h3>
        <p className="text-2xs text-ink-3">
          Gegenüber deiner aktuellen Stelle, nach Steuern.
        </p>
      </div>

      <Zeile
        name="Netto im Monat"
        wert={v.nettoUnterschiedMonat}
        bis={vOben?.nettoUnterschiedMonat}
        einheit="€"
        gut={v.nettoUnterschiedMonat > 0}
      />
      <Zeile
        name="Im Jahr"
        wert={v.nettoUnterschiedMonat * 12}
        bis={vOben ? vOben.nettoUnterschiedMonat * 12 : undefined}
        einheit="€"
        gut={v.nettoUnterschiedMonat > 0}
        leise
      />

      {stundeNeu && stundeAlt && jeStunde && (
        <div className="border-t border-line pt-3">
          <Zeile
            name="Je Arbeitsstunde"
            wert={jeStunde.unterschied}
            bis={jeStundeOben?.unterschied}
            einheit="€"
            gut={jeStunde.unterschied > 0}
            /*
             * Hier zählen die Cent.
             *
             * Bei einem Monatsbetrag sind Nachkommastellen Rauschen; bei
             * einem Stundensatz sind sie die Auskunft. „−5 €" und
             * „−4,56 €" führen zu verschiedenen Entscheidungen, und
             * gerundet sieht die Zahl schlimmer aus, als sie ist.
             */
            nachkomma={2}
          />
          <p className="mt-1.5 max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
            {/*
             * Dieselbe Spanne wie in der Zeile darüber.
             *
             * Nur das untere Ende zu nennen, während daneben eine
             * Spanne steht, sind zwei Auskünfte über dieselbe Stelle
             * — und die schlechtere der beiden gewinnt beim Überfliegen.
             */}
            {euro(stundeNeu.proArbeitsstunde)}
            {stundeNeuOben && stundeNeuOben.proArbeitsstunde !== stundeNeu.proArbeitsstunde
              ? ` – ${euro(stundeNeuOben.proArbeitsstunde)}`
              : ""}{" "}
            € gegenüber {euro(stundeAlt.proArbeitsstunde)} € — bei {job.weeklyHours} statt{" "}
            {stelle.weeklyHours} Wochenstunden. Der Arbeitsweg ist hier noch nicht eingerechnet.
          </p>
        </div>
      )}

      {(!stundeNeu || !stundeAlt) && (
        <p className="border-t border-line pt-3 max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
          {/*
           * Der häufige Fall, und deshalb ausgeschrieben.
           *
           * Ohne Wochenstunden auf beiden Seiten gibt es keinen
           * Stundenwert — und mit vierzig zu rechnen verfehlte eine
           * Teilzeitstelle um die Hälfte. Der Satz sagt, welche Seite
           * fehlt, damit klar ist, ob man sie selbst nachtragen kann
           * oder im Gespräch danach fragt.
           */}
          {!stundeAlt
            ? "Wie viel dir die Stelle je Stunde bringt, kann ich noch nicht sagen: Für deine aktuelle Stelle fehlen die Wochenstunden."
            : "Diese Anzeige nennt keine Wochenstunden. Ohne sie ist kein Stundenwert zu rechnen — eine gute Frage fürs Gespräch."}
        </p>
      )}

      <div className="border-t border-line pt-3">
        {jetzigerWeg ? (
          <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
            Dein jetziger Weg kostet dich{" "}
            <span className="font-mono tabular text-ink-2">
              {zahlText(jetzigerWeg.monatlichStunden)} Stunden
            </span>{" "}
            im Monat. Was diese Stelle an Weg kostet, weiss ich nicht — für sie ist keine Fahrzeit
            bekannt, und geschätzt ginge sie direkt in die Rechnung oben ein.
          </p>
        ) : (
          <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
            Der Arbeitsweg fehlt auf beiden Seiten. Er verschiebt das Ergebnis oft stärker als das
            Gehalt — deine Minuten und Bürotage stehen in der Lebenshaltung.
          </p>
        )}
      </div>

      <p className="text-2xs leading-relaxed text-ink-3">
        Gerechnet mit denselben Steuerangaben wie die Schätzung darüber. Kosten, die nur durch die
        Stelle entstehen — Fahrtkosten, Parken, Betreuung — sind hier noch nicht enthalten.
      </p>
    </section>
  );
}

function Hinweis({ children }: { children: React.ReactNode }) {
  return (
    <section className="grid gap-2 rounded-(--radius-surface) bg-soft p-6">
      <h3 className="text-sm font-semibold">Was der Wechsel bringt</h3>
      <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">{children}</p>
      <Link
        href="/app/settings/lebenshaltung"
        className="inline-flex min-h-6 w-fit items-center gap-1.5 text-sm text-accent-text underline underline-offset-[3px]"
      >
        Aktuelle Stelle hinterlegen
        <ArrowRight className="size-3.5" strokeWidth={1.9} />
      </Link>
    </section>
  );
}

function Zeile({
  name,
  wert,
  bis,
  einheit,
  gut,
  leise,
  nachkomma = 0,
}: {
  name: string;
  wert: number;
  /** Das obere Ende, wenn die Anzeige eine Gehaltsspanne nennt. */
  bis?: number;
  einheit: string;
  gut: boolean;
  leise?: boolean;
  nachkomma?: number;
}) {
  const zahl = (n: number) =>
    `${n > 0 ? "+" : ""}${new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: nachkomma,
      maximumFractionDigits: nachkomma,
    }).format(n)}`;
  const text =
    bis !== undefined && bis !== wert
      ? `${zahl(wert)} – ${zahl(bis)} ${einheit}`
      : `${zahl(wert)} ${einheit}`;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={leise ? "text-sm text-ink-3" : "text-sm text-ink-2"}>{name}</span>
      <span
        className={
          (leise ? "font-mono text-sm tabular " : "font-mono text-lg font-semibold tabular ") +
          /*
           * Grün nur bei einem echten Vorteil, sonst neutral.
           *
           * Kein Rot für einen Nachteil: Ein Wechsel, der weniger Geld
           * bringt, ist keine Fehlermeldung. Er kann aus zehn anderen
           * Gründen richtig sein, und diese Zahl soll ihn nicht
           * verurteilen.
           */
          (wert === 0 ? "text-ink-2" : gut ? "text-positive" : "text-ink")
        }
      >
        {text}
      </span>
    </div>
  );
}

/** Auf ein Jahr gerechnet — oder `null`, wenn der Zeitraum es nicht hergibt. */
function jahresbrutto(betrag: number | null, zeitraum: string): number | null {
  if (betrag === null) return null;
  if (zeitraum === "year") return betrag;
  if (zeitraum === "month") return betrag * 12;
  /*
   * Ein Stundenlohn wird NICHT hochgerechnet.
   *
   * Dafür bräuchte es die Wochenstunden, und die stehen selten in der
   * Anzeige. Mit vierzig zu rechnen wäre eine Annahme, die den Betrag
   * um ein Vielfaches verfehlen kann — bei einer Teilzeitstelle um mehr
   * als die Hälfte.
   */
  return null;
}

function euro(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function zahlText(n: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(n);
}
