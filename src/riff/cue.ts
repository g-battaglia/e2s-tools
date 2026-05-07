/** WAV "cue " chunk: list of cue points (sample markers/slice positions). */
import { ChunkData, ChunkHeader } from "./chunk.js";

/** A single cue point (24 bytes): identifies a position in the audio data. */
export class CuePoint {
  static readonly SIZE = 24;

  identifier = 0;
  position = 0;
  fccChunk: Buffer = Buffer.from("data", "ascii");
  chunkStart = 0;
  blockStart = 0;
  sampleOffset = 0;

  static fromBuffer(buf: Buffer, offset: number): CuePoint {
    const cp = new CuePoint();
    cp.identifier = buf.readUInt32LE(offset);
    cp.position = buf.readUInt32LE(offset + 4);
    cp.fccChunk = Buffer.from(buf.subarray(offset + 8, offset + 12));
    cp.chunkStart = buf.readUInt32LE(offset + 12);
    cp.blockStart = buf.readUInt32LE(offset + 16);
    cp.sampleOffset = buf.readUInt32LE(offset + 20);
    return cp;
  }

  toBuffer(buf: Buffer, offset: number): void {
    buf.writeUInt32LE(this.identifier, offset);
    buf.writeUInt32LE(this.position, offset + 4);
    this.fccChunk.copy(buf, offset + 8);
    buf.writeUInt32LE(this.chunkStart, offset + 12);
    buf.writeUInt32LE(this.blockStart, offset + 16);
    buf.writeUInt32LE(this.sampleOffset, offset + 20);
  }
}

export class CueChunk extends ChunkData {
  static readonly MIN_SIZE = 4;

  numCuePoints = 0;
  cuePoints: CuePoint[] = [];

  get length(): number {
    return CueChunk.MIN_SIZE + this.cuePoints.length * CuePoint.SIZE;
  }

  readFromBuffer(buf: Buffer, offset: number, size: number): number {
    this.numCuePoints = buf.readUInt32LE(offset);
    this.cuePoints = [];
    for (let i = 0; i < this.numCuePoints; i++) {
      this.cuePoints.push(CuePoint.fromBuffer(buf, offset + CueChunk.MIN_SIZE + i * CuePoint.SIZE));
    }
    return size;
  }

  writeToBuffer(buf: Buffer, offset: number): number {
    buf.writeUInt32LE(this.cuePoints.length, offset);
    for (let i = 0; i < this.cuePoints.length; i++) {
      this.cuePoints[i].toBuffer(buf, offset + CueChunk.MIN_SIZE + i * CuePoint.SIZE);
    }
    return CueChunk.MIN_SIZE + this.cuePoints.length * CuePoint.SIZE;
  }

  addCuePoint(): CuePoint {
    const cp = new CuePoint();
    this.cuePoints.push(cp);
    this.numCuePoints = this.cuePoints.length;
    return cp;
  }
}
