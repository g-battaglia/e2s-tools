import { Sample } from "../models/sample.js";

/**
 * Trim a sample's audio data to a frame range [start, stop].
 * Adjusts ESLI metadata offsets (startPoint, loop, end, slices) relative to the new origin.
 */
export function trimSample(sample: Sample, start: number, stop: number): Sample {
  const fmt = sample.fmt;
  const esli = sample.esli;

  const dataSize = sample.audioData.length;
  const blockAlign = fmt.blockAlign;

  // Clamp to valid range
  const maxFrame = Math.floor(dataSize / blockAlign) - 1;
  start = Math.min(Math.max(0, start), maxFrame);
  stop = Math.min(Math.max(0, stop), maxFrame);
  if (start > stop) [start, stop] = [stop, start];

  const byteOffset = start * blockAlign;
  const frameCount = stop - start + 1;
  const byteCount = frameCount * blockAlign;

  // Adjust all points relative to new origin
  esli.startPoint = Math.max(0, esli.startPoint - byteOffset);

  // Adjust slices first
  for (const sli of esli.slices) {
    sli.length = Math.max(0, Math.min(sli.length, sli.length + sli.start));
    sli.start = Math.max(0, sli.start);
  }

  esli.loopStartOffset = Math.min(esli.loopStartOffset, byteCount - blockAlign);
  esli.endPointOffset = Math.min(esli.endPointOffset, byteCount - blockAlign);

  for (const sli of esli.slices) {
    if (sli.start > frameCount - 1) {
      sli.start = 0;
      sli.length = 0;
    } else {
      sli.length = Math.min(sli.length, frameCount - sli.start);
    }
  }

  sample.audioData = Buffer.from(sample.audioData.subarray(byteOffset, byteOffset + byteCount));
  esli.wavDataSize = sample.audioData.length;

  return sample;
}
