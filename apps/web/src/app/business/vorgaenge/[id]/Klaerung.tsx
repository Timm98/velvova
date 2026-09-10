"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EBENEN, LOESUNGSWEGE, type Ebene, type Loesungsart } from "@paycheck/domain";
import {
  befundEintragen,
  ebeneHeben,
  quelleHinterlegen,
  wegWaehlen,
} from "@/lib/arbeitgeber/bedarfsvorgang";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Handlungen an einer Klärung
 * ══════════════════════════════════════════════════════════════════
 *
 * Vier, und jede prüft der Server noch einmal. Die Oberfläche zeigt,
 * was möglich ist; sie entscheidet es nicht.
 *
 * ── Warum der Weg vor der Ebene steht ───────────────────────────
 *
 * Weil „welche Lösung" die Frage ist, an der sich entscheidet, ob
 * überhaupt jemand eingestellt werden muss — und weil zwei der acht
 * Antworten „erst messen" und „vorerst beobachten" lauten. Sie stehen
 * gleichrangig in derselben Liste, nicht als Ausweg darunter.
 */

const WEGNAME: Record<Loesungsart, string> = {
  ablauf_aendern: "Einen Ablauf ändern",
  zustaendigkeit_klaeren: "Eine Zuständigkeit klären",
  faehigkeiten_entwickeln: "Vorhandene Fähigkeiten entwickeln",
  werkzeug_einsetzen: "Ein Werkzeug einsetzen",
  auftrag_vergeben: "Einen abgegrenzten Auftrag vergeben",
  rolle_schaffen: "Eine dauerhafte Rolle schaffen",
  erst_messen: "Erst messen",
  vorerst_beobachten: "Vorerst beobachten",
};

const EBENENNAME: Record<Ebene, string> = {
  beduerfnis: "Wunsch",
  beobachtung: "Beobachtung",
  hypothese: "Hypothese",
  bestaetigtes_problem: "Bestätigtes Problem",
  loesungsbedarf: "Lösungsbedarf",
  freigegebene_moeglichkeit: "Freigegeben",
};

const FELD =
  "w-full rounded-(--radius-lg) border border-line bg-raised px-3 py-2 text-[14.5px] text-ink outline-none placeholder:text-ink-3 focus-visible:border-accent";
const KNOPF =
  "inline-flex min-h-11 w-fit items-center rounded-(--radius-control) bg-accent px-4 text-[14px] font-medium text-accent-on transition-opacity hover:opacity-90 disabled:opacity-60";

function zeilen(roh: string): string[] {
  return roh
    .split("\n")
    .map((z) => z.trim())
    .filter((z) => z.length > 0);
}

export function Klaerung({
  orgId,
  vorgangId,
  ebene,
  weg,
  unabhaengig,
  quellen,
  befunde,
}: {
  orgId: string;
  vorgangId: string;
  ebene: Ebene;
  weg: Loesungsart | null;
  unabhaengig: number;
  quellen: { id: string; art: string; eigentuemer: string; erlaubt: boolean; grund: string | null }[];
  befunde: { id: string; beobachtung: string; stand: string }[];
}) {
  const router = useRouter();
  const [laeuft, starten] = useTransition();
  const [meldung, setMeldung] = useState<string | null>(null);
  const [warnung, setWarnung] = useState<string | null>(null);

  /* Quelle */
  const [art, setArt] = useState("");
  const [eigentuemer, setEigentuemer] = useState("");
  const [zeitraum, setZeitraum] = useState("");
  const [rechtsgrundlage, setRechtsgrundlage] = useState("");
  const [verbunden, setVerbunden] = useState(false);
  const [berechtigt, setBerechtigt] = useState(false);
  const [vorgangsebene, setVorgangsebene] = useState(true);

  /* Befund */
  const [beobachtung, setBeobachtung] = useState("");
  const [alternativen, setAlternativen] = useState("");
  const [gegenbelege, setGegenbelege] = useState("");
  const [gegenGeprueft, setGegenGeprueft] = useState(false);
  const [bestaetigt, setBestaetigt] = useState(false);
  const [gewaehlteQuellen, setGewaehlteQuellen] = useState<string[]>([]);

  const naechste = EBENEN[EBENEN.indexOf(ebene) + 1] as Ebene | undefined;
  const [freigabeVon, setFreigabeVon] = useState("");

  function melden(gut: string | null, schlecht: string | null) {
    setMeldung(gut);
    setWarnung(schlecht);
    router.refresh();
  }

  return (
    <div className="grid gap-8">
      {meldung && (
        <p className="rounded-(--radius-lg) border border-line bg-soft p-4 text-[14.5px] text-ink">
          {meldung}
        </p>
      )}
      {warnung && (
        <p className="rounded-(--radius-lg) border border-line bg-raised p-4 text-[14.5px] leading-relaxed text-caution">
          {warnung}
        </p>
      )}

      <section className="grid gap-3 border-t border-line pt-6">
        <h2 className="text-[15px] font-semibold text-ink">Worauf sich das stützt</h2>
        <p className="max-w-[var(--measure)] text-[14px] leading-relaxed text-ink-2">
          {unabhaengig === 0
            ? "Bisher keine Quelle. Ein Befund braucht zwei voneinander unabhängige — drei Kopien derselben Unterlage sind eine."
            : `${unabhaengig} unabhängige ${unabhaengig === 1 ? "Quelle" : "Quellen"}. Gezählt wird das Paar aus Eigentümer und Art.`}
        </p>

        {quellen.length > 0 && (
          <ul className="grid gap-1.5">
            {quellen.map((q) => (
              <li key={q.id} className="grid gap-0.5">
                <span className="text-[14.5px] text-ink-2">
                  {q.art} — {q.eigentuemer}
                </span>
                {!q.erlaubt && q.grund && (
                  <span className="text-2xs leading-relaxed text-caution">{q.grund}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-2.5 rounded-(--radius-lg) border border-line bg-raised p-4">
          <h3 className="text-[14.5px] font-medium text-ink">Quelle hinterlegen</h3>
          <input
            className={FELD}
            value={art}
            onChange={(e) => setArt(e.target.value)}
            placeholder="Was ist es? Zum Beispiel: Vorgangsliste, Prozessbeschreibung"
          />
          <input
            className={FELD}
            value={eigentuemer}
            onChange={(e) => setEigentuemer(e.target.value)}
            placeholder="Wem gehört sie? Zum Beispiel: Leitung Kundenservice"
          />
          <input
            className={FELD}
            value={zeitraum}
            onChange={(e) => setZeitraum(e.target.value)}
            placeholder="Erhebungszeitraum, zum Beispiel: Januar bis März"
          />
          <input
            className={FELD}
            value={rechtsgrundlage}
            onChange={(e) => setRechtsgrundlage(e.target.value)}
            placeholder="Rechtsgrundlage — worauf stützt sich die Verarbeitung?"
          />
          {/*
            Drei Häkchen, weil es drei verschiedene Dinge sind. Ein
            einziges „freigegeben" würde die Verwechslung festschreiben,
            die dieser Abschnitt verhindern soll.
          */}
          <label className="flex items-start gap-2 text-[14px] leading-relaxed text-ink-2">
            <input type="checkbox" checked={verbunden} onChange={(e) => setVerbunden(e.target.checked)} className="mt-1" />
            Die Quelle liegt vor oder ist technisch verbunden.
          </label>
          <label className="flex items-start gap-2 text-[14px] leading-relaxed text-ink-2">
            <input type="checkbox" checked={berechtigt} onChange={(e) => setBerechtigt(e.target.checked)} className="mt-1" />
            Jemand bei uns, der es darf, hat sie für die Analyse freigegeben.
          </label>
          <label className="flex items-start gap-2 text-[14px] leading-relaxed text-ink-2">
            <input type="checkbox" checked={vorgangsebene} onChange={(e) => setVorgangsebene(e.target.checked)} className="mt-1" />
            Sie beschreibt Vorgänge, nicht einzelne Beschäftigte.
          </label>
          <button
            type="button"
            className={KNOPF}
            disabled={laeuft || art.trim().length < 2 || eigentuemer.trim().length < 2}
            onClick={() =>
              starten(async () => {
                const a = await quelleHinterlegen(orgId, vorgangId, {
                  art: art.trim(),
                  eigentuemer: eigentuemer.trim(),
                  zweck: "unternehmensanalyse",
                  zeitraum: zeitraum.trim() || null,
                  alterTage: null,
                  sichtbarFuer: [],
                  technischVerbunden: verbunden,
                  betrieblichBerechtigt: berechtigt,
                  rechtsgrundlage: rechtsgrundlage.trim() || null,
                  aufVorgangsebene: vorgangsebene,
                });
                setArt("");
                setEigentuemer("");
                melden(
                  a.erlaubt ? "Quelle hinterlegt." : "Quelle hinterlegt — verwendbar ist sie noch nicht.",
                  a.grund ?? (a.hinweise.length > 0 ? a.hinweise.join(" ") : null),
                );
              })
            }
          >
            Quelle hinterlegen
          </button>
        </div>
      </section>

      <section className="grid gap-3 border-t border-line pt-6">
        <h2 className="text-[15px] font-semibold text-ink">Befunde</h2>

        {befunde.length > 0 && (
          <ul className="grid gap-1.5">
            {befunde.map((b) => (
              <li key={b.id} className="text-[14.5px] leading-relaxed text-ink-2">
                · {b.beobachtung} <span className="text-ink-3">({b.stand})</span>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-2.5 rounded-(--radius-lg) border border-line bg-raised p-4">
          <h3 className="text-[14.5px] font-medium text-ink">Befund eintragen</h3>
          <textarea
            className={FELD}
            rows={2}
            value={beobachtung}
            onChange={(e) => setBeobachtung(e.target.value)}
            placeholder="Was wurde beobachtet? Keine Ursache, keine Bewertung."
          />
          <textarea
            className={FELD}
            rows={3}
            value={alternativen}
            onChange={(e) => setAlternativen(e.target.value)}
            placeholder="Welche anderen Erklärungen kämen in Frage? Eine je Zeile. Ohne mindestens eine bleibt es eine Hypothese."
          />
          <textarea
            className={FELD}
            rows={2}
            value={gegenbelege}
            onChange={(e) => setGegenbelege(e.target.value)}
            placeholder="Was spricht dagegen? Eine je Zeile. Steht hier etwas, gilt der Befund als verworfen."
          />
          <label className="flex items-start gap-2 text-[14px] leading-relaxed text-ink-2">
            <input type="checkbox" checked={gegenGeprueft} onChange={(e) => setGegenGeprueft(e.target.checked)} className="mt-1" />
            Wir haben gezielt nach Gegenbelegen gesucht.
          </label>
          <label className="flex items-start gap-2 text-[14px] leading-relaxed text-ink-2">
            <input type="checkbox" checked={bestaetigt} onChange={(e) => setBestaetigt(e.target.checked)} className="mt-1" />
            Die zuständige Person bei uns bestätigt den Befund.
          </label>

          {quellen.length > 0 && (
            <fieldset className="grid gap-1.5">
              <legend className="text-[14px] text-ink-2">Worauf stützt sich dieser Befund?</legend>
              {quellen.map((q) => (
                <label key={q.id} className="flex items-start gap-2 text-[14px] leading-relaxed text-ink-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={gewaehlteQuellen.includes(q.id)}
                    onChange={(e) =>
                      setGewaehlteQuellen((alt) =>
                        e.target.checked ? [...alt, q.id] : alt.filter((x) => x !== q.id),
                      )
                    }
                  />
                  {q.art} — {q.eigentuemer}
                </label>
              ))}
            </fieldset>
          )}

          <button
            type="button"
            className={KNOPF}
            disabled={laeuft || beobachtung.trim().length < 10}
            onClick={() =>
              starten(async () => {
                const a = await befundEintragen(orgId, vorgangId, {
                  beobachtung: beobachtung.trim(),
                  quellenIds: gewaehlteQuellen,
                  alternativen: zeilen(alternativen),
                  gegenbelege: zeilen(gegenbelege),
                  gegenbelegeGeprueft: gegenGeprueft,
                  vomUnternehmenBestaetigt: bestaetigt,
                });
                setBeobachtung("");
                setAlternativen("");
                setGegenbelege("");
                setGewaehlteQuellen([]);
                melden(
                  `Eingetragen als: ${a.stand}.`,
                  a.fehlt ? `Zum bestätigten Befund fehlt noch: ${a.fehlt}.` : null,
                );
              })
            }
          >
            Befund eintragen
          </button>
        </div>
      </section>

      <section className="grid gap-3 border-t border-line pt-6">
        <h2 className="text-[15px] font-semibold text-ink">Welcher Weg</h2>
        <p className="max-w-[var(--measure)] text-[14px] leading-relaxed text-ink-2">
          Sechs der acht Wege kommen ohne einen Menschen von aussen aus. Das ist keine Bescheidenheit,
          sondern der häufigere Fall.
        </p>
        <div className="flex flex-wrap gap-2">
          {LOESUNGSWEGE.map((w) => (
            <button
              key={w}
              type="button"
              disabled={laeuft}
              onClick={() =>
                starten(async () => {
                  await wegWaehlen(orgId, vorgangId, w);
                  melden(`Gewählt: ${WEGNAME[w]}.`, null);
                })
              }
              className={`inline-flex min-h-10 items-center rounded-(--radius-control) border px-3 text-[14px] transition-colors ${
                weg === w ? "border-accent bg-soft text-ink" : "border-line text-ink-2 hover:border-accent"
              }`}
            >
              {WEGNAME[w]}
            </button>
          ))}
        </div>
      </section>

      {naechste && (
        <section className="grid gap-3 border-t border-line pt-6">
          <h2 className="text-[15px] font-semibold text-ink">Eine Ebene weiter</h2>
          <p className="max-w-[var(--measure)] text-[14px] leading-relaxed text-ink-2">
            Nächster Schritt: {EBENENNAME[naechste]}. Geht er nicht, steht hier warum — und das ist
            die Auskunft, was noch fehlt.
          </p>
          {naechste === "freigegebene_moeglichkeit" && (
            <input
              className={FELD}
              value={freigabeVon}
              onChange={(e) => setFreigabeVon(e.target.value)}
              placeholder="Wer gibt Umfang und Bedingungen frei? Name oder Funktion."
            />
          )}
          <button
            type="button"
            className={KNOPF}
            disabled={laeuft}
            onClick={() =>
              starten(async () => {
                const a = await ebeneHeben(orgId, vorgangId, naechste, freigabeVon.trim() || undefined);
                melden(
                  a.erlaubt ? `Jetzt: ${EBENENNAME[a.ebene]}.` : null,
                  a.erlaubt ? null : a.grund,
                );
              })
            }
          >
            {laeuft ? "Wird geprüft …" : `Weiter zu „${EBENENNAME[naechste]}“`}
          </button>
        </section>
      )}
    </div>
  );
}
