/** WAV "smpl" chunk: sampler-specific metadata with loop point definitions. */
import { ChunkData, ChunkHeader } from "./chunk.js";

/** A single loop definition (24 bytes): start/end sample positions and loop type. */
export class LoopData {
  static readonly SIZE = 24;

  identifier = 0;
  type = 0;
  start = 0;
  end = 0;
  fraction = 0;
  playCount = 0;

  static fromBuffer(buf: Buffer, offset: number): LoopData {
    const loop = new LoopData();
    loop.identifier = buf.readUInt32LE(offset);
    loop.type = buf.readUInt32LE(offset + 4);
    loop.start = buf.readUInt32LE(offset + 8);
    loop.end = buf.readUInt32LE(offset + 12);
    loop.fraction = buf.readUInt32LE(offset + 16);
    loop.playCount = buf.readUInt32LE(offset + 20);
    return loop;
  }

  toBuffer(buf: Buffer, offset: number): void {
    buf.writeUInt32LE(this.identifier, offset);
    buf.writeUInt32LE(this.type, offset + 4);
    buf.writeUInt32LE(this.start, offset + 8);
    buf.writeUInt32LE(this.end, offset + 12);
    buf.writeUInt32LE(this.fraction, offset + 16);
    buf.writeUInt32LE(this.playCount, offset + 20);
  }
}

export class SmplChunk extends ChunkData {
  static readonly MIN_SIZE = 36;

  manufacturer = 0;
  product = 0;
  samplePeriod = 0;
  midiUnityNote = 60;
  midiPitchFraction = 0;
  smpteFormat = 0;
  smpteOffset = 0;
  numSampleLoops = 0;
  numAdditionalBytes = 0;
  loops: LoopData[] = [];

  get length(): number {
    return SmplChunk.MIN_SIZE + this.loops.length * LoopData.SIZE;
  }

  readFromBuffer(buf: Buffer, offset: number, size: number): number {
    this.manufacturer = buf.readUInt32LE(offset);
    this.product = buf.readUInt32LE(offset + 4);
    this.samplePeriod = buf.readUInt32LE(offset + 8);
    this.midiUnityNote = buf.readUInt32LE(offset + 12);
    this.midiPitchFraction = buf.readUInt32LE(offset + 16);
    this.smpteFormat = buf.readUInt32LE(offset + 20);
    this.smpteOffset = buf.readUInt32LE(offset + 24);
    this.numSampleLoops = buf.readUInt32LE(offset + 28);
    this.numAdditionalBytes = buf.readUInt32LE(offset + 32);

    this.loops = [];
    for (let i = 0; i < this.numSampleLoops; i++) {
      this.loops.push(LoopData.fromBuffer(buf, offset + SmplChunk.MIN_SIZE + i * LoopData.SIZE));
    }
    return size;
  }

  writeToBuffer(buf: Buffer, offset: number): number {
    buf.writeUInt32LE(this.manufacturer, offset);
    buf.writeUInt32LE(this.product, offset + 4);
    buf.writeUInt32LE(this.samplePeriod, offset + 8);
    buf.writeUInt32LE(this.midiUnityNote, offset + 12);
    buf.writeUInt32LE(this.midiPitchFraction, offset + 16);
    buf.writeUInt32LE(this.smpteFormat, offset + 20);
    buf.writeUInt32LE(this.smpteOffset, offset + 24);
    buf.writeUInt32LE(this.loops.length, offset + 28);
    buf.writeUInt32LE(this.numAdditionalBytes, offset + 32);

    for (let i = 0; i < this.loops.length; i++) {
      this.loops[i].toBuffer(buf, offset + SmplChunk.MIN_SIZE + i * LoopData.SIZE);
    }
    return SmplChunk.MIN_SIZE + this.loops.length * LoopData.SIZE;
  }

  addLoop(): LoopData {
    const loop = new LoopData();
    this.loops.push(loop);
    this.numSampleLoops = this.loops.length;
    return loop;
  }
}
