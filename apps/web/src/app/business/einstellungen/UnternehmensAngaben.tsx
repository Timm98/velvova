"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, Info } from "lucide-react";
import { unternehmensangabenSpeichern } from "@/lib/arbeitgeber/aktionen";
import { BRANCHEN, GROESSEN, PRUEFSTAND_TEXT, domainAus, type Pruefstand } from "@/lib/arbeitgeber/registrierung-felder";
import { cn } from "@/lib/cn";

/**
 * Die Angaben, aus denen die Prüfung entsteht.
 *
 * ── Warum der Domainabgleich schon beim Tippen läuft ──────────
 *
 * Er ist die Angabe, die über den weiteren Weg entscheidet: Passt die
 * Domain zur Anmeldeadresse, geht es schnell; passt sie nicht, sieht
 * ein Mensch drauf. Wer das erst nach dem Absenden erfährt, hat die
 * falsche Erwartung mitgenommen.
 *
 * Gerechnet wird im Browser — `domainAus` hängt an keiner Datenbank.
 * Die Entscheidung fällt trotzdem auf dem Server; hier steht nur, was
 * herauskommen wird.
 */

const eingabe =
  "h-11 w-full rounded-(--radius-control) bg-inset px-3.5 text-[15px] outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60";

export function UnternehmensAngaben({
  orgId,
  darfAendern,
  adresse,
  start,
  stand,
}: {
  orgId: string;
  darfAendern: boolean;
  /** Die Anmeldeadresse — für den Domainabgleich. */
  adresse: string;
  start: {
    rechtsname: string;
    domain: string;
    branche: string;
    groesse: string;
    hauptsitz: string;
    handelsregister: string;
    ustId: string;
  };
  stand: Pruefstand;
}) {
  const [w, setW] = useState(start);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [aktuellerStand, setStand] = useState<Pruefstand>(stand);
  const [laeuft, starte] = useTransition();

  const domain = domainAus(w.domain);
  const adressDomain = domainAus(adresse);
  const passt = Boolean(domain && adressDomain && domain === adressDomain);

  const feld = (k: keyof typeof w) => ({
    value: w[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setW({ ...w, [k]: e.target.value }),
    disabled: !darfAendern || laeuft,
    className: eingabe,
  });

  const text = PRUEFSTAND_TEXT[aktuellerStand];

  return (
    <section className="grid gap-5 rounded-(--radius-md) border border-line p-5">
      <div className="grid gap-1">
        <h2 className="text-[15px] font-semibold text-ink">Unternehmen und Prüfung</h2>
        <p className="text-sm leading-relaxed text-ink-2">
          Diese Angaben brauchen wir, um zu bestätigen, dass ihr für dieses Unternehmen sprecht.
          Vorher lässt sich nichts veröffentlichen.
        </p>
      </div>

      {/*
        Der Prüfstand steht oben, nicht am Ende.

        Wer hierher kommt, will als Erstes wissen, woran es hängt —
        nicht, nachdem er acht Felder gelesen hat.
      */}
      <div
        className={cn(
          "flex items-start gap-2.5 rounded-(--radius-sm) px-4 py-3 text-sm",
          aktuellerStand === "bestaetigt"
            ? "border border-positive/40 bg-positive-soft"
            : aktuellerStand === "angaben_fehlen"
              ? "border border-caution/40 bg-caution-soft"
              : "border border-line bg-sunken",
        )}
      >
        {aktuellerStand === "bestaetigt" ? (
          <Check aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} />
        ) : aktuellerStand === "angaben_fehlen" ? (
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
        ) : (
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
        )}
        <span className="grid gap-0.5">
          <span className="font-medium text-ink">{text.titel}</span>
          <span className="text-ink-2">{text.text}</span>
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Feld label="Rechtlicher Unternehmensname" hinweis="Wie im Handelsregister.">
          <input {...feld("rechtsname")} aria-label="Rechtlicher Unternehmensname" />
        </Feld>
        <Feld
          label="Unternehmensdomain"
          hinweis={
            !domain
              ? "Etwa beispiel-gmbh.de"
              : passt
                ? `Stimmt mit eurer Anmeldeadresse überein (${adressDomain}).`
                : `Weicht von eurer Anmeldeadresse ab (${adressDomain ?? "keine"}). Dann prüft ein Mensch.`
          }
        >
          <input {...feld("domain")} aria-label="Unternehmensdomain" placeholder="beispiel-gmbh.de" />
        </Feld>
        <Feld label="Branche">
          <select {...feld("branche")} aria-label="Branche">
            <option value="">nicht angegeben</option>
            {BRANCHEN.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Feld>
        <Feld label="Unternehmensgrösse">
          <select {...feld("groesse")} aria-label="Unternehmensgrösse">
            <option value="">nicht angegeben</option>
            {GROESSEN.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Feld>
        <Feld label="Hauptsitz">
          <input {...feld("hauptsitz")} aria-label="Hauptsitz" placeholder="Dortmund" />
        </Feld>
        <Feld label="Handelsregisternummer" hinweis="Optional. Verkürzt die manuelle Prüfung.">
          <input {...feld("handelsregister")} aria-label="Handelsregisternummer" placeholder="HRB 12345" />
        </Feld>
        <Feld label="Umsatzsteuer-ID" hinweis="Optional.">
          <input {...feld("ustId")} aria-label="Umsatzsteuer-ID" placeholder="DE123456789" />
        </Feld>
      </div>

      {darfAendern && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button
            type="button"
            disabled={laeuft}
            onClick={() => {
              setMeldung(null);
              starte(async () => {
                const r = await unternehmensangabenSpeichern(orgId, w);
                setMeldung(r.text);
                if (r.stand) setStand(r.stand as Pruefstand);
              });
            }}
            className="inline-flex min-h-11 items-center rounded-(--radius-pill) bg-accent px-4 text-sm font-semibold text-accent-on hover:opacity-90 disabled:opacity-55"
          >
            {laeuft ? "Wird gespeichert …" : "Angaben speichern"}
          </button>
          {meldung && (
            <span role="status" className="text-sm text-ink-2">
              {meldung}
            </span>
          )}
        </div>
      )}

      {!darfAendern && (
        <p className="border-t border-line pt-4 text-sm text-ink-3">
          Ändern darf diese Angaben nur, wer mindestens die Rolle „Verwaltung“ hat.
        </p>
      )}
    </section>
  );
}

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
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hinweis && <span className="text-xs leading-relaxed text-ink-3">{hinweis}</span>}
    </label>
  );
}
