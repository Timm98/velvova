import { decideForProvider } from "@paycheck/sources";
import type { JobSourceAdapter } from "./adapter.ts";
export type { ProviderCapabilities } from "./adapter.ts";
export { DEFAULT_CAPABILITIES } from "./adapter.ts";

/**
 * Was ein Anbieter kann, ob er gerade antwortet, und wann man aufhört
 * zu fragen.
 *
 * Drei Dinge, die zusammengehören und bisher fehlten:
 *
 * **Fähigkeiten.** Nicht jeder Anbieter kann nach Datum filtern oder
 * liefert Gehaltsangaben. Ohne diese Auskunft fragt der Aufrufer
 * blindlings und deutet ein leeres Ergebnis als „keine Stellen“ statt
 * als „diese Frage kann der Anbieter nicht beantworten“.
 *
 * **Gesundheitsprüfung.** Ein Anbieter, der langsam kaputtgeht, sieht
 * lange aus wie einer, der wenig liefert.
 *
 * **Sicherung.** Nach genug Fehlschlägen wird gar nicht mehr gefragt.
 * Das schützt nicht uns, sondern den anderen: einen überlasteten
 * Dienst weiter im Minutentakt anzufragen, macht seinen Ausfall länger.
 */

export type HealthState = "ok" | "degraded" | "down" | "not_configured" | "not_allowed";

export interface HealthReport {
  provider: string;
  state: HealthState;
  /** In ganzen Sätzen, für Menschen. Landet in der Betriebsansicht. */
  detail: string;
  latencyMs: number | null;
  checkedAt: Date;
}

/**
 * Antwortet der Anbieter?
 *
 * Die Reihenfolge der Prüfungen ist die Reihenfolge der Verantwortung:
 * zuerst, ob wir überhaupt fragen dürfen, dann, ob wir es können, und
 * erst danach, ob es klappt. Ein rechtlich nicht freigegebener Anbieter
 * wird auch nicht angepingt — ein Health-Check ist ein Netzzugriff.
 */
export async function healthCheck(
  adapter: JobSourceAdapter,
  now: () => number = () => performance.now(),
): Promise<HealthReport> {
  const checkedAt = new Date();
  const base = { provider: adapter.key, latencyMs: null, checkedAt };

  const policy = decideForProvider(adapter.key);
  if (policy.decision !== "approved" || !policy.allowedOperations.includes("Search")) {
    return { ...base, state: "not_allowed", detail: policy.reason };
  }

  if (!adapter.isConfigured()) {
    return { ...base, state: "not_configured", detail: "Keine Zugangsdaten hinterlegt." };
  }

  const start = now();
  try {
    const listings = await adapter.fetchListings({ limit: 1 });
    const latencyMs = Math.round(now() - start);

    if (listings.length === 0) {
      // Kein Fehler, aber auch kein Beleg dafür, dass es funktioniert.
      // Das ehrliche Wort dafür ist „eingeschränkt“, nicht „in Ordnung“.
      return {
        ...base,
        state: "degraded",
        latencyMs,
        detail: "Antwortet, liefert aber keine Ergebnisse.",
      };
    }

    // Über zehn Sekunden für eine einzelne Anzeige heisst: der volle
    // Abruf läuft in eine Zeitüberschreitung, bevor er fertig ist.
    if (latencyMs > 10_000) {
      return { ...base, state: "degraded", latencyMs, detail: `Antwortet langsam (${latencyMs} ms).` };
    }

    return { ...base, state: "ok", latencyMs, detail: `Antwortet in ${latencyMs} ms.` };
  } catch (error) {
    return {
      ...base,
      state: "down",
      latencyMs: Math.round(now() - start),
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Die Sicherung.
 *
 * Nach `threshold` Fehlschlägen in Folge wird für `cooldownMs` nicht
 * mehr gefragt. Danach genau ein Versuch: klappt er, ist die Sicherung
 * zurückgesetzt; klappt er nicht, beginnt die Wartezeit von vorn.
 *
 * Der einzelne Versuch ist der Punkt. Nach der Wartezeit wieder mit
 * voller Frequenz anzufangen, verlängert den Ausfall des anderen — und
 * genau das passiert, wenn viele Dienste gleichzeitig neu starten.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;
  private halfOpen = false;

  // Ebenfalls ohne Parameter-Properties: Node strippt Typen, es
  // übersetzt sie nicht. `private readonly` im Konstruktor erzeugt
  // Code und lässt die Datei unter --experimental-strip-types
  // scheitern — wovon die Skripte hier abhängen.
  private readonly threshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(
    threshold = 3,
    cooldownMs = 5 * 60_000,
    now: () => number = () => Date.now(),
  ) {
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
    this.now = now;
  }

  /** Darf gefragt werden? */
  allows(): boolean {
    if (this.openedAt === null) return true;

    if (this.now() - this.openedAt >= this.cooldownMs) {
      this.halfOpen = true;
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAt = null;
    this.halfOpen = false;
  }

  recordFailure(): void {
    this.failures += 1;

    // Ein Fehlschlag im Probeversuch führt sofort zurück in die
    // Wartezeit. Erst wieder bis zum Schwellwert zu zählen, hiesse: der
    // kaputte Dienst bekommt jedes Mal drei weitere Anfragen.
    if (this.halfOpen || this.failures >= this.threshold) {
      this.openedAt = this.now();
      this.halfOpen = false;
    }
  }

  get state(): "closed" | "open" | "half_open" {
    if (this.openedAt === null) return "closed";
    return this.now() - this.openedAt >= this.cooldownMs ? "half_open" : "open";
  }

  /** Für die Betriebsansicht: wie lange noch. */
  retryInMs(): number {
    if (this.openedAt === null) return 0;
    return Math.max(0, this.cooldownMs - (this.now() - this.openedAt));
  }
}

/**
 * Zwischengespeicherte Gesundheitsprüfung.
 *
 * Die Betriebsansicht wird bei jedem Aufruf neu gerechnet. Ohne
 * Zwischenspeicher hiesse das: jeder Blick auf die Seite ist ein
 * Netzzugriff bei jedem Anbieter. Bei geöffnetem Browsertab und einem
 * Neuladen alle paar Sekunden wäre die Betriebsansicht selbst die
 * Ursache des nächsten Ausfalls — und die Sicherung ein paar Zeilen
 * weiter unten wäre eine Regel, die wir anderen auferlegen und selbst
 * brechen.
 *
 * Eine Minute ist der Kompromiss: frisch genug, um einen Ausfall zu
 * bemerken, selten genug, um keiner zu werden.
 */
const CACHE_MS = 60_000;
const cache = new Map<string, { report: HealthReport; at: number }>();

export async function cachedHealthCheck(
  adapter: JobSourceAdapter,
  now: () => number = () => Date.now(),
): Promise<HealthReport> {
  const hit = cache.get(adapter.key);
  if (hit && now() - hit.at < CACHE_MS) return hit.report;

  // Steht die Sicherung offen, wird nicht geprüft. Ein Health-Check ist
  // eine Anfrage wie jede andere.
  const breaker = breakerFor(adapter.key);
  if (!breaker.allows()) {
    const sekunden = Math.ceil(breaker.retryInMs() / 1000);
    return {
      provider: adapter.key,
      state: "down",
      detail: `Abruf ausgesetzt, nächster Versuch in ${sekunden} Sekunden.`,
      latencyMs: null,
      checkedAt: new Date(),
    };
  }

  const report = await healthCheck(adapter);
  cache.set(adapter.key, { report, at: now() });
  return report;
}

/** Eine Sicherung je Adapter, prozessweit. */
const breakers = new Map<string, CircuitBreaker>();

export function breakerFor(providerKey: string): CircuitBreaker {
  let b = breakers.get(providerKey);
  if (!b) {
    b = new CircuitBreaker();
    breakers.set(providerKey, b);
  }
  return b;
}

/* ══════════════════════════════════════════════════════════════════
   Die zweite Sicherung: eine je Anbieter, nicht je Land
   ══════════════════════════════════════════════════════════════════

   Hier stand einmal der Kommentar „Eine Sicherung je Anbieter" über
   einer Zuordnung nach `adapter.key`. Beides zusammen stimmt nicht:
   Die Schlüssel heissen `careerjet_de`, `careerjet_fr`, `adzuna_de`
   — der Anbieter ist der Teil vor dem Unterstrich.

   ── Was das gekostet hat ────────────────────────────────────────

   Careerjet hat 32 Ländervarianten. Am 9. September 2026 antworteten
   alle 32 mit derselben Meldung: „Unauthorized access from IP …" —
   eine Freigabeliste beim Anbieter, also ein Zustand des Kontos und
   nicht des Landes.

   Mit einer Sicherung je Land heisst das: 32 Sicherungen lernen
   dieselbe Lektion getrennt, jede braucht drei Fehlschläge, und nach
   fünf Minuten Wartezeit fangen alle wieder an. Fast hundert Anfragen
   je Lauf, deren Ausgang von der ersten an feststand — bezahlt aus
   dem Zeitbudget der Quellen, die geliefert hätten.

   ── Warum trotzdem beide Sicherungen ────────────────────────────

   Weil nicht jeder Fehler den Anbieter meint. Ein Land, das 404
   liefert oder gerade leer ist, sagt nichts über die anderen 31. Die
   Anbietersicherung löst deshalb NUR bei Fehlern aus, die
   kontoweit sind — und die einzeln zu bewerten sind, nicht in Summe.
*/

/** `careerjet_de` → `careerjet`. Die eine Stelle, an der das steht. */
export function quellenfamilie(adapterKey: string): string {
  return adapterKey.split("_")[0] ?? adapterKey;
}

const familienBreakers = new Map<string, CircuitBreaker>();

export function familienBreakerFor(adapterKey: string): CircuitBreaker {
  const familie = quellenfamilie(adapterKey);
  let b = familienBreakers.get(familie);
  if (!b) {
    b = new CircuitBreaker();
    familienBreakers.set(familie, b);
  }
  return b;
}

/**
 * Meint dieser Fehler den Anbieter und nicht das Land?
 *
 * ── Warum das den Text liest und nicht einen Statuscode ─────────
 *
 * Weil die Adapter einfache `Error` werfen, mit dem Status im Satz.
 * Das ist keine schöne Grundlage, und ein eigener Fehlertyp mit
 * `status` wäre die richtige — aber er verlangte, achtzehn Adapter
 * anzufassen, und die sollen hier nicht nebenbei umgebaut werden.
 *
 * Deshalb ist die Erkennung bewusst ENG. Ein Fehler, der hier nicht
 * erkannt wird, kostet ein paar vergebliche Anfragen. Einer, der
 * fälschlich als kontoweit gilt, sperrt einen Anbieter, der
 * funktioniert — und das ist der teurere Fehler.
 *
 * Vorrang hat ein `status` am Fehler, falls ihn jemand später
 * mitgibt. Dann greift der Text gar nicht mehr.
 */
const KONTOWEIT = /\b(401|403|429)\b|unauthorized|not authorized|invalid (api[- ]?)?key|forbidden|quota exceeded|rate limit/i;

export function istKontoweiterFehler(fehler: unknown): boolean {
  const status = (fehler as { status?: unknown })?.status;
  if (typeof status === "number") return status === 401 || status === 403 || status === 429;

  const text = fehler instanceof Error ? fehler.message : String(fehler ?? "");
  return KONTOWEIT.test(text);
}

/** Nur für Tests: alle Sicherungen und Zwischenspeicher zurücksetzen. */
export function resetBreakers(): void {
  breakers.clear();
  familienBreakers.clear();
  cache.clear();
}
