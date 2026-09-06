import {
  ERGEBNISNAME,
  LEERFORMELN,
  felderFuer,
  feldFinden,
  type Ergebnis,
  type OnboardingFeld,
} from "./felder";

/**
 * Was aus den Angaben folgt — und was noch fehlt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es keine 100 % gibt, solange etwas Zwingendes fehlt
 * ══════════════════════════════════════════════════════════════
 *
 * Die bequeme Rechnung wäre „ausgefüllte durch mögliche Felder". Sie
 * ergibt 92 %, wenn von zwölf Feldern eines fehlt — auch wenn dieses
 * eine die Gehaltsspanne ist, ohne die keine Anzeige online geht.
 *
 * Diese Rechnung deckelt deshalb bei 95 %, solange eine zwingende
 * Angabe offen ist. Nicht als Strafe: 100 % heisst „bereit zur
 * Veröffentlichung", und das wäre dann eine Falschaussage.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum unbestätigte Angaben nur halb zählen
 * ══════════════════════════════════════════════════════════════
 *
 * Was Nina auf einer Website gefunden hat, ist eine Vermutung mit
 * Fundstelle. Sie wie eine bestätigte Angabe zu zählen hiesse, dass
 * ein Profil vollständig aussieht, obwohl niemand es gelesen hat — und
 * genau dieser Fall ist der gefährliche: Ein Gründungsjahr von der
 * falschen Unterseite steht dann öffentlich im Namen des Unternehmens.
 */

export type Angabe = {
  bereich: string;
  feld: string;
  wert: unknown;
  quelle: "gespraech" | "website" | "dokument" | "nutzer";
  quelleDetail: string | null;
  konfidenz: number;
  status: "bestaetigt" | "gefunden" | "abgeleitet" | "unklar" | "nicht_angegeben";
};

export type Warnung = {
  art: "leerformel" | "unbestaetigt" | "widerspruch" | "unklar";
  text: string;
  bereich?: string;
  feld?: string;
};

export type Ergebnisstand = {
  ergebnis: Ergebnis;
  name: string;
  prozent: number;
  bestaetigt: number;
  offen: OnboardingFeld[];
  /** Zwingende Angaben, die fehlen — sie verhindern das Veröffentlichen. */
  fehlendZwingend: OnboardingFeld[];
  warnungen: Warnung[];
  bereit: boolean;
};

function gefuellt(a: Angabe | undefined): boolean {
  if (!a || a.status === "nicht_angegeben") return false;
  const w = a.wert;
  if (w === null || w === undefined) return false;
  if (typeof w === "string") return w.trim().length > 0;
  if (Array.isArray(w)) return w.length > 0;
  return true;
}

export function bewerte(ergebnis: Ergebnis, angaben: Angabe[]): Ergebnisstand {
  const nach = new Map(angaben.map((a) => [`${a.bereich}.${a.feld}`, a]));
  const felder = felderFuer(ergebnis);

  const offen: OnboardingFeld[] = [];
  const fehlendZwingend: OnboardingFeld[] = [];
  let punkte = 0;
  let bestaetigt = 0;

  for (const f of felder) {
    const a = nach.get(`${f.bereich}.${f.feld}`);
    if (!gefuellt(a)) {
      offen.push(f);
      if (f.zwingend) fehlendZwingend.push(f);
      continue;
    }
    /* Bestätigt zählt ganz, gefunden oder abgeleitet halb. Unklar
       zählt gar nicht — eine widersprüchliche Angabe ist keine. */
    if (a!.status === "bestaetigt") {
      punkte += 1;
      bestaetigt++;
    } else if (a!.status === "unklar") {
      punkte += 0;
    } else {
      punkte += 0.5;
    }
  }

  const roh = felder.length === 0 ? 0 : Math.round((punkte / felder.length) * 100);
  /* Der Deckel bei 95: „100 %" heisst „bereit zur Veröffentlichung". */
  const prozent = fehlendZwingend.length > 0 ? Math.min(roh, 95) : roh;

  return {
    ergebnis,
    name: ERGEBNISNAME[ergebnis],
    prozent,
    bestaetigt,
    offen,
    fehlendZwingend,
    warnungen: warnungen(angaben, felder),
    bereit: fehlendZwingend.length === 0,
  };
}

/**
 * Woran Nina Anstoss nimmt.
 *
 * Ausschliesslich Aussagen über die Angaben — nie über das
 * Unternehmen. „Diese Formulierung sagt nichts" ist eine Aussage über
 * einen Satz; „euer Angebot ist nicht wettbewerbsfähig" wäre eine über
 * einen Arbeitgeber, und die steht uns nicht zu.
 */
function warnungen(angaben: Angabe[], felder: OnboardingFeld[]): Warnung[] {
  const w: Warnung[] = [];
  const relevant = new Set(felder.map((f) => `${f.bereich}.${f.feld}`));

  for (const a of angaben) {
    if (!relevant.has(`${a.bereich}.${a.feld}`)) continue;

    if (a.status === "unklar") {
      const f = feldFinden(a.bereich, a.feld);
      w.push({
        art: "unklar",
        bereich: a.bereich,
        feld: a.feld,
        text: `„${f?.label ?? a.feld}“ ist noch widersprüchlich.`,
      });
      continue;
    }

    /* Leerformeln nur im Text. Eine Liste von Fähigkeiten kann keine
       Werbefloskel sein. */
    const text = typeof a.wert === "string" ? a.wert : "";
    for (const formel of LEERFORMELN) {
      if (formel.muster.test(text)) {
        w.push({
          art: "leerformel",
          bereich: a.bereich,
          feld: a.feld,
          text: `„${formel.label}“ sagt nichts Konkretes. ${formel.frage}`,
        });
      }
    }
  }

  /*
   * Unbestätigte Fundstellen als eine Warnung, nicht als zwanzig.
   *
   * Sieben Zeilen „von der Website übernommen" untereinander liest
   * niemand; eine Zeile mit einer Zahl schon — und dahinter liegt die
   * Liste zum Durchgehen.
   */
  const unbestaetigt = angaben.filter(
    (a) => relevant.has(`${a.bereich}.${a.feld}`) && (a.status === "gefunden" || a.status === "abgeleitet"),
  );
  if (unbestaetigt.length > 0) {
    const vonWebsite = unbestaetigt.filter((a) => a.quelle === "website").length;
    w.push({
      art: "unbestaetigt",
      text:
        vonWebsite > 0
          ? `${unbestaetigt.length} Angaben sind noch nicht bestätigt, davon ${vonWebsite} von eurer Website.`
          : `${unbestaetigt.length} Angaben sind noch nicht bestätigt.`,
    });
  }

  return w;
}

/**
 * Der Satz, mit dem Nina zusammenfasst.
 *
 * Zahlen statt Adjektiven: „Ich habe 31 Angaben übernommen, sieben
 * davon von eurer Website, und drei offene Fragen erkannt." Wer das
 * liest, weiss, was zu tun ist — „fast fertig" weiss es nicht.
 */
export function zusammenfassung(angaben: Angabe[]): string {
  const uebernommen = angaben.filter((a) => a.status !== "nicht_angegeben").length;
  const vonWebsite = angaben.filter((a) => a.quelle === "website" && a.status !== "nicht_angegeben").length;
  const offen = angaben.filter((a) => a.status === "unklar").length;

  const teile = [`Ich habe ${uebernommen} ${uebernommen === 1 ? "Angabe" : "Angaben"} übernommen`];
  if (vonWebsite > 0) {
    teile.push(`${vonWebsite} ${vonWebsite === 1 ? "Information" : "Informationen"} von eurer Website ergänzt`);
  }
  if (offen > 0) {
    teile.push(`${offen} offene ${offen === 1 ? "Frage" : "Fragen"} erkannt`);
  }

  return teile.length === 1
    ? `${teile[0]}.`
    : `${teile.slice(0, -1).join(", ")} und ${teile.at(-1)}.`;
}

/**
 * Der Fortschritt — an Ergebnissen, nicht an Formularzeilen.
 *
 * „Unternehmen verstanden" ist eine Auskunft; „7 von 34 Feldern" ist
 * eine Aufforderung, weiter auszufüllen. Der Unterschied entscheidet,
 * ob jemand die Einrichtung als Gespräch erlebt oder als Formular mit
 * Chatfenster davor.
 */
export type Etappe = { id: string; label: string; erreicht: boolean };

export function etappen(angaben: Angabe[]): Etappe[] {
  const da = (bereich: string, feld: string) =>
    gefuellt(angaben.find((a) => a.bereich === bereich && a.feld === feld));

  const stelle = bewerte("anzeige", angaben);
  const matching = bewerte("matching", angaben);

  return [
    {
      id: "unternehmen",
      label: "Unternehmen verstanden",
      erreicht: da("unternehmen", "beschreibung") && da("unternehmen", "branche") && da("unternehmen", "hauptsitz"),
    },
    {
      id: "stelle",
      label: "Stelle verstanden",
      erreicht: da("stelle", "titel") && da("aufgaben", "haupt"),
    },
    {
      id: "passung",
      label: "Passung definiert",
      erreicht: da("muss", "faehigkeiten") && da("gehalt", "spanne"),
    },
    {
      id: "freigaben",
      label: "Freigaben festgelegt",
      erreicht: da("freigaben", "stufe") && da("freigaben", "kontaktFreigabe"),
    },
    {
      id: "bereit",
      label: "Bereit zur Veröffentlichung",
      erreicht: stelle.bereit && matching.bereit,
    },
  ];
}
