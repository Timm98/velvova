import type { Metadata } from "next";
import { SCORING_VERSION } from "@paycheck/domain";
import { DEFAULT_FIT_WEIGHTS, DEFAULT_RANKING_WEIGHTS } from "@paycheck/matching";
import { Card, Stack } from "@/components/ui";

export const metadata: Metadata = { title: "Methodik" };

/**
 * Die Methodik offen darlegen.
 *
 * Wer eine Zahl zeigt, sollte sagen koennen, wie sie entsteht. Die
 * Gewichte hier kommen aus dem Code, nicht aus einer Tabelle im Text -
 * eine Aenderung der Logik aendert diese Seite mit.
 */
export default function MethodologyPage() {
  const fitRows: [string, number, string][] = [
    ["Belegte Faehigkeiten und Qualifikationen", DEFAULT_FIT_WEIGHTS.provenSkills,
     "Abgleich der bestaetigten Erfahrungen mit den Muss- und Kann-Anforderungen. Muss zaehlt dreifach."],
    ["Taetigkeiten, die Energie geben", DEFAULT_FIT_WEIGHTS.preferredTasks,
     "Vergleich der Kernaufgaben mit dem, was Energie gibt und was auslaugt."],
    ["Arbeitsweise und Umfeld", DEFAULT_FIT_WEIGHTS.workStyle,
     "Bevorzugte Arbeitsweise gegen die Beschreibung der Stelle."],
    ["Werte und Motive", DEFAULT_FIT_WEIGHTS.valuesAndMotives,
     "Die wichtigsten Werte gegen das, was die Stelle ausdruecklich bietet."],
    ["Entwicklungspotenzial", DEFAULT_FIT_WEIGHTS.growthPotential,
     "Wie gross der Schritt vom heutigen Stand aus waere. Ein Schritt nach oben zaehlt am meisten."],
    ["Umsetzbarkeit", DEFAULT_FIT_WEIGHTS.marketRealism,
     "Anteil der zwingenden Anforderungen, die heute schon erfuellt sind."],
    ["Ausdrueckliches Interesse", DEFAULT_FIT_WEIGHTS.statedInterest,
     "Naehe zu den selbst genannten Zielrollen."],
  ];

  return (
    <Stack gap={7}>
      <header>
        <h1 style={{ fontSize: "var(--text-3xl)", lineHeight: "var(--leading-3xl)" }}>Methodik</h1>
        <p style={{ marginTop: "var(--space-4)", fontSize: "var(--text-lg)", color: "var(--text-secondary)" }}>
          Wie die Werte entstehen, was sie bedeuten - und vor allem, was sie nicht bedeuten.
        </p>
        <p style={{ marginTop: "var(--space-3)", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
          Fassung der Bewertungslogik: {SCORING_VERSION}
        </p>
      </header>

      <Card style={{ borderColor: "var(--critical)" }}>
        <Stack gap={3}>
          <h2 style={{ fontSize: "var(--text-lg)", color: "var(--critical)" }}>
            Was keiner dieser Werte ist
          </h2>
          <p style={{ color: "var(--text-secondary)" }}>
            <strong>Keine Einstellungswahrscheinlichkeit.</strong> Wer eingeladen wird, haengt an
            Dingen, die wir nicht kennen und nicht kennen koennen: dem Bewerberfeld, dem Zeitpunkt,
            internen Kandidatinnen, der Tagesform der Person, die liest. Ein Fit-Wert beantwortet
            eine andere Frage - passt die Taetigkeit zu dem, was dieser Mensch belegbar kann und will.
          </p>
        </Stack>
      </Card>

      <section>
        <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-3)" }}>
          Der Grundsatz: Unbekanntes ist neutral
        </h2>
        <Card>
          <Stack gap={3}>
            <p style={{ color: "var(--text-secondary)" }}>
              Ein Faktor ohne Daten wird nicht als null gewertet. Das wuerde eine Stelle bestrafen,
              nur weil ihre Anzeige unvollstaendig ist - und Anzeigen sind fast immer unvollstaendig.
            </p>
            <p style={{ color: "var(--text-secondary)" }}>
              Stattdessen wird das Gewicht eines unbekannten Faktors anteilig auf die bekannten
              verteilt. Das Fehlen schlaegt sich ausschliesslich in der <strong>Abdeckung</strong>{" "}
              nieder, und die fliesst in die <strong>Sicherheit</strong>, nicht in die Passung.
            </p>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              Praktisch heisst das: eine Anzeige ohne Gehaltsangabe wird nicht schlechter bewertet.
              Sie fuehrt zu einer niedrigeren Sicherheit und zu einer vorbereiteten Rueckfrage.
            </p>
          </Stack>
        </Card>
      </section>

      <section>
        <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-3)" }}>
          Fit: die sieben Faktoren
        </h2>
        <p style={{ marginBottom: "var(--space-4)", color: "var(--text-secondary)" }}>
          Die Startgewichtung ist eine begruendete Annahme, keine Messung. Sie laesst sich in
          festgelegten Grenzen anpassen.
        </p>
        <Card padded={false}>
          <div className="scroll-x">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-default)" }}>Faktor</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-default)", whiteSpace: "nowrap" }}>Gewicht</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-default)" }}>Grundlage</th>
                </tr>
              </thead>
              <tbody>
                {fitRows.map(([name, weight, basis]) => (
                  <tr key={name}>
                    <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)", fontWeight: 500 }}>{name}</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>{Math.round(weight * 100)} %</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>{basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section>
        <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-3)" }}>Die fuenf getrennten Werte</h2>
        <Stack gap={4}>
          {[
            ["Fit", "Passt die Taetigkeit fachlich zu dir? Zeigt eine Zahl nur, wenn genug Faktoren bekannt sind - sonst ein Band wie \"explorativ\"."],
            ["Sicherheit", "Wie belastbar ist diese Aussage? Aus Profilabdeckung, Vollstaendigkeit der Anzeige, Quellenalter und externen Informationen."],
            ["Jobqualitaet", "Wie gut ist die Stelle als Arbeitsplatz? Einkommen, Sicherheit, Belastung, Flexibilitaet, Kultur, Entwicklung. Bei zu duenner Datenlage: \"nicht ausreichend beurteilbar\" statt eines schlechten Werts."],
            ["Entwicklung durch KI", "Bewertet werden die Aufgaben der konkreten Rolle, nicht der Berufstitel. Ausgabe sind Szenarien, nie eine Prognose mit Jahreszahl."],
            ["Vertrauen in die Anzeige", "Quelle, Alter, Linkcheck, Vollstaendigkeit, moegliche Wiederveroeffentlichung. Das Wort \"Fake\" faellt nicht - aus der Ferne laesst sich Betrug nicht feststellen."],
          ].map(([name, body]) => (
            <Card key={name}>
              <Stack gap={2}>
                <h3 style={{ fontSize: "var(--text-base)" }}>{name}</h3>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{body}</p>
              </Stack>
            </Card>
          ))}
        </Stack>
      </section>

      <section>
        <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-3)" }}>Gesamtranking</h2>
        <Card>
          <Stack gap={3}>
            <p style={{ color: "var(--text-secondary)" }}>
              Harte Bedingungen werden vor jedem Wert geprueft. Eine Stelle, die eine davon verletzt,
              bekommt gar keinen Gesamtwert - &bdquo;72 von 100, aber du darfst dort nicht arbeiten&ldquo;
              waere eine sinnlose Zahl.
            </p>
            <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
              <li>· Fachliche Passung: {Math.round(DEFAULT_RANKING_WEIGHTS.fit * 100)} %</li>
              <li>· Jobqualitaet: {Math.round(DEFAULT_RANKING_WEIGHTS.jobQuality * 100)} %</li>
              <li>· Entwicklung durch KI: {Math.round(DEFAULT_RANKING_WEIGHTS.aiOutlook * 100)} %</li>
              <li>· Vertrauen in die Anzeige: {Math.round(DEFAULT_RANKING_WEIGHTS.listingConfidence * 100)} %</li>
            </ul>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              Sind mehr als die Haelfte der Bestandteile unbekannt, wird kein Gesamtwert gebildet.
              Lieber keine Zahl als eine, die Sicherheit vortaeuscht.
            </p>
          </Stack>
        </Card>
      </section>

      <section>
        <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-3)" }}>Grenzen</h2>
        <Card style={{ background: "var(--surface-sunken)", boxShadow: "none" }}>
          <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-3)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            <li>
              · Der Abgleich zwischen Anforderung und Erfahrung arbeitet mit Wortueberlappung. Das
              ist nachvollziehbar, aber grob: eine anders formulierte, gleichbedeutende Erfahrung
              kann uebersehen werden.
            </li>
            <li>
              · Reisezeiten werden aus einer kleinen Tabelle geschaetzt, nicht mit einem Routendienst
              berechnet. Unbekannte Verbindungen liefern keinen Wert - keine erfundene Zahl.
            </li>
            <li>
              · Die Einordnung der Aufgabenveraenderung durch KI beruht auf Merkmalen des
              Aufgabentexts, nicht auf einer validierten Studie zu dieser konkreten Rolle.
            </li>
            <li>
              · Es gibt keine wissenschaftliche Validierung dieser Verfahren. Wo Eignungsdiagnostik
              belastbare Aussagen verlangt, waere eine externe Pruefung noetig - die hat nicht
              stattgefunden, und deshalb behaupten wir sie nicht.
            </li>
          </ul>
        </Card>
      </section>
    </Stack>
  );
}
