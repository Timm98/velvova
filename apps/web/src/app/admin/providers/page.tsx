import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import {
  ApifyAdapter,
  BrightDataAdapter,
  CoresignalEnrichment,
  JSearchAdapter,
  TheirStackAdapter,
  nutzung,
} from "@paycheck/jobs";
import { Badge, Card } from "@/components/ui";
import { PageHeader } from "@/components/ui/states";

export const metadata: Metadata = { title: "Job-Anbieter" };
export const dynamic = "force-dynamic";

/**
 * Was die Job-Anbieter gerade tun.
 *
 * ── Was hier NICHT steht ──────────────────────────────────────
 *
 * Kein Schlüssel, auch nicht gekürzt. Ein Präfix reicht, um einen
 * Schlüssel in einem Leck wiederzuerkennen, und diese Seite ist zum
 * Anschauen und Weiterreichen gedacht. Es steht nur, OB einer
 * hinterlegt ist.
 *
 * ── Warum „eingerichtet" und „antwortet" getrennt sind ────────
 *
 * Ein Anbieter kann einen gültigen Schlüssel haben und trotzdem nichts
 * liefern — weil der Plan den Endpunkt nicht hergibt, weil kein
 * Datensatz freigegeben ist, weil ein Actor gesperrt ist. Eine einzige
 * Ampel würde all das zu „rot" verschmelzen und die Frage „woran liegt
 * es" unbeantwortet lassen.
 *
 * Die Zählung läuft im Arbeitsspeicher und beginnt beim Start des
 * Servers neu. Deshalb steht der Bezugszeitpunkt dabei: eine Zahl ohne
 * ihn lädt dazu ein, sie für den Tageswert zu halten.
 */
/**
 * Zugang: nur Betrieb.
 *
 * Diese Prüfung fehlte. Die Seite lag im Verzeichnis `admin`, trug den
 * Titel eines Betriebswerkzeugs — und war für jede angemeldete Person
 * erreichbar. Die Geschwisterseiten `/admin` und `/admin/reviews`
 * prüften die Rolle seit jeher; diese beiden nicht.
 *
 * Aufgefallen ist es nicht beim Lesen des Codes, sondern beim Abgehen
 * aller 45 Routen mit einem frisch angelegten, ganz gewöhnlichen Konto:
 * zwei Seiten unter `/admin` antworteten mit 200 statt mit 404.
 *
 * 404 und nicht 403: Ein 403 bestätigt, dass es die Seite gibt.
 */
export default async function Seite() {
  const user = await requireUser();
  const { flags } = await getPageContext();
  if (!flags.adminArea || (user.role !== "operator" && user.role !== "admin")) {
    notFound();
  }

  const { seit, zeilen } = nutzung();
  const zahlenJe = new Map(zeilen.map((z) => [z.provider, z]));

  const theirstack = new TheirStackAdapter();
  const jsearch = new JSearchAdapter();
  const bright = new BrightDataAdapter();
  const apify = new ApifyAdapter();
  const coresignal = new CoresignalEnrichment();

  const anbieter = [
    {
      name: "TheirStack",
      zaehlname: "TheirStack",
      schluessel: "THEIRSTACK_API_KEY",
      hat: theirstack.isConfigured(),
      bereit: theirstack.isConfigured(),
      zweck: "Stellen, strukturiert. Erste Reihe.",
      hinweis: theirstack.isConfigured() ? null : "Kein Schlüssel hinterlegt.",
    },
    {
      name: "JSearch",
      zaehlname: "JSearch",
      schluessel: "RAPIDAPI_KEY",
      hat: jsearch.isConfigured(),
      bereit: jsearch.isConfigured(),
      zweck: "Stellen, Sammelstelle. Erste Reihe.",
      hinweis: jsearch.isConfigured() ? null : "Kein Schlüssel hinterlegt.",
    },
    {
      name: "Bright Data",
      zaehlname: "Bright Data",
      schluessel: "BRIGHT_DATA_API_KEY",
      hat: bright.hatSchluessel(),
      bereit: bright.isConfigured(),
      zweck: "Stellen aus einem freigegebenen Datensatz. Zweite Reihe.",
      hinweis: bright.hatSchluessel()
        ? bright.isConfigured()
          ? null
          : "Schlüssel vorhanden, aber BRIGHT_DATA_DATASET_ID ist leer. Ohne ausdrücklich freigegebenen Datensatz wird nichts abgerufen."
        : "Kein Schlüssel hinterlegt.",
    },
    {
      name: "Apify",
      zaehlname: "Apify",
      schluessel: "APIFY_TOKEN",
      hat: apify.hatToken(),
      bereit: apify.isConfigured(),
      zweck: "Stellen aus freigegebenen Actors. Zweite Reihe.",
      hinweis: !apify.hatToken()
        ? "Kein Token hinterlegt."
        : apify.gesperrteActors().length > 0
          ? `Eingetragen, aber gesperrt: ${apify.gesperrteActors().map((g) => `${g.actor} (zielt auf ${g.ziel})`).join(", ")}. Das automatisierte Auslesen dieser Quellen ist untersagt.`
          : apify.erlaubteActors().length === 0
            ? "Token vorhanden, APIFY_ACTORS ist leer. Ein Token ist keine Erlaubnis — ohne freigegebenen Actor wird nichts abgerufen."
            : `Freigegeben: ${apify.erlaubteActors().join(", ")}`,
    },
    {
      name: "Coresignal",
      zaehlname: "Coresignal",
      schluessel: "CORESIGNAL_API_KEY",
      hat: coresignal.isConfigured(),
      bereit: coresignal.isConfigured(),
      zweck: "Unternehmen anreichern. Nur für geöffnete Stellen, nie für die ganze Liste.",
      hinweis: coresignal.isConfigured() ? null : "Kein Schlüssel hinterlegt.",
    },
  ];

  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-8 px-5 py-10 md:px-8">
      <PageHeader
        title="Job-Anbieter"
        lead={`${anbieter.filter((a) => a.bereit).length} von ${anbieter.length} einsatzbereit. Gezählt seit ${seit.toLocaleString("de-DE")} — die Zahlen beginnen bei jedem Serverstart neu.`}
      />

      <div className="grid gap-4">
        {anbieter.map((a) => {
          const z = zahlenJe.get(a.zaehlname);
          return (
            <Card key={a.name} className="grid gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold">{a.name}</h2>
                <Badge tone={a.bereit ? "positive" : a.hat ? "caution" : "outline"}>
                  {a.bereit ? "einsatzbereit" : a.hat ? "eingerichtet, aber nicht nutzbar" : "kein Schlüssel"}
                </Badge>
                {/* Nur ob, nie welcher. */}
                <span className="text-sm text-ink-3">
                  {a.schluessel}: {a.hat ? "hinterlegt" : "fehlt"}
                </span>
              </div>

              <p className="text-sm text-ink-2">{a.zweck}</p>
              {a.hinweis && <p className="text-sm leading-relaxed text-ink-2">{a.hinweis}</p>}

              {z ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-ink-3">Anfragen</dt>
                    <dd>{z.anfragen}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">Fehler</dt>
                    <dd>
                      {z.fehler}
                      {Object.keys(z.codes).length > 0 && (
                        <span className="text-ink-3">
                          {" "}
                          ({Object.entries(z.codes).map(([c, n]) => `${c}×${n}`).join(", ")})
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">Gelieferte Sätze</dt>
                    <dd>{z.stellen}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">Mittlere Dauer</dt>
                    <dd>{z.mittlereDauer !== null ? `${z.mittlereDauer} ms` : "—"}</dd>
                  </div>
                  <div className="col-span-2 sm:col-span-4">
                    <dt className="text-ink-3">Letzte erfolgreiche Antwort</dt>
                    <dd>{z.letzterErfolg ? z.letzterErfolg.toLocaleString("de-DE") : "noch keine"}</dd>
                  </div>
                  {z.letzterFehler && (
                    <div className="col-span-2 sm:col-span-4">
                      <dt className="text-ink-3">
                        Letzter Fehler ({z.letzterFehler.zeitpunkt.toLocaleString("de-DE")})
                      </dt>
                      <dd className="break-words">{z.letzterFehler.text}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-ink-3">
                  Seit dem Start noch nicht angefragt.
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <p className="max-w-prose text-sm leading-relaxed text-ink-3">
        Ein echter Abruf gegen alle Anbieter — mit Statuscodes und den tatsächlich gelieferten
        Feldern — läuft über <code className="text-ink-2">node scripts/provider-smoketest.mjs</code>.
        Diese Seite zeigt nur, was der laufende Server bisher getan hat.
      </p>
    </div>
  );
}
