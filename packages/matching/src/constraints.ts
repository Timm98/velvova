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

  // --- Arbeitserlaubnis ---
  if (job.workPermitRequired === null) {
    checks.push(check("work_permit", "Arbeitserlaubnis", "uncertain",
      "Die Anzeige sagt nichts zur erforderlichen Arbeitserlaubnis.", null,
      c.workPermitCountries.join(", ") || null));
  } else if (!job.workPermitRequired || c.workPermitCountries.includes(job.country)) {
    checks.push(check("work_permit", "Arbeitserlaubnis", "eligible",
      "Du darfst in diesem Land arbeiten.", job.country, c.workPermitCountries.join(", ")));
  } else if (c.needsVisaSponsorship) {
    checks.push(check("work_permit", "Arbeitserlaubnis", "uncertain",
      "Du brauchst eine Unterstützung beim Visum. Ob der Arbeitgeber das anbietet, steht nicht in der Anzeige.",
      job.country, "Visum-Unterstützung noetig"));
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
    checks.push(check("language", "Sprache", "uncertain",
      "Die Anzeige nennt kein Sprachniveau.", null, null));
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
    checks.push(check("commute", "Arbeitsweg", "uncertain",
      "Es ist keine Obergrenze für den Arbeitsweg hinterlegt.", job.location, null));
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
    checks.push(check("salary", "Gehalt", "eligible", "Du hast keine Untergrenze festgelegt.", null, null));
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

  // --- Schichtarbeit ---
  if (job.shiftWork === null) {
    checks.push(check("shift", "Schichtarbeit", "uncertain", "Die Anzeige sagt nichts zu Schichten.", null, null));
  } else if (!job.shiftWork || c.acceptsShiftWork) {
    checks.push(check("shift", "Schichtarbeit", "eligible",
      job.shiftWork ? "Schichtarbeit ist für dich in Ordnung." : "Keine Schichtarbeit.",
      job.shiftWork ? "ja" : "nein", c.acceptsShiftWork ? "akzeptiert" : "ausgeschlossen"));
  } else {
    checks.push(check("shift", "Schichtarbeit", "blocked",
      "Die Stelle ist Schichtarbeit. Das hast du ausgeschlossen.", "ja", "ausgeschlossen"));
  }

  // --- Reiseanteil ---
  if (c.maxTravelPercent === null || job.travelPercent === null) {
    checks.push(check("travel", "Reiseanteil", "uncertain",
      job.travelPercent === null ? "Die Anzeige nennt keinen Reiseanteil." : "Du hast keine Grenze festgelegt.",
      job.travelPercent === null ? null : `${job.travelPercent} %`,
      c.maxTravelPercent === null ? null : `maximal ${c.maxTravelPercent} %`));
  } else {
    checks.push(job.travelPercent <= c.maxTravelPercent
      ? check("travel", "Reiseanteil", "eligible", `${job.travelPercent} % liegt in deinem Rahmen.`,
          `${job.travelPercent} %`, `maximal ${c.maxTravelPercent} %`)
      : check("travel", "Reiseanteil", "blocked",
          `${job.travelPercent} % uebersteigt deine Grenze von ${c.maxTravelPercent} %.`,
          `${job.travelPercent} %`, `maximal ${c.maxTravelPercent} %`));
  }

  // --- Vertragsart ---
  if (c.acceptedContractTypes.length === 0 || job.contractType === null) {
    checks.push(check("contract", "Vertragsart", "uncertain",
      job.contractType === null ? "Die Anzeige nennt keine Vertragsart." : "Du hast keine Vertragsart ausgeschlossen.",
      job.contractType, c.acceptedContractTypes.join(", ") || null));
  } else {
    checks.push(c.acceptedContractTypes.includes(job.contractType)
      ? check("contract", "Vertragsart", "eligible", "Die Vertragsart passt.",
          job.contractType, c.acceptedContractTypes.join(", "))
      : check("contract", "Vertragsart", "blocked",
          `Die Stelle ist ${job.contractType}. Das ist nicht in deiner Auswahl.`,
          job.contractType, c.acceptedContractTypes.join(", ")));
  }

  // --- Arbeitszeit ---
  if (job.weeklyHours === null || (c.weeklyHoursMin === null && c.weeklyHoursMax === null)) {
    checks.push(check("hours", "Arbeitszeit", "uncertain",
      job.weeklyHours === null ? "Die Anzeige nennt keine Wochenstunden." : "Du hast keine Arbeitszeit festgelegt.",
      job.weeklyHours === null ? null : `${job.weeklyHours} h`, null));
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

  // --- Startdatum ---
  if (c.earliestStartDate === null || job.publishedAt === null) {
    checks.push(check("start_date", "Startdatum", "uncertain",
      "Zum Startdatum liegen keine ausreichenden Angaben vor.", null,
      c.earliestStartDate ? c.earliestStartDate.toISOString().slice(0, 10) : null));
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
