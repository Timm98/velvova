"use client";

import { useState, useTransition } from "react";
import { bedarfAufnehmen, angebotVerbindlichMachen, type Aufnahme } from "@/lib/arbeitgeber/wunschprofil";

/**
 * ══════════════════════════════════════════════════════════════════
 * „Wen würden Sie sofort nehmen?"
 * ══════════════════════════════════════════════════════════════════
 *
 * Ein Feld, eine Frage, kein Formular. Der Betrieb schreibt oder
 * diktiert, wie er reden würde — den Rest sortiert der Code.
 *
 * ── Warum das Gestrichene gross dasteht ─────────────────────────
 *
 * Weil es die einzige Gelegenheit ist, dass jemand erfährt, warum ein
 * Satz nicht geht. Wer es kleingedruckt versteckt, bekommt denselben
 * Satz beim nächsten Mal wieder — und hat nichts gelernt ausser, dass
 * die Software etwas geschluckt hat.
 *
 * ── Warum „verbindlich machen" ein zweiter Knopf ist ────────────
 *
 * Weil dazwischen der Satz steht, was das heisst. Ein Ablauf, in dem
 * Aufnehmen und Zusagen dieselbe Handlung sind, erzeugt Zusagen, die
 * niemand bewusst gegeben hat.
 */
export function Bedarfsaufnahme({ orgId, klaerung = false }: { orgId: string; klaerung?: boolean }) {
  const [text, setText] = useState("");
  const [lage, setLage] = useState<Aufnahme | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [laeuft, starten] = useTransition();

  function aufnehmen() {
    setMeldung(null);
    starten(async () => setLage(await bedarfAufnehmen(orgId, text)));
  }

  function bestaetigen(angebotId: string) {
    starten(async () => {
      const a = await angebotVerbindlichMachen(orgId, angebotId);
      setMeldung(a.text);
      if (a.ok) setLage(null);
    });
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        {/*
          Zwei Fragen, nicht eine mit Zusatz.

          „Wen würden Sie sofort nehmen?“ setzt voraus, dass es schon
          jemanden gibt. Wer nur weiss, dass etwas klemmt, hat darauf
          keine Antwort — und erfindet dann eine Rolle, die niemand
          gebraucht hätte.
        */}
        <label htmlFor="bedarf" className="text-[15px] font-medium text-ink">
          {klaerung ? "Was läuft bei Ihnen nicht rund?" : "Wen würden Sie sofort nehmen?"}
        </label>
        <textarea
          id="bedarf"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          disabled={laeuft}
          placeholder={
            klaerung
              ? "Beschreiben Sie die Lage. Zum Beispiel: Kundenanfragen bleiben mehrere Tage liegen, und hinterher weiss keiner, wer dran war. Wir haben schon eine gemeinsame Mailadresse probiert, das hat es nicht besser gemacht."
              : "Reden Sie, wie Sie reden würden. Zum Beispiel: Wir bräuchten eigentlich immer einen guten Elektriker, Wärmepumpen wären super, wir zahlen so viertausend, Firmenwagen gibt es auch."
          }
          className="w-full resize-y rounded-(--radius-lg) border border-line bg-raised px-4 py-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-3 focus-visible:border-accent"
        />
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={aufnehmen}
            disabled={laeuft || text.trim().length < 20}
            className="inline-flex min-h-11 items-center rounded-(--radius-control) bg-accent px-4 text-[14px] font-medium text-accent-on transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {laeuft ? "Wird gelesen …" : klaerung ? "Einordnen lassen" : "Daraus ein Angebot machen"}
          </button>
          <span className="text-2xs leading-relaxed text-ink-3">
            {klaerung
              ? "Noch nichts verbindlich, und vielleicht wird nie eine Stelle daraus."
              : "Noch nichts verbindlich. Was fehlt, wird nachgefragt."}
          </span>
        </div>
      </div>

      {meldung && (
        <p className="rounded-(--radius-lg) border border-line bg-soft p-4 text-[14.5px] text-ink">
          {meldung}
        </p>
      )}

      {lage?.art === "kein_modell" && (
        <p className="rounded-(--radius-lg) border border-line bg-raised p-4 text-[14.5px] leading-relaxed text-ink-2">
          Das lässt sich gerade nicht auswerten. Ihr Text steht noch da — versuchen Sie es gleich
          noch einmal.
        </p>
      )}

      {lage?.art === "leer" && (
        <p className="rounded-(--radius-lg) border border-line bg-raised p-4 text-[14.5px] leading-relaxed text-ink-2">
          Daraus konnte ich keine Rolle erkennen. Sagen Sie zuerst, welche Stelle es wäre — der
          Rest ergibt sich.
        </p>
      )}

      {lage?.art === "situation" && (
        <section className="grid gap-3 rounded-(--radius-lg) border border-line bg-raised p-5">
          <h2 className="text-[16px] font-semibold text-ink">
            Das ist noch keine Stelle — und vielleicht braucht es auch keine
          </h2>
          <p className="max-w-[var(--measure)] text-[14.5px] leading-relaxed text-ink-2">
            {lage.satz}
          </p>
          <p className="max-w-[var(--measure)] text-[14.5px] leading-relaxed text-ink-2">
            Manche Engpässe verschwinden, sobald eine Zuständigkeit geklärt ist. Damit sich das
            unterscheiden lässt, brauche ich drei Angaben:
          </p>
          <ul className="grid gap-1.5">
            {lage.fragen.map((f) => (
              <li key={f} className="text-[14.5px] leading-relaxed text-ink-2">
                · {f}
              </li>
            ))}
          </ul>
          <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
            Schreiben Sie die Antworten oben dazu. Solange nicht feststeht, woran es liegt, lege ich
            kein Angebot an — ein erfundener Bedarf kostet Sie mehr als eine Rückfrage.
          </p>
        </section>
      )}

      {lage?.art === "entwurf" && (
        <section className="grid gap-5 rounded-(--radius-lg) border border-line bg-raised p-5">
          {lage.lage.art === "unvollstaendig" ? (
            <div className="grid gap-2.5">
              <h2 className="text-[16px] font-semibold text-ink">
                {lage.lage.fragen.length === 1 ? "Eine Frage noch" : "Noch kurz nachgefragt"}
              </h2>
              <ul className="grid gap-1.5">
                {lage.lage.fragen.map((f) => (
                  <li key={f} className="text-[14.5px] leading-relaxed text-ink-2">
                    · {f}
                  </li>
                ))}
              </ul>
              <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
                Schreiben Sie die Antworten einfach oben dazu und geben Sie es noch einmal ab. Ohne
                diese Angaben lässt sich nichts hinterlegen, an das sich jemand halten könnte.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              <h2 className="text-[16px] font-semibold text-ink">Das ist vollständig</h2>
              <p className="max-w-[var(--measure)] text-[14.5px] leading-relaxed text-ink-2">
                {lage.hinweis}
              </p>
              <button
                type="button"
                onClick={() => bestaetigen(lage.angebotId)}
                disabled={laeuft}
                className="inline-flex min-h-11 w-fit items-center rounded-(--radius-control) bg-accent px-4 text-[14px] font-medium text-accent-on transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                Verbindlich hinterlegen
              </button>
            </div>
          )}

          {lage.lage.art !== "leer" && lage.lage.gestrichen.length > 0 && (
            /*
             * Nicht kleingedruckt und nicht weggeklappt.
             *
             * Der Betrieb hat das ehrlich gemeint. Er soll lesen, was
             * daran nicht geht und warum — sonst sagt er es beim
             * nächsten Mal wieder.
             */
            <div className="grid gap-2 border-t border-line pt-4">
              <h3 className="text-[15px] font-semibold text-ink">Das habe ich weggelassen</h3>
              <ul className="grid gap-2">
                {lage.lage.gestrichen.map((g) => (
                  <li key={g.wunsch} className="grid gap-1">
                    <span className="text-[14.5px] text-ink-3 line-through decoration-ink-3/40">
                      {g.wunsch}
                    </span>
                    <span className="text-2xs leading-relaxed text-critical">{g.grund}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lage.auffaelligkeiten.length > 0 && (
            <p className="border-t border-line pt-3 text-2xs leading-relaxed text-ink-3">
              Im Text standen Anweisungen an das System. Sie wurden als Text behandelt und nicht
              befolgt: {lage.auffaelligkeiten.join(" · ")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
