"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  stelleSchliessen,
  stelleSpeichern,
  stelleVeroeffentlichen,
} from "@/lib/arbeitgeber/stellen";
import { pruefeAnzeige, pruefeFelder, veroeffentlichbar } from "@/lib/arbeitgeber/anzeigenpruefung";

/** Eine Zeile je Anforderung. Leere Zeilen fallen weg. */
function zeilen(text: string): string[] {
  return text.split("\n").map((z) => z.trim()).filter((z) => z.length > 0);
}

type Stelle = {
  id: string;
  title: string;
  location: string;
  country: string;
  workModel: string | null;
  contractType: string | null;
  weeklyHours: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
  description: string;
  status: string;
  benefits: string[];
  team: string | null;
  bereich: string | null;
  starttermin: string | null;
  aufgaben: string | null;
  mussFaehigkeiten: string[];
  kannFaehigkeiten: string[];
  gewuenschteErfahrung: string | null;
  arbeitssprache: string | null;
  reiseanteil: string | null;
  verantwortungsumfang: string | null;
  berichtslinie: string | null;
  interviewablauf: string | null;
  antwortzeit: string | null;
  kontaktperson: string | null;
};

/**
 * Die Anzeige schreiben.
 *
 * ── Warum das Gehalt ein Pflichtfeld ist ──────────────────────
 *
 * Bei fremden Anzeigen können wir es nicht verlangen. Hier schon — und
 * hier ist es auch richtig: Wer eine Stelle über ein Produkt
 * ausschreibt, in dem alles um „was bleibt mir davon" kreist, kann nicht
 * ausgerechnet die Angabe weglassen, die diese Frage beantwortbar macht.
 *
 * Das Feld sagt das auch, statt nur eine rote Umrandung zu zeigen.
 */
export function StellenFormular({
  orgId,
  stelle,
  darfSchreiben,
  darfVeroeffentlichen,
  verifiziert,
}: {
  orgId: string;
  stelle: Stelle;
  darfSchreiben: boolean;
  darfVeroeffentlichen: boolean;
  verifiziert: boolean;
}) {
  const [w, setW] = useState({
    title: stelle.title,
    location: stelle.location,
    country: stelle.country,
    workModel: stelle.workModel ?? "",
    contractType: stelle.contractType ?? "",
    weeklyHours: stelle.weeklyHours === null ? "" : String(stelle.weeklyHours),
    salaryMin: stelle.salaryMin === null ? "" : String(stelle.salaryMin),
    salaryMax: stelle.salaryMax === null ? "" : String(stelle.salaryMax),
    salaryCurrency: stelle.salaryCurrency,
    salaryPeriod: stelle.salaryPeriod,
    description: stelle.description,
    team: stelle.team ?? "",
    bereich: stelle.bereich ?? "",
    starttermin: stelle.starttermin ?? "",
    aufgaben: stelle.aufgaben ?? "",
    /*
     * Die Fähigkeiten stehen im Formular als Zeilen, nicht als Liste.
     *
     * Ein Feld mit Hinzufügen-Knopf und Löschkreuzen je Eintrag wäre
     * mehr Bedienung für dasselbe Ergebnis. Eine Zeile je Anforderung
     * ist das, was ohnehin jeder tippt.
     */
    mussFaehigkeiten: stelle.mussFaehigkeiten.join("\n"),
    kannFaehigkeiten: stelle.kannFaehigkeiten.join("\n"),
    gewuenschteErfahrung: stelle.gewuenschteErfahrung ?? "",
    arbeitssprache: stelle.arbeitssprache ?? "",
    reiseanteil: stelle.reiseanteil ?? "",
    verantwortungsumfang: stelle.verantwortungsumfang ?? "",
    berichtslinie: stelle.berichtslinie ?? "",
    interviewablauf: stelle.interviewablauf ?? "",
    antwortzeit: stelle.antwortzeit ?? "",
    kontaktperson: stelle.kontaktperson ?? "",
  });
  const [meldung, setMeldung] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const befunde = pruefeAnzeige({
    title: w.title,
    location: w.location,
    description: w.description,
    workModel: w.workModel || null,
    contractType: w.contractType || null,
    weeklyHours: w.weeklyHours === "" ? null : Number(w.weeklyHours),
    salaryMin: w.salaryMin === "" ? null : Number(w.salaryMin),
    salaryMax: w.salaryMax === "" ? null : Number(w.salaryMax),
    salaryPeriod: w.salaryPeriod,
    aufgaben: w.aufgaben,
    mussFaehigkeiten: zeilen(w.mussFaehigkeiten),
    kannFaehigkeiten: zeilen(w.kannFaehigkeiten),
    arbeitssprache: w.arbeitssprache,
    antwortzeit: w.antwortzeit,
    interviewablauf: w.interviewablauf,
    berichtslinie: w.berichtslinie,
  });
  /* Die Feldprüfung kommt dazu, blockiert aber nicht: Was fehlt, ist
     ein Hinweis oder wichtig — blockierend sind nur die Regeln, die es
     vorher schon gab. */
  const alleBefunde = [...befunde, ...pruefeFelder({
    title: w.title,
    location: w.location,
    description: w.description,
    workModel: null,
    contractType: null,
    weeklyHours: null,
    salaryMin: null,
    salaryMax: null,
    salaryPeriod: w.salaryPeriod,
    aufgaben: w.aufgaben,
    mussFaehigkeiten: zeilen(w.mussFaehigkeiten),
    kannFaehigkeiten: zeilen(w.kannFaehigkeiten),
    antwortzeit: w.antwortzeit,
    interviewablauf: w.interviewablauf,
  })];
  const bereit = veroeffentlichbar(befunde);

  const feld = (k: keyof typeof w) => ({
    value: w[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setW({ ...w, [k]: e.target.value }),
    disabled: !darfSchreiben,
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">{stelle.title}</h1>
        <span className="rounded-(--radius-pill) bg-inset px-2.5 py-0.5 font-mono text-2xs text-ink-3">
          {stelle.status === "draft"
            ? "Entwurf"
            : stelle.status === "published"
              ? "Veröffentlicht"
              : "Geschlossen"}
        </span>
      </div>

      {!darfSchreiben && (
        <p className="max-w-[var(--measure)] rounded-(--radius-surface) bg-soft p-4 text-sm leading-relaxed text-ink-2">
          Du kannst diese Stelle ansehen, aber nicht ändern. Dafür bräuchtest du mindestens die
          Rolle „Recruiting".
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Feld label="Titel">
          <input {...feld("title")} className={eingabe} aria-label="Titel" />
        </Feld>
        <Feld label="Ort">
          <input {...feld("location")} className={eingabe} aria-label="Ort" placeholder="Dortmund" />
        </Feld>
        <Feld label="Arbeitsmodell">
          <select {...feld("workModel")} className={eingabe} aria-label="Arbeitsmodell">
            <option value="">nicht angegeben</option>
            <option value="on_site">Vor Ort</option>
            <option value="hybrid">Hybrid</option>
            <option value="remote">Remote</option>
          </select>
        </Feld>
        <Feld label="Vertrag">
          <select {...feld("contractType")} className={eingabe} aria-label="Vertrag">
            <option value="">nicht angegeben</option>
            <option value="permanent">Unbefristet</option>
            <option value="fixed_term">Befristet</option>
            <option value="internship">Praktikum</option>
            <option value="apprenticeship">Ausbildung</option>
          </select>
        </Feld>
        <Feld label="Wochenstunden" hinweis="Ohne sie lässt sich kein Stundenwert rechnen.">
          <input {...feld("weeklyHours")} className={eingabe} aria-label="Wochenstunden" inputMode="numeric" />
        </Feld>
        <Feld label="Währung">
          <select {...feld("salaryCurrency")} className={eingabe} aria-label="Währung">
            <option value="EUR">EUR</option>
            <option value="CHF">CHF</option>
            <option value="GBP">GBP</option>
            <option value="USD">USD</option>
          </select>
        </Feld>
        <Feld
          label="Gehalt von"
          hinweis="Pflicht. Ohne Gehaltsangabe kann hier niemand veröffentlichen."
        >
          <input {...feld("salaryMin")} className={eingabe} aria-label="Gehalt von" inputMode="numeric" />
        </Feld>
        <Feld label="Gehalt bis">
          <input {...feld("salaryMax")} className={eingabe} aria-label="Gehalt bis" inputMode="numeric" />
        </Feld>
      </div>

      <Feld
        label="Beschreibung"
        hinweis="Leistungen wie Homeoffice, Jobticket oder Altersvorsorge werden aus diesem Text gelesen — schreib sie einfach hinein."
      >
        <textarea
          {...feld("description")}
          rows={14}
          aria-label="Beschreibung"
          className="rounded-(--radius-control) bg-inset p-3.5 text-[15px] leading-relaxed outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent"
        />
      </Feld>

      {/*
        Die erweiterten Angaben stehen unter der Beschreibung, nicht
        darüber.

        Wer eine Anzeige anlegt, schreibt zuerst Titel, Ort, Gehalt und
        Text — das ist der Weg, den alle kennen. Die Felder darunter
        machen daraus eine Anzeige, mit der Nina rechnen kann; sie
        davorzustellen hiesse, den Einstieg zu verlängern.
      */}
      <details className="group grid gap-5 rounded-(--radius-md) border border-line p-5" open>
        <summary className="cursor-pointer list-none text-[15px] font-semibold text-ink">
          Angaben, mit denen {"Nina"} rechnen kann
        </summary>

        <div className="grid gap-5 pt-4 lg:grid-cols-2">
          <Feld label="Team">
            <input {...feld("team")} className={eingabe} aria-label="Team" />
          </Feld>
          <Feld label="Bereich">
            <input {...feld("bereich")} className={eingabe} aria-label="Bereich" />
          </Feld>
          <Feld label="Starttermin">
            <input {...feld("starttermin")} className={eingabe} aria-label="Starttermin" placeholder="ab sofort · 1. Oktober" />
          </Feld>
          <Feld label="Arbeitssprache">
            <input {...feld("arbeitssprache")} className={eingabe} aria-label="Arbeitssprache" placeholder="Deutsch · Englisch" />
          </Feld>
          <Feld label="Reiseanteil">
            <input {...feld("reiseanteil")} className={eingabe} aria-label="Reiseanteil" placeholder="etwa 10 %, meist Tagesreisen" />
          </Feld>
          <Feld label="Berichtslinie">
            <input {...feld("berichtslinie")} className={eingabe} aria-label="Berichtslinie" placeholder="an die Leitung Finanzen" />
          </Feld>
          <Feld label="Antwortzeit" hinweis="Eine Zusage, an der ihr euch messen lasst.">
            <input {...feld("antwortzeit")} className={eingabe} aria-label="Antwortzeit" placeholder="innerhalb von fünf Werktagen" />
          </Feld>
          <Feld label="Kontaktperson">
            <input {...feld("kontaktperson")} className={eingabe} aria-label="Kontaktperson" />
          </Feld>
        </div>

        <div className="grid gap-5 pt-1">
          <Feld label="Aufgaben" hinweis="Was die Person tatsächlich tut — eine Zeile je Aufgabe.">
            <textarea {...feld("aufgaben")} rows={5} aria-label="Aufgaben" className={mehrzeilig} />
          </Feld>

          {/*
            Muss und Kann getrennt — das ist der Kern.

            In einer gemeinsamen Aufzählung hält niemand sie
            auseinander. Getrennt führt Nina eine fehlende
            Kann-Fähigkeit als „entwickelbar" statt als Ausschluss.
          */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Feld label="Unverzichtbare Fähigkeiten" hinweis="Eine je Zeile. Ohne diese geht es nicht.">
              <textarea {...feld("mussFaehigkeiten")} rows={5} aria-label="Unverzichtbare Fähigkeiten" className={mehrzeilig} />
            </Feld>
            <Feld label="Erlernbare Fähigkeiten" hinweis="Eine je Zeile. Fehlen sie, ist das kein Ausschluss.">
              <textarea {...feld("kannFaehigkeiten")} rows={5} aria-label="Erlernbare Fähigkeiten" className={mehrzeilig} />
            </Feld>
          </div>

          <Feld label="Gewünschte Erfahrung">
            <textarea {...feld("gewuenschteErfahrung")} rows={3} aria-label="Gewünschte Erfahrung" className={mehrzeilig} />
          </Feld>
          <Feld label="Verantwortungsumfang">
            <textarea {...feld("verantwortungsumfang")} rows={3} aria-label="Verantwortungsumfang" className={mehrzeilig} />
          </Feld>
          <Feld label="Interviewablauf" hinweis="Wie viele Gespräche, mit wem, wie lange.">
            <textarea {...feld("interviewablauf")} rows={4} aria-label="Interviewablauf" className={mehrzeilig} />
          </Feld>
        </div>
      </details>

      {stelle.benefits.length > 0 && (
        <p className="text-2xs text-ink-3">
          Erkannt: {stelle.benefits.join(" · ")}
        </p>
      )}

      {/*
       * Die Prüfung rechnet im Browser mit.
       *
       * Dieselbe Funktion wie auf dem Server — sie hängt an keiner
       * Datenbank und keinem Netz. Wer eine Formulierung ändert, sieht
       * den Hinweis verschwinden, statt erst nach dem Speichern zu
       * erfahren, ob es gereicht hat.
       */}
      <Pruefung befunde={alleBefunde} />

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        {darfSchreiben && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await stelleSpeichern(orgId, stelle.id, {
                  ...w,
                  workModel: w.workModel || null,
                  contractType: w.contractType || null,
                  weeklyHours: w.weeklyHours === "" ? null : Number(w.weeklyHours),
                  salaryMin: w.salaryMin === "" ? null : Number(w.salaryMin),
                  salaryMax: w.salaryMax === "" ? null : Number(w.salaryMax),
                  team: w.team || null,
                  bereich: w.bereich || null,
                  starttermin: w.starttermin || null,
                  aufgaben: w.aufgaben || null,
                  mussFaehigkeiten: zeilen(w.mussFaehigkeiten),
                  kannFaehigkeiten: zeilen(w.kannFaehigkeiten),
                  gewuenschteErfahrung: w.gewuenschteErfahrung || null,
                  arbeitssprache: w.arbeitssprache || null,
                  reiseanteil: w.reiseanteil || null,
                  verantwortungsumfang: w.verantwortungsumfang || null,
                  berichtslinie: w.berichtslinie || null,
                  interviewablauf: w.interviewablauf || null,
                  antwortzeit: w.antwortzeit || null,
                  kontaktperson: w.kontaktperson || null,
                });
                setMeldung(r.text);
              })
            }
            className="inline-flex h-11 items-center gap-2 rounded-(--radius-control) bg-accent px-5 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
            Speichern
          </button>
        )}

        {darfVeroeffentlichen && stelle.status !== "published" && (
          <button
            type="button"
            disabled={pending || !verifiziert || !bereit}
            title={
              !verifiziert
                ? "Die Organisation ist noch nicht bestätigt."
                : !bereit
                  ? "Es fehlen noch Angaben — siehe die Liste oben."
                  : undefined
            }
            onClick={() =>
              start(async () => {
                const r = await stelleVeroeffentlichen(orgId, stelle.id);
                setMeldung(r.text);
              })
            }
            className="inline-flex h-11 items-center rounded-(--radius-control) px-4 text-sm text-ink-2 ring-1 ring-line transition-colors hover:bg-soft hover:text-ink disabled:opacity-50"
          >
            Veröffentlichen
          </button>
        )}

        {darfVeroeffentlichen && stelle.status === "published" && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await stelleSchliessen(orgId, stelle.id);
                setMeldung(r.text);
              })
            }
            className="inline-flex h-11 items-center rounded-(--radius-control) px-4 text-sm text-ink-2 ring-1 ring-line transition-colors hover:bg-soft hover:text-ink"
          >
            Schliessen
          </button>
        )}

        {meldung && (
          <span role="status" className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            {meldung}
          </span>
        )}
      </div>
    </div>
  );
}

const eingabe =
  "h-11 rounded-(--radius-control) bg-inset px-3.5 text-[15px] outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60";

/** Dieselbe Fläche, nur mehrzeilig — damit Ein- und Mehrzeiler nicht
    wie zwei verschiedene Bauteile aussehen. */
const mehrzeilig =
  "rounded-(--radius-control) bg-inset p-3.5 text-[15px] leading-relaxed outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 resize-y";

function Feld({
  label,
  hinweis,
  children,
}: {
  label: string;
  hinweis?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {hinweis && <span className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">{hinweis}</span>}
      {children}
    </label>
  );
}

/**
 * Was an der Anzeige noch fehlt oder schiefliegt.
 *
 * Drei Stufen, absteigend sortiert: Was das Veröffentlichen blockiert,
 * was fehlt, was auffällt. Kein Rot — ein unvollständiger Entwurf ist
 * keine Fehlermeldung, sondern ein Zwischenstand.
 */
function Pruefung({
  befunde,
}: {
  befunde: ReturnType<typeof pruefeAnzeige>;
}) {
  if (befunde.length === 0) {
    return (
      <p className="max-w-[var(--measure)] rounded-(--radius-surface) bg-soft p-4 text-sm leading-relaxed text-ink-2">
        Vollständig. Gehalt, Ort, Stunden, Arbeitsmodell und Vertrag stehen drin — damit lässt sich
        ausrechnen, was die Stelle jemandem tatsächlich bringt.
      </p>
    );
  }

  const wort: Record<string, string> = {
    blockiert: "Fehlt zum Veröffentlichen",
    wichtig: "Sollte drinstehen",
    hinweis: "Fällt auf",
  };

  return (
    <div className="grid gap-3 rounded-(--radius-surface) bg-soft p-5">
      <h2 className="text-sm font-semibold">Was noch fehlt</h2>
      <ul className="grid gap-3">
        {befunde.map((b) => (
          <li key={b.key} className="grid gap-1">
            <p className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-medium text-ink">{b.titel}</span>
              <span className="abschnitts-titel text-ink-3">
                {wort[b.gewicht]}
              </span>
            </p>
            <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-2">{b.text}</p>
            {b.beleg && (
              <p className="max-w-[var(--measure)] border-l-2 border-line pl-3 text-2xs leading-relaxed text-ink-3">
                „{b.beleg}“
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
