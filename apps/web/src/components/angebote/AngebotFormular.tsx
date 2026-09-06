"use client";

import { useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import { angebotSpeichern } from "@/lib/angebote";

/**
 * Ein Angebot eintragen.
 *
 * ── Warum nicht nur das Gehalt ────────────────────────────────
 *
 * Stunden, Remote-Anteil, Urlaub und Probezeit bestimmen den Alltag
 * oft stärker als die Zahl auf dem Papier — und sie sind in einer
 * Verhandlung meist beweglicher. Ein Formular, das nur nach dem Gehalt
 * fragt, lenkt das Gespräch auf die eine Grösse, die am festesten ist.
 *
 * ── Warum nur ein Pflichtfeld ─────────────────────────────────
 *
 * Wer gerade ein Angebot bekommen hat, hat den Kopf woanders. Das
 * Gehalt genügt für den Vergleich; alles andere kann später kommen.
 */
export function AngebotFormular({
  bewerbungen,
}: {
  bewerbungen: { id: string; titel: string; firma: string }[];
}) {
  const [laeuft, starten] = useTransition();
  const [fertig, setFertig] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  if (bewerbungen.length === 0) return null;
  if (fertig) {
    return (
      <Card>
        <p className="text-[15px] leading-relaxed text-ink">
          Eingetragen. Unten steht, wie es zum amtlichen Vergleichswert steht.
        </p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setFertig(false)}>
          Noch ein Angebot
        </Button>
      </Card>
    );
  }

  const feld = (name: string, label: string, hinweis?: string) => (
    <div key={name} className="grid gap-1.5">
      <label htmlFor={name} className="text-sm text-ink-2">
        {label} {hinweis && <span className="text-ink-3">({hinweis})</span>}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        min={0}
        className="min-h-9 rounded-(--radius-sm) border border-line bg-surface px-3 text-[15px] tabular text-ink"
      />
    </div>
  );

  return (
    <Card>
      <form
        className="grid gap-4"
        action={(fd) => {
          setFehler(null);
          const zahl = (n: string) => {
            const v = fd.get(n);
            const x = v === null || String(v).trim() === "" ? null : Number(v);
            return x !== null && Number.isFinite(x) ? x : null;
          };
          const applicationId = String(fd.get("bewerbung") ?? "");
          const grundgehalt = zahl("grundgehalt");
          if (!applicationId || grundgehalt === null) {
            setFehler("Wähle eine Bewerbung und trag das Grundgehalt ein.");
            return;
          }
          starten(async () => {
            try {
              await angebotSpeichern({
                applicationId,
                grundgehalt,
                bonus: zahl("bonus"),
                wochenstunden: zahl("wochenstunden"),
                remoteAnteil: zahl("remote"),
                urlaubstage: zahl("urlaub"),
                probezeitMonate: zahl("probezeit"),
                entscheidungsfrist: String(fd.get("frist") ?? "") || null,
                notizen: String(fd.get("notizen") ?? ""),
              });
              setFertig(true);
            } catch (e) {
              setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
            }
          });
        }}
      >
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold text-ink">Angebot eintragen</h2>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Nur das Grundgehalt ist nötig. Alles andere hilft beim Vergleichen — und ist in einer
            Verhandlung oft beweglicher als die Zahl auf dem Papier.
          </p>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="bewerbung" className="text-sm font-medium text-ink">
            Für welche Bewerbung?
          </label>
          <select
            id="bewerbung"
            name="bewerbung"
            className="min-h-9 rounded-(--radius-sm) border border-line bg-surface px-3 text-[15px] text-ink"
          >
            {bewerbungen.map((b) => (
              <option key={b.id} value={b.id}>
                {b.titel} — {b.firma}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {feld("grundgehalt", "Grundgehalt je Jahr", "€, brutto")}
          {feld("bonus", "Bonus je Jahr", "€, falls zugesagt")}
          {feld("wochenstunden", "Wochenstunden")}
          {feld("remote", "Remote-Anteil", "%")}
          {feld("urlaub", "Urlaubstage")}
          {feld("probezeit", "Probezeit", "Monate")}
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="frist" className="text-sm text-ink-2">
            Entscheidungsfrist <span className="text-ink-3">(freiwillig)</span>
          </label>
          <input
            id="frist"
            name="frist"
            type="date"
            className="min-h-9 w-fit rounded-(--radius-sm) border border-line bg-surface px-3 text-[15px] text-ink"
          />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="notizen" className="text-sm text-ink-2">
            Was sonst noch besprochen wurde <span className="text-ink-3">(freiwillig)</span>
          </label>
          <textarea
            id="notizen"
            name="notizen"
            rows={2}
            className="rounded-(--radius-sm) border border-line bg-surface px-3 py-2 text-[15px] text-ink"
          />
        </div>

        {fehler && <p className="text-sm text-critical-text">{fehler}</p>}

        <Button type="submit" disabled={laeuft} className="w-fit">
          {laeuft ? "Wird gespeichert…" : "Angebot eintragen"}
        </Button>
      </form>
    </Card>
  );
}
