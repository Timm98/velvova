import type {
  ConstraintCheck, ConstraintResult, ConstraintVerdict, Job, UserConstraints,
} from "@paycheck/domain";

/**
 * Harte Bedingungen. Läuft vor jedem Score.
 *
 * Drei Ausgänge je Bedingung:
 *   eligible  - die Stelle erfüllt sie nachweislich
 *   uncertain - die Anzeige sagt nichts dazu; das ist kein Ausschluss
 *   blocked   - die Stelle widerspricht der Bedingung nachweislich
 *
 * "uncertain" wird bewusst nie zu "blocked" hochgestuft. Eine Anzeige, die
 * das Gehalt verschweigt, ist kein Grund, eine Stelle wegzuwerfen - sie ist
 * ein Grund, danach zu fragen.
 */

/** Grobe Schätzung der Reisezeit. Ersetzt keinen Routendienst. */
export interface CommuteEstimator {
  estimateMinutes(
    from: string,
    to: string,
    mode: UserConstraints["commuteMode"],
  ): number | null;
}

function check(
  key: string, label: string, verdict: ConstraintVerdict, reason: string,
  jobValue: string | null, userValue: string | null,
): ConstraintCheck {
  return { key, label, verdict, reason, jobValue, userValue };
}

function normaliseSalaryToYear(amount: number, period: "year" | "month" | "hour"): number {
  if (period === "year") return amount;
  if (period === "month") return amount * 12;
  return Math.round(amount * 40 * 52); // 40h-Woche als transparente Annahme
}

export function checkConstraints(
  job: Job,
  c: UserConstraints,
  commute?: CommuteEstimator,
): ConstraintResult {
  const checks: ConstraintCheck[] = [];

  /*
   * --- Arbeitserlaubnis ---
   *
   * Ohne hinterlegte Länder gibt es nichts zu prüfen.
   *
   * Das war die letzte Stelle mit demselben Muster, und die
   * folgenreichste: ein neu angemeldeter Mensch hat noch keine Länder
   * hinterlegt, fast keine Anzeige sagt etwas zur Arbeitserlaubnis —
   * also war für ihn JEDE Stelle „uncertain", und seine gesamte
   * Trefferliste stand im Abschnitt „hier ist etwas offen". Gemessen:
   * 10 von 10.
   *
   * Die Regel gilt unverändert in die andere Richtung: sobald Länder
   * hinterlegt sind und eine Stelle sie verletzt, ist sie gesperrt.
   */
  if (c.workPermitCountries.length === 0) {
    // keine Angabe, keine Prüfung
  } else if (job.workPermitRequired === null) {
    checks.push(check("work_permit", "Arbeitserlaubnis", "uncertain",
      "Die Anzeige sagt nichts zur erforderlichen Arbeitserlaubnis.", null,
      c.workPermitCountries.join(", ")));
  } else if (!job.workPermitRequired || c.workPermitCountries.includes(job.country)) {
    checks.push(check("work_permit", "Arbeitserlaubnis", "eligible",
      "Du darfst in diesem Land arbeiten.", job.country, c.workPermitCountries.join(", ")));
  } else if (c.needsVisaSponsorship) {
    checks.push(check("work_permit", "Arbeitserlaubnis", "uncertain",
      "Du brauchst eine Unterstützung beim Visum. Ob der Arbeitgeber das anbietet, steht nicht in der Anzeige.",
      job.country, "Visum-Unterstützung nötig"));
  } else {
    checks.push(check("work_permit", "Arbeitserlaubnis", "blocked",
      `Für ${job.country} liegt keine Arbeitserlaubnis vor.`, job.country,
      c.workPermitCountries.join(", ") || "keine hinterlegt"));
  }

  // --- Pflichtlizenzen ---
  if (job.requiredLicenses.length === 0) {
    checks.push(check("licenses", "Pflichtlizenzen", "eligible",
      "Die Stelle verlangt keine gesonderte Lizenz.", null, null));
  } else {
    const have = new Set(c.licenses.map((l) => l.toLowerCase()));
    const missing = job.requiredLicenses.filter((l) => !have.has(l.toLowerCase()));
    checks.push(missing.length === 0
      ? check("licenses", "Pflichtlizenzen", "eligible", "Alle geforderten Nachweise liegen vor.",
          job.requiredLicenses.join(", "), c.licenses.join(", "))
      : check("licenses", "Pflichtlizenzen", "blocked",
          `Es fehlt: ${missing.join(", ")}. Das ist eine zwingende Voraussetzung.`,
          job.requiredLicenses.join(", "), c.licenses.join(", ") || "keine hinterlegt"));
  }

  // --- Sprache ---
  const langLevels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const required = Object.entries(job.languageRequirements);
  if (required.length === 0) {
    /*
     * Die Anzeige nennt kein Sprachniveau — das ist der Normalfall
     * und keine offene Bedingung.
     *
     * Eine Bedingung entsteht erst dort, wo die Anzeige etwas fordert.
     * Ohne Forderung gibt es nichts zu erfüllen und nichts zu klären.
     */
  } else {
    const shortfalls = required.filter(([lang, need]) => {
      const has = c.languages[lang];
      if (!has) return true;
      return langLevels.indexOf(has) < langLevels.indexOf(need);
    });
    checks.push(shortfalls.length === 0
      ? check("language", "Sprache", "eligible", "Dein Sprachniveau reicht aus.",
          required.map(([l, v]) => `${l} ${v}`).join(", "),
          Object.entries(c.languages).map(([l, v]) => `${l} ${v}`).join(", "))
      : check("language", "Sprache", "blocked",
          `Gefordert: ${shortfalls.map(([l, v]) => `${l} ${v}`).join(", ")}. Das ist nicht belegt.`,
          required.map(([l, v]) => `${l} ${v}`).join(", "),
          Object.entries(c.languages).map(([l, v]) => `${l} ${v}`).join(", ") || "nicht angegeben"));
  }

  // --- Arbeitsmodell ---
  checks.push(c.acceptedWorkModels.includes(job.workModel)
    ? check("work_model", "Arbeitsmodell", "eligible",
        "Das Modell passt zu dem, was du akzeptierst.", job.workModel, c.acceptedWorkModels.join(", "))
    : check("work_model", "Arbeitsmodell", "blocked",
        `Die Stelle ist ${job.workModel}. Das hast du ausgeschlossen.`,
        job.workModel, c.acceptedWorkModels.join(", ")));

  // --- Standort und Pendelzeit ---
  if (job.workModel === "remote") {
    checks.push(check("commute", "Arbeitsweg", "eligible",
      "Vollständig remote, kein Arbeitsweg.", "remote", null));
  } else if (c.maxCommuteMinutes === null || c.baseLocation === null) {
    // Keine Obergrenze und kein Wohnort — dann gibt es nichts zu prüfen.
  } else {
    const minutes = commute?.estimateMinutes(c.baseLocation, job.location, c.commuteMode) ?? null;
    if (minutes === null) {
      checks.push(check("commute", "Arbeitsweg", "uncertain",
        "Die Reisezeit lässt sich aus den vorliegenden Daten nicht schaetzen.",
        job.location, `maximal ${c.maxCommuteMinutes} Minuten`));
    } else if (minutes <= c.maxCommuteMinutes) {
      checks.push(check("commute", "Arbeitsweg", "eligible",
        `Geschätzt ${minutes} Minuten, deine Grenze liegt bei ${c.maxCommuteMinutes}.`,
        `${minutes} Min`, `maximal ${c.maxCommuteMinutes} Min`));
    } else if (c.willingToRelocate) {
      checks.push(check("commute", "Arbeitsweg", "uncertain",
        `Geschätzt ${minutes} Minuten. Das liegt über deiner Grenze, aber du bist umzugsbereit.`,
        `${minutes} Min`, `maximal ${c.maxCommuteMinutes} Min`));
    } else {
      checks.push(check("commute", "Arbeitsweg", "blocked",
        `Geschätzt ${minutes} Minuten. Deine Grenze liegt bei ${c.maxCommuteMinutes}.`,
        `${minutes} Min`, `maximal ${c.maxCommuteMinutes} Min`));
    }
  }

  // --- Mindestgehalt ---
  if (c.minSalaryPerYear === null) {
    /*
     * Keine Untergrenze, keine Zeile.
     *
     * Vorher stand hier „eligible — Du hast keine Untergrenze
     * festgelegt": ein grüner Haken für eine Prüfung, die nicht
     * stattgefunden hat. Neben echten Prüfungen liest sich das als
     * „Gehalt passt".
     */
  } else if (job.salary.provenance === "text") {
    /*
     * Aus dem Beschreibungstext gelesen — informiert, entscheidet nicht.
     *
     * Diese Zahl steht in der Anzeige, aber nicht in einem Feld, das
     * der Arbeitgeber ausgefüllt hat. Sie kann sich auf ein
     * Projektbudget, einen Umsatz oder ein Beispiel beziehen; der
     * Leser hat das im Blick, ein Muster nicht immer.
     *
     * Deshalb bleibt es „offen", auch wenn die Zahl unter der Grenze
     * liegt. Eine Stelle wegen einer Vermutung auszublenden wäre der
     * teurere Fehler: ausgeblendete Stellen fallen niemandem auf, und
     * die Person erfährt nie, dass es sie gab.
     *
     * Angezeigt wird sie trotzdem — mit dem Beleg daneben. Wer sie
     * liest, kann selbst urteilen, und genau das ist der Unterschied
     * zwischen Verschweigen und Nicht-Behaupten.
     */
    const wert = job.salary.max ?? job.salary.min;
    const jahr = wert === null ? null : normaliseSalaryToYear(wert, job.salary.period);
    checks.push(check("salary", "Gehalt", "uncertain",
      jahr === null
        ? "Im Anzeigentext steht eine Gehaltsangabe, die sich nicht sicher zuordnen liess."
        : `Im Anzeigentext steht ${jahr} ${job.salary.currency} — das ist keine Angabe des Arbeitgebers im dafür vorgesehenen Feld, sondern aus dem Text gelesen. Frag im Erstgespräch nach.`,
      jahr === null ? "aus dem Text" : `${jahr} ${job.salary.currency} (aus dem Text)`,
      `mindestens ${c.minSalaryPerYear} ${c.currency}`));
  } else if (!job.salary.disclosed) {
    checks.push(check("salary", "Gehalt", "uncertain",
      "Die Anzeige nennt kein Gehalt. Frag im Erstgespräch danach.",
      "nicht angegeben", `mindestens ${c.minSalaryPerYear} ${c.currency}`));
  } else {
    // Die Obergrenze zählt: erreicht sie das Minimum, ist Verhandlung möglich.
    const top = job.salary.max ?? job.salary.min;
    const yearly = top === null ? null : normaliseSalaryToYear(top, job.salary.period);
    if (yearly === null) {
      checks.push(check("salary", "Gehalt", "uncertain", "Die Gehaltsangabe ist unvollständig.",
        "unvollständig", `mindestens ${c.minSalaryPerYear} ${c.currency}`));
    } else if (yearly >= c.minSalaryPerYear) {
      checks.push(check("salary", "Gehalt", "eligible",
        `Bis ${yearly} ${job.salary.currency} möglich, deine Grenze liegt bei ${c.minSalaryPerYear}.`,
        `${yearly} ${job.salary.currency}`, `mindestens ${c.minSalaryPerYear} ${c.currency}`));
    } else {
      const tradeOff = c.salaryTradeOffs.length > 0
        ? ` Du hast genannt, was das ausgleichen könnte: ${c.salaryTradeOffs.join(", ")}.` : "";
      checks.push(check("salary", "Gehalt", "blocked",
        `Höchstens ${yearly} ${job.salary.currency}, deine Untergrenze liegt bei ${c.minSalaryPerYear}.${tradeOff}`,
        `${yearly} ${job.salary.currency}`, `mindestens ${c.minSalaryPerYear} ${c.currency}`));
    }
  }

  /*
   * --- Schichtarbeit ---
   *
   * Nur wenn sie ausgeschlossen wurde. Wer Schichtarbeit annimmt, hat
   * keine Bedingung dazu, und ein „die Anzeige sagt nichts zu
   * Schichten" wäre für ihn eine Unklarheit ohne Gegenstand.
   */
  if (c.acceptsShiftWork) {
    // keine Bedingung, keine Prüfung
  } else if (job.shiftWork === null) {
    checks.push(check("shift", "Schichtarbeit", "uncertain",
      "Die Anzeige sagt nichts zu Schichten. Du hast sie ausgeschlossen.", null, "ausgeschlossen"));
  } else if (!job.shiftWork || c.acceptsShiftWork) {
    checks.push(check("shift", "Schichtarbeit", "eligible",
      job.shiftWork ? "Schichtarbeit ist für dich in Ordnung." : "Keine Schichtarbeit.",
      job.shiftWork ? "ja" : "nein", c.acceptsShiftWork ? "akzeptiert" : "ausgeschlossen"));
  } else {
    checks.push(check("shift", "Schichtarbeit", "blocked",
      "Die Stelle ist Schichtarbeit. Das hast du ausgeschlossen.", "ja", "ausgeschlossen"));
  }

  /*
   * --- Reiseanteil ---
   *
   * Ohne eigene Grenze gibt es hier nichts zu prüfen — und deshalb
   * auch keine Zeile.
   *
   * Vorher stand hier „uncertain", wenn die Person KEINE Grenze
   * gesetzt hatte. Das klang harmlos und war der teuerste Fehler
   * dieser Datei: `overall` wird „uncertain", sobald eine einzige
   * Prüfung es ist. Reiseanteil, Vertragsart und Wochenstunden stehen
   * in fast keiner Anzeige — also war praktisch JEDE Stelle
   * „uncertain", aus Gründen, die mit den Bedingungen der Person
   * nichts zu tun hatten.
   *
   * Gemessen: 243 von 243 Stellen landeten deshalb im Abschnitt „hier
   * ist etwas offen". Ein Hinweis, der für alles gilt, sagt nichts.
   */
  if (c.maxTravelPercent === null) {
    // keine Bedingung, keine Prüfung
  } else if (job.travelPercent === null) {
    checks.push(check("travel", "Reiseanteil", "uncertain",
      "Die Anzeige nennt keinen Reiseanteil.",
      null, `maximal ${c.maxTravelPercent} %`));
  } else {
    checks.push(job.travelPercent <= c.maxTravelPercent
      ? check("travel", "Reiseanteil", "eligible", `${job.travelPercent} % liegt in deinem Rahmen.`,
          `${job.travelPercent} %`, `maximal ${c.maxTravelPercent} %`)
      : check("travel", "Reiseanteil", "blocked",
          `${job.travelPercent} % uebersteigt deine Grenze von ${c.maxTravelPercent} %.`,
          `${job.travelPercent} %`, `maximal ${c.maxTravelPercent} %`));
  }

  // --- Vertragsart ---  (dieselbe Regel: keine Auswahl, keine Prüfung)
  if (c.acceptedContractTypes.length === 0) {
    // keine Bedingung, keine Prüfung
  } else if (job.contractType === null) {
    checks.push(check("contract", "Vertragsart", "uncertain",
      "Die Anzeige nennt keine Vertragsart.",
      null, c.acceptedContractTypes.join(", ")));
  } else {
    checks.push(c.acceptedContractTypes.includes(job.contractType)
      ? check("contract", "Vertragsart", "eligible", "Die Vertragsart passt.",
          job.contractType, c.acceptedContractTypes.join(", "))
      : check("contract", "Vertragsart", "blocked",
          `Die Stelle ist ${job.contractType}. Das ist nicht in deiner Auswahl.`,
          job.contractType, c.acceptedContractTypes.join(", ")));
  }

  // --- Arbeitszeit ---  (dieselbe Regel)
  if (c.weeklyHoursMin === null && c.weeklyHoursMax === null) {
    // keine Bedingung, keine Prüfung
  } else if (job.weeklyHours === null) {
    checks.push(check("hours", "Arbeitszeit", "uncertain",
      "Die Anzeige nennt keine Wochenstunden.", null,
      [c.weeklyHoursMin, c.weeklyHoursMax].filter((x) => x !== null).join("–") + " h"));
  } else {
    const tooFew = c.weeklyHoursMin !== null && job.weeklyHours < c.weeklyHoursMin;
    const tooMany = c.weeklyHoursMax !== null && job.weeklyHours > c.weeklyHoursMax;
    checks.push(!tooFew && !tooMany
      ? check("hours", "Arbeitszeit", "eligible", `${job.weeklyHours} Stunden passen zu dir.`,
          `${job.weeklyHours} h`, `${c.weeklyHoursMin ?? "?"}-${c.weeklyHoursMax ?? "?"} h`)
      : check("hours", "Arbeitszeit", "blocked",
          `${job.weeklyHours} Stunden liegen ausserhalb deines Rahmens.`,
          `${job.weeklyHours} h`, `${c.weeklyHoursMin ?? "?"}-${c.weeklyHoursMax ?? "?"} h`));
  }

  // --- Startdatum ---  (dieselbe Regel)
  if (c.earliestStartDate === null) {
    // keine Bedingung, keine Prüfung
  } else if (job.publishedAt === null) {
    checks.push(check("start_date", "Startdatum", "uncertain",
      "Die Anzeige nennt kein Datum, an dem sich dein frühester Start prüfen liesse.", null,
      c.earliestStartDate.toISOString().slice(0, 10)));
  } else {
    checks.push(check("start_date", "Startdatum", "eligible",
      "Kein Widerspruch zu deinem fruehesten Start erkennbar.", null,
      c.earliestStartDate.toISOString().slice(0, 10)));
  }

  const blockedBy = checks.filter((c2) => c2.verdict === "blocked").map((c2) => c2.key);
  const uncertainAbout = checks.filter((c2) => c2.verdict === "uncertain").map((c2) => c2.key);
  const overall: ConstraintVerdict =
    blockedBy.length > 0 ? "blocked" : uncertainAbout.length > 0 ? "uncertain" : "eligible";

  return { overall, checks, blockedBy, uncertainAbout };
}
