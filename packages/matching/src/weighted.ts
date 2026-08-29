import type { ScoreFactor } from "@paycheck/domain";

/**
 * Gewichtete Summe mit einer entscheidenden Eigenschaft: Unbekanntes ist
 * neutral.
 *
 * Ein Faktor ohne Daten (raw === null) wird nicht als 0 gewertet - das
 * würde eine Stelle bestrafen, nur weil ihre Anzeige unvollständig ist.
 * Stattdessen wird sein Gewicht anteilig auf die bekannten Faktoren
 * verteilt. Das Fehlen schlägt sich ausschließlich in der Abdeckung
 * nieder, und die fliesst in die Confidence, nicht in den Fit.
 */

export interface WeightedInput {
  key: string;
  label: string;
  raw: number | null;
  weight: number;
  explanation: string;
  evidenceIds?: string[];
}

export interface WeightedOutput {
  /** 0..1, oder null wenn kein einziger Faktor Daten hatte. */
  value: number | null;
  /** Anteil der Gewichtssumme, für den Daten vorlagen. */
  coverage: number;
  factors: ScoreFactor[];
}

export function weightedScore(inputs: WeightedInput[]): WeightedOutput {
  const totalWeight = inputs.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight <= 0) {
    return { value: null, coverage: 0, factors: [] };
  }

  const known = inputs.filter((i) => i.raw !== null);
  const knownWeight = known.reduce((sum, i) => sum + i.weight, 0);
  const coverage = knownWeight / totalWeight;

  if (knownWeight <= 0) {
    return {
      value: null,
      coverage: 0,
      factors: inputs.map((i) => ({
        key: i.key, label: i.label, raw: null, weight: i.weight, contribution: 0,
        explanation: i.explanation, evidenceIds: i.evidenceIds ?? [],
      })),
    };
  }

  // Umverteilung: bekannte Gewichte werden so hochskaliert, dass sie
  // wieder die volle Gewichtssumme ergeben.
  const scale = totalWeight / knownWeight;

  let value = 0;
  const factors: ScoreFactor[] = inputs.map((i) => {
    if (i.raw === null) {
      return {
        key: i.key, label: i.label, raw: null, weight: i.weight, contribution: 0,
        explanation: i.explanation, evidenceIds: i.evidenceIds ?? [],
      };
    }
    const contribution = (i.raw * i.weight * scale) / totalWeight;
    value += contribution;
    return {
      key: i.key, label: i.label, raw: i.raw, weight: i.weight,
      contribution: round(contribution, 4), explanation: i.explanation,
      evidenceIds: i.evidenceIds ?? [],
    };
  });

  return { value: clamp01(value), coverage, factors };
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function toScore100(value: number): number {
  return Math.round(clamp01(value) * 100);
}
