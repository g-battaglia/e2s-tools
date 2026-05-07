/**
 * Export an Electribe 2 sample to a standard WAV file.
 * Optionally includes smpl chunk (loop points) and cue chunk (slice markers)
 * reconstructed from the ESLI metadata.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { Sample } from "../models/sample.js";
import { Chunk, ChunkHeader } from "../riff/chunk.js";
import { CueChunk } from "../riff/cue.js";
import { SmplChunk } from "../riff/smpl.js";

export interface ExportOptions {
  exportSmplChunk: boolean;
  exportCueChunk: boolean;
}

export const defaultExportOptions: ExportOptions = {
  exportSmplChunk: true,
  exportCueChunk: true,
};

export function exportToWav(sample: Sample, filePath: string, opts?: Partial<ExportOptions>): void {
  const options = { ...defaultExportOptions, ...opts };

  const clean = sample.cleanCopy();
  const esli = clean.esli;
  const fmt = clean.fmt;
  let uid = 0;

  // Add smpl chunk for loop points
  if (options.exportSmplChunk && esli.loopStartOffset < esli.endPointOffset) {
    const smpl = new SmplChunk();
    smpl.samplePeriod = Math.round(1.0 / esli.samplingFreq * 1e9);
    const loop = smpl.addLoop();
    loop.identifier = uid;
    loop.start = Math.floor((esli.startPoint + esli.loopStartOffset) / fmt.blockAlign);
    loop.end = Math.floor((esli.startPoint + esli.endPointOffset) / fmt.blockAlign);
    const smplChunk = Chunk.from(ChunkHeader.from("smpl"), smpl);
    clean.form.chunkList.chunks.push(smplChunk);
    uid++;
  }

  // Add cue chunk for slice markers
  if (options.exportCueChunk) {
    const numSamples = Math.floor(clean.audioData.length / fmt.blockAlign);
    const startSample = Math.floor(esli.startPoint / fmt.blockAlign);
    const slices = esli.slices.filter(sli => sli.length > 0 && sli.start < numSamples);
    const uniqueSlices = slices.filter((sli, i) => !slices.some((other, j) => j < i && other.start === sli.start));

    if (uniqueSlices.length > 0) {
      const cue = new CueChunk();
      for (const sli of uniqueSlices) {
        const cp = cue.addCuePoint();
        cp.identifier = uid;
        cp.position = sli.start + startSample;
        cp.fccChunk = Buffer.from("data", "ascii");
        cp.sampleOffset = sli.start + startSample;
        uid++;
      }
      const cueChunk = Chunk.from(ChunkHeader.from("cue "), cue);
      clean.form.chunkList.chunks.push(cueChunk);
    }
  }

  const buf = clean.toBuffer();
  fs.writeFileSync(filePath, buf);
}
