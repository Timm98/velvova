/**
 * ══════════════════════════════════════════════════════════════════
 * Zwei Domains, eine Anwendung
 * ══════════════════════════════════════════════════════════════════
 *
 * velvova.com ist die öffentliche Seite. monday.ai ist die Anwendung.
 * Es ist dieselbe Next-Anwendung unter zwei Adressen — kein zweites
 * Deployment, kein doppelter Code, keine zwei Stände, die
 * auseinanderlaufen.
 *
 * ── Warum kein Cross-Domain-SSO nötig ist ───────────────────────
 *
 * Weil auf der öffentlichen Seite niemand angemeldet ist. Das ist die
 * ganze Entscheidung, und sie erspart ein eigenes Vorhaben: Ein
 * Sitzungs-Cookie gilt für eine registrierbare Domain und lässt sich
 * zwischen zweien grundsätzlich nicht teilen. Wenn aber nur EINE
 * Domain Sitzungen kennt, gibt es nichts zu teilen.
 *
 * „Mit Monday sprechen" wird damit ein gewöhnlicher Link. Kein Token,
 * kein Rücksprung, keine Sonderbehandlung — wer dort nicht angemeldet
 * ist, sieht die Anmeldung.
 *
 * ── Der Preis dieser Entscheidung ───────────────────────────────
 *
 * Die öffentliche Startseite kennt keinen angemeldeten Zustand mehr.
 * Heute begrüsst sie Angemeldete mit Namen; nach der Trennung zieht
 * das auf die Anwendung um. Das ist kein Nebeneffekt, sondern genau
 * der Handel: keine Sitzung draussen, kein SSO nötig.
 *
 * ── Solange nichts eingerichtet ist ─────────────────────────────
 *
 * Ist `NEXT_PUBLIC_MONDAY_HOST` nicht gesetzt, gibt es keine Trennung.
 * Alles läuft wie bisher unter einer Adresse. Der ganze Umbau liegt
 * hinter dieser einen Variablen — er lässt sich vollständig bauen und
 * prüfen, bevor irgendetwas umschaltet.
 */

/** Der Host der Anwendung, etwa `monday.ai`. Leer heisst: keine Trennung. */
export function mondayHost(): string | null {
  const wert = process.env.NEXT_PUBLIC_MONDAY_HOST?.trim().toLowerCase();
  return wert ? wert.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null;
}

/** Der Host der öffentlichen Seite, etwa `velvova.com`. */
export function seitenHost(): string | null {
  const wert = process.env.NEXT_PUBLIC_SEITEN_HOST?.trim().toLowerCase();
  return wert ? wert.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null;
}

export function trennungAktiv(): boolean {
  return mondayHost() !== null && seitenHost() !== null;
}

/**
 * Pfade, die zur Anwendung gehören.
 *
 * Alles unter `/app` und `/business`, und die Anmeldung: Sie legt das
 * Cookie an, und das Cookie gehört auf die Anwendungsdomain. Eine
 * Anmeldung auf der öffentlichen Seite würde eine Sitzung anlegen, die
 * dort nichts zu suchen hat — genau das, was die Trennung vermeidet.
 */
const ANWENDUNG = [
  "/app",
  "/business",
  "/login",
  "/register",
  "/firma",
  "/setup",
  "/monday-einrichten",
  "/nina-einrichten",
];

/** Pfade, die überall gelten müssen. */
const UEBERALL = [
  "/api",
  "/_next",
  "/auth",
  /* Rechtliches gehört auf beide: Wer auf der Anwendung ein Impressum
     sucht, soll es dort finden und nicht die Domain wechseln müssen. */
  "/imprint",
  "/privacy",
  "/terms",
];

export type Zustaendig = "anwendung" | "seite" | "beide";

/** Wohin gehört dieser Pfad? */
export function zustaendigFuer(pfad: string): Zustaendig {
  const p = pfad.toLowerCase();
  if (UEBERALL.some((v) => p === v || p.startsWith(`${v}/`))) return "beide";
  if (ANWENDUNG.some((v) => p === v || p.startsWith(`${v}/`))) return "anwendung";
  return "seite";
}

/**
 * Wohin ein Pfad umgeleitet werden muss — oder `null`.
 *
 * `null` heisst: hier ist er richtig. Das ist der Normalfall und
 * bleibt es, solange die Trennung nicht eingerichtet ist.
 */
export function umleitungFuer(host: string, pfad: string): string | null {
  const app = mondayHost();
  const seite = seitenHost();
  if (!app || !seite) return null;

  /*
   * Port weg, `www.` weg.
   *
   * Der Port, damit die lokale Entwicklung sich nicht im Kreis
   * umleitet. Und `www.`, weil jede echte Domain unter beiden Formen
   * ausgeliefert wird — ohne diese Zeile käme jemand auf
   * www.velvova.com/login nirgends an, weil der Vergleich scheitert
   * und die Umleitung ausbleibt.
   */
  const kurz = (h: string) => h.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
  const hier = kurz(host);
  const zustaendig = zustaendigFuer(pfad);
  if (zustaendig === "beide") return null;

  if (zustaendig === "anwendung" && hier === kurz(seite)) return `https://${app}${pfad}`;
  if (zustaendig === "seite" && hier === kurz(app)) return `https://${seite}${pfad}`;
  return null;
}

/**
 * Die Adresse der Anwendung für einen Link von der öffentlichen Seite.
 *
 * Ohne eingerichtete Trennung ein gewöhnlicher relativer Pfad — dann
 * ist es dieselbe Seite, und ein absoluter Link wäre ein unnötiger
 * Sprung über das Netz.
 */
export function mondayLink(pfad = "/app/monday"): string {
  const app = mondayHost();
  return app ? `https://${app}${pfad}` : pfad;
}
