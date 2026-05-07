/**
 * Audio format conversion operations for Electribe 2 samples.
 *
 * The Electribe 2 Sampler requires 16-bit PCM audio. These functions convert
 * 8-bit and 24-bit WAV data to 16-bit, and stereo to mono.
 */

import { Sample } from "../models/sample.js";
import { WAVE_FORMAT_PCM } from "../riff/wave.js";

/**
 * Convert 8-bit unsigned PCM to 16-bit signed PCM in-place.
 * 8-bit WAV is unsigned (0-255, center at 128). Conversion: (sample - 128) * 256.
 */
export function pcm8bTo16b(sample: Sample): Sample {
  const fmt = sample.fmt;
  if (fmt.formatTag !== WAVE_FORMAT_PCM || fmt.bitsPerSample !== 8) return sample;

  const raw = sample.audioData;
  const nSamples = raw.length;
  const signed16 = Buffer.alloc(nSamples * 2);
  for (let i = 0; i < nSamples; i++) {
    signed16.writeInt16LE((raw[i] - 128) * 256, i * 2);
  }
  sample.audioData = signed16;

  const dataChunk = sample.getChunk("data");
  if (dataChunk) dataChunk.header.size = signed16.length;

  fmt.bitsPerSample = 16;
  fmt.avgBytesPerSec *= 2;
  fmt.blockAlign *= 2;
  return sample;
}

/**
 * Convert 24-bit signed PCM to 16-bit signed PCM by dropping the low byte.
 * Each 24-bit sample (3 bytes LE: low, mid, high) becomes 16-bit (mid, high).
 */
export function pcm24bTo16b(sample: Sample): Sample {
  const fmt = sample.fmt;
  if (fmt.formatTag !== WAVE_FORMAT_PCM || fmt.bitsPerSample !== 24) return sample;

  const raw = sample.audioData;
  const nSamples = Math.floor(raw.length / 3);
  const converted = Buffer.alloc(nSamples * 2);
  for (let i = 0; i < nSamples; i++) {
    converted[i * 2] = raw[i * 3 + 1];
    converted[i * 2 + 1] = raw[i * 3 + 2];
  }
  sample.audioData = converted;

  const dataChunk = sample.getChunk("data");
  if (dataChunk) dataChunk.header.size = converted.length;

  fmt.bitsPerSample = 16;
  fmt.avgBytesPerSec = Math.floor(fmt.avgBytesPerSec * 2 / 3);
  fmt.blockAlign = Math.floor(fmt.blockAlign * 2 / 3);
  return sample;
}

/**
 * Convert a multi-channel sample to mono by weighted mix-down.
 *
 * @param sample - The sample to convert (modified in-place)
 * @param mix - Pan position: -1.0 = full left, 0.0 = center (equal L/R), 1.0 = full right
 *
 * The mixing formula for stereo:
 *   wLeft  = (1 - mix) / 2    → 1.0 at mix=-1, 0.5 at mix=0, 0.0 at mix=1
 *   wRight = (1 + mix) / 2    → 0.0 at mix=-1, 0.5 at mix=0, 1.0 at mix=1
 * Weights are normalized by their absolute sum to prevent clipping.
 *
 * Also updates ESLI metadata: adjusts byte offsets by dividing by channel count,
 * and sets stereo=false.
 */
export function stereoToMono(sample: Sample, mix = 0.0): Sample {
  const fmt = sample.fmt;
  const nChannels = fmt.channels;
  if (nChannels <= 1) return sample;

  const esli = sample.esli;
  const wLeft = (1.0 - mix) / 2.0;
  const wRight = 1.0 - wLeft;
  const weights = [wLeft, wRight, ...new Array(nChannels - 2).fill(0)];
  const wSum = weights.reduce((s, w) => s + Math.abs(w), 0);
  const normalizedWeights = weights.map(w => w / wSum);

  const raw = sample.audioData;
  const nSamplesPerChan = Math.floor(raw.length / (nChannels * 2));

  const channels: Int16Array[] = [];
  for (let c = 0; c < nChannels; c++) {
    const ch = new Int16Array(nSamplesPerChan);
    for (let i = 0; i < nSamplesPerChan; i++) {
      ch[i] = raw.readInt16LE((i * nChannels + c) * 2);
    }
    channels.push(ch);
  }

  const mono = Buffer.alloc(nSamplesPerChan * 2);
  for (let i = 0; i < nSamplesPerChan; i++) {
    let sum = 0;
    for (let c = 0; c < nChannels; c++) sum += channels[c][i] * normalizedWeights[c];
    mono.writeInt16LE(Math.round(sum), i * 2);
  }
  sample.audioData = mono;

  const prevChannels = fmt.channels;
  fmt.channels = 1;
  fmt.avgBytesPerSec = Math.floor(fmt.avgBytesPerSec / prevChannels);
  fmt.blockAlign = Math.floor(fmt.blockAlign / prevChannels);

  // ESLI offsets are in bytes; halve them when going from stereo to mono
  esli.startPoint = Math.floor(esli.startPoint / prevChannels);
  esli.loopStartOffset = Math.floor(esli.loopStartOffset / prevChannels);
  esli.endPointOffset = Math.floor(esli.endPointOffset / prevChannels);
  esli.wavDataSize = Math.floor(esli.wavDataSize / prevChannels);
  esli.stereo = false;

  const dataChunk = sample.getChunk("data");
  if (dataChunk) dataChunk.header.size = mono.length;

  return sample;
}
