import Link from "next/link";
import { AMPELTON } from "@/lib/jobs/befundton";
import { vorgabenampel, vorgabensatz } from "@/lib/jobs/vorgabenampel";
import { AlertTriangle, ArrowRight, Bike, Car, Footprints } from "lucide-react";
import type { Job } from "@paycheck/domain";
import { arbeitswegBerechnen } from "@/lib/geo/arbeitsweg";
import { WOCHEN_JE_MONAT } from "@/lib/lebenswert/pendelzeit";

/**
 * Dein Arbeitsweg — echte Fahrzeit, keine Luftlinie.
 *
 * ── Warum das lange gefehlt hat ───────────────────────────────
 *
 * Es gab keinen Routing-Dienst, und aus der Entfernung eine Zeit zu
 * schätzen wäre der naheliegende Fehler gewesen: Zwischen zwei Punkten
 * derselben Stadt liegt je nach Verbindung eine Viertel- oder eine
 * Dreiviertelstunde. Beide Zahlen sähen gleich seriös aus, und eine
 * davon ginge direkt in die Frage ein, ob jemand diesen Weg jeden Tag
 * fahren will.
 *
 * Jetzt liegt einer an — mit Zwischenspeicher davor, damit dieselbe
 * Strecke genau einmal erfragt wird.
 *
 * ── Warum nur Auto ────────────────────────────────────────────
 *
 * Der öffentliche Dienst antwortet auf jedes Profil mit der Autoroute.
 * Rad und zu Fuss zu zeigen hiesse, dreimal dieselbe Zahl unter drei
 * Überschriften zu setzen. Mit eigenem Dienst (`ROUTING_URL`) kommen
 * sie dazu, ohne dass sich hier etwas ändert.
 *
 * ── Warum ohne Wohnort ein Knopf steht und nicht nichts ───────
 *
 * Ein fehlender Abschnitt sieht aus wie ein fehlendes Feature. Ein
 * Knopf sagt, dass es das Feature gibt und woran es hängt.
 */

const SYMBOL = { auto: Car, rad: Bike, fuss: Footprints } as const;
const NAME: Record<string, string> = {
  auto: "Auto",
  oepnv: "ÖPNV",
  rad: "Fahrrad",
  /* E-Bike und Roller nehmen dieselben Wege und sind ähnlich schnell. */
  roller: "Roller / E-Bike",
  fuss: "Zu Fuss",
};

export async function Arbeitswegblock({
  job,
  wohnort,
  buerotage = 5,
  maxPendelzeit = null,
}: {
  job: Pick<Job, "location" | "country" | "latitude" | "longitude">;
  wohnort: string | null;
  /** Wie oft jemand tatsächlich hinfährt. */
  buerotage?: number;
  /**
   * Die eigene Obergrenze in Minuten — Massstab für die Farbe.
   *
   * `null` heisst nicht „egal", sondern „nicht festgelegt". Dann
   * bleibt die Zahl grau statt eingefärbt.
   */
  maxPendelzeit?: number | null;
}) {
  const befund = await arbeitswegBerechnen(wohnort, job.location, job.country, {
    lat: job.latitude,
    lon: job.longitude,
  });

  if (befund.grund === "kein_wohnort") {
    return (
      <Rahmen>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Trag deinen Wohnort ein, dann rechne ich den Weg zu dieser Stelle aus — und was er dich
          im Monat an Zeit kostet.
        </p>
        <Link
          href="/app/settings/language-region"
          className="inline-flex min-h-8 w-fit items-center gap-1.5 text-sm text-accent-text underline underline-offset-[3px]"
        >
          Wohnort hinzufügen
          <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.9} />
        </Link>
      </Rahmen>
    );
  }

  if (befund.strecken.length === 0) {
    const text =
      befund.grund === "jobort_unbekannt"
        ? `Den Ort „${job.location}“ konnte ich nicht auf der Karte finden — dafür ist die Angabe zu ungenau.`
        : befund.grund === "wohnort_unbekannt"
          ? "Deinen Wohnort konnte ich nicht auf der Karte finden. Eine Stadt oder Postleitzahl genügt."
          : "Zwischen den beiden Orten habe ich keine Route gefunden.";
    return (
      <Rahmen>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">{text}</p>
      </Rahmen>
    );
  }

  const auto = befund.strecken.find((s) => s.modus === "auto") ?? befund.strecken[0]!;
  /*
   * Hin UND zurück, mal Bürotage, mal Wochen je Monat.
   *
   * Die einfache Zahl („32 Minuten") beantwortet „wie weit ist das".
   * Die zusammengesetzte beantwortet „was kostet mich das" — und danach
   * entscheidet man.
   */
  const stundenMonat = Math.round(((auto.minuten * 2 * buerotage * WOCHEN_JE_MONAT) / 60) * 10) / 10;

  /*
   * Die Farbe einer Fahrzeit — gemessen an der eigenen Grenze.
   *
   * `vorgabenampel` kennt die Richtung: Bei der Pendelzeit ist weniger
   * besser, beim Gehalt mehr. Ohne Grenze gibt sie `null` zurück, und
   * dann bleibt die Zahl grau — eine Fahrzeit einzufärben, für die
   * niemand ein Ziel genannt hat, wäre ein Urteil, das wir uns
   * anmassen.
   */
  const farbeFuer = (minuten: number) => {
    const stufe = vorgabenampel(minuten, maxPendelzeit ?? null, "niedriger_besser");
    return stufe === null ? "text-ink" : AMPELTON[stufe].text;
  };

  /*
   * Der Satz zum Vergleich, wenn eine Grenze hinterlegt ist.
   *
   * Die Farbe allein sagt „zu weit", aber nicht um wie viel. Bei einer
   * Entscheidung über einen täglichen Weg ist genau das die Zahl, die
   * zählt — zehn Minuten über der Grenze sind etwas anderes als
   * vierzig.
   */
  const vergleich = vorgabensatz(
    auto.minuten,
    maxPendelzeit ?? null,
    "niedriger_besser",
    (n) => `${Math.round(n)} Minuten`,
  );

  /*
   * Warnzeichen nur bei „rot".
   *
   * Nicht ab einer festen Dauer: Vierzig Minuten sind für die eine
   * Person unzumutbar und für die andere die halbe bisherige Fahrt.
   * Ohne hinterlegte Grenze gibt es kein Zeichen — eine Warnung ohne
   * Massstab ist eine Meinung.
   *
   * Auch nicht bei knapper Überschreitung: Dort steht „gelb", und ein
   * Ausrufezeichen für sieben Minuten wäre der Anfang vom Ende jeder
   * Warnung.
   */
  const problematisch =
    vorgabenampel(auto.minuten, maxPendelzeit ?? null, "niedriger_besser") === "rot";

  return (
    <Rahmen>
      <h3 id="arbeitsweg-panel" className="flex items-center gap-2 abschnitts-titel text-ink-3">
        Dein Arbeitsweg
        {problematisch && (
          <span className="inline-flex items-center text-caution">
            <AlertTriangle aria-hidden className="size-3.5" strokeWidth={2.2} />
            <span className="sr-only">Der Weg liegt deutlich über deiner Grenze.</span>
          </span>
        )}
      </h3>

      <ul className="grid gap-2.5">
        {befund.strecken.map((s) => {
          const Symbol = SYMBOL[s.modus as keyof typeof SYMBOL] ?? Car;
          return (
            <li key={s.modus} className="flex items-baseline justify-between gap-4">
              <span className="flex items-center gap-2 text-sm text-ink-2">
                <Symbol aria-hidden className="size-4 shrink-0" strokeWidth={1.8} />
                {NAME[s.modus]}
              </span>
              {/*
                Die Zeit trägt die Farbe deiner eigenen Grenze.
                
                Nicht einer festen Skala: Vierzig Minuten sind für die
                eine Person unzumutbar und für die andere die halbe
                bisherige Fahrt. Eine allgemeine Schwelle gäbe es nur,
                wenn wir beschlössen, was viel ist — und das steht uns
                nicht zu.
                
                Ohne hinterlegte Wunschzeit bleibt die Zahl neutral.
              */}
              <span className="font-mono text-[15px] tabular">
                <span className={farbeFuer(s.minuten)}>{s.minuten} Min.</span>
                <span className="ml-2 text-2xs text-ink-3">{s.kilometer} km</span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="border-t border-line pt-3 text-sm leading-relaxed text-ink-2">
        Bei {buerotage} {buerotage === 1 ? "Tag" : "Tagen"} vor Ort in der Woche sind das{" "}
        {/*
          Die Monatsstunden tragen dieselbe Farbe wie die Fahrzeit
          darüber.
          
          Sie sind dieselbe Aussage, nur hochgerechnet: Wer über seiner
          Grenze liegt, liegt es auch im Monat. Sie neutral zu lassen,
          während die Zeile darüber rot ist, sähe aus, als wären es
          zwei verschiedene Befunde.
        */}
        <span className={"font-mono font-semibold tabular " + farbeFuer(auto.minuten)}>
          {stundenMonat.toLocaleString("de-DE", { maximumFractionDigits: 0 })} Stunden
        </span>{" "}
        Pendeln im Monat — hin und zurück gerechnet.
      </p>

      {vergleich && (
        <p className={"text-sm leading-relaxed " + farbeFuer(auto.minuten)}>{vergleich}</p>
      )}

      <p className="text-2xs leading-relaxed text-ink-3">
        Fahrzeit über OpenStreetMap, ohne Verkehrslage. Der Weg zum tatsächlichen Arbeitsplatz kann
        abweichen, wenn die Anzeige nur die Stadt nennt.
      </p>
    </Rahmen>
  );
}

function Rahmen({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3">{children}</div>;
}
