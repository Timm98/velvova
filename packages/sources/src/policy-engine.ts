import {
  SourcePolicyError,
  type PolicyDecision,
  type SourceDecision,
  type SourceOperation,
} from "./decision-types.ts";
import { findByKey, findByUrl, type SourceEntry } from "./source-registry.ts";

/**
 * Die Policy Engine.
 *
 * Jeder Zugriff auf eine externe Quelle geht durch diese Datei. Sie ist
 * kein Ratgeber, sondern eine Sperre: `assertAllowed` wirft, und der
 * aufrufende Code kommt gar nicht erst zum Abruf.
 *
 * Drei Grundsätze, die sie durchsetzt:
 *
 * 1. **Unbekannt ist nicht erlaubt.** Eine Domain, die niemand geprüft
 *    hat, bekommt `pending_review` — nicht „vermutlich in Ordnung".
 *
 * 2. **Umformulieren ist keine Rechtsgrundlage.** Es gibt bewusst keinen
 *    Weg, `Summarize` zu erhalten, ohne vorher `FetchDetails` zu haben.
 *    Wer nicht lesen darf, darf auch nicht zusammenfassen.
 *
 * 3. **Abgelaufene Prüfung sperrt.** Steht `nextLegalReviewAt` in der
 *    Vergangenheit, wechselt die Quelle selbsttätig auf
 *    `pending_review`. Eine Freigabe, die niemand mehr ansieht, ist
 *    keine Freigabe.
 */

function deny(
  entry: SourceEntry | null,
  decision: PolicyDecision,
  reasonCode: string,
  reason: string,
): SourceDecision {
  return {
    sourceId: entry?.providerKey ?? null,
    decision,
    allowedOperations: decision === "link_only" ? [] : [],
    allowedFields: decision === "link_only" ? ["source_url"] : [],
    attribution: entry?.attributionText ?? null,
    maxCacheHours: null,
    reasonCode,
    reason,
  };
}

/** Ist die dokumentierte Prüfung abgelaufen? */
function reviewOverdue(entry: SourceEntry, now: Date): boolean {
  if (!entry.nextLegalReviewAt) return false;
  return new Date(entry.nextLegalReviewAt).getTime() < now.getTime();
}

/**
 * Die Entscheidung für eine Quelle.
 *
 * `now` ist ein Parameter und kein `new Date()` im Rumpf: nur so lässt
 * sich das Ablaufen einer Prüfung überhaupt testen.
 */
/** Genau ein Satzzeichen am Ende, nicht zwei und nicht keins. */
function satzende(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

export function decideForEntry(entry: SourceEntry | null, now = new Date()): SourceDecision {
  if (!entry) {
    return deny(
      null,
      "pending_review",
      "unknown_source",
      "Diese Quelle steht nicht im Verzeichnis. Ohne dokumentierte Grundlage wird " +
        "nichts abgerufen und nichts gespeichert.",
    );
  }

  if (entry.accessMode === "blocked") {
    return deny(
      entry,
      "blocked",
      "explicitly_blocked",
      `${entry.displayName} ist gesperrt: ${entry.killSwitchReason ?? "ohne Angabe"}`,
    );
  }

  if (entry.legalStatus === "expired" || reviewOverdue(entry, now)) {
    return deny(
      entry,
      "pending_review",
      "terms_review_overdue",
      `Die Prüfung der Bedingungen von ${entry.displayName} ist fällig. Bis dahin ` +
        `wird nicht abgerufen.`,
    );
  }

  if (!entry.enabled) {
    // Nicht eingerichtet heißt: es gibt keinen Zugang. Der Verweis auf
    // die Originalseite bleibt trotzdem möglich.
    return {
      ...deny(
        entry,
        "link_only",
        "provider_disabled",
        // Der Grund im Verzeichnis endet mal mit Punkt, mal ohne. Ein
        // fest angehängter Punkt ergab "keine Freigabe.. Der Verweis" —
        // sichtbar in jeder Antwort des Import-Endpunkts.
        `${entry.displayName} ist nicht in Betrieb: ` +
          `${satzende(entry.killSwitchReason ?? "kein Grund hinterlegt")} ` +
          `Der Verweis auf die Originalquelle bleibt möglich.`,
      ),
      allowedFields: ["source_url"],
    };
  }

  if (entry.legalStatus === "partner_pending" || entry.accessMode === "link_only") {
    return {
      ...deny(
        entry,
        "link_only",
        "partner_pending",
        `Für ${entry.displayName} liegt keine Freigabe vor. Es wird nichts abgerufen, ` +
          `nichts gespeichert und nichts indexiert — nur verlinkt.`,
      ),
      allowedFields: ["source_url"],
    };
  }

  if (entry.accessMode === "user_private_import") {
    return {
      sourceId: entry.providerKey,
      decision: "private_import",
      allowedOperations: entry.allowedOperations,
      allowedFields: entry.allowedFields,
      attribution: entry.attributionText,
      maxCacheHours: entry.maxCacheHours,
      reasonCode: "user_private_import",
      reason:
        "Von dir selbst eingebracht. Bleibt privat und wandert nicht in den " +
        "öffentlichen Stellenindex.",
    };
  }

  return {
    sourceId: entry.providerKey,
    decision: "approved",
    allowedOperations: entry.allowedOperations,
    allowedFields: entry.allowedFields,
    attribution: entry.attributionText,
    maxCacheHours: entry.maxCacheHours,
    reasonCode: "approved",
    reason: `${entry.displayName}: ${entry.note}`,
  };
}

export function decideForProvider(providerKey: string, now = new Date()): SourceDecision {
  return decideForEntry(findByKey(providerKey), now);
}

export function decideForUrl(url: string, now = new Date()): SourceDecision {
  return decideForEntry(findByUrl(url), now);
}

/**
 * Die Sperre.
 *
 * Wird VOR jedem Abruf, jeder Zwischenspeicherung, jeder Einbettung und
 * jeder öffentlichen Anzeige aufgerufen. Sie gibt nichts zurück — sie
 * lässt durch oder wirft.
 */
export function assertAllowed(
  decision: SourceDecision,
  operation: SourceOperation,
): void {
  if (!decision.allowedOperations.includes(operation)) {
    throw new SourcePolicyError(
      `„${operation}" ist für diese Quelle nicht erlaubt (${decision.reasonCode}). ` +
        decision.reason,
      decision.reasonCode,
      decision.decision,
    );
  }
}

export function isAllowed(decision: SourceDecision, operation: SourceOperation): boolean {
  return decision.allowedOperations.includes(operation);
}

/**
 * Felder auf das Erlaubte beschneiden.
 *
 * Nicht „warnen und trotzdem speichern": was nicht erlaubt ist,
 * verschwindet hier. Der Rest des Systems bekommt es nie zu sehen und
 * kann es deshalb auch nicht versehentlich anzeigen.
 */
export function restrictFields<T extends Record<string, unknown>>(
  decision: SourceDecision,
  record: T,
): Partial<T> {
  const allowed = new Set(decision.allowedFields);
  const out: Partial<T> = {};

  for (const [key, value] of Object.entries(record)) {
    if (allowed.has(key)) out[key as keyof T] = value as T[keyof T];
  }
  return out;
}

/**
 * Darf eine Stelle öffentlich erscheinen?
 *
 * Zwei Bedingungen, beide notwendig: die Quelle erlaubt die Anzeige,
 * UND es gibt einen Verweis auf das Original. Eine Anzeige ohne Weg
 * zum Original ist für die suchende Person wertlos und für die Quelle
 * unfair.
 */
export function canPublish(
  decision: SourceDecision,
  job: { sourceUrl?: string | null },
): { ok: boolean; reason: string } {
  if (!isAllowed(decision, "PublicDisplay")) {
    return {
      ok: false,
      reason: `Diese Quelle erlaubt keine öffentliche Anzeige (${decision.reasonCode}).`,
    };
  }
  if (!job.sourceUrl) {
    return {
      ok: false,
      reason: "Ohne Verweis auf die Originalanzeige wird nichts veröffentlicht.",
    };
  }
  return { ok: true, reason: "Anzeige erlaubt, Original verlinkt." };
}

/**
 * Darf der Anzeigentext einer Quelle wörtlich und vollständig erscheinen?
 *
 * ── Was hier gefehlt hat ──────────────────────────────────────
 *
 * Die Registry sagt es bei 26 von 28 Quellen ausdrücklich, teils mit
 * eigenem Kommentar: „Bewusst OHNE PublicDisplay des Volltexts …
 * Angezeigt werden Metadaten und der Originallink." Die erlaubten
 * Felder enthalten `description_summary`, nicht `description`.
 *
 * Die Stellenseite zeigte den vollständigen Text trotzdem — unter der
 * Überschrift „Vollständige Stellenbeschreibung", aufklappbar, für
 * jede Quelle gleich. Die Regel stand geschrieben und wurde nirgends
 * angewandt.
 *
 * ── Warum das Speichern davon unberührt bleibt ────────────────
 *
 * Aus dem Text werden Aufgaben, Anforderungen und Bewertung
 * abgeleitet — das ist `Summarize` und erlaubt, und ohne den Text
 * ginge es nicht. Verboten ist die wörtliche Wiedergabe, nicht die
 * Auswertung. Deshalb greift die Regel bei der Anzeige und nicht beim
 * Import.
 */
export function volltextErlaubt(providerKey: string | null | undefined): boolean {
  if (!providerKey) return false;
  const eintrag = findByKey(providerKey);
  /*
   * Unbekannte Quelle heisst nein.
   *
   * Eine Quelle, für die keine Regel hinterlegt ist, ist keine Quelle
   * mit Erlaubnis — der sichere Weg ist hier auch der richtige.
   */
  if (!eintrag) return false;

  /*
   * Beides muss stimmen — und warum.
   *
   * `usajobs` steht in der Registry auf `fullTextAllowed: true`, führt
   * aber nur `description_summary` unter den erlaubten Feldern. Was
   * gar nicht gespeichert werden darf, kann nicht wörtlich angezeigt
   * werden; der Widerspruch löst sich nur in eine Richtung auf.
   *
   * Ich ändere die hinterlegte Regel nicht: Das ist eine rechtliche
   * Angabe, und sie zu lockern, weil sie unbequem ist, wäre genau
   * verkehrt. Gelesen wird die engere der beiden.
   */
  return eintrag.fullTextAllowed === true && eintrag.allowedFields.includes("description_text");
}
