/** File writers for Electribe 2 binary formats (.all, .e2pat, .e2sallpat). */
import * as fs from "node:fs";
import { LIBRARY_HEADER, LIBRARY_HEADER_SIZE, LIBRARY_DATA_OFFSET, LIBRARY_POINTER_COUNT } from "../constants.js";
import { SampleLibrary } from "../models/library.js";
import { Pattern, PatternBank } from "../models/pattern.js";
import { Sample } from "../models/sample.js";

export function writeLibrary(library: SampleLibrary, filePath: string): void {
  for (const sample of library.samples) {
    SampleLibrary.assignImportNumbers(sample);
  }

  const entries: Array<{ oscIndex: number; sampleBuf: Buffer }> = [];
  const seen = new Set<number>();
  for (const sample of library.samples) {
    const clean = sample.cleanCopy();
    const idx = clean.esli.oscIndex;
    if (seen.has(idx)) continue;
    seen.add(idx);
    entries.push({ oscIndex: idx, sampleBuf: clean.toBuffer() });
  }

  // Calculate addresses
  let nextAddr = LIBRARY_DATA_OFFSET;
  const addrMap = new Map<number, number>();
  const buffers: Buffer[] = [];
  for (const entry of entries) {
    addrMap.set(entry.oscIndex, nextAddr);
    buffers.push(entry.sampleBuf);
    nextAddr += entry.sampleBuf.length;
  }

  const buf = Buffer.alloc(nextAddr);
  LIBRARY_HEADER.copy(buf, 0);

  // Pointer table
  for (let i = 0; i < LIBRARY_POINTER_COUNT; i++) {
    buf.writeUInt32LE(addrMap.get(i) ?? 0, LIBRARY_HEADER_SIZE + i * 4);
  }

  // Sample data
  let pos = 0;
  for (const entry of entries) {
    buffers[pos].copy(buf, addrMap.get(entry.oscIndex)!);
    pos++;
  }

  fs.writeFileSync(filePath, buf);
}

export function writeSample(sample: Sample, filePath: string): void {
  fs.writeFileSync(filePath, sample.toBuffer());
}

export function writePattern(pattern: Pattern, filePath: string): void {
  fs.writeFileSync(filePath, pattern.toBytes());
}

export function writePatternBank(patternBank: PatternBank, filePath: string): void {
  fs.writeFileSync(filePath, patternBank.toBytes());
}
