/** High-level pattern editing operations. Thin wrappers over Pattern methods. */
import { Pattern, PatternBank, PATTERN_BANK_PATTERN_COUNT } from "../models/pattern.js";

/** Update multiple global pattern fields (name, tempo, swing, scale, etc.) in one call. Null values are skipped. */
export function updatePatternGlobals(pattern: Pattern, fields: Record<string, number | string | null>): Pattern {
  for (const [field, value] of Object.entries(fields)) {
    if (value !== null) pattern.setGlobal(field, value);
  }
  return pattern;
}

/** Update multiple fields on a single part. Null values are skipped. */
export function updatePart(pattern: Pattern, partIndex: number, fields: Record<string, number | null>): Pattern {
  for (const [field, value] of Object.entries(fields)) {
    if (value !== null) pattern.setPartField(partIndex, field, value);
  }
  return pattern;
}

/** Update step properties (on/off, gate, velocity, chord, notes). Only provided fields are changed. */
export function updateStep(
  pattern: Pattern,
  partIndex: number,
  stepIndex: number,
  opts: Partial<{ on: boolean; gate: number; velocity: number; chord: number; notes: number[] }>
): Pattern {
  pattern.setStep(partIndex, stepIndex, opts);
  return pattern;
}

/** Rotate step records within a range. Positive steps = shift right. */
export function rotateSteps(
  pattern: Pattern, partIndex: number, steps: number, startStep = 0, stepCount = 64
): Pattern {
  pattern.rotateSteps(partIndex, steps, startStep, stepCount);
  return pattern;
}

/** Extract all 250 patterns from a bank as individual Pattern objects. */
export function splitPatternBank(patternBank: PatternBank): Pattern[] {
  return Array.from({ length: PATTERN_BANK_PATTERN_COUNT }, (_, i) => patternBank.getPattern(i));
}

/** Replace a single pattern slot (1-based number) inside a pattern bank. */
export function replacePatternInBank(
  patternBank: PatternBank, patternNumber: number, pattern: Pattern
): PatternBank {
  if (patternNumber < 1 || patternNumber > PATTERN_BANK_PATTERN_COUNT) {
    throw new Error("Pattern number must be between 1 and 250");
  }
  patternBank.setPattern(patternNumber - 1, pattern);
  return patternBank;
}
