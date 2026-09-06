"use client";

import { Kombifeld, type KombiEintrag } from "@/components/ui/Kombifeld";
import {
  länder,
  währungName,
  währungen,
  zeitzoneMitVersatz,
  zeitzonen,
} from "@paycheck/i18n";

/**
 * Länder, Zeitzonen und Währungen — im Browser gebaut.
 *
 * Die drei Helfer aus `@paycheck/i18n` lesen nur `Intl`, und `Intl`
 * steht im Browser genauso zur Verfügung wie in Node. Sie hier
 * aufzurufen statt auf dem Server heisst: die Liste reist nicht mit.
 *
 * Übrig bleibt im Dokument, was eine Person tatsächlich sieht — ein
 * Feld mit einem Namen darin. Vorher waren es 1126 `<option>`-Elemente
 * für vier Felder, von denen jede Person höchstens vier Einträge
 * anfasst.
 *
 * Der Server schickt nur zweierlei: den gespeicherten Code und seinen
 * Namen. Der Name, damit vor der Hydration „Deutschland" dasteht und
 * nicht „DE" — der Unterschied zwischen einem fertigen Formular und
 * einem, das noch lädt.
 */

export function LandFeld({
  id,
  name,
  wert,
  anzeige,
  sprache,
}: {
  id: string;
  name: string;
  wert: string;
  anzeige: string;
  sprache: string;
}) {
  return (
    <Kombifeld
      id={id}
      name={name}
      wert={wert}
      anzeige={anzeige}
      platzhalter="Land suchen…"
      eintraege={(): KombiEintrag[] =>
        // Der Code kommt in den Suchtext, nicht in die Anzeige: „CH"
        // findet die Schweiz, ohne dass in der Liste überall
        // Buchstabenpaare stehen, die niemand liest.
        länder(sprache).map((l) => ({ wert: l.code, text: l.name, suchtext: l.code }))
      }
    />
  );
}

export function ZeitzoneFeld({
  id,
  name,
  wert,
  anzeige,
  sprache,
}: {
  id: string;
  name: string;
  wert: string;
  anzeige: string;
  sprache: string;
}) {
  return (
    <Kombifeld
      id={id}
      name={name}
      wert={wert}
      anzeige={anzeige}
      platzhalter="Stadt oder Region suchen…"
      eintraege={(): KombiEintrag[] => {
        /*
         * Der Versatz wird hier bestimmt, nicht auf dem Server.
         *
         * „(UTC+2)" gilt nur jetzt; im Winter steht dort „(UTC+1)".
         * Beim Server gerechnet wäre der Wert an dem Moment richtig, in
         * dem die Seite entstand — und danach so lange falsch, wie sie
         * offen bleibt.
         */
        const jetzt = new Date();
        return zeitzonen().map((tz) => ({
          wert: tz,
          text: zeitzoneMitVersatz(tz, sprache, jetzt),
          // Unterstriche raus: wer „New York" tippt, sucht nicht
          // „New_York".
          suchtext: tz.replace(/_/g, " "),
        }));
      }}
    />
  );
}

export function WaehrungFeld({
  id,
  name,
  wert,
  anzeige,
  sprache,
}: {
  id: string;
  name: string;
  wert: string;
  anzeige: string;
  sprache: string;
}) {
  return (
    <Kombifeld
      id={id}
      name={name}
      wert={wert}
      anzeige={anzeige}
      platzhalter="Währung suchen…"
      eintraege={(): KombiEintrag[] =>
        währungen().map((c) => ({ wert: c, text: währungName(c, sprache), suchtext: c }))
      }
    />
  );
}
