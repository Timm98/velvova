"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Keyboard, Lock, Mic, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { NinaVisual } from "@/components/nina/NinaVisual";
import type { NinaVisualState } from "@/components/nina/NinaProvider";
import { laender } from "@/lib/laender";
import {
  abschluss, BEDIENUNG, berechtigungen, BRIEFING, HINTERGRUND, KANAELE, KNOEPFE, KOPF,
  RHYTHMEN, SPRACHHINWEIS, STUFEN, VERTRAUEN, VERWEISE,
  type Bedienart, type Kanal, type Kontotyp, type Rhythmus, type Sprachspeicherung, type Stufe,
} from "@/lib/nina/einrichtung/texte";
import { einrichtungAbschliessen, ohneHintergrund, weiterInsGespraech } from "./aktionen";

/**
 * Monday einrichten — einmal je Konto.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nichts vorausgewählt ist
 * ══════════════════════════════════════════════════════════════
 *
 * „Empfohlen" steht als Abzeichen daneben, aber kein Feld ist
 * angehakt. Eine vorausgewählte Einwilligung ist keine: Sie misst,
 * wer widerspricht, nicht wer zustimmt.
 *
 * Deshalb bleibt der Hauptknopf gesperrt, bis beide Entscheidungen
 * getroffen sind — und deshalb steht daneben ein zweiter Knopf, der
 * ohne Hintergrundsuche weitergeht. Ablehnen muss ein Klick sein,
 * genau wie Zustimmen.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier bewusst NICHT gefragt wird
 * ══════════════════════════════════════════════════════════════
 *
 * Lebenslauf auswerten, Dokumente speichern, Website analysieren,
 * Bewerbung vorbereiten, Stelle veröffentlichen, Kontakt aufnehmen,
 * Gespräch aufzeichnen. Alles sieben wird dort gefragt, wo es
 * gebraucht wird — beim Hochladen, beim Veröffentlichen, vor dem
 * Kontakt.
 *
 * Vorsorglich abgefragt sind das sieben Haken ohne Zusammenhang, und
 * niemand weiss beim Setzen, wozu er zustimmt. Im Moment der Nutzung
 * ist es eine Frage mit Kontext.
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
};

/** Eine anklickbare Karte — für Bedienart und Stufen dasselbe Muster. */
function Wahlkarte({
  gewaehlt, titel, text, badge, nachsatz, zusatz, icon, name, wert, onWahl,
}: {
  gewaehlt: boolean;
  titel: string;
  text: string;
  badge?: string;
  nachsatz?: string;
  zusatz?: string;
  icon?: React.ReactNode;
  name: string;
  wert: string;
  onWahl: () => void;
}) {
  return (
    <label
      className={cn(
        "grid cursor-pointer gap-1.5 rounded-[12px] border p-4 transition-colors",
        gewaehlt ? "border-accent bg-accent-subtle" : "border-line-3 hover:bg-soft",
      )}
    >
      <span className="flex items-start gap-3">
        <input
          type="radio" name={name} value={wert} checked={gewaehlt} onChange={onWahl}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
        />
        {icon && <span className="mt-0.5 shrink-0 text-ink-2">{icon}</span>}
        <span className="grid gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-600 text-ink">{titel}</span>
            {badge && (
              <span className="rounded-[5px] bg-accent-soft px-1.5 py-0.5 text-2xs font-600 text-accent-text">
                {badge}
              </span>
            )}
          </span>
          <span className="text-sm leading-relaxed text-ink-2">{text}</span>
          {zusatz && <span className="text-2xs text-ink-3">{zusatz}</span>}
        </span>
      </span>
      {nachsatz && (
        <span className="flex gap-2 rounded-[8px] bg-inset px-3 py-2 text-2xs text-ink-2">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" />
          {nachsatz}
        </span>
      )}
    </label>
  );
}

export function Einrichtung({ start }: { start: Stand }) {
  const [stand, setStand] = useState<Stand>(start);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState<Stand | null>(null);
  const [laeuft, start_] = useTransition();

  const [sprache, setSprache] = useState<"de" | "en">("de");
  const [land, setLand] = useState("DE");
  const landesliste = useMemo(() => laender(sprache), [sprache]);

  /* Die Zeitzone des Geräts, einmal beim Laden. Serverseitig wäre sie
     die des Servers — und die stimmt für niemanden. */
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setStand((s) => ({ ...s, zeitzone: tz }));
    } catch {
      /* Ohne Zeitzonendaten bleibt Europe/Berlin. */
    }
  }, []);

  const firma = stand.kontotyp === "unternehmen";
  const bedienung = BEDIENUNG[stand.kontotyp];
  const stufen = STUFEN[stand.kontotyp];
  const hintergrund = HINTERGRUND[stand.kontotyp];
  const briefing = BRIEFING[stand.kontotyp];

  /*
   * Der Core spiegelt die Auswahl — ruhig, nicht verspielt.
   *
   * Er zeigt nur, was gerade entschieden wird: zuhören bei Sprache,
   * denken bei Hintergrundsuche, ein kurzes Gelingen am Ende. Keine
   * Bewegung ohne Anlass.
   */
  const coreZustand: NinaVisualState = fertig
    ? "success"
    : stand.stufe === "observe_and_save" || stand.stufe === "prepare_and_connect"
      ? "thinking"
      : stand.bedienart === "sprache"
        ? "listening"
        : "idle";

  const vollstaendig = stand.bedienart !== null && stand.stufe !== null;
  const briefingMoeglich = stand.stufe !== null && stand.stufe !== "manual";
  const rechte = stand.stufe ? berechtigungen(stand.kontotyp, stand.stufe) : null;

  const kanalUm = (k: Kanal) =>
    setStand((s) => ({
      ...s,
      kanaele: s.kanaele.includes(k) ? s.kanaele.filter((x) => x !== k) : [...s.kanaele, k],
    }));

  const absenden = () => {
    setFehler(null);
    start_(async () => {
      const e = await einrichtungAbschliessen({ ...stand, sprache, land });
      if (!e.ok) { setFehler(e.fehler ?? "Das hat nicht geklappt."); return; }
      setFertig(stand);
    });
  };

  const ohneSuche = () => {
    setFehler(null);
    start_(async () => {
      const e = await ohneHintergrund(stand.bedienart);
      if (!e.ok) { setFehler(e.fehler ?? "Das hat nicht geklappt."); return; }
      setFertig({ ...stand, stufe: "manual", briefingAktiv: false, bedienart: stand.bedienart ?? "text" });
    });
  };

  /* ── Abschluss ──────────────────────────────────────────────── */
  if (fertig) {
    const a = abschluss({
      kontotyp: fertig.kontotyp,
      bedienart: fertig.bedienart ?? "text",
      stufe: fertig.stufe ?? "manual",
      briefingAktiv: fertig.briefingAktiv,
      rhythmus: fertig.briefingRhythmus,
      zeit: fertig.briefingZeit,
    });
    return (
      <div className="mx-auto grid max-w-[560px] gap-6 py-12 text-center">
        <div className="justify-self-center">
          <NinaVisual size="lg" state="success" />
        </div>
        <h1 className="text-2xl font-600 text-ink">{a.titel}</h1>
        <p className="text-[15px] leading-relaxed text-ink-2">{a.text}</p>
        <div className="grid gap-2 pt-2 sm:grid-cols-2">
          <form action={weiterInsGespraech}>
            <button
              type="submit"
              className="w-full rounded-[10px] bg-accent px-5 py-3 text-[15px] font-600 text-accent-on"
            >
              {a.knoepfe.primaer}
            </button>
          </form>
          <Link
            href={firma ? "/business" : "/app"}
            className="grid place-items-center rounded-[10px] border border-line px-5 py-3 text-[15px] text-ink-2 hover:bg-soft"
          >
            {a.knoepfe.sekundaer}
          </Link>
        </div>
      </div>
    );
  }

  /* ── Die Einrichtung ────────────────────────────────────────── */
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(280px,380px)_1fr] lg:items-start lg:gap-12">
      {/* Links: Monday */}
      <aside className="grid justify-items-center gap-4 lg:sticky lg:top-24">
        {/*
          Dieselbe Grösse und Einfassung wie auf der Startseite und
          unter „Für Unternehmen": `size="xl"`, sichtbar geladen, ohne
          Grundfläche dahinter.

          Was hier anders ist, ist der Zustand. Dort läuft `zyklus` —
          der Core wechselt von selbst zwischen Ruhe, Denken und
          Sprechen, weil es nichts gibt, worauf er reagieren könnte.
          Hier gibt es etwas: die Auswahl. Ein Core, der nebenher seine
          eigene Schleife dreht, während daneben eine Entscheidung
          getroffen wird, sagt nichts über diese Entscheidung.
        */}
        <NinaVisual size="xl" strategie="sichtbar" grund="keiner" state={coreZustand} />
        <p className="max-w-[26ch] text-center text-2xs leading-relaxed text-ink-3">
          {stand.bedienart === "sprache"
            ? "Monday hört zu, sobald du das Gespräch startest."
            : stand.stufe && stand.stufe !== "manual"
              ? "Monday arbeitet dann auch, wenn du gerade nicht da bist."
              : "Monday wartet auf deine Entscheidung."}
        </p>
      </aside>

      <div className="grid gap-10">
        {/* ── Kopf ─────────────────────────────────────────── */}
        <header className="grid gap-2">
          <p className="text-2xs font-600 uppercase tracking-[0.14em] text-accent-text">
            {KOPF.eyebrow}
          </p>
          <h1 className="text-[clamp(1.6rem,3.5vw,2rem)] font-600 tracking-[-0.02em] text-ink">
            {KOPF.titel}
          </h1>
          <p className="max-w-[58ch] text-[15px] leading-relaxed text-ink-2">{KOPF.text}</p>
          <p className="text-2xs text-ink-3">{KOPF.fortschritt}</p>
        </header>

        {/* ── 1. Sprache oder Text ─────────────────────────── */}
        <section className="grid gap-4">
          <div className="grid gap-1.5">
            <h2 className="text-lg font-600 text-ink">{bedienung.titel}</h2>
            <p className="max-w-[62ch] text-sm leading-relaxed text-ink-2">{bedienung.text}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {bedienung.karten.map((k) => (
              <Wahlkarte
                key={k.wert}
                name="bedienart"
                wert={k.wert}
                gewaehlt={stand.bedienart === k.wert}
                onWahl={() => setStand((s) => ({ ...s, bedienart: k.wert }))}
                titel={k.titel}
                text={k.text}
                badge={k.badge}
                zusatz={k.zusatz}
                icon={k.wert === "sprache" ? <Mic className="h-4 w-4" /> : <Keyboard className="h-4 w-4" />}
              />
            ))}
          </div>

          {/* Der Sprachhinweis erscheint erst nach der Wahl — vorher
              wäre er eine Erklärung für etwas, das niemand vorhat. */}
          {stand.bedienart === "sprache" && (
            <div className="grid gap-3 rounded-[12px] border border-line-3 bg-inset p-4">
              <h3 className="text-sm font-600 text-ink">{SPRACHHINWEIS.titel}</h3>
              <p className="max-w-[62ch] text-sm leading-relaxed text-ink-2">{SPRACHHINWEIS.text}</p>
              <p className="text-sm font-600 text-ink">{SPRACHHINWEIS.frage}</p>
              <div className="grid gap-2">
                {SPRACHHINWEIS.optionen.map((o) => (
                  <Wahlkarte
                    key={o.wert}
                    name="sprachspeicherung"
                    wert={o.wert}
                    gewaehlt={stand.sprachspeicherung === o.wert}
                    onWahl={() => setStand((s) => ({ ...s, sprachspeicherung: o.wert }))}
                    titel={o.titel}
                    text={o.text}
                    badge={"badge" in o ? o.badge : undefined}
                  />
                ))}
              </div>
              <p className="text-2xs text-ink-3">{SPRACHHINWEIS.mikrofonHinweis}</p>
            </div>
          )}
        </section>

        {/* ── 2. Hintergrund ───────────────────────────────── */}
        <section className="grid gap-4">
          <div className="grid gap-1.5">
            <h2 className="text-lg font-600 text-ink">{hintergrund.titel}</h2>
            <p className="max-w-[62ch] text-sm leading-relaxed text-ink-2">{hintergrund.text}</p>
          </div>

          <div className="grid gap-3">
            {stufen.map((s) => (
              <Wahlkarte
                key={s.wert}
                name="stufe"
                wert={s.wert}
                gewaehlt={stand.stufe === s.wert}
                onWahl={() =>
                  setStand((v) => ({
                    ...v,
                    stufe: s.wert,
                    /* Zurück auf Stufe 1 nimmt das Briefing mit. Es
                       ohne Hintergrundsuche stehen zu lassen hiesse,
                       eine Zusammenfassung von nichts zu versprechen. */
                    briefingAktiv: s.wert === "manual" ? false : v.briefingAktiv,
                  }))
                }
                titel={s.titel}
                text={s.text}
                badge={s.badge}
                nachsatz={s.nachsatz}
              />
            ))}
          </div>

          {/* Was daraus folgt — sichtbar, sobald eine Stufe steht. */}
          {rechte && (
            <div className="grid gap-3 rounded-[12px] border border-line-3 p-4 sm:grid-cols-2">
              <div className="grid content-start gap-1.5">
                <h3 className="text-2xs font-600 uppercase tracking-wide text-ink-3">Monday darf</h3>
                <ul className="grid gap-1">
                  {rechte.darf.map((d) => (
                    <li key={d} className="flex gap-2 text-2xs text-ink">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-positive" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid content-start gap-1.5">
                <h3 className="text-2xs font-600 uppercase tracking-wide text-ink-3">Monday darf nicht</h3>
                <ul className="grid gap-1">
                  {rechte.niemals.map((n) => (
                    <li key={n} className="flex gap-2 text-2xs text-ink">
                      <Lock className="mt-0.5 h-3 w-3 shrink-0 text-ink-3" />
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ── Briefing — nur ab Stufe 2 ──────────────────── */}
          {briefingMoeglich && (
            <div className="grid gap-3 rounded-[12px] border border-line-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-1">
                  <h3 className="text-sm font-600 text-ink">{briefing.titel}</h3>
                  <p className="max-w-[52ch] text-sm text-ink-2">{briefing.text}</p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={stand.briefingAktiv}
                    onChange={(e) =>
                      setStand((s) => ({
                        ...s,
                        briefingAktiv: e.target.checked,
                        kanaele: e.target.checked && s.kanaele.length === 0 ? ["in_app"] : s.kanaele,
                      }))
                    }
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  {briefing.schalter}
                </label>
              </div>

              {/* Das Beispiel ist ein Beispiel — und sagt das auch. */}
              <figure className="grid gap-1 rounded-[8px] bg-inset px-3 py-2.5">
                <figcaption className="text-2xs uppercase tracking-wide text-ink-3">
                  Beispiel — keine echten Ergebnisse
                </figcaption>
                <p className="text-sm text-ink-2">{briefing.beispiel}</p>
              </figure>

              {stand.briefingAktiv && (
                <div className="grid gap-4 border-t border-line-3 pt-3 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-2xs uppercase tracking-wide text-ink-3">Häufigkeit</span>
                    <select
                      value={stand.briefingRhythmus}
                      onChange={(e) => setStand((s) => ({ ...s, briefingRhythmus: e.target.value as Rhythmus }))}
                      className="rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink"
                    >
                      {RHYTHMEN.map((r) => (
                        <option key={r.wert} value={r.wert}>{r.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-2xs uppercase tracking-wide text-ink-3">Uhrzeit</span>
                    <input
                      type="time"
                      value={stand.briefingZeit}
                      onChange={(e) => setStand((s) => ({ ...s, briefingZeit: e.target.value }))}
                      className="rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink"
                    />
                  </label>

                  <label className="grid gap-1.5 sm:col-span-2">
                    <span className="text-2xs uppercase tracking-wide text-ink-3">
                      Zeitzone <span className="normal-case text-line-2">— automatisch erkannt, änderbar</span>
                    </span>
                    <input
                      type="text"
                      value={stand.zeitzone}
                      onChange={(e) => setStand((s) => ({ ...s, zeitzone: e.target.value }))}
                      className="rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink"
                    />
                  </label>

                  <fieldset className="grid gap-1.5 sm:col-span-2">
                    <legend className="pb-1 text-2xs uppercase tracking-wide text-ink-3">Zustellung</legend>
                    <div className="grid gap-1.5">
                      {KANAELE.map((k) => (
                        <label key={k.wert} className="flex items-center gap-2 text-sm text-ink">
                          <input
                            type="checkbox"
                            checked={stand.kanaele.includes(k.wert)}
                            onChange={() => kanalUm(k.wert)}
                            className="h-4 w-4 accent-[var(--accent)]"
                          />
                          {k.label}
                          {k.hinweis && <span className="text-2xs text-ink-3">— {k.hinweis}</span>}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Sprache und Wohnort ──────────────────────────── */}
        <section className="grid gap-3">
          <div className="grid gap-1.5">
            <h2 className="text-lg font-600 text-ink">Sprache und Wohnort</h2>
            <p className="max-w-[62ch] text-sm leading-relaxed text-ink-2">
              Damit Monday in deiner Sprache antwortet und weiss, welcher Arbeitsmarkt
              für dich gilt. Beides lässt sich in den Einstellungen ändern.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-2xs uppercase tracking-wide text-ink-3">Sprache</span>
              <select
                value={sprache}
                onChange={(e) => setSprache(e.target.value === "en" ? "en" : "de")}
                className="rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink"
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-2xs uppercase tracking-wide text-ink-3">Land</span>
              <select
                value={land}
                onChange={(e) => setLand(e.target.value)}
                className="rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink"
              >
                {landesliste.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* ── 3. Vertrauen ─────────────────────────────────── */}
        <section className="grid gap-3 rounded-[12px] bg-inset p-4">
          <h2 className="flex items-center gap-2 text-lg font-600 text-ink">
            <ShieldCheck className="h-4 w-4 text-positive" />
            Du behältst die Kontrolle.
          </h2>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {VERTRAUEN[stand.kontotyp].map((v) => (
              <li key={v} className="flex gap-2 text-sm text-ink-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" />
                <span>{v}</span>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-2xs">
            {VERWEISE.map((v) => (
              <Link key={v.href} href={v.href} className="text-ink-3 underline underline-offset-2 hover:text-ink">
                {v.label}
              </Link>
            ))}
          </p>
        </section>

        {/* ── Abschluss ────────────────────────────────────── */}
        <div className="grid gap-3">
          {fehler && (
            <p role="alert" className="rounded-[8px] bg-critical-soft px-3 py-2 text-sm text-critical-text">
              {fehler}
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <button
              type="button"
              onClick={absenden}
              disabled={!vollstaendig || laeuft}
              className="rounded-[10px] bg-accent px-5 py-3 text-[15px] font-600 text-accent-on disabled:opacity-45"
            >
              {KNOEPFE.primaer}
            </button>
            <button
              type="button"
              onClick={ohneSuche}
              disabled={laeuft}
              className="rounded-[10px] border border-line px-5 py-3 text-[15px] text-ink-2 hover:bg-soft disabled:opacity-45"
            >
              {KNOEPFE.sekundaer}
            </button>
          </div>
          {!vollstaendig && (
            <p className="text-2xs text-ink-3">
              Wähle oben, wie du mit Monday arbeiten möchtest und was sie im Hintergrund tun darf.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
