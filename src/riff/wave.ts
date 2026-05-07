/**
 * WAV/WAVE format chunk types for RIFF parsing.
 *
 * Standard WAV structure: RIFF/WAVE container → fmt chunk (audio format) + data chunk (PCM samples).
 * Electribe samples extend this with korg, smpl, and cue chunks.
 */
import { ChunkData, ChunkDataClass, ChunkHeader, ChunkList } from "./chunk.js";

export const WAVE_FORMAT_UNKNOWN = 0x0000;
export const WAVE_FORMAT_PCM = 0x0001;
export const WAVE_FORMAT_IEEE_FLOAT = 0x0003;
export const WAVE_FORMAT_EXTENSIBLE = 0xfffe;

/** WAV "fmt " chunk: audio format parameters (PCM, channels, sample rate, etc.) */
export class WaveFmt extends ChunkData {
  formatTag = WAVE_FORMAT_PCM;
  channels = 1;
  samplesPerSec = 44100;
  avgBytesPerSec = 88200;
  blockAlign = 2;
  bitsPerSample: number | null = 16;
  otherFieldsRaw: Buffer | null = null;

  static readonly COMMON_SIZE = 16;
  static readonly PCM_EXTRA_SIZE = 2;

  get length(): number {
    let size = WaveFmt.COMMON_SIZE;
    if (this.formatTag === WAVE_FORMAT_PCM && this.bitsPerSample !== null) {
      size += WaveFmt.PCM_EXTRA_SIZE;
    }
    if (this.otherFieldsRaw) {
      size += this.otherFieldsRaw.length;
    }
    return size;
  }

  readFromBuffer(buf: Buffer, offset: number, size: number): number {
    if (size < WaveFmt.COMMON_SIZE) {
      throw new Error("'fmt' chunk size too small");
    }

    this.formatTag = buf.readUInt16LE(offset);
    this.channels = buf.readUInt16LE(offset + 2);
    this.samplesPerSec = buf.readUInt32LE(offset + 4);
    this.avgBytesPerSec = buf.readUInt32LE(offset + 8);
    this.blockAlign = buf.readUInt16LE(offset + 12);

    let sizeRead = WaveFmt.COMMON_SIZE;

    if (this.formatTag === WAVE_FORMAT_PCM) {
      if (size >= sizeRead + WaveFmt.PCM_EXTRA_SIZE) {
        this.bitsPerSample = buf.readUInt16LE(offset + sizeRead);
        sizeRead += WaveFmt.PCM_EXTRA_SIZE;
      } else {
        this.bitsPerSample = this.blockAlign * 8 / this.channels;
      }
    }

    const remaining = size - sizeRead;
    this.otherFieldsRaw = remaining > 0 ? Buffer.from(buf.subarray(offset + sizeRead, offset + sizeRead + remaining)) : null;

    return size;
  }

  writeToBuffer(buf: Buffer, offset: number): number {
    buf.writeUInt16LE(this.formatTag, offset);
    buf.writeUInt16LE(this.channels, offset + 2);
    buf.writeUInt32LE(this.samplesPerSec, offset + 4);
    buf.writeUInt32LE(this.avgBytesPerSec, offset + 8);
    buf.writeUInt16LE(this.blockAlign, offset + 12);

    let pos = offset + WaveFmt.COMMON_SIZE;
    if (this.formatTag === WAVE_FORMAT_PCM && this.bitsPerSample !== null) {
      buf.writeUInt16LE(this.bitsPerSample, pos);
      pos += WaveFmt.PCM_EXTRA_SIZE;
    }
    if (this.otherFieldsRaw) {
      this.otherFieldsRaw.copy(buf, pos);
      pos += this.otherFieldsRaw.length;
    }
    return pos - offset;
  }
}

export class WaveData extends ChunkData {}

export class WaveChunkList extends ChunkList {
  static BASE_REGISTERED: Map<string, ChunkDataClass> = new Map([
    ["fmt ", WaveFmt as unknown as ChunkDataClass],
    ["data", WaveData as unknown as ChunkDataClass],
  ]);

  constructor(extraChunks?: Map<string, ChunkDataClass>) {
    super();
    this.registeredChunks = new Map(WaveChunkList.BASE_REGISTERED);
    if (extraChunks) {
      for (const [k, v] of extraChunks) {
        this.registeredChunks.set(k, v);
      }
    }
  }

  valid(): boolean {
    let hasFmt = false;
    let fmtBeforeData = false;
    for (const chunk of this.chunks) {
      if (chunk.header.id.toString("ascii") === "fmt ") {
        hasFmt = true;
      } else if (chunk.header.id.toString("ascii") === "data" && hasFmt) {
        fmtBeforeData = true;
      }
    }
    return hasFmt && fmtBeforeData;
  }
}

export class Form extends ChunkData {
  static readonly WAVE_FORM_TYPE = "WAVE";
  static readonly TYPE_SIZE = 4;

  formType: string = Form.WAVE_FORM_TYPE;
  chunkList: WaveChunkList;
  private extraChunks: Map<string, ChunkDataClass>;

  constructor(extraChunks?: Map<string, ChunkDataClass>) {
    super();
    this.extraChunks = extraChunks ?? new Map();
    this.chunkList = new WaveChunkList(extraChunks);
  }

  get length(): number {
    return Form.TYPE_SIZE + this.chunkList.length;
  }

  readFromBuffer(buf: Buffer, offset: number, size: number): number {
    if (size < Form.TYPE_SIZE) {
      throw new Error("'RIFF' chunk size too small");
    }

    this.formType = buf.subarray(offset, offset + 4).toString("ascii");
    const remaining = size - Form.TYPE_SIZE;

    this.chunkList = new WaveChunkList(this.extraChunks);
    this.chunkList.readFromBuffer(buf, offset + Form.TYPE_SIZE, remaining);

    return size;
  }

  writeToBuffer(buf: Buffer, offset: number): number {
    buf.write(this.formType, offset, 4, "ascii");
    return Form.TYPE_SIZE + this.chunkList.writeToBuffer(buf, offset + Form.TYPE_SIZE);
  }
}
