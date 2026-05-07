/**
 * Sample library container (e2sSample.all).
 * Manages up to 1020 samples indexed by OSC number (1-based display, 0-based internal).
 * Handles the OSC gap at indices 422-499 and factory import number assignment.
 */
import { MAX_SAMPLES, OSC_GAP_START, OSC_GAP_END, FACTORY_IMPORT_NUMS } from "../constants.js";
import { DuplicateOSCNumberError, InvalidOSCNumberError, LibraryFullError, SampleNotFoundError } from "../errors.js";
import { Sample } from "./sample.js";

export class SampleLibrary {
  samples: Sample[] = [];

  get length(): number {
    return this.samples.length;
  }

  [Symbol.iterator](): Iterator<Sample> {
    return this.samples[Symbol.iterator]();
  }

  static isValidOscIndex(index: number): boolean {
    if (index < 0 || index >= MAX_SAMPLES) return false;
    return !(index >= OSC_GAP_START && index <= OSC_GAP_END);
  }

  getByOscIndex(index: number): Sample | undefined {
    return this.samples.find(s => s.esli.oscIndex === index);
  }

  getByOscNumber(oscNumber: number): Sample | undefined {
    return this.getByOscIndex(oscNumber - 1);
  }

  /** Find the next available OSC index, starting from 18 (first user slot) by default. */
  nextFreeIndex(fromIndex = 18): number | null {
    const used = new Set(this.samples.map(s => s.esli.oscIndex));
    for (let idx = fromIndex; idx < MAX_SAMPLES; idx++) {
      if (!SampleLibrary.isValidOscIndex(idx)) continue;
      if (!used.has(idx)) return idx;
    }
    return null;
  }

  addSample(sample: Sample, oscIndex?: number): number {
    if (oscIndex !== undefined) {
      if (!SampleLibrary.isValidOscIndex(oscIndex)) {
        throw new InvalidOSCNumberError(`OSC index ${oscIndex} is not valid`);
      }
      const existing = this.getByOscIndex(oscIndex);
      if (existing) {
        throw new DuplicateOSCNumberError(`OSC index ${oscIndex} already has a sample`);
      }
      sample.esli.oscIndex = oscIndex;
      sample.esli.oscIndexMirror = oscIndex;
    } else {
      const freeIdx = this.nextFreeIndex();
      if (freeIdx === null) throw new LibraryFullError("No free OSC slots available");
      sample.esli.oscIndex = freeIdx;
      sample.esli.oscIndexMirror = freeIdx;
    }

    this.samples.push(sample);
    this.sort();
    return sample.esli.oscIndex;
  }

  removeSample(oscIndex: number): Sample {
    const idx = this.samples.findIndex(s => s.esli.oscIndex === oscIndex);
    if (idx === -1) throw new SampleNotFoundError(`No sample at OSC index ${oscIndex}`);
    return this.samples.splice(idx, 1)[0];
  }

  swapSamples(indexA: number, indexB: number): void {
    const sampleA = this.getByOscIndex(indexA);
    const sampleB = this.getByOscIndex(indexB);
    if (!sampleA) throw new SampleNotFoundError(`No sample at OSC index ${indexA}`);
    if (!sampleB) throw new SampleNotFoundError(`No sample at OSC index ${indexB}`);

    sampleA.esli.oscIndex = indexB;
    sampleA.esli.oscIndexMirror = indexB;
    sampleB.esli.oscIndex = indexA;
    sampleB.esli.oscIndexMirror = indexA;
    this.sort();
  }

  get totalDataSize(): number {
    return this.samples.reduce((sum, s) => sum + s.esli.wavDataSize, 0);
  }

  static assignImportNumbers(sample: Sample): void {
    const esli = sample.esli;
    if (esli.oscIndex < 500) {
      const idx = esli.oscIndex - 18;
      if (idx >= 0 && idx < FACTORY_IMPORT_NUMS.length) {
        esli.importNumber = FACTORY_IMPORT_NUMS[idx];
      }
    } else {
      esli.importNumber = 550 + esli.oscIndex - 500;
    }
  }

  sort(): void {
    this.samples.sort((a, b) => a.esli.oscIndex - b.esli.oscIndex);
  }
}
