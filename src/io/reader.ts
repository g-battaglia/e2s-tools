/** File readers for Electribe 2 binary formats (.all, .e2pat, .e2sallpat). */
import * as fs from "node:fs";
import * as path from "node:path";
import { LIBRARY_HEADER, LIBRARY_HEADER_SIZE, LIBRARY_POINTER_COUNT } from "../constants.js";
import { InvalidLibraryFileError } from "../errors.js";
import { SampleLibrary } from "../models/library.js";
import { Pattern, PatternBank } from "../models/pattern.js";
import { Sample } from "../models/sample.js";

/**
 * Read an e2sSample.all library file.
 * Parses the 16-byte header, 1020 RIFF address pointers, and each sample.
 * Returns the library and a count of samples that failed to parse.
 */
export function readLibrary(filePath: string): { library: SampleLibrary; errors: number } {
  const library = new SampleLibrary();
  let errors = 0;

  const data = fs.readFileSync(filePath);

  const header = data.subarray(0, LIBRARY_HEADER_SIZE);
  if (!header.equals(LIBRARY_HEADER)) {
    throw new InvalidLibraryFileError(`Invalid file format: expected header mismatch`);
  }

  // Read 1020 RIFF address pointers
  const pointerData = data.subarray(LIBRARY_HEADER_SIZE, LIBRARY_HEADER_SIZE + LIBRARY_POINTER_COUNT * 4);
  if (pointerData.length < LIBRARY_POINTER_COUNT * 4) {
    throw new InvalidLibraryFileError("File too short for pointer table");
  }

  const riffAddrs: number[] = [];
  for (let i = 0; i < LIBRARY_POINTER_COUNT; i++) {
    riffAddrs.push(pointerData.readUInt32LE(i * 4));
  }

  for (const riffAddr of riffAddrs) {
    if (riffAddr === 0) continue;
    try {
      const sample = new Sample(data.subarray(riffAddr));
      library.samples.push(sample);
    } catch {
      errors++;
    }
  }

  library.sort();
  return { library, errors };
}

/** Read a WAV file and return a Sample. */
export function readSampleFromWav(filePath: string): Sample {
  return new Sample(fs.readFileSync(filePath));
}

export function readPattern(filePath: string): Pattern {
  return Pattern.fromBytes(fs.readFileSync(filePath));
}

export function readPatternBank(filePath: string): PatternBank {
  return PatternBank.fromBytes(fs.readFileSync(filePath));
}
