/**
 * ESLI (Electribe Sample Library Information) metadata chunk.
 *
 * Each sample in an Electribe 2 .all library contains a Korg-proprietary "esli"
 * sub-chunk inside the RIFF/WAVE structure. This 1172-byte chunk stores all
 * sample metadata: name, category, playback parameters, loop points, and up to
 * 64 slice definitions.
 *
 * ## Byte Layout (1172 bytes = 0x494)
 *
 * | Offset | Size  | Type     | Field                        |
 * |--------|-------|----------|------------------------------|
 * | 0x000  | 2     | uint16LE | oscIndex (0-based)           |
 * | 0x002  | 16    | ASCII    | name (null-padded)           |
 * | 0x012  | 2     | uint16LE | category (OscCategory enum)  |
 * | 0x014  | 2     | uint16LE | importNumber                 |
 * | 0x016  | 12    | bytes    | fixed (unknown, preserved)   |
 * | 0x022  | 2     | uint16LE | playLogPeriod                |
 * | 0x024  | 2     | uint16LE | playVolume (0-65535)         |
 * | 0x026  | 1     | byte     | variable (preserved)         |
 * | 0x027  | 1     | byte     | fixed (preserved)            |
 * | 0x028  | 4     | uint32LE | startPoint (byte offset)     |
 * | 0x02C  | 4     | uint32LE | loopStartOffset (byte offset)|
 * | 0x030  | 4     | uint32LE | endPointOffset (byte offset) |
 * | 0x034  | 1     | bool     | oneShot                      |
 * | 0x035  | 7     | bytes    | fixed (zero, preserved)      |
 * | 0x03C  | 4     | uint32LE | wavDataSize                  |
 * | 0x040  | 1     | byte     | useChan0 (always 1)          |
 * | 0x041  | 1     | bool     | stereo                       |
 * | 0x042  | 1     | bool     | plus12db                     |
 * | 0x043  | 5     | bytes    | fixed (engine flags)         |
 * | 0x048  | 4     | uint32LE | samplingFreq (Hz)            |
 * | 0x04C  | 1     | byte     | fixed (preserved)            |
 * | 0x04D  | 1     | int8     | sampleTune (-63 to +63)      |
 * | 0x04E  | 2     | uint16LE | oscIndexMirror (= oscIndex)  |
 * | 0x050  | 1024  | 64×16B   | slices (see SliceData)       |
 * | 0x450  | 64    | 64×int8  | sliceActiveSteps             |
 * | 0x490  | 1     | byte     | slicingNumSteps              |
 * | 0x491  | 1     | byte     | slicingBeat (BeatType enum)  |
 * | 0x492  | 1     | byte     | numActiveSteps               |
 * | 0x493  | 1     | byte     | variable (preserved)         |
 *
 * Slice record (16 bytes each, 64 slices at 0x050-0x44F):
 * | +0 | int32LE  | start (sample frame, can be negative) |
 * | +4 | uint32LE | length (frames)                       |
 * | +8 | uint32LE | attackLength (frames)                  |
 * | +12| uint32LE | amplitude (0-65535)                    |
 */

import {
  ESLI_CHUNK_SIZE, FIXED_BYTES_16_22, FIXED_BYTES_27, FIXED_BYTES_35_3C,
  FIXED_BYTES_43_48, FIXED_BYTES_4C, FIXED_USE_CHAN0, TUNE_MIN, TUNE_MAX, VOLUME_MAX,
} from "../constants.js";
import { BeatType, OscCategory, categoryDisplayName, beatDisplayName } from "./enums.js";

/** A single slice definition within a sample (16 bytes in the ESLI chunk). */
export interface SliceData {
  /** Start position in sample frames (can be negative for pre-roll) */
  start: number;
  /** Length in sample frames */
  length: number;
  /** Attack ramp length in frames */
  attackLength: number;
  /** Amplitude level (0-65535) */
  amplitude: number;
}

/** All fields stored in the ESLI metadata chunk. */
export interface EsliData {
  /** 0-based OSC slot index (display number = oscIndex + 1) */
  oscIndex: number;
  /** Sample name, max 16 ASCII characters */
  name: string;
  /** Sample category (Kick, Snare, User, etc.) */
  category: OscCategory;
  /** Korg internal import ID, mapped from OSC index via FACTORY_IMPORT_NUMS */
  importNumber: number;
  /**
   * Logarithmic playback period. Korg pitch formula:
   * playLogPeriod = 63132 - log2(samplingFreq) * 3072
   * where 3072 = 256 subdivisions × 12 semitones (Korg's internal resolution)
   * and 63132 is calibrated so 44100 Hz maps to standard playback rate.
   */
  playLogPeriod: number;
  /** Playback volume (0-65535, default 65535 = max) */
  playVolume: number;
  /** Audio data start point (byte offset into WAV data) */
  startPoint: number;
  /** Loop start as byte offset from startPoint */
  loopStartOffset: number;
  /** End point as byte offset from startPoint */
  endPointOffset: number;
  /** True = one-shot playback, false = looping */
  oneShot: boolean;
  /** +12dB gain boost */
  plus12db: boolean;
  /** Sampling frequency in Hz */
  samplingFreq: number;
  /** Pitch tune offset (-63 to +63 semitones) */
  sampleTune: number;
  /** Total WAV audio data size in bytes */
  wavDataSize: number;
  /** True if stereo (blockAlign=4), false if mono (blockAlign=2) */
  stereo: boolean;
  /** 64 slice definitions */
  slices: SliceData[];
  /** Per-step active slice indices (64 signed bytes) */
  sliceActiveSteps: number[];
  /** Number of slicing steps configured */
  slicingNumSteps: number;
  /** Beat subdivision for slicing */
  slicingBeat: BeatType;
  /** Number of active slice steps */
  numActiveSteps: number;
  /** Mirror of oscIndex — firmware expects both to match */
  oscIndexMirror: number;
}

/**
 * Parses and serializes the 1172-byte ESLI metadata chunk.
 * Preserves unknown/fixed byte regions for byte-exact round-trip fidelity.
 */
export class EsliMetadata implements EsliData {
  static readonly BYTE_SIZE = ESLI_CHUNK_SIZE;

  oscIndex = 0;
  name = "";
  category = OscCategory.USER;
  importNumber = 0;
  playLogPeriod = 0;
  playVolume = VOLUME_MAX;
  startPoint = 0;
  loopStartOffset = 0;
  endPointOffset = 0;
  oneShot = true;
  plus12db = false;
  samplingFreq = 44100;
  sampleTune = 0;
  wavDataSize = 0;
  stereo = false;
  slices: SliceData[] = Array.from({ length: 64 }, () => ({ start: 0, length: 0, attackLength: 0, amplitude: 0 }));
  sliceActiveSteps: number[] = new Array(64).fill(0);
  slicingNumSteps = 0;
  slicingBeat = BeatType.SIXTEEN;
  numActiveSteps = 0;
  oscIndexMirror = 0;

  // Byte regions with unknown purpose, preserved for round-trip fidelity.
  // On write, these are copied back to the exact offsets they came from.
  private fixedBytes: Record<string, Buffer> = {
    fixed_16_22: Buffer.from(FIXED_BYTES_16_22),
    fixed_27: Buffer.from(FIXED_BYTES_27),
    fixed_35_3c: Buffer.from(FIXED_BYTES_35_3C),
    fixed_43_48: Buffer.from(FIXED_BYTES_43_48),
    fixed_4c: Buffer.from(FIXED_BYTES_4C),
  };
  private varBytes: Record<string, Buffer> = {
    var_26: Buffer.from([0x00]),
    var_493: Buffer.from([0x00]),
  };

  /** 1-based OSC display number */
  get oscNumber(): number {
    return this.oscIndex + 1;
  }

  set oscNumber(value: number) {
    this.oscIndex = value - 1;
    this.oscIndexMirror = value - 1;
  }

  get categoryDisplayName(): string {
    return categoryDisplayName(this.category);
  }

  get slicingBeatDisplayName(): string {
    return beatDisplayName(this.slicingBeat);
  }

  /** Parse an ESLI chunk from a 1172-byte buffer. */
  static fromBuffer(data: Buffer): EsliMetadata {
    if (data.length < EsliMetadata.BYTE_SIZE) {
      throw new Error(`esli chunk too small: ${data.length} < ${EsliMetadata.BYTE_SIZE}`);
    }

    const esli = new EsliMetadata();

    // Preserve unknown byte regions for round-trip fidelity
    esli.fixedBytes = {
      fixed_16_22: Buffer.from(data.subarray(0x16, 0x22)),
      fixed_27: Buffer.from(data.subarray(0x27, 0x28)),
      fixed_35_3c: Buffer.from(data.subarray(0x35, 0x3c)),
      fixed_43_48: Buffer.from(data.subarray(0x43, 0x48)),
      fixed_4c: Buffer.from(data.subarray(0x4c, 0x4d)),
    };
    esli.varBytes = {
      var_26: Buffer.from(data.subarray(0x26, 0x27)),
      var_493: Buffer.from(data.subarray(0x493, 0x494)),
    };

    esli.oscIndex = data.readUInt16LE(0x00);
    esli.name = data.subarray(0x02, 0x12).toString("ascii").split("\0")[0];
    esli.category = data.readUInt16LE(0x12) as OscCategory;
    esli.importNumber = data.readUInt16LE(0x14);
    esli.playLogPeriod = data.readUInt16LE(0x22);
    esli.playVolume = data.readUInt16LE(0x24);
    esli.startPoint = data.readUInt32LE(0x28);
    esli.loopStartOffset = data.readUInt32LE(0x2c);
    esli.endPointOffset = data.readUInt32LE(0x30);
    esli.oneShot = data[0x34] !== 0;
    esli.wavDataSize = data.readUInt32LE(0x3c);
    esli.stereo = data[0x41] !== 0;
    esli.plus12db = data[0x42] !== 0;
    esli.samplingFreq = data.readUInt32LE(0x48);
    esli.sampleTune = data.readInt8(0x4d);
    esli.oscIndexMirror = data.readUInt16LE(0x4e);
    esli.slicingNumSteps = data[0x490];
    esli.slicingBeat = data[0x491] as BeatType;
    esli.numActiveSteps = data[0x492];

    for (let i = 0; i < 64; i++) {
      const base = 0x50 + i * 16;
      esli.slices[i] = {
        start: data.readInt32LE(base),
        length: data.readUInt32LE(base + 4),
        attackLength: data.readUInt32LE(base + 8),
        amplitude: data.readUInt32LE(base + 12),
      };
    }

    for (let i = 0; i < 64; i++) {
      esli.sliceActiveSteps[i] = data.readInt8(0x450 + i);
    }

    return esli;
  }

  /** Serialize to a 1172-byte buffer, preserving all unknown byte regions. */
  toBuffer(): Buffer {
    const buf = Buffer.alloc(EsliMetadata.BYTE_SIZE);

    buf.writeUInt16LE(this.oscIndex, 0x00);
    const nameBytes = Buffer.from(this.name, "ascii");
    nameBytes.copy(buf, 0x02, 0, Math.min(nameBytes.length, 16));
    buf.writeUInt16LE(this.category, 0x12);
    buf.writeUInt16LE(this.importNumber, 0x14);

    this.fixedBytes.fixed_16_22.copy(buf, 0x16);
    this.fixedBytes.fixed_27.copy(buf, 0x27);
    this.fixedBytes.fixed_35_3c.copy(buf, 0x35);
    this.fixedBytes.fixed_43_48.copy(buf, 0x43);
    this.fixedBytes.fixed_4c.copy(buf, 0x4c);
    this.varBytes.var_26.copy(buf, 0x26);
    this.varBytes.var_493.copy(buf, 0x493);

    buf.writeUInt16LE(this.playLogPeriod, 0x22);
    buf.writeUInt16LE(this.playVolume, 0x24);
    buf.writeUInt32LE(this.startPoint, 0x28);
    buf.writeUInt32LE(this.loopStartOffset, 0x2c);
    buf.writeUInt32LE(this.endPointOffset, 0x30);
    buf[0x34] = this.oneShot ? 1 : 0;
    buf.writeUInt32LE(this.wavDataSize, 0x3c);
    buf[0x40] = FIXED_USE_CHAN0;
    buf[0x41] = this.stereo ? 1 : 0;
    buf[0x42] = this.plus12db ? 1 : 0;
    buf.writeUInt32LE(this.samplingFreq, 0x48);
    buf.writeInt8(clamp(this.sampleTune, TUNE_MIN, TUNE_MAX), 0x4d);
    buf.writeUInt16LE(this.oscIndexMirror, 0x4e);

    for (let i = 0; i < Math.min(this.slices.length, 64); i++) {
      const base = 0x50 + i * 16;
      const s = this.slices[i];
      buf.writeInt32LE(s.start, base);
      buf.writeUInt32LE(s.length, base + 4);
      buf.writeUInt32LE(s.attackLength, base + 8);
      buf.writeUInt32LE(s.amplitude, base + 12);
    }

    for (let i = 0; i < Math.min(this.sliceActiveSteps.length, 64); i++) {
      buf.writeInt8(this.sliceActiveSteps[i], 0x450 + i);
    }

    buf[0x490] = this.slicingNumSteps;
    buf[0x491] = this.slicingBeat;
    buf[0x492] = this.numActiveSteps;

    return buf;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
