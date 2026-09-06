"use client";

import { useState, useTransition } from "react";
import { Button, Card, Input } from "@/components/ui";
import { routeBerechnen, type Routenergebnis } from "@/lib/tools/routenrechner";

/**
 * Der Routen- und Pendelkostenrechner.
 *
 * ── Warum jede Annahme unter dem Ergebnis steht ───────────────
 *
 * „310 € Pendelkosten im Monat" ist eine Zahl, mit der jemand eine
 * Entscheidung über die nächsten Jahre trifft. Sie hängt an vier
 * Annahmen — Bürotage, Wochenfaktor, Hin- und Rückweg, Kosten je
 * Kilometer. Wer sie nicht sieht, kann die Zahl weder prüfen noch
 * anzweifeln.
 *
 * ── Warum ohne Kosten je Kilometer keine Kosten erscheinen ────
 *
 * Was ein Kilometer kostet, hängt am Fahrzeug, am Verbrauch und am
 * Kraftstoffpreis. Eine Standardannahme wäre eine Zahl, die niemand
 * geprüft hat — und auf die sich trotzdem jemand verlässt.
 */
export function RoutenFormular({
  vorbelegtNach,
  herkunft,
  modi,
  fehlenderModusGrund,
}: {
  vorbelegtNach?: string;
  herkunft?: string;
  modi: string[];
  fehlenderModusGrund: string | null;
}) {
  const [von, setVon] = useState("");
  const [nach, setNach] = useState(vorbelegtNach ?? "");
  const [modus, setModus] = useState(modi[0] ?? "auto");
  const [tage, setTage] = useState("5");
  const [kostenJeKm, setKostenJeKm] = useState("");
  const [feste, setFeste] = useState("");
  const [ergebnis, setErgebnis] = useState<Routenergebnis | null>(null);
  const [laeuft, starten] = useTransition();

  const zahl = (s: string): number | null => {
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  return (
    <div className="grid gap-6">
      <Card>
        <div className="grid gap-4">
          <Feld id="von" label="Startadresse" hinweis="Ort oder Adresse — so genau du magst.">
            <Input id="von" value={von} onChange={(e) => setVon(e.target.value)} placeholder="Karlsruhe" />
          </Feld>

          <Feld
            id="nach"
            label="Zieladresse"
            hinweis={herkunft ?? "Wo der Arbeitsplatz liegt."}
          >
            <Input id="nach" value={nach} onChange={(e) => setNach(e.target.value)} placeholder="Stuttgart" />
          </Feld>

          <Feld id="modus" label="Verkehrsmittel" hinweis={fehlenderModusGrund ?? undefined}>
            <select
              id="modus"
              value={modus}
              onChange={(e) => setModus(e.target.value)}
              className="h-11 w-full rounded-(--radius-control) border border-line bg-raised px-3 text-sm text-ink"
            >
              {modi.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Feld>

          <div className="grid gap-4 sm:grid-cols-3">
            <Feld id="tage" label="Tage vor Ort je Woche" hinweis="0 bis 7.">
              <Input id="tage" inputMode="numeric" value={tage} onChange={(e) => setTage(e.target.value)} />
            </Feld>
            <Feld
              id="kostenJeKm"
              label="Kosten je Kilometer"
              hinweis="Ohne Angabe bleiben die Fahrtkosten offen."
            >
              <Input id="kostenJeKm" inputMode="decimal" value={kostenJeKm}
                onChange={(e) => setKostenJeKm(e.target.value)} placeholder="0,30" />
            </Feld>
            <Feld id="feste" label="Feste Kosten je Monat" hinweis="Ticket, Parkplatz.">
              <Input id="feste" inputMode="decimal" value={feste}
                onChange={(e) => setFeste(e.target.value)} placeholder="59" />
            </Feld>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={laeuft || von.trim() === "" || nach.trim() === ""}
              onClick={() =>
                starten(async () => {
                  setErgebnis(
                    await routeBerechnen({
                      von,
                      nach,
                      modus,
                      buerotageJeWoche: Number(tage) || 0,
                      kostenJeKm: zahl(kostenJeKm),
                      festeKostenMonat: zahl(feste),
                    }),
                  );
                })
              }
            >
              Berechnen
            </Button>
            {/*
              * Zurücksetzen sichtbar, nicht versteckt.
              *
              * Wer aus einer Stelle kommt, hat eine vorbelegte
              * Zieladresse. Ohne sichtbaren Weg zurück bleibt sie
              * kleben, und die nächste Rechnung gilt heimlich für die
              * vorige Stelle.
              */}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setVon("");
                setNach("");
                setKostenJeKm("");
                setFeste("");
                setTage("5");
                setErgebnis(null);
              }}
            >
              Zurücksetzen
            </Button>
          </div>
        </div>
      </Card>

      {ergebnis && !ergebnis.ok && (
        <Card>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">{ergebnis.grund}</p>
        </Card>
      )}

      {ergebnis?.ok && (
        <Card>
          <div className="grid gap-4">
            <dl className="grid gap-2 text-sm">
              <Zeile label="Entfernung einfach" wert={`${ergebnis.entfernungKm} km`} />
              <Zeile label="Dauer einfach" wert={`${ergebnis.einfachMinuten} min`} />
              <Zeile label="Pro Arbeitstag" wert={`${ergebnis.taeglichMinuten} min`} />
              <Zeile label="Kilometer je Monat" wert={`${ergebnis.kmJeMonat?.toLocaleString("de-DE")} km`} />
              <Zeile
                label="Pendelzeit je Monat"
                wert={`${ergebnis.monatlichStunden?.toFixed(1)} Stunden`}
              />
              <Zeile
                label="Pendelzeit je Jahr"
                wert={`${ergebnis.jaehrlichStunden?.toFixed(0)} Stunden`}
              />
              <Zeile
                label="Kosten je Monat"
                wert={
                  ergebnis.kostenJeMonat === null
                    ? "offen — keine Kosten je Kilometer angegeben"
                    : `${ergebnis.kostenJeMonat?.toLocaleString("de-DE")} €`
                }
              />
              <Zeile
                label="Kosten je Jahr"
                wert={
                  ergebnis.kostenJeJahr === null
                    ? "offen"
                    : `${ergebnis.kostenJeJahr?.toLocaleString("de-DE")} €`
                }
              />
            </dl>

            <div className="border-t border-line pt-3">
              <h3 className="abschnitts-titel text-ink-3">
                Womit gerechnet wurde
              </h3>
              <ul className="mt-2 grid gap-1">
                {ergebnis.annahmen.map((a) => (
                  <li key={a} className="text-2xs leading-relaxed text-ink-3">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function Feld({
  id,
  label,
  hinweis,
  children,
}: {
  id: string;
  label: string;
  hinweis?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hinweis && <p className="text-2xs leading-relaxed text-ink-3">{hinweis}</p>}
    </div>
  );
}

function Zeile({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-1.5 last:border-0">
      <dt className="text-ink-2">{label}</dt>
      <dd className="tabular text-ink">{wert}</dd>
    </div>
  );
}
