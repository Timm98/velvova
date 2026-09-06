import { decideForUrl, findByUrl } from "@paycheck/sources";

/**
 * Auf welchem Weg eine Bewerbung tatsächlich möglich ist.
 *
 * Die technische Wahrheit zuerst: eine Webseite kann keine
 * Formularfelder auf einer fremden Domain ausfüllen. Browser trennen
 * Origins, und das ist keine Einschränkung, die man umgeht — es ist
 * der Grund, warum das Web sicher benutzbar ist.
 *
 * Ein Produkt, das „wir bewerben uns für dich" verspricht, verspricht
 * also entweder etwas, das es nicht kann, oder es umgeht etwas, das es
 * nicht umgehen darf. Beides scheidet aus.
 *
 * Was bleibt, sind sechs klar getrennte Wege — und der Standard ist
 * der ehrlichste davon.
 */

export type ApplyMode =
  /**
   * Die Stelle wurde hier eingestellt — die Bewerbung bleibt hier.
   *
   * Der einzige Fall, in dem wir wirklich wissen, was mit einer
   * Bewerbung passiert: Der Arbeitgeber liest sie in seinem Bereich in
   * diesem Produkt. Kein fremdes Portal, kein Weiterleiten, keine
   * Vermutung über den Verbleib.
   */
  | "paycheck_apply"
  | "native_apply"
  | "embedded_partner_apply"
  | "prepared_redirect"
  | "apply_companion"
  | "manual_only"
  | "email_draft";

export type AuthorizationStatus = "authorized" | "pending_review" | "not_authorized" | "revoked";

export interface ApplyCapability {
  mode: ApplyMode;
  authorization: AuthorizationStatus;
  supportsScreeningQuestions: boolean;
  supportsResumeUpload: boolean;
  supportsStatusSync: boolean;
  /** Immer true. Es gibt keinen Weg, das abzuschalten. */
  userConfirmationRequired: true;
  /** Immer false. Weder Konfiguration noch Code können das ändern. */
  autoSubmitAllowed: false;
  /** In ganzen Sätzen, für die Person. */
  explanation: string;
  /** Was fehlt, damit ein besserer Weg möglich wäre. */
  missingForBetterMode: string | null;
}

const MODUS_TEXT: Record<ApplyMode, string> = {
  paycheck_apply:
    "Diese Stelle hat der Arbeitgeber hier eingestellt. Deine Bewerbung geht direkt an ihn — du " +
    "siehst vorher, was übermittelt wird, und kannst sie jederzeit zurückziehen.",
  native_apply:
    "Die Bewerbung geht über eine autorisierte Schnittstelle des Arbeitgebers — nach deiner " +
    "ausdrücklichen Bestätigung und mit vollständiger Vorschau.",
  embedded_partner_apply:
    "Das Bewerbungsformular des Anbieters wird hier eingebettet. Deine Daten gehen direkt an ihn.",
  prepared_redirect:
    "Wir bereiten alles vor und öffnen dann die Originalseite. Den letzten Schritt machst du " +
    "selbst — dort, wo die Stelle wirklich ausgeschrieben ist.",
  apply_companion:
    "Eine Browser-Erweiterung schlägt auf der Bewerbungsseite passende Werte vor. Einfügen und " +
    "Absenden machst du.",
  manual_only:
    "Wir stellen dir das Bewerbungspaket zusammen. Den Rest erledigst du direkt beim Arbeitgeber.",
  email_draft:
    "Wir schreiben die Bewerbungs-E-Mail als Entwurf. Empfänger, Text und Anhänge prüfst du, " +
    "abgeschickt wird sie erst auf deine Bestätigung.",
};

/**
 * Was für eine Anzeige möglich ist.
 *
 * Ohne Eintrag in der Fähigkeitsmatrix bleibt es beim vorbereiteten
 * Verweis. Das ist keine Notlösung, sondern der richtige Standard: er
 * behauptet nichts, was nicht stimmt, und er funktioniert überall.
 */
export function capabilityForJob(input: {
  originalUrl: string | null;
  applyMethod: string;
  applyTarget: string | null;
  /** Einträge aus apply_capabilities, sofern vorhanden. */
  registered?: {
    sourceKey: string;
    mode: ApplyMode;
    authorization: AuthorizationStatus;
    enabled: boolean;
    supportsScreeningQuestions: boolean;
    supportsResumeUpload: boolean;
    supportsStatusSync: boolean;
    allowedDomains: string[];
  }[];
}): ApplyCapability {
  const url = input.originalUrl ?? input.applyTarget;

  const basis = {
    supportsScreeningQuestions: false,
    supportsResumeUpload: false,
    supportsStatusSync: false,
    userConfirmationRequired: true as const,
    autoSubmitAllowed: false as const,
  };

  /*
   * Der eigene Weg zuerst.
   *
   * Für eine hier eingestellte Stelle ist `applyTarget` ein Pfad in
   * diesem Produkt und keine fremde Adresse. Liefe er durch die
   * Portalerkennung darunter, würde er als unbekannte Domain behandelt
   * und die Person bekäme „wir können dich nirgendwohin führen“ zu
   * lesen — für eine Bewerbung, die zwei Klicks entfernt ist.
   */
  if (input.applyMethod === "internal" && input.applyTarget) {
    return {
      ...basis,
      mode: "paycheck_apply",
      authorization: "authorized",
      explanation: MODUS_TEXT.paycheck_apply,
      missingForBetterMode: null,
    };
  }

  // Ohne Weg zum Original bleibt nur das Paket in der Hand der Person.
  if (!url) {
    return {
      ...basis,
      mode: "manual_only",
      authorization: "not_authorized",
      explanation: MODUS_TEXT.manual_only,
      missingForBetterMode:
        "Zu dieser Anzeige liegt keine Adresse vor. Ohne sie können wir dich nirgendwohin führen.",
    };
  }

  const eintrag = findByUrl(url);
  const entscheidung = decideForUrl(url);

  const passend = (input.registered ?? []).find(
    (r) =>
      r.enabled &&
      r.authorization === "authorized" &&
      (r.sourceKey === eintrag?.providerKey ||
        r.allowedDomains.some((d) => {
          try {
            const host = new URL(url).hostname.toLowerCase();
            return host === d || host.endsWith(`.${d}`);
          } catch {
            return false;
          }
        })),
  );

  if (passend) {
    return {
      ...basis,
      mode: passend.mode,
      authorization: "authorized",
      supportsScreeningQuestions: passend.supportsScreeningQuestions,
      supportsResumeUpload: passend.supportsResumeUpload,
      supportsStatusSync: passend.supportsStatusSync,
      explanation: MODUS_TEXT[passend.mode],
      missingForBetterMode: null,
    };
  }

  /*
   * E-Mail-Bewerbung nur, wenn die Adresse aus einer freigegebenen
   * Quelle stammt. Eine erratene Adresse ist keine Bewerbung, sondern
   * eine Mail an jemanden, der nichts erwartet.
   */
  if (
    input.applyMethod === "email" &&
    input.applyTarget?.includes("@") &&
    entscheidung.decision === "approved"
  ) {
    return {
      ...basis,
      mode: "email_draft",
      authorization: "authorized",
      explanation: MODUS_TEXT.email_draft,
      missingForBetterMode: null,
    };
  }

  return {
    ...basis,
    mode: "prepared_redirect",
    authorization: "not_authorized",
    explanation: MODUS_TEXT.prepared_redirect,
    missingForBetterMode: eintrag
      ? `Für ${eintrag.displayName} gibt es keine autorisierte Bewerbungsschnittstelle. ` +
        "Dafür bräuchte es eine schriftliche Partnervereinbarung."
      : "Für diese Quelle ist keine Bewerbungsschnittstelle hinterlegt.",
  };
}

/**
 * Darf hier automatisch abgeschickt werden?
 *
 * Die Antwort ist immer nein, und die Funktion existiert nur, damit
 * das an genau einer Stelle steht und geprüft werden kann. Ein Aufruf,
 * der true erwartet, findet nie einen.
 */
export function autoSubmitAllowed(): false {
  return false;
}
