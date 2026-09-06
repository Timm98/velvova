"use client";

import { useState, useTransition } from "react";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  berechtigungen, BRIEFING, KANAELE, RHYTHMEN, STUFEN,
  type Bedienart, type Kanal, type Kontotyp, type Rhythmus, type Sprachspeicherung, type Stufe,
} from "@/lib/nina/einrichtung/texte";
import { einstellungAendern, hintergrundAbschalten } from "@/app/nina-einrichten/aktionen";

/**
 * Nina im Privacy Center.
 *
 * ── Warum dieselben Texte wie bei der Einrichtung ─────────────
 *
 * Wer hier etwas ändert, muss dieselben Stufen mit denselben Worten
 * wiederfinden. Eine zweite Formulierung derselben Erlaubnis wäre
 * eine zweite Zusage — und bei der nächsten Änderung wüsste niemand,
 * welche von beiden gilt.
 *
 * ── Warum das Abschalten ein eigener Knopf ist ────────────────
 *
 * Widerrufen muss so einfach sein wie Zustimmen. Über die Stufenwahl
 * zurück auf „manual" wäre derselbe Effekt, aber drei Klicks und ein
 * Speichern — und im Protokoll stünde eine Änderung statt eines
 * Widerrufs.
 */

type Stand = {
  kontotyp: Kontotyp;
  bedienart: Bedienart | null;
  sprachspeicherung: Sprachspeicherung;
  stufe: Stufe | null;
  briefingAktiv: boolean;
  briefingRhythmus: Rhythmus;
  briefingZeit: string;
  zeitzone: string;
  kanaele: Kanal[];
  widerrufenAm: string | null;
};

export function NinaBereich({ start }: { start: Stand }) {
  const [stand, setStand] = useState(start);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, los] = useTransition();

  const stufen = STUFEN[stand.kontotyp];
  const briefing = BRIEFING[stand.kontotyp];
  const rechte = stand.stufe ? berechtigungen(stand.kontotyp, stand.stufe) : null;

  const speichern = (neu: Partial<Stand>) => {
    const naechster = { ...stand, ...neu };
    setStand(naechster);
    setFehler(null);
    setMeldung(null);
    los(async () => {
      const e = await einstellungAendern({
        bedienart: naechster.bedienart,
        sprachspeicherung: naechster.sprachspeicherung,
        stufe: naechster.stufe,
        briefingAktiv: naechster.briefingAktiv,
        briefingRhythmus: naechster.briefingRhythmus,
        briefingZeit: naechster.briefingZeit,
        zeitzone: naechster.zeitzone,
        kanaele: naechster.kanaele,
      });
      if (!e.ok) { setFehler(e.fehler ?? "Das hat nicht geklappt."); return; }
      setMeldung("Gespeichert.");
    });
  };

  const abschalten = () => {
    los(async () => {
      const e = await hintergrundAbschalten();
      if (e.ok && e.stand) {
        setStand((s) => ({ ...s, stufe: "manual", briefingAktiv: false, kanaele: [] }));
        setMeldung(
          "Die Hintergrundsuche ist aus. Geplante Läufe wurden abgebrochen, neue Briefings " +
          "werden nicht mehr erstellt. Bereits gespeicherte Ergebnisse bleiben liegen — " +
          "du kannst sie unten einzeln löschen.",
        );
      }
    });
  };

  return (
    <section id="nina" className="grid gap-5 scroll-mt-24">
      <div className="grid gap-1.5">
        <h2 className="text-lg font-semibold text-ink">Nina</h2>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Wie du mit Nina arbeitest und was sie im Hintergrund tun darf. Änderungen
          gelten ab sofort, nicht erst beim nächsten Anmelden.
        </p>
      </div>

      {stand.widerrufenAm && (
        <p className="rounded-(--radius-md) bg-caution-soft px-3 py-2 text-sm text-caution-text">
          Du hast die Hintergrundsuche widerrufen. Nina arbeitet nur noch, wenn du sie öffnest.
        </p>
      )}

      {/* ── Sprache oder Text ─────────────────────────────── */}
      <fieldset className="grid gap-2">
        <legend className="pb-1 text-2xs font-medium uppercase tracking-wider text-ink-3">
          So arbeitest du mit Nina
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["sprache", "text"] as Bedienart[]).map((b) => (
            <label
              key={b}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-(--radius-md) border px-3 py-2.5 text-sm",
                stand.bedienart === b ? "border-accent bg-accent-subtle" : "border-line-3 hover:bg-soft",
              )}
            >
              <input
                type="radio" name="nina-bedienart" checked={stand.bedienart === b}
                onChange={() => speichern({ bedienart: b })} disabled={laeuft}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              {b === "sprache" ? "Mit Nina sprechen" : "Mit Nina schreiben"}
            </label>
          ))}
        </div>
      </fieldset>

      {/* ── Transkripte — nur beim Sprechen ───────────────── */}
      {stand.bedienart === "sprache" && (
        <fieldset className="grid gap-2">
          <legend className="pb-1 text-2xs font-medium uppercase tracking-wider text-ink-3">
            Sprache und Transkripte
          </legend>
          {(
            [
              ["nur_bestaetigte", "Nur bestätigte Angaben speichern", "Audio und Transkript werden nach der Verarbeitung gelöscht."],
              ["transkript", "Transkript zusätzlich speichern", "Das Gespräch bleibt in deinem privaten Verlauf, bis du es löschst."],
            ] as [Sprachspeicherung, string, string][]
          ).map(([wert, titel, text]) => (
            <label
              key={wert}
              className={cn(
                "grid cursor-pointer gap-0.5 rounded-(--radius-md) border px-3 py-2.5",
                stand.sprachspeicherung === wert ? "border-accent bg-accent-subtle" : "border-line-3 hover:bg-soft",
              )}
            >
              <span className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio" name="nina-transkript" checked={stand.sprachspeicherung === wert}
                  onChange={() => speichern({ sprachspeicherung: wert })} disabled={laeuft}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                {titel}
              </span>
              <span className="pl-6 text-2xs text-ink-2">{text}</span>
            </label>
          ))}
        </fieldset>
      )}

      {/* ── Hintergrundaktivität ──────────────────────────── */}
      <fieldset className="grid gap-2">
        <legend className="pb-1 text-2xs font-medium uppercase tracking-wider text-ink-3">
          Hintergrundaktivität
        </legend>
        {stufen.map((s) => (
          <label
            key={s.wert}
            className={cn(
              "grid cursor-pointer gap-0.5 rounded-(--radius-md) border px-3 py-2.5",
              stand.stufe === s.wert ? "border-accent bg-accent-subtle" : "border-line-3 hover:bg-soft",
            )}
          >
            <span className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio" name="nina-stufe" checked={stand.stufe === s.wert}
                onChange={() => speichern({ stufe: s.wert, briefingAktiv: s.wert === "manual" ? false : stand.briefingAktiv })}
                disabled={laeuft}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              {s.titel}
            </span>
            <span className="pl-6 text-2xs text-ink-2">{s.text}</span>
          </label>
        ))}
      </fieldset>

      {rechte && (
        <div className="grid gap-3 rounded-(--radius-md) border border-line-3 p-4 sm:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <h3 className="text-2xs font-medium uppercase tracking-wider text-ink-3">Nina darf</h3>
            <ul className="grid gap-1">
              {rechte.darf.map((d) => (
                <li key={d} className="flex gap-2 text-2xs text-ink">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-positive" />{d}
                </li>
              ))}
            </ul>
          </div>
          <div id="berechtigungen" className="grid content-start gap-1.5 scroll-mt-24">
            <h3 className="text-2xs font-medium uppercase tracking-wider text-ink-3">Nina darf nicht</h3>
            <ul className="grid gap-1">
              {rechte.niemals.map((n) => (
                <li key={n} className="flex gap-2 text-2xs text-ink">
                  <Lock className="mt-0.5 h-3 w-3 shrink-0 text-ink-3" />{n}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── Morning Review ────────────────────────────────── */}
      {stand.stufe && stand.stufe !== "manual" && (
        <fieldset className="grid gap-3 rounded-(--radius-md) border border-line-3 p-4">
          <legend className="px-1 text-2xs font-medium uppercase tracking-wider text-ink-3">
            {briefing.titel}
          </legend>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox" checked={stand.briefingAktiv} disabled={laeuft}
              onChange={(e) =>
                speichern({
                  briefingAktiv: e.target.checked,
                  kanaele: e.target.checked && stand.kanaele.length === 0 ? ["in_app"] : stand.kanaele,
                })
              }
              className="h-4 w-4 accent-[var(--accent)]"
            />
            {briefing.schalter}
          </label>

          {stand.briefingAktiv && (
            <div className="grid gap-3 border-t border-line-3 pt-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-2xs uppercase tracking-wide text-ink-3">Häufigkeit</span>
                <select
                  value={stand.briefingRhythmus} disabled={laeuft}
                  onChange={(e) => speichern({ briefingRhythmus: e.target.value as Rhythmus })}
                  className="rounded-(--radius-md) border border-line bg-surface px-3 py-2 text-sm text-ink"
                >
                  {RHYTHMEN.map((r) => <option key={r.wert} value={r.wert}>{r.label}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-2xs uppercase tracking-wide text-ink-3">Uhrzeit</span>
                <input
                  type="time" value={stand.briefingZeit} disabled={laeuft}
                  onChange={(e) => speichern({ briefingZeit: e.target.value })}
                  className="rounded-(--radius-md) border border-line bg-surface px-3 py-2 text-sm text-ink"
                />
              </label>
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-2xs uppercase tracking-wide text-ink-3">Zeitzone</span>
                <input
                  type="text" value={stand.zeitzone} disabled={laeuft}
                  onChange={(e) => speichern({ zeitzone: e.target.value })}
                  className="rounded-(--radius-md) border border-line bg-surface px-3 py-2 text-sm text-ink"
                />
              </label>
              <div className="grid gap-1.5 sm:col-span-2">
                <span className="text-2xs uppercase tracking-wide text-ink-3">Zustellung</span>
                {KANAELE.map((k) => (
                  <label key={k.wert} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox" checked={stand.kanaele.includes(k.wert)} disabled={laeuft}
                      onChange={() =>
                        speichern({
                          kanaele: stand.kanaele.includes(k.wert)
                            ? stand.kanaele.filter((x) => x !== k.wert)
                            : [...stand.kanaele, k.wert],
                        })
                      }
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    {k.label}
                    {k.hinweis && <span className="text-2xs text-ink-3">— {k.hinweis}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}
        </fieldset>
      )}

      {/* ── Widerruf ──────────────────────────────────────── */}
      {stand.stufe && stand.stufe !== "manual" && (
        <div className="grid gap-2 rounded-(--radius-md) border border-line-3 p-4">
          <p className="text-sm text-ink">Hintergrundsuche beenden</p>
          <p className="max-w-[var(--measure)] text-2xs text-ink-2">
            Nina startet dann keine neuen Läufe mehr und erstellt keine Briefings.
            Bereits gespeicherte Ergebnisse bleiben erhalten — du entscheidest getrennt,
            ob du sie behalten oder löschen willst.
          </p>
          <button
            type="button" onClick={abschalten} disabled={laeuft}
            className="w-fit rounded-(--radius-md) border border-critical-border px-3 py-1.5 text-sm text-critical-text hover:bg-critical-soft"
          >
            Hintergrundsuche abschalten
          </button>
        </div>
      )}

      {meldung && <p role="status" className="text-2xs text-positive-text">{meldung}</p>}
      {fehler && <p role="alert" className="text-2xs text-critical-text">{fehler}</p>}
    </section>
  );
}
