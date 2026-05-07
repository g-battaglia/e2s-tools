import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { stereoToMono } from "../src/operations/convert.js";
import { readLibrary } from "../src/io/reader.js";

describe("Convert", () => {
  it("converts stereo to mono on a real library sample", () => {
    const fixture = path.join(__dirname, "fixtures", "e2sSample.all");
    if (!fs.existsSync(fixture)) { console.warn(`SKIP: fixture not found: ${fixture}`); return; }

    const { library } = readLibrary(fixture);
    const stereoSample = library.samples.find(s => s.esli.stereo);
    if (!stereoSample) return;

    const originalSize = stereoSample.audioData.length;
    stereoToMono(stereoSample, 0);

    expect(stereoSample.audioData.length).toBe(originalSize / 2);
    expect(stereoSample.esli.stereo).toBe(false);
  });

  it("reads library samples with valid audio data and format", () => {
    const fixture = path.join(__dirname, "fixtures", "e2sSample.all");
    if (!fs.existsSync(fixture)) { console.warn(`SKIP: fixture not found: ${fixture}`); return; }

    // Use any real WAV from the fixture exports
    // This test verifies the import pipeline works end-to-end
    const { library } = readLibrary(fixture);
    expect(library.samples.length).toBeGreaterThan(0);

    // Verify at least one sample has valid audio data
    const sample = library.samples[0];
    expect(sample.audioData.length).toBeGreaterThan(0);
    expect(sample.fmt.samplesPerSec).toBeGreaterThan(0);
  });
});
