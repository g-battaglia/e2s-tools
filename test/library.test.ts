import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { SampleLibrary } from "../src/models/library.js";
import { Sample } from "../src/models/sample.js";
import { EsliMetadata } from "../src/models/esli.js";
import { OscCategory } from "../src/models/enums.js";
import { readLibrary } from "../src/io/reader.js";
import { writeLibrary } from "../src/io/writer.js";
import { LIBRARY_HEADER_SIZE, LIBRARY_POINTER_COUNT } from "../src/constants.js";

function makeSample(oscIndex: number, name: string, dataSize = 100): Sample {
  // Build a minimal valid RIFF/WAVE sample with esli
  const audioData = Buffer.alloc(dataSize);
  const esli = new EsliMetadata();
  esli.oscIndex = oscIndex;
  esli.oscIndexMirror = oscIndex;
  esli.name = name;
  esli.wavDataSize = dataSize;
  esli.samplingFreq = 44100;

  // Minimal RIFF: fmt(16) + data(dataSize) + korg/esli(1172)
  const fmtSize = 16;
  const dataSizeWithAlign = dataSize + (dataSize % 2);
  const esliSize = 8 + 1172; // "esli" header + data
  const korgSize = 8 + esliSize; // "korg" header + esli sub-chunk
  const waveSize = 4 + (8 + fmtSize) + (8 + dataSizeWithAlign) + korgSize;
  const totalSize = 8 + waveSize;

  const buf = Buffer.alloc(totalSize);
  let pos = 0;

  // RIFF header
  Buffer.from("RIFF", "ascii").copy(buf, pos); pos += 4;
  buf.writeUInt32LE(waveSize, pos); pos += 4;
  Buffer.from("WAVE", "ascii").copy(buf, pos); pos += 4;

  // fmt chunk (16 bytes, no PCM extra)
  Buffer.from("fmt ", "ascii").copy(buf, pos); pos += 4;
  buf.writeUInt32LE(fmtSize, pos); pos += 4;
  buf.writeUInt16LE(1, pos); pos += 2; // PCM
  buf.writeUInt16LE(1, pos); pos += 2; // mono
  buf.writeUInt32LE(44100, pos); pos += 4;
  buf.writeUInt32LE(88200, pos); pos += 4;
  buf.writeUInt16LE(2, pos); pos += 2; // block align
  pos += 2; // skip bitsPerSample since fmt size is 16

  // data chunk
  Buffer.from("data", "ascii").copy(buf, pos); pos += 4;
  buf.writeUInt32LE(dataSize, pos); pos += 4;
  audioData.copy(buf, pos); pos += dataSizeWithAlign;

  // korg chunk
  Buffer.from("korg", "ascii").copy(buf, pos); pos += 4;
  buf.writeUInt32LE(esliSize, pos); pos += 4;
  // esli sub-chunk
  Buffer.from("esli", "ascii").copy(buf, pos); pos += 4;
  buf.writeUInt32LE(1172, pos); pos += 4;
  esli.toBuffer().copy(buf, pos);

  const sample = new Sample(buf);
  return sample;
}

describe("SampleLibrary", () => {
  it("adds and retrieves samples by OSC number", () => {
    const lib = new SampleLibrary();
    const s1 = makeSample(18, "Kick");
    const s2 = makeSample(19, "Snare");

    lib.addSample(s1);
    lib.addSample(s2);

    expect(lib.samples.length).toBe(2);
    expect(lib.getByOscNumber(19)?.esli.name).toBe("Kick");
    expect(lib.getByOscNumber(20)?.esli.name).toBe("Snare");
  });

  it("auto-assigns OSC index when not specified", () => {
    const lib = new SampleLibrary();
    const s = makeSample(0, "Auto");
    s.esli.oscIndex = 0;
    s.esli.oscIndexMirror = 0;

    const assigned = lib.addSample(s);
    expect(assigned).toBe(18); // First valid index after factory range
  });

  it("removes samples by OSC index", () => {
    const lib = new SampleLibrary();
    lib.addSample(makeSample(18, "Kick"));
    lib.addSample(makeSample(19, "Snare"));

    lib.removeSample(18);
    expect(lib.samples.length).toBe(1);
    expect(lib.getByOscNumber(19)).toBeUndefined();
    expect(lib.getByOscNumber(20)?.esli.name).toBe("Snare");
  });

  it("swaps two samples", () => {
    const lib = new SampleLibrary();
    lib.addSample(makeSample(18, "Kick"));
    lib.addSample(makeSample(19, "Snare"));

    lib.swapSamples(18, 19);

    const first = lib.getByOscIndex(18);
    const second = lib.getByOscIndex(19);
    expect(first?.esli.name).toBe("Snare");
    expect(second?.esli.name).toBe("Kick");
  });

  it("finds next free OSC index", () => {
    const lib = new SampleLibrary();
    lib.addSample(makeSample(18, "A"));
    lib.addSample(makeSample(19, "B"));

    const free = lib.nextFreeIndex(18);
    expect(free).toBe(20);
  });

  it("validates OSC index correctly", () => {
    expect(SampleLibrary.isValidOscIndex(18)).toBe(true);
    expect(SampleLibrary.isValidOscIndex(421)).toBe(true);
    expect(SampleLibrary.isValidOscIndex(422)).toBe(false); // Gap start
    expect(SampleLibrary.isValidOscIndex(499)).toBe(false); // Gap end
    expect(SampleLibrary.isValidOscIndex(500)).toBe(true);
    expect(SampleLibrary.isValidOscIndex(1019)).toBe(true);
    expect(SampleLibrary.isValidOscIndex(1020)).toBe(false);
  });

  it("computes total data size", () => {
    const lib = new SampleLibrary();
    lib.addSample(makeSample(18, "A", 200));
    lib.addSample(makeSample(19, "B", 300));
    expect(lib.totalDataSize).toBe(500);
  });

  it("reads real .all file and round-trips", () => {
    const fixture = path.join(__dirname, "fixtures", "e2sSample.all");
    if (!fs.existsSync(fixture)) { console.warn(`SKIP: fixture not found: ${fixture}`); return; }

    const { library, errors } = readLibrary(fixture);
    expect(errors).toBe(0);
    expect(library.samples.length).toBeGreaterThan(0);

    // Write and read back
    const tmpFile = path.join(__dirname, "fixtures", "test_roundtrip.all");
    writeLibrary(library, tmpFile);

    const { library: restored } = readLibrary(tmpFile);
    expect(restored.samples.length).toBe(library.samples.length);

    // Verify each sample's name matches
    for (let i = 0; i < library.samples.length; i++) {
      expect(restored.samples[i].esli.name).toBe(library.samples[i].esli.name);
      expect(restored.samples[i].esli.oscIndex).toBe(library.samples[i].esli.oscIndex);
    }

    fs.unlinkSync(tmpFile);
  });
});
