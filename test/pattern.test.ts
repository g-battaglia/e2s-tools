import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  Pattern, PatternBank,
  RAW_PATTERN_SIZE, WRAPPED_PATTERN_SIZE, PATTERN_BANK_SIZE,
  PATTERN_BANK_HEADER_SIZE, PATTERN_BANK_PATTERN_COUNT,
  buildPatternFileHeader,
} from "../src/models/pattern.js";
import { encodeSysExPayload, decodeSysExPayload, patternToSysex, sysexToPattern } from "../src/sysex.js";
import { readPattern, readPatternBank, readLibrary } from "../src/io/reader.js";

function rawPattern(): Buffer {
  const data = Buffer.alloc(RAW_PATTERN_SIZE);
  data.write("PTST", 0, 4, "ascii");
  data.write("Init01", 0x10, 6, "ascii");
  data[0x22] = 0xb0;
  data[0x23] = 0x04;
  data[0x25] = 4;
  return data;
}

describe("Pattern", () => {
  it("round-trips raw pattern and reads summary", () => {
    const data = rawPattern();
    const pattern = Pattern.fromBytes(data);

    expect(pattern.name).toBe("Init01");
    expect(pattern.tempo).toBe(120.0);
    expect(pattern.length).toBe(4);
    expect(pattern.toBytes().equals(data)).toBe(true);
  });

  it("handles wrapped pattern with data offset", () => {
    const wrapped = Buffer.alloc(WRAPPED_PATTERN_SIZE);
    rawPattern().copy(wrapped, 0x100);

    const pattern = Pattern.fromBytes(wrapped);
    pattern.name = "Wrapped";
    pattern.tempo = 98.5;

    const out = pattern.toBytes();
    expect(out.subarray(0, 0x100).equals(Buffer.alloc(0x100))).toBe(true);
    expect(out.subarray(0x110, 0x117).toString("ascii")).toBe("Wrapped");
    expect(out[0x122]).toBe(0xd9);
    expect(out[0x123]).toBe(0x03);
  });

  it("edits parts and steps", () => {
    const pattern = Pattern.fromBytes(rawPattern());
    pattern.setPartField(0, "oscillator", 325);
    pattern.setStep(0, 0, { on: true, gate: 72, velocity: 100, notes: [36, 40] });

    const part = pattern.getPart(0);
    const step = pattern.getStep(0, 0);
    expect(part.oscillator).toBe(325);
    expect(step.on).toBe(true);
    expect(step.gate).toBe(72);
    expect(step.velocity).toBe(100);
    expect(step.notes).toEqual([36, 40]);

    pattern.toggleNote(0, 0, 36);
    expect(pattern.getStep(0, 0).notes).toEqual([40]);

    pattern.clearStep(0, 0);
    expect(pattern.getStep(0, 0).on).toBe(false);
    expect(pattern.getStep(0, 0).notes).toEqual([]);
  });

  it("rotates steps correctly", () => {
    const pattern = Pattern.fromBytes(rawPattern());
    for (let step = 0; step < 4; step++) {
      pattern.setStep(0, step, { on: true, velocity: step + 1, notes: [36 + step] });
    }

    pattern.rotateSteps(0, 1, 0, 4);

    expect(pattern.getStep(0, 0).velocity).toBe(4);
    expect(pattern.getStep(0, 1).velocity).toBe(1);
    expect(pattern.getStep(0, 2).velocity).toBe(2);
    expect(pattern.getStep(0, 3).velocity).toBe(3);
  });
});

describe("SysEx", () => {
  it("round-trips 7-bit payload encoding", () => {
    const data = Buffer.concat([Buffer.from(Array.from({ length: 256 }, (_, i) => i)), Buffer.from("tail")]);

    const encoded = encodeSysExPayload(data);
    expect(encoded.every(b => b < 128)).toBe(true);
    expect(decodeSysExPayload(encoded).equals(data)).toBe(true);
  });

  it("converts pattern to SysEx and back (current dump)", () => {
    const pattern = Pattern.fromBytes(rawPattern());
    const syx = patternToSysex(pattern);

    expect(syx[0]).toBe(0xf0);
    expect(syx.subarray(0, 7).equals(Buffer.from([0xf0, 0x42, 0x30, 0x00, 0x01, 0x23, 0x40]))).toBe(true);
    expect(syx[syx.length - 1]).toBe(0xf7);

    const restored = sysexToPattern(syx);
    expect(restored.raw.equals(pattern.raw)).toBe(true);
  });

  it("converts pattern to SysEx and back (numbered dump)", () => {
    const pattern = Pattern.fromBytes(rawPattern());
    const numbered = patternToSysex(pattern, { patternNumber: 130, deviceId: 0x24, globalChannel: 2 });

    expect(numbered.subarray(0, 9).equals(Buffer.from([0xf0, 0x42, 0x32, 0x00, 0x01, 0x24, 0x4c, 1, 1]))).toBe(true);

    const restored = sysexToPattern(numbered, "electribe");
    expect(restored.fileHeader.subarray(0x10, 0x19).toString("ascii")).toBe("electribe");
  });
});

describe("PatternBank", () => {
  it("reads and writes pattern bank", () => {
    const data = Buffer.alloc(PATTERN_BANK_SIZE);
    buildPatternFileHeader("e2sampler").copy(data, 0);
    for (let index = 0; index < PATTERN_BANK_PATTERN_COUNT; index++) {
      const pat = rawPattern();
      const name = `Pat${String(index + 1).padStart(3, "0")}`;
      Buffer.from(name, "ascii").copy(pat, 0x10);
      pat.copy(data, PATTERN_BANK_HEADER_SIZE + index * RAW_PATTERN_SIZE);
    }

    const bank = PatternBank.fromBytes(data);
    const replacement = Pattern.fromBytes(rawPattern());
    replacement.name = "Replace";
    bank.setPattern(249, replacement);

    expect(bank.summary().patternCount).toBe(250);
    expect(bank.getPattern(0).name).toBe("Pat001");
    expect(bank.getPattern(249).name).toBe("Replace");
  });

  it("reads real e2sallpat file", () => {
    const fixture = path.join(__dirname, "fixtures", "e2s-2016.e2sallpat");
    if (!fs.existsSync(fixture)) { console.warn(`SKIP: fixture not found: ${fixture}`); return; }

    const bank = readPatternBank(fixture);
    expect(bank.summary().patternCount).toBe(250);
    const pat0 = bank.getPattern(0);
    expect(pat0.name.length).toBeGreaterThan(0);
  });
});

describe("File I/O", () => {
  it("reads real e2pat file", () => {
    const fixture = path.join(__dirname, "fixtures", "001_Stalactite_1.e2pat");
    if (!fs.existsSync(fixture)) { console.warn(`SKIP: fixture not found: ${fixture}`); return; }

    const pattern = readPattern(fixture);
    expect(pattern.name).toBe("Stalactite 1");
    expect(pattern.tempo).toBeGreaterThan(0);
  });

  it("reads real e2sSample.all library", () => {
    const fixture = path.join(__dirname, "fixtures", "e2sSample.all");
    if (!fs.existsSync(fixture)) { console.warn(`SKIP: fixture not found: ${fixture}`); return; }

    const { library, errors } = readLibrary(fixture);
    expect(library.samples.length).toBeGreaterThan(0);
    expect(errors).toBe(0);

    // Check that at least one sample has valid fmt
    const withFmt = library.samples.filter(s => {
      try { return s.fmt.samplesPerSec > 0; } catch { return false; }
    });
    expect(withFmt.length).toBeGreaterThan(0);
  });
});
