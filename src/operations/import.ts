import * as fs from "node:fs";
import * as path from "node:path";
import { WAVE_FORMAT_PCM } from "../riff/wave.js";
import { SmplChunk } from "../riff/smpl.js";
import { CueChunk } from "../riff/cue.js";
import { Sample } from "../models/sample.js";
import { OscCategory, categoryFromDisplayName } from "../models/enums.js";
import { EmptyWavError, InvalidWavFormatError, UnsupportedBitDepthError } from "../errors.js";
import { pcm8bTo16b, pcm24bTo16b, stereoToMono } from "./convert.js";

export interface ImportOptions {
  category: string;
  loopType: number;
  plus12db: boolean;
  forceCategory: boolean;
  forceLoopType: boolean;
  forcePlus12db: boolean;
  forceMono: boolean;
  monoMix: number;
  startFrom: number;
}

export const defaultImportOptions: ImportOptions = {
  category: "User",
  loopType: 0,
  plus12db: false,
  forceCategory: false,
  forceLoopType: false,
  forcePlus12db: false,
  forceMono: false,
  monoMix: 0.0,
  startFrom: 19,
};

/**
 * Import a WAV file as an Electribe 2 sample with ESLI metadata.
 * Handles bit-depth conversion (8/24→16), ESLI metadata setup (name, category,
 * playback period, loop points), and reads existing smpl/cue chunks for loop
 * and slice data. Returns the sample and conversion diagnostics.
 */
export function importFromWav(
  filePath: string,
  opts?: Partial<ImportOptions>
): { sample: Sample; convertedFrom: number | null; convertedToMono: boolean } {
  const options = { ...defaultImportOptions, ...opts };
  const data = fs.readFileSync(filePath);
  const sample = new Sample(data);

  const fmt = sample.fmt;
  if (fmt.formatTag !== WAVE_FORMAT_PCM) throw new InvalidWavFormatError("WAV format must be PCM");
  if (sample.audioData.length === 0) throw new EmptyWavError("Empty WAV samples are not allowed");

  let convertedFrom: number | null = null;
  if (fmt.bitsPerSample !== 16) {
    if (fmt.bitsPerSample === 8) { pcm8bTo16b(sample); convertedFrom = 8; }
    else if (fmt.bitsPerSample === 24) { pcm24bTo16b(sample); convertedFrom = 24; }
    else throw new UnsupportedBitDepthError(`Unsupported bit depth: ${fmt.bitsPerSample}`);
  }

  // Ensure korg/esli chunks exist in the RIFF structure
  sample.ensureKorgEsli();

  const esli = sample.esli;
  const audioData = sample.audioData;

  esli.name = path.basename(filePath, path.extname(filePath));
  esli.samplingFreq = fmt.samplesPerSec;
  esli.endPointOffset = audioData.length - fmt.blockAlign;
  esli.loopStartOffset = esli.endPointOffset;
  esli.wavDataSize = audioData.length;
  if (fmt.blockAlign === 4) esli.stereo = true;
  esli.playVolume = 65535;

  try {
    esli.category = categoryFromDisplayName(options.category);
  } catch {
    esli.category = OscCategory.USER;
  }

  esli.plus12db = options.plus12db;

  // Korg stores pitch as a logarithmic period:
  // playLogPeriod = 63132 - log2(freq) * 3072
  // 3072 = 256 subdivisions/octave × 12 semitones (Korg's internal resolution)
  // 63132 is calibrated so 44100 Hz maps to standard playback rate
  if (fmt.samplesPerSec === 0) {
    esli.playLogPeriod = 65535;
  } else {
    esli.playLogPeriod = Math.max(0, Math.round(63132 - Math.log2(fmt.samplesPerSec) * 3072));
  }

  // Read loop points from existing smpl chunk
  const smplChunk = sample.getChunk("smpl");
  if (smplChunk && smplChunk.data instanceof SmplChunk) {
    const smpl = smplChunk.data as SmplChunk;
    if (smpl.loops.length > 0) {
      const loop = smpl.loops[0];
      esli.loopStartOffset = loop.start * fmt.blockAlign;
      esli.oneShot = false;
    }
  }

  // Read slice markers from existing cue chunk
  const cueChunk = sample.getChunk("cue ");
  if (cueChunk && cueChunk.data instanceof CueChunk) {
    const cue = cueChunk.data as CueChunk;
    const numSamples = Math.floor(audioData.length / fmt.blockAlign);
    for (let i = 0; i < Math.min(cue.cuePoints.length, 64); i++) {
      const cp = cue.cuePoints[i];
      if (cp.sampleOffset < numSamples) {
        esli.slices[i] = {
          start: cp.sampleOffset,
          length: numSamples - cp.sampleOffset,
          attackLength: 0,
          amplitude: 65535,
        };
      }
    }
  }

  const convertedToMono = applyForcedOptions(sample, options);

  return { sample, convertedFrom, convertedToMono };
}

function applyForcedOptions(sample: Sample, opts: ImportOptions): boolean {
  const esli = sample.esli;

  if (opts.forceCategory) {
    try { esli.category = categoryFromDisplayName(opts.category); } catch { /* keep current */ }
  }

  if (opts.forceLoopType) {
    if (opts.loopType === 0) {
      esli.loopStartOffset = esli.endPointOffset;
      esli.oneShot = true;
    } else if (opts.loopType === 1) {
      esli.loopStartOffset = 0;
      esli.oneShot = false;
    }
  }

  if (opts.forcePlus12db) esli.plus12db = opts.plus12db;

  if (opts.forceMono) {
    stereoToMono(sample, opts.monoMix);
    return true;
  }

  return false;
}
