import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { readPattern, readPatternBank, readLibrary } from "../src/io/reader.js";
import { writePattern, writePatternBank, writeLibrary } from "../src/io/writer.js";

describe("Binary Round-trip", () => {
  it("round-trips .e2pat file byte-exact", () => {
    const fixture = path.join(__dirname, "fixtures", "001_Stalactite_1.e2pat");
    if (!fs.existsSync(fixture)) { console.warn(`SKIP: fixture not found: ${fixture}`); return; }

    const original = fs.readFileSync(fixture);
    const pattern = readPattern(fixture);

    const tmpFile = path.join(__dirname, "fixtures", "roundtrip_test.e2pat");
    writePattern(pattern, tmpFile);

    const written = fs.readFileSync(tmpFile);
    expect(written.equals(original)).toBe(true);

    fs.unlinkSync(tmpFile);
  });

  it("round-trips .e2sallpat file byte-exact", () => {
    const fixture = path.join(__dirname, "fixtures", "e2s-2016.e2sallpat");
    if (!fs.existsSync(fixture)) { console.warn(`SKIP: fixture not found: ${fixture}`); return; }

    const original = fs.readFileSync(fixture);
    const bank = readPatternBank(fixture);

    const tmpFile = path.join(__dirname, "fixtures", "roundtrip_test.e2sallpat");
    writePatternBank(bank, tmpFile);

    const written = fs.readFileSync(tmpFile);
    expect(written.equals(original)).toBe(true);

    fs.unlinkSync(tmpFile);
  });

  it("round-trips .all library file", () => {
    const fixture = path.join(__dirname, "fixtures", "e2sSample.all");
    if (!fs.existsSync(fixture)) { console.warn(`SKIP: fixture not found: ${fixture}`); return; }

    const { library } = readLibrary(fixture);

    const tmpFile = path.join(__dirname, "fixtures", "roundtrip_test.all");
    writeLibrary(library, tmpFile);

    // Verify sample count and metadata matches
    const { library: restored, errors } = readLibrary(tmpFile);
    expect(errors).toBe(0);
    expect(restored.samples.length).toBe(library.samples.length);

    for (let i = 0; i < library.samples.length; i++) {
      expect(restored.samples[i].esli.name).toBe(library.samples[i].esli.name);
      expect(restored.samples[i].esli.oscIndex).toBe(library.samples[i].esli.oscIndex);
      expect(restored.samples[i].esli.samplingFreq).toBe(library.samples[i].esli.samplingFreq);
    }

    fs.unlinkSync(tmpFile);
  });
});
