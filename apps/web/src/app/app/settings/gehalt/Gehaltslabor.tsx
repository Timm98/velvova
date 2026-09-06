"use client";

import { useState } from "react";
import type { Gehaltsangaben } from "@/lib/payroll/angaben";
import { bruttoFuerNetto, erhoehung } from "@/lib/lebenswert/gehaltslabor";

/**
 * Zwei Fragen, die man in einer Verhandlung stellt.
 *
 * ── Warum sie hier stehen und nicht auf einer eigenen Seite ───
 *
 * Beide hängen an denselben Angaben wie die Schätzung darüber:
 * Steuerklasse, Kinder, Kasse, Bundesland. Auf einer eigenen Seite
 * müsste man sie ein zweites Mal eintragen — oder, schlimmer, es würde
 * dort mit Voreinstellungen gerechnet, während oben die eigenen gelten.
 * Zwei verschiedene Antworten auf dieselbe Frage, im selben Produkt.
 *
 * Hier oben ändert man die Steuerklasse und sieht unten sofort, was das
 * für die nächste Gehaltsverhandlung bedeutet.
 *
 * ── Warum die Grenzbelastung so gross dasteht ─────────────────
 *
 * Sie ist die Zahl, die niemand im Kopf hat. Wer 5.000 € mehr
 * verhandelt, rechnet mit vierhundert im Monat und bekommt
 * hundertneunzig. Nicht weil jemand betrügt, sondern weil auf dem
 * ZUSÄTZLICHEN Euro eine ganz andere Last liegt als auf dem
 * Durchschnitt — bei mittleren Einkommen oft über fünfzig Prozent.
 *
 * Die Durchschnittsbelastung steht bewusst daneben, klein: Erst der
 * Abstand zwischen beiden erklärt, warum sich eine Erhöhung anders
 * anfühlt, als sie sich rechnet.
 */
export function Gehaltslabor({
  angaben,
  bruttoVorschlag,
}: {
  angaben: Gehaltsangaben;
  /** Das Brutto der aktuellen Stelle, wenn hinterlegt. */
  bruttoVorschlag: number | null;
}) {
  /*
   * Ohne hinterlegtes Gehalt bleibt das Feld leer.
   *
   * Eine Vorbelegung mit „60.000" wäre bequem und würde zur ersten
   * Zahl, die jemand sieht — und ein Grenzabgabensatz gilt nicht
   * allgemein, sondern genau für das eingetragene Gehalt. Wer das Feld
   * übersieht, läse eine Auskunft über ein fremdes Einkommen.
   */
  const [brutto, setBrutto] = useState(bruttoVorschlag ? String(bruttoVorschlag) : "");
  const [plus, setPlus] = useState("5000");
  const [ziel, setZiel] = useState("");

  const e = erhoehung(zahl(brutto), zahl(plus), angaben);
  const z = ziel.trim() === "" ? null : bruttoFuerNetto(zahl(ziel), angaben);

  return (
    <div className="grid gap-8 border-t border-line pt-8">
      <div className="grid gap-1.5">
        <h3 className="text-base font-semibold">Für die Verhandlung</h3>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Gerechnet mit den Angaben von oben. Nichts davon wird gespeichert.
        </p>
      </div>

      {/* ── Was bleibt von einer Erhöhung? ──────────────── */}
      <section className="grid gap-4 rounded-(--radius-surface) bg-inset p-5">
        <h4 className="text-sm font-semibold">Was bleibt von einer Erhöhung?</h4>

        <div className="flex flex-wrap items-end gap-4">
          <Feld label="Heutiges Brutto im Jahr" wert={brutto} setze={setBrutto} breit />
          <Feld label="Erhöhung im Jahr" wert={plus} setze={setPlus} />
        </div>

        {e ? (
          <div className="grid gap-3">
            <p className="text-[15px] leading-relaxed text-ink">
              Von{" "}
              <span className="font-mono font-semibold tabular">{euro(e.bruttoPlusJahr)} €</span>{" "}
              brutto mehr bleiben dir{" "}
              <span className="font-mono font-semibold tabular text-positive">
                {euro(e.nettoPlusJahr)} €
              </span>{" "}
              im Jahr — <span className="font-mono tabular">{euro(e.nettoPlusMonat)} €</span> im
              Monat.
            </p>

            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-line-2 pt-3">
              <p className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-semibold tabular">
                  {prozent(e.grenzabgaben)}
                </span>
                <span className="text-sm text-ink-2">gehen von der Erhöhung ab</span>
              </p>
              <p className="text-2xs text-ink-3">
                Von deinem gesamten Gehalt sind es {prozent(e.durchschnittsabgaben)}. Der
                Unterschied ist der Grund, warum sich eine Erhöhung kleiner anfühlt, als sie klingt.
              </p>
            </div>
          </div>
        ) : (
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-3">
            {brutto.trim() === ""
              ? "Trag dein heutiges Bruttogehalt ein — der Anteil, der von einer Erhöhung abgeht, hängt genau daran."
              : "Diese Beträge kann ich nicht rechnen."}
          </p>
        )}
      </section>

      {/* ── Was müsstest du verdienen? ──────────────────── */}
      <section className="grid gap-4 rounded-(--radius-surface) bg-inset p-5">
        <h4 className="text-sm font-semibold">Was müsstest du verdienen?</h4>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Die Frage in der Verhandlung selbst: Du weisst, was du brauchst — und musst daraus eine
          Bruttoforderung machen.
        </p>

        <Feld label="Wunschnetto im Monat" wert={ziel} setze={setZiel} breit />

        {z?.ergebnis ? (
          <p className="text-[15px] leading-relaxed text-ink">
            Dafür brauchst du etwa{" "}
            <span className="font-mono font-semibold tabular">{euro(z.ergebnis.bruttoJahr)} €</span>{" "}
            brutto im Jahr.{" "}
            <span className="text-ink-3">
              Damit kommst du auf {euro(z.ergebnis.erreichtesNettoMonat)} € netto im Monat.
            </span>
          </p>
        ) : (
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-3">
            {z?.grund ?? "Trag ein Wunschnetto ein, dann rechne ich das Brutto dazu aus."}
          </p>
        )}
      </section>

      <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
        Beides sind Schätzungen nach den Regeln für 2026 und den Angaben oben. Sie ersetzen keine
        Lohnabrechnung — aber sie sind näher an deiner Lage als jede allgemeine Faustregel.
      </p>
    </div>
  );
}

function Feld({
  label,
  wert,
  setze,
  breit,
}: {
  label: string;
  wert: string;
  setze: (v: string) => void;
  breit?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={wert}
        onChange={(ev) => setze(ev.target.value)}
        placeholder="—"
        aria-label={label}
        className={
          "h-11 rounded-(--radius-control) bg-surface px-3.5 text-[15px] outline-none ring-1 " +
          "ring-line focus-visible:ring-2 focus-visible:ring-accent " +
          (breit ? "w-48" : "w-36")
        }
      />
    </label>
  );
}

/*
 * Punkte als Tausendertrennung werden entfernt, Kommas nicht.
 *
 * „60.000" ist die deutsche Schreibweise für sechzigtausend. Mit
 * `Number()` allein käme dort 60 heraus — ein stiller Faktor tausend
 * mitten in einer Gehaltsrechnung.
 */
function zahl(s: string): number {
  const n = Number(s.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function euro(n: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(n);
}

function prozent(anteil: number): string {
  return `${(anteil * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
}
