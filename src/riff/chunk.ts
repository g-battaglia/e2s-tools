/**
 * RIFF chunk parsing for WAV/WAVE files.
 *
 * RIFF files consist of nested chunks, each with an 8-byte header (4-byte ID + 4-byte size)
 * followed by data. Chunks are word-aligned: if data length is odd, a pad byte follows.
 *
 * Electribe 2 samples are RIFF/WAVE files with standard chunks (fmt, data) plus
 * Korg-proprietary chunks (korg → esli sub-chunk, smpl, cue).
 */

/** 8-byte chunk header: 4-byte ASCII ID + 4-byte little-endian data size. */
export class ChunkHeader {
  static readonly SIZE = 8;
  id: Buffer = Buffer.alloc(4);
  size = 0;

  read(buf: Buffer, offset: number): number {
    this.id = buf.subarray(offset, offset + 4);
    this.size = buf.readUInt32LE(offset + 4);
    return ChunkHeader.SIZE;
  }

  write(buf: Buffer, offset: number): number {
    this.id.copy(buf, offset);
    buf.writeUInt32LE(this.size, offset + 4);
    return ChunkHeader.SIZE;
  }

  static from(id: Buffer | string, size = 0): ChunkHeader {
    const h = new ChunkHeader();
    if (typeof id === "string") {
      h.id = Buffer.from(id, "ascii");
    } else {
      h.id = id;
    }
    h.size = size;
    return h;
  }
}

/** Raw chunk data payload. Subclasses (WaveFmt, SmplChunk, etc.) override read/write for typed access. */
export class ChunkData {
  rawdata: Buffer = Buffer.alloc(0);

  get length(): number {
    return this.rawdata.length;
  }

  readFromBuffer(buf: Buffer, offset: number, size: number): number {
    this.rawdata = Buffer.from(buf.subarray(offset, offset + size));
    return size;
  }

  writeToBuffer(buf: Buffer, offset: number): number {
    this.rawdata.copy(buf, offset);
    return this.rawdata.length;
  }
}

export type ChunkDataClass = new (...args: unknown[]) => ChunkData;

/** A complete RIFF chunk: header + data + optional word-alignment pad byte. */
export class Chunk {
  header: ChunkHeader = new ChunkHeader();
  data: ChunkData = new ChunkData();
  registeredChunks: Map<string, ChunkDataClass> = new Map();

  get length(): number {
    const dataLen = this.data.length;
    return ChunkHeader.SIZE + dataLen + (dataLen & 1);
  }

  readFromBuffer(buf: Buffer, offset: number, maxBytes?: number): number {
    if (maxBytes !== undefined && maxBytes < ChunkHeader.SIZE) {
      throw new Error("Not enough data to read chunk header");
    }

    let pos = offset;
    pos += this.header.read(buf, pos);

    if (maxBytes !== undefined && maxBytes < ChunkHeader.SIZE + this.header.size) {
      throw new Error("Not enough data to read chunk body");
    }

    const dataClass = this.registeredChunks.get(this.header.id.toString("ascii")) ?? ChunkData;
    this.data = new dataClass();
    pos += this.data.readFromBuffer(buf, pos, this.header.size);

    // Word-align: skip pad byte if data size is odd
    if (this.data.length & 1) {
      pos += 1;
    }

    return pos - offset;
  }

  writeToBuffer(buf: Buffer, offset: number): number {
    this.header.size = this.data.length;
    let pos = offset;
    pos += this.header.write(buf, pos);
    pos += this.data.writeToBuffer(buf, pos);
    if (this.data.length & 1) {
      buf.writeUInt8(0, pos);
      pos += 1;
    }
    return pos - offset;
  }

  static from(header: ChunkHeader, data: ChunkData): Chunk {
    const c = new Chunk();
    c.header = header;
    c.data = data;
    return c;
  }
}

/**
 * Ordered list of chunks parsed from a RIFF container.
 * Uses `registeredChunks` map for polymorphic dispatch: chunk ID → specific ChunkData subclass.
 * Unrecognized chunk IDs fall back to raw ChunkData.
 */
export class ChunkList {
  chunks: Chunk[] = [];
  registeredChunks: Map<string, ChunkDataClass>;

  constructor(registeredChunks?: Map<string, ChunkDataClass>) {
    this.registeredChunks = registeredChunks ?? new Map();
  }

  get length(): number {
    return this.chunks.reduce((sum, c) => sum + c.length, 0);
  }

  getChunk(chunkId: string): Chunk | undefined {
    return this.chunks.find(c => c.header.id.toString("ascii") === chunkId);
  }

  readFromBuffer(buf: Buffer, offset: number, maxBytes: number): number {
    let pos = offset;
    let remaining = maxBytes;

    while (remaining > 0) {
      try {
        const chunk = new Chunk();
        chunk.registeredChunks = this.registeredChunks;
        const bytesRead = chunk.readFromBuffer(buf, pos, remaining);
        this.chunks.push(chunk);
        pos += bytesRead;
        remaining -= bytesRead;
      } catch {
        break;
      }
    }
    return pos - offset;
  }

  writeToBuffer(buf: Buffer, offset: number): number {
    let pos = offset;
    for (const chunk of this.chunks) {
      pos += chunk.writeToBuffer(buf, pos);
    }
    return pos - offset;
  }

  valid(): boolean {
    return true;
  }
}
