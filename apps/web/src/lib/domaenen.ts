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
  /*
   * Der Rest der Anmeldung.
   *
   * `/login` und `/register` standen hier von Anfang an, die vier
   * hier nicht — und sie leiteten gemessen auf die öffentliche Seite:
   * `app.velvovatest.com/magic` → `velvova.vercel.app/magic`. Ein
   * Anmeldelink hätte damit die Sitzung auf der Domain angelegt, auf
   * der es keine Anwendung gibt.
   *
   * Alles, was eine Sitzung anlegt, gehört auf die Anwendungsdomain,
   * weil das Cookie an den Host gebunden ist. Das ist kein Geschmack,
   * sondern die Regel, aus der die ganze Trennung folgt.
   */
  /*
   * Der Rückweg vom Anmeldeanbieter.
   *
   * Stand unter „überall". Das war falsch: `/auth/callback` legt die
   * Sitzung an, und eine Sitzung auf der Marketingdomain nützt
   * niemandem — dort gibt es keine Anwendung. Ausserdem liegt der
   * PKCE-Prüfwert als Cookie auf dem Host, auf dem die Anmeldung
   * begann; auf der falschen Domain findet der Austausch ihn gar
   * nicht und scheitert lautlos.
   *
   * Unter `/auth` liegt genau eine Route, der Callback. Es geht hier
   * also nichts anderes mit.
   */
  "/auth",
  "/magic",
  "/bestaetigen",
  "/forgot-password",
  /* Verwaltung ist Anwendung, auch wenn sie nicht unter /app liegt. */
  "/admin",
  /*
   * `/pricing` sieht öffentlich aus und ist es nicht.
   *
   * Es gibt keine Preisseite mehr; die Adresse leitet auf
   * `/app/settings/abo`, weil Preise dort stehen, wo auch das eigene
   * Konto steht. Alte Lesezeichen und Suchergebnisse zeigen weiter
   * hierher — deshalb bleibt sie.
   *
   * Als „Seite" eingeordnet ergab das unter der Trennung einen
   * Umweg über beide Domains: app → seite/pricing →
   * seite/app/settings/abo → app. Drei Sprünge, zwei Domainwechsel,
   * und es endet dort, wo es anfing. Gemessen, nicht vermutet.
   */
  "/pricing",
];

/** Pfade, die überall gelten müssen. */
const UEBERALL = [
  "/api",
  "/_next",
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
export function umleitungFuer(
  host: string,
  pfad: string,
  abfrage?: URLSearchParams,
): string | null {
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

  /*
   * ── Die Wurzel der Anwendung ist nicht die Wurzel der Seite ─────
   *
   * Hier stand `/` in einem Topf mit dem übrigen Marketing, und
   * damit schickte `app.velvovatest.com/` jeden auf die öffentliche
   * Seite. Wer die Adresse der Anwendung eintippt, sah das Marketing
   * — beide Domains zeigten dasselbe, und die Trennung sah aus, als
   * täte sie nichts.
   *
   * Auf claude.ai landet man bei `/` in der Anwendung oder auf der
   * Anmeldung. Nie im Marketing. Die Wurzel gehört dem Host, unter
   * dem sie aufgerufen wird — und auf der Anwendungsdomain ist das
   * der Einstieg in die Anwendung.
   *
   * `/app/monday` und nicht `/login`: Wer angemeldet ist, soll nicht
   * über eine Anmeldeseite gehen, die er nicht braucht. Ist er es
   * nicht, schickt `requireUser` ihn dorthin — mit `weiter`, sodass
   * er danach ankommt, wo er hinwollte.
   */
  if (pfad === "/" && hier === kurz(app)) return `https://${app}/app/monday`;

  /*
   * ── Der Anmeldecode, der auf der falschen Domain ankommt ────────
   *
   * Gemessen am 9. September 2026: Supabase ist auf die Site-URL
   * `https://velvova.vercel.app` eingestellt, und JEDES Ziel, das
   * nicht in seiner Freigabeliste steht, wird durch diese Site-URL
   * ersetzt — geprüft mit drei Zielen, darunter eines, das sicher
   * nicht freigegeben ist. Alle drei landeten dort.
   *
   * Für den Google-Login heisst das: Der Browser kommt mit `?code=`
   * auf der ÖFFENTLICHEN Wurzel an statt auf `/auth/callback` der
   * Anwendung. Niemand löst den Code ein, es entsteht keine Sitzung,
   * und die Person steht wieder auf der Startseite — als hätte das
   * Anmelden nichts getan. Danach führt jeder Weg in die Anwendung
   * folgerichtig zurück auf die Anmeldung.
   *
   * Hier wird der Code an die richtige Stelle weitergereicht. Die
   * Abfrage bleibt dabei erhalten (die Middleware überträgt sie), und
   * der PKCE-Prüfwert liegt als Cookie auf der Anwendungsdomain —
   * also genau dort, wo der Austausch ihn braucht.
   *
   * Das ist ein Fangnetz, keine Reparatur. Richtig behoben ist es
   * erst, wenn in Supabase unter „Redirect URLs" auch die Adresse der
   * Anwendung steht; dann kommt der Browser gleich richtig an und
   * dieser Zweig greift nie. Er schadet auch dann nicht.
   *
   * Eng gefasst: nur die Wurzel, nur die öffentliche Seite, nur mit
   * `code`. Ein Marketingverweis mit `?code=` als Kampagnenkennung
   * würde sonst in der Anmeldung landen.
   */
  if (pfad === "/" && hier === kurz(seite) && abfrage?.get("code")) {
    return `https://${app}/auth/callback`;
  }

  const zustaendig = zustaendigFuer(pfad);
  if (zustaendig === "beide") return null;

  if (zustaendig === "anwendung" && hier === kurz(seite)) return `https://${app}${pfad}`;
  if (zustaendig === "seite" && hier === kurz(app)) return `https://${seite}${pfad}`;
  return null;
}

/**
 * Die Adresse der Anwendung für einen Link.
 *
 * ── Warum der aktuelle Host dazugehört ──────────────────────────
 *
 * Ein absoluter Link ist nur DRAUSSEN richtig. Innerhalb der
 * Anwendung wäre er schädlich: Aus jedem Klick würde ein voller
 * Seitenwechsel statt einer Navigation im Browser — dieselbe Domain,
 * derselbe Server, nur langsamer und mit weissem Blitz dazwischen.
 *
 * Dasselbe gilt für die Entwicklung. Auf `localhost` einen Link auf
 * die Testdomain zu setzen hiesse, dass jeder Klick den Rechner
 * verlässt.
 *
 * Deshalb: absolut nur, wenn wir nachweislich auf der öffentlichen
 * Seite stehen. In allen anderen Fällen relativ — und das ist nie
 * falsch, denn die Weiche in der Middleware leitet einen relativen
 * Pfad ohnehin an die richtige Adresse weiter. Der absolute Link
 * spart nur den einen Sprung.
 */
export function mondayLink(pfad = "/app/monday", aktuellerHost?: string | null): string {
  const app = mondayHost();
  const seite = seitenHost();
  if (!app || !seite || !aktuellerHost) return pfad;

  const kurz = (h: string) => h.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
  return kurz(aktuellerHost) === kurz(seite) ? `https://${app}${pfad}` : pfad;
}
