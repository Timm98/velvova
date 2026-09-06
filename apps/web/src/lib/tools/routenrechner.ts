"use server";

import { verfuegbareModi, wegBerechnen } from "@/lib/geo/anbieter";
/*
 * `ortAufloesen` statt `geokodieren` — mit Zwischenspeicher und der
 * Schreibweisen-Leiter. Stellenanzeigen führen den Ort oft dreiteilig
 * („Meckenheim, Rheinland, Nordrhein-Westfalen"), und die rohe
 * Geokodierung findet das nicht.
 */
import { ortAufloesen } from "@/lib/geo/arbeitsweg";
import { pendelrechnung, pendelkostenMonat, WOCHEN_JE_MONAT } from "@/lib/lebenswert/pendelzeit";
import { requireUser } from "@/lib/auth";

/**
 * Der Routen- und Pendelkostenrechner.
 *
 * ── Warum ausserhalb der Stellenseite ─────────────────────────
 *
 * Die Frage „was kostet mich dieser Weg" stellt sich auch ohne
 * Stellenanzeige — beim Vergleich zweier Angebote, beim Nachdenken
 * über einen Umzug, beim Rechnen, ob sich drei Bürotage lohnen. Ein
 * Rechner, den es nur im Zusammenhang einer Anzeige gibt, beantwortet
 * sie nur zufällig.
 *
 * ── Was hier NICHT passiert ───────────────────────────────────
 *
 * Ohne Routing-Anbieter wird nichts geschätzt. Eine erfundene
 * Entfernung sähe genauso aus wie eine berechnete, und mit ihr würde
 * jemand eine Entscheidung über seinen Alltag treffen. Statt dessen
 * sagt die Antwort, was fehlt.
 *
 * Auch die Kosten je Kilometer werden nicht angenommen: Was ein
 * Kilometer kostet, hängt am Fahrzeug, am Verbrauch und am
 * Kraftstoffpreis. Ohne Angabe steht die Zeit da und die Kosten
 * nicht — eine Standardannahme wäre eine Zahl, die niemand geprüft
 * hat und auf die sich jemand verlässt.
 */

export interface Routeneingabe {
  von: string;
  nach: string;
  land?: string | null;
  modus?: string;
  buerotageJeWoche: number;
  /** Kosten je Kilometer in Euro. `null` heisst: nicht angegeben. */
  kostenJeKm?: number | null;
  /** Feste monatliche Kosten, etwa ein ÖPNV-Ticket oder Parkplatz. */
  festeKostenMonat?: number | null;
}

export interface Routenergebnis {
  ok: boolean;
  /** Was fehlt, in einem Satz. Nur gesetzt, wenn `ok` falsch ist. */
  grund?: string;
  entfernungKm?: number;
  einfachMinuten?: number;
  taeglichMinuten?: number;
  monatlichStunden?: number;
  jaehrlichStunden?: number;
  kmJeMonat?: number;
  kostenJeMonat?: number | null;
  kostenJeJahr?: number | null;
  /** Jede benutzte Annahme, ausgeschrieben. */
  annahmen: string[];
}

export async function routeBerechnen(e: Routeneingabe): Promise<Routenergebnis> {
  await requireUser();

  const von = e.von?.trim();
  const nach = e.nach?.trim();
  if (!von || !nach) {
    return { ok: false, grund: "Start und Ziel werden beide gebraucht.", annahmen: [] };
  }

  const modi = verfuegbareModi();
  const modus = (modi.includes(e.modus as never) ? e.modus : modi[0]) as never;

  const [a, b] = await Promise.all([
    ortAufloesen(von, e.land ?? null).catch(() => null),
    ortAufloesen(nach, e.land ?? null).catch(() => null),
  ]);
  if (!a || !b) {
    return {
      ok: false,
      grund: !a
        ? `Die Startadresse „${von}“ liess sich nicht auf einen Ort auflösen.`
        : `Die Zieladresse „${nach}“ liess sich nicht auf einen Ort auflösen.`,
      annahmen: [],
    };
  }

  const weg = await wegBerechnen(a, b, modus).catch(() => null);
  if (!weg) {
    return {
      ok: false,
      grund:
        "Für diese Strecke liegt keine berechnete Route vor. Eine geschätzte Entfernung " +
        "würde hier wie eine gemessene aussehen — deshalb steht keine da.",
      annahmen: [],
    };
  }

  const tage = Math.min(7, Math.max(0, Math.round(e.buerotageJeWoche)));
  const p = pendelrechnung(weg.minuten, tage);

  /*
   * Kilometer je Monat: Hin und zurück, an den Bürotagen, mal den
   * Wochenfaktor. Der Faktor steht als Konstante daneben und wird
   * unten mitgenannt — sonst wäre er eine versteckte Annahme.
   */
  const kmJeMonat = Math.round(weg.kilometer * 2 * tage * WOCHEN_JE_MONAT);
  const fahrtkosten = pendelkostenMonat(weg.kilometer, tage, e.kostenJeKm ?? null);
  const feste = e.festeKostenMonat ?? null;
  const kostenJeMonat =
    fahrtkosten === null && feste === null ? null : (fahrtkosten ?? 0) + (feste ?? 0);

  const annahmen = [
    `${tage} ${tage === 1 ? "Arbeitstag" : "Arbeitstage"} je Woche vor Ort`,
    `${WOCHEN_JE_MONAT.toFixed(2)} Wochen je Monat (52 Wochen durch 12)`,
    "Hin- und Rückweg an jedem dieser Tage",
    `Verkehrsmittel: ${modus}`,
  ];
  if (e.kostenJeKm != null) {
    annahmen.push(`${e.kostenJeKm.toFixed(2)} € je Kilometer, von dir angegeben`);
  } else {
    annahmen.push("keine Kosten je Kilometer angegeben — Fahrtkosten bleiben offen");
  }
  if (feste != null) annahmen.push(`${feste.toFixed(2)} € feste Kosten je Monat, von dir angegeben`);

  return {
    ok: true,
    entfernungKm: Math.round(weg.kilometer * 10) / 10,
    einfachMinuten: Math.round(weg.minuten),
    taeglichMinuten: p.taeglichMinuten,
    monatlichStunden: p.monatlichStunden,
    jaehrlichStunden: p.jaehrlichStunden,
    kmJeMonat,
    kostenJeMonat: kostenJeMonat === null ? null : Math.round(kostenJeMonat * 100) / 100,
    kostenJeJahr: kostenJeMonat === null ? null : Math.round(kostenJeMonat * 12 * 100) / 100,
    annahmen,
  };
}
