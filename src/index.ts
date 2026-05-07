/**
 * electribe2 — TypeScript library for Korg Electribe 2 Sampler file formats.
 *
 * Supports: sample libraries (.all), patterns (.e2pat), pattern banks (.e2sallpat),
 * and SysEx dumps (.syx). Provides both a programmatic API and a CLI (e2s command).
 *
 * @example
 * ```typescript
 * import { readLibrary, readPattern, patternToSysex } from 'electribe2';
 *
 * const { library } = readLibrary('/path/to/e2sSample.all');
 * const pattern = readPattern('/path/to/beat.e2pat');
 * const syx = patternToSysex(pattern, { patternNumber: 42 });
 * ```
 */

// Core library
export * from "./constants.js";
export * from "./errors.js";
export * as Riff from "./riff/index.js";
export * as Models from "./models/index.js";
export * as Operations from "./operations/index.js";
export * as IO from "./io/index.js";
export { patternToSysex, sysexToPattern, encodeSysExPayload, decodeSysExPayload } from "./sysex.js";

// Convenience re-exports (most commonly used)
export { readLibrary, readPattern, readPatternBank, readSampleFromWav } from "./io/reader.js";
export { writeLibrary, writePattern, writePatternBank, writeSample } from "./io/writer.js";
export {
  Pattern, PatternBank, Sample, SampleLibrary, EsliMetadata,
  RAW_PATTERN_SIZE, WRAPPED_PATTERN_SIZE, PATTERN_BANK_HEADER_SIZE, PATTERN_BANK_PATTERN_COUNT, PATTERN_BANK_SIZE,
  FACTORY_SCALE_NAMES, scaleDisplayName, buildPatternFileHeader,
} from "./models/index.js";
export type { PatternStep, PatternPart, SliceData, EsliData } from "./models/index.js";
export { OscCategory, BeatType, LoopType, categoryFromDisplayName, categoryDisplayName, beatDisplayName } from "./models/enums.js";
export { importFromWav } from "./operations/import.js";
export type { ImportOptions } from "./operations/import.js";
export { exportToWav } from "./operations/export.js";
export type { ExportOptions } from "./operations/export.js";
export { trimSample } from "./operations/trim.js";
export { pcm8bTo16b, pcm24bTo16b, stereoToMono } from "./operations/convert.js";
export { updatePatternGlobals, updatePart, updateStep, rotateSteps, replacePatternInBank, splitPatternBank } from "./operations/pattern.js";
