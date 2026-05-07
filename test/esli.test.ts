import { describe, it, expect } from "vitest";
import { EsliMetadata } from "../src/models/esli.js";
import { OscCategory, BeatType } from "../src/models/enums.js";
import { ESLI_CHUNK_SIZE } from "../src/constants.js";

function rawEsli(): Buffer {
  const buf = Buffer.alloc(ESLI_CHUNK_SIZE);
  // OSC index
  buf.writeUInt16LE(18, 0x00);
  // Name
  Buffer.from("TestSample", "ascii").copy(buf, 0x02);
  // Category = KICK
  buf.writeUInt16LE(OscCategory.KICK, 0x12);
  // Import number
  buf.writeUInt16LE(100, 0x14);
  // Play log period
  buf.writeUInt16LE(48000, 0x22);
  // Play volume
  buf.writeUInt16LE(50000, 0x24);
  // Start point
  buf.writeUInt32LE(0, 0x28);
  // Loop start offset
  buf.writeUInt32LE(1000, 0x2c);
  // End point offset
  buf.writeUInt32LE(5000, 0x30);
  // One shot
  buf[0x34] = 1;
  // Wav data size
  buf.writeUInt32LE(10000, 0x3c);
  // Stereo
  buf[0x41] = 0;
  // Plus12db
  buf[0x42] = 1;
  // Sampling freq
  buf.writeUInt32LE(44100, 0x48);
  // Sample tune
  buf.writeInt8(-5, 0x4d);
  // OSC index mirror
  buf.writeUInt16LE(18, 0x4e);
  // Slicing params
  buf[0x490] = 8;
  buf[0x491] = BeatType.SIXTEEN;
  buf[0x492] = 4;
  // First slice
  buf.writeInt32LE(0, 0x50);
  buf.writeUInt32LE(100, 0x54);
  buf.writeUInt32LE(10, 0x58);
  buf.writeUInt32LE(200, 0x5c);
  // Second slice
  buf.writeInt32LE(100, 0x60);
  buf.writeUInt32LE(200, 0x64);
  buf.writeUInt32LE(5, 0x68);
  buf.writeUInt32LE(180, 0x6c);

  // Set fixed byte patterns to match what EsliMetadata expects
  const FIXED_BYTES_16_22 = Buffer.from([0x00, 0x00, 0x00, 0x7F, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  FIXED_BYTES_16_22.copy(buf, 0x16);
  buf[0x43] = 0x01; buf[0x44] = 0xB0; buf[0x45] = 0x04;
  buf[0x46] = 0x00; buf[0x47] = 0x00;
  buf[0x40] = 1; // FIXED_USE_CHAN0

  return buf;
}

describe("EsliMetadata", () => {
  it("reads fields from buffer", () => {
    const buf = rawEsli();
    const esli = EsliMetadata.fromBuffer(buf);

    expect(esli.oscIndex).toBe(18);
    expect(esli.oscNumber).toBe(19);
    expect(esli.name).toBe("TestSample");
    expect(esli.category).toBe(OscCategory.KICK);
    expect(esli.categoryDisplayName).toBe("Kick");
    expect(esli.importNumber).toBe(100);
    expect(esli.playLogPeriod).toBe(48000);
    expect(esli.playVolume).toBe(50000);
    expect(esli.startPoint).toBe(0);
    expect(esli.loopStartOffset).toBe(1000);
    expect(esli.endPointOffset).toBe(5000);
    expect(esli.oneShot).toBe(true);
    expect(esli.wavDataSize).toBe(10000);
    expect(esli.stereo).toBe(false);
    expect(esli.plus12db).toBe(true);
    expect(esli.samplingFreq).toBe(44100);
    expect(esli.sampleTune).toBe(-5);
    expect(esli.oscIndexMirror).toBe(18);
    expect(esli.slicingNumSteps).toBe(8);
    expect(esli.slicingBeat).toBe(BeatType.SIXTEEN);
    expect(esli.slicingBeatDisplayName).toBe("16");
    expect(esli.numActiveSteps).toBe(4);
  });

  it("reads slices correctly", () => {
    const esli = EsliMetadata.fromBuffer(rawEsli());
    expect(esli.slices[0]).toEqual({ start: 0, length: 100, attackLength: 10, amplitude: 200 });
    expect(esli.slices[1]).toEqual({ start: 100, length: 200, attackLength: 5, amplitude: 180 });
  });

  it("round-trips to buffer preserving all fields", () => {
    const original = rawEsli();
    const esli = EsliMetadata.fromBuffer(original);
    const restored = esli.toBuffer();

    expect(restored.length).toBe(ESLI_CHUNK_SIZE);

    // Verify all semantic fields round-trip
    const esli2 = EsliMetadata.fromBuffer(restored);
    expect(esli2.oscIndex).toBe(esli.oscIndex);
    expect(esli2.name).toBe(esli.name);
    expect(esli2.category).toBe(esli.category);
    expect(esli2.importNumber).toBe(esli.importNumber);
    expect(esli2.playLogPeriod).toBe(esli.playLogPeriod);
    expect(esli2.playVolume).toBe(esli.playVolume);
    expect(esli2.startPoint).toBe(esli.startPoint);
    expect(esli2.loopStartOffset).toBe(esli.loopStartOffset);
    expect(esli2.endPointOffset).toBe(esli.endPointOffset);
    expect(esli2.oneShot).toBe(esli.oneShot);
    expect(esli2.wavDataSize).toBe(esli.wavDataSize);
    expect(esli2.stereo).toBe(esli.stereo);
    expect(esli2.plus12db).toBe(esli.plus12db);
    expect(esli2.samplingFreq).toBe(esli.samplingFreq);
    expect(esli2.sampleTune).toBe(esli.sampleTune);
    expect(esli2.oscIndexMirror).toBe(esli.oscIndexMirror);
    expect(esli2.slicingNumSteps).toBe(esli.slicingNumSteps);
    expect(esli2.slicingBeat).toBe(esli.slicingBeat);
    expect(esli2.numActiveSteps).toBe(esli.numActiveSteps);
    expect(esli2.slices).toEqual(esli.slices);
  });

  it("mutates fields and serializes correctly", () => {
    const esli = EsliMetadata.fromBuffer(rawEsli());
    esli.name = "NewName";
    esli.category = OscCategory.SNARE;
    esli.sampleTune = 10;
    esli.oneShot = false;
    esli.slicingNumSteps = 16;
    esli.slices[0] = { start: 50, length: 300, attackLength: 20, amplitude: 250 };

    const buf = esli.toBuffer();
    const restored = EsliMetadata.fromBuffer(buf);

    expect(restored.name).toBe("NewName");
    expect(restored.category).toBe(OscCategory.SNARE);
    expect(restored.sampleTune).toBe(10);
    expect(restored.oneShot).toBe(false);
    expect(restored.slicingNumSteps).toBe(16);
    expect(restored.slices[0]).toEqual({ start: 50, length: 300, attackLength: 20, amplitude: 250 });
  });

  it("creates default metadata with correct defaults", () => {
    const esli = new EsliMetadata();
    expect(esli.oscIndex).toBe(0);
    expect(esli.name).toBe("");
    expect(esli.category).toBe(OscCategory.USER);
    expect(esli.playVolume).toBe(65535);
    expect(esli.samplingFreq).toBe(44100);
    expect(esli.oneShot).toBe(true);
    expect(esli.slices.length).toBe(64);
  });
});
