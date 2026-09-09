/**
 * ══════════════════════════════════════════════════════════════════
 * Verfügbarkeitsregister für die Unterseiten
 * ══════════════════════════════════════════════════════════════════
 *
 * Aufgenommen am 9. September 2026, beim Umbau der Unterseiten.
 *
 * ── Wozu das gut ist ─────────────────────────────────────────────
 *
 * Die alten Unterseiten beschrieben Dinge, die es im Code nicht gibt:
 * einen „Wechsel-Check", einen „Klarheits-Check" für Arbeitgeber, ein
 * „Application Studio". Gesucht wurde nach jedem dieser Namen — kein
 * Bauteil, keine Route, kein Endpunkt. Es waren Überschriften.
 *
 * Wer eine Seite neu textet, ohne vorher nachzusehen, schreibt
 * dieselben Versprechen in schönerer Typografie noch einmal hin.
 * Deshalb steht hier je Funktion, was tatsächlich existiert und woran
 * man das nachprüfen kann.
 *
 * ── Was dieses Register NICHT ist ────────────────────────────────
 *
 * Kein Zugriffsschutz. `stand: "nutzbar"` erlaubt nichts und schaltet
 * nichts frei; es entscheidet ausschliesslich, wie eine Seite über
 * eine Funktion SPRECHEN darf. Die Durchsetzung liegt weiter in der
 * Middleware und in den Endpunkten.
 *
 * Und kein Ersatz für eine Prüfung des laufenden Betriebs. Ein
 * vorhandener Endpunkt ist nicht dasselbe wie ein Dienst, der
 * antwortet. Wo das offen ist, steht es im Feld `grenze`.
 */

/**
 * Wie über eine Funktion gesprochen werden darf.
 *
 * Die vier Stufen sind absichtlich grob. Feinere Abstufungen laden
 * dazu ein, ein „fast fertig" zu erfinden, und genau das soll hier
 * nicht möglich sein.
 */
export type Stand =
  /** Im Code vorhanden, erreichbar, mit belegter Route. Konkrete Leistung und echte Aktion. */
  | "nutzbar"
  /** Vorhanden, aber begrenzt — Anmeldung, Freigabe oder Einladung nötig. Als solches benennen. */
  | "pilot"
  /** Beschlossen, nicht gebaut. Kleiner Ausblick, keine Aktion, kein Datum. */
  | "geplant"
  /** Behauptet, aber nicht gefunden. Kommt auf keiner Seite als Leistung vor. */
  | "nicht-verifiziert";

export interface Funktion {
  key: string;
  /** Der Name, unter dem die Funktion öffentlich vorkommt. */
  name: string;
  stand: Stand;
  /** Die tatsächliche Route, falls es eine gibt. Aus dem Dateibaum, nicht aus einem Screenshot. */
  route: string | null;
  /** Woran der Stand hängt — Datei, Endpunkt, Bauteil. Nachprüfbar. */
  nachweis: string;
  /** Was der Nachweis NICHT zeigt. Leer, wenn nichts offen ist. */
  grenze?: string;
}

export const REGISTER: readonly Funktion[] = [
  {
    key: "jobsuche",
    name: "Stellen suchen",
    stand: "pilot",
    route: "/app/jobs",
    nachweis:
      "apps/web/src/app/app/jobs/page.tsx mit JobSplitView, JobDetailPanel, JobFilters; Suche über /api/search.",
    grenze:
      "Liegt unter /app und damit hinter der Anmeldung (middleware.ts). Als Einstieg für Nichtangemeldete taugt es nur mit vorgeschalteter Registrierung — das ist keine freie Jobsuche.",
  },
  {
    key: "anzeige-einfuegen",
    name: "Anzeige über Link einfügen",
    stand: "pilot",
    route: "/api/jobs/import-url",
    nachweis:
      "apps/web/src/app/api/jobs/import-url/route.ts — nimmt eine mitgebrachte Anzeige entgegen und unterscheidet freigegebene von nicht freigegebenen Quellen.",
    grenze:
      "Ein Endpunkt, keine öffentliche Seite. Es gibt keinen Einstieg, auf dem jemand ohne Konto eine Anzeige einwirft.",
  },
  {
    key: "stelle-verstehen",
    name: "Angaben einer Stelle einordnen",
    stand: "pilot",
    route: "/app/jobs",
    nachweis:
      "JobDetailPanel zeigt Angaben mit Herkunft und kennt dreiwertige Felder — `shiftWork` ist true, false oder unbekannt, und unbekannt heisst dort ausdrücklich nicht false.",
    grenze:
      "Es ist die Detailansicht einer Stelle, kein eigener „Check“ mit Abschnitten für bekannt, offen und widersprüchlich.",
  },
  {
    key: "monday",
    name: "Gespräch mit dem Assistenten",
    stand: "pilot",
    route: "/app/monday",
    nachweis: "apps/web/src/app/app/monday/ mit /api/nina/chat, /api/nina/job-frage.",
  },
  {
    key: "hilfe-suche",
    name: "Suche in der Hilfe",
    stand: "nutzbar",
    route: "/help",
    nachweis:
      "apps/web/src/lib/content/hilfe.ts: 12 Einträge, 6 Bereiche, `sucheHilfe()` als Volltextsuche mit Synonymen — ohne Modell und ohne Netzaufruf.",
  },
  {
    key: "hilfe-ki",
    name: "KI-Antwort auf Produktfragen",
    stand: "nutzbar",
    route: "/api/nina/support",
    nachweis:
      "Eigener Endpunkt mit eigenem Prompt und eigenem Kontext; bekommt ausschliesslich die Frage und die Produktdokumentation aus lib/content/hilfe.ts.",
    grenze:
      "Ob der Modellanbieter dahinter antwortet, ist eine Betriebsfrage und aus dem Code nicht zu belegen.",
  },
  {
    key: "kontakt",
    name: "Support erreichen",
    stand: "nutzbar",
    route: "/contact",
    nachweis:
      "apps/web/src/app/(public)/contact/page.tsx — Mailto-Verweise auf benannte Adressen.",
    grenze:
      "Es gibt kein Formular und keine Eingangsbestätigung. Ein Kontaktformular zu bauen, das „Nachricht gesendet“ meldet, hätte hier nichts, was den Eingang bestätigt.",
  },
  {
    key: "wechsel-check",
    name: "Wechsel-Check",
    stand: "nicht-verifiziert",
    route: null,
    nachweis:
      "Gesucht nach „Wechsel-Check“, „WechselCheck“, „wechselcheck“ in apps/web/src — kein Treffer. Weder Route noch Bauteil noch Endpunkt.",
    grenze:
      "Der Name steht auf den alten Unterseiten als Leistung. Er darf auf den neuen nicht als Aktion vorkommen.",
  },
  {
    key: "klarheits-check",
    name: "Klarheits-Check für Arbeitgeber",
    stand: "nicht-verifiziert",
    route: null,
    nachweis:
      "„Klarheits“ kommt in apps/web/src nur in Marketingtexten und in lib/billing/preismodell.ts vor — dort als Angebotsname, nicht als Werkzeug.",
    grenze:
      "Auf der Unternehmensseite darf deshalb „Pilotzugang anfragen“ die Hauptaktion sein, nicht „Stellenanzeige prüfen“.",
  },
  {
    key: "arbeitgeber-freigabe",
    name: "Freigabe von Bewerberangaben an Arbeitgeber",
    stand: "pilot",
    route: "/business/matches",
    /*
     * Berichtigt am 9. September 2026.
     *
     * Hier stand „geplant — kein Freigabemodell im Code gefunden".
     * Das war falsch, und der Fehler lag in der Suche: gesucht wurde
     * nach „Klarheits" und „Freigabe" in apps/web/src/app/(public)
     * und in den Marketingbauteilen. Der Arbeitgeberbereich liegt
     * unter apps/web/src/app/business und war damit ausserhalb.
     *
     * Ein Register, das eine vorhandene Funktion für nicht vorhanden
     * erklärt, ist genauso falsch wie eines, das eine fehlende
     * behauptet — es führt nur in die andere Richtung.
     */
    nachweis:
      "apps/web/src/app/business/matches mit MatchKarte, Rollenprüfung über lib/arbeitgeber/zugang und darf(); Freigabemodell in lib/arbeitgeber/bewerbungen.ts mit eigener Schnittstelle `Freigabe` und Tests. Vorschläge entstehen laut matches/page.tsx nur zu Menschen, die der Auffindbarkeit ausdrücklich zugestimmt haben.",
    grenze:
      "Zwei Punkte sind offen. Erstens zeigt MatchKarte einen Gesamtwert und die Teilwerte „Fachlich“ und „Persönlich“, während die Freigabe daneben festhält, es solle „nur das Band, nie die Faktoren“ herausgehen — das gehört geklärt und nicht auf einer Marketingseite beschrieben. Zweitens ist die Kennung „Vorschlag …“ eine Pseudonymisierung, keine Anonymität; sie darf nicht als solche zugesagt werden.",
  },
  {
    key: "bewerbung-versenden",
    name: "Bewerbung über Velvova versenden",
    stand: "nicht-verifiziert",
    route: null,
    nachweis:
      "/app/applications verwaltet Bewerbungen; ein Versandweg an Arbeitgeber wurde nicht gefunden.",
    grenze:
      "Der Satz „wir verschicken nichts automatisch“ ist deshalb zu schwach — es gibt auch keinen manuellen Versand. Die Seite muss sagen, dass der Bewerbungsweg zum Originalanbieter führt.",
  },
  {
    key: "suchauftraege",
    name: "Suchaufträge",
    stand: "pilot",
    route: "/app/suchauftraege",
    nachweis: "apps/web/src/app/app/suchauftraege/ und /api/intern/suchauftrag.",
    grenze:
      "Ob ein Auftrag tatsächlich getaktet läuft und benachrichtigt, hängt am Zeitplan und ist aus dem Code allein nicht zu belegen.",
  },
  {
    key: "datenschutz-einstellungen",
    name: "Datenschutz- und Dateneinstellungen",
    stand: "pilot",
    route: "/app/settings",
    nachweis: "apps/web/src/app/app/settings/ ist vorhanden.",
    grenze:
      "Welche Schalter dort wirklich etwas speichern, ist beim Umbau der Sicherheitsseite einzeln zu prüfen. Bis dahin keine Zusage über Selbstbedienung beim Löschen und Exportieren.",
  },
] as const;

const NACH_KEY = new Map(REGISTER.map((f) => [f.key, f]));

/**
 * Eine Funktion nachschlagen.
 *
 * Wirft, wenn der Schlüssel unbekannt ist, statt `undefined`
 * zurückzugeben. Ein Tippfehler soll den Bau anhalten und nicht
 * stillschweigend eine Karte ohne Aktion ergeben.
 */
export function funktion(key: string): Funktion {
  const f = NACH_KEY.get(key);
  if (!f) throw new Error(`Unbekannte Funktion im Verfügbarkeitsregister: ${key}`);
  return f;
}

/**
 * Darf diese Funktion eine echte Aktion auf einer Unterseite bekommen?
 *
 * Nur „nutzbar" und „pilot" haben ein Ziel. Bei allem anderen führt
 * die Karte zum gekennzeichneten Beispiel — nicht auf `#`, nicht in
 * ein leeres Eingabefeld und nicht in eine vorgetäuschte Auswertung.
 */
export function hatZiel(f: Funktion): f is Funktion & { route: string } {
  return (f.stand === "nutzbar" || f.stand === "pilot") && f.route !== null;
}
