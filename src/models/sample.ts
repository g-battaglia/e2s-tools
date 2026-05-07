/**
 * Electribe 2 sample model.
 *
 * Each sample in a library is a RIFF/WAVE file with standard chunks (fmt, data)
 * plus Korg-proprietary chunks:
 * - "korg" container chunk, which holds an "esli" sub-chunk (1172 bytes of metadata)
 * - optional "smpl" and "cue " chunks for loop points and slice markers
 *
 * The Sample class wraps the full RIFF structure and provides typed access to
 * the ESLI metadata, audio data, and format information.
 */
import { Chunk, ChunkData, ChunkDataClass, ChunkHeader, ChunkList, CueChunk, Form, SmplChunk, WaveChunkList, WaveFmt } from "../riff/index.js";
import { EsliMetadata } from "./esli.js";

class KorgChunkData extends ChunkData {
  chunkList: ChunkList = new ChunkList();
  private static registeredChunks: Map<string, ChunkDataClass> = new Map();

  static setRegisteredChunks(map: Map<string, ChunkDataClass>): void {
    KorgChunkData.registeredChunks = map;
  }

  get length(): number {
    return this.chunkList.length;
  }

  readFromBuffer(buf: Buffer, offset: number, size: number): number {
    this.chunkList = new ChunkList(KorgChunkData.registeredChunks);
    return this.chunkList.readFromBuffer(buf, offset, size);
  }

  writeToBuffer(buf: Buffer, offset: number): number {
    return this.chunkList.writeToBuffer(buf, offset);
  }
}

class EsliChunkData extends ChunkData {
  private _esli: EsliMetadata | null;

  constructor(esli?: EsliMetadata) {
    super();
    this._esli = esli ?? null;
  }

  get length(): number {
    return EsliMetadata.BYTE_SIZE;
  }

  get esli(): EsliMetadata {
    if (!this._esli) this._esli = new EsliMetadata();
    return this._esli;
  }

  readFromBuffer(buf: Buffer, offset: number, size: number): number {
    this._esli = EsliMetadata.fromBuffer(buf.subarray(offset, offset + EsliMetadata.BYTE_SIZE));
    return size;
  }

  writeToBuffer(buf: Buffer, offset: number): number {
    const data = this._esli ? this._esli.toBuffer() : Buffer.alloc(EsliMetadata.BYTE_SIZE);
    data.copy(buf, offset);
    return EsliMetadata.BYTE_SIZE;
  }
}

// Register esli as sub-chunk of korg
KorgChunkData.setRegisteredChunks(new Map([["esli", EsliChunkData as unknown as ChunkDataClass]]));

class ElectribeChunkList extends WaveChunkList {
  static readonly EXTRA_CHUNKS: Map<string, ChunkDataClass> = new Map([
    ["korg", KorgChunkData as unknown as ChunkDataClass],
    ["smpl", SmplChunk as unknown as ChunkDataClass],
    ["cue ", CueChunk as unknown as ChunkDataClass],
  ]);

  constructor() {
    super(ElectribeChunkList.EXTRA_CHUNKS);
  }
}

/**
 * A Korg Electribe 2 sample: RIFF/WAVE with Korg-specific metadata.
 * Construct from a Buffer containing the full RIFF data, or create empty and populate.
 */
export class Sample {
  header: ChunkHeader = ChunkHeader.from("RIFF");
  form: Form;
  private _esliCache: EsliMetadata | null = null;

  constructor(data?: Buffer) {
    this.form = new Form(ElectribeChunkList.EXTRA_CHUNKS);
    if (data) {
      this.readFromBuffer(data);
    }
  }

  readFromBuffer(data: Buffer): void {
    this.header.read(data, 0);
    if (this.header.id.toString("ascii") !== "RIFF") {
      throw new Error(`Expected RIFF chunk, got ${this.header.id.toString("ascii")}`);
    }
    this.form.readFromBuffer(data, ChunkHeader.SIZE, this.header.size);
  }

  toBuffer(): Buffer {
    const size = ChunkHeader.SIZE + this.form.length;
    const buf = Buffer.alloc(size);
    this.header.size = this.form.length;
    this.header.write(buf, 0);
    this.form.writeToBuffer(buf, ChunkHeader.SIZE);
    return buf;
  }

  get esli(): EsliMetadata {
    if (!this._esliCache) {
      const korgChunk = this.form.chunkList.getChunk("korg");
      if (!korgChunk) {
        this._esliCache = new EsliMetadata();
      } else {
        const esliChunk = (korgChunk.data as KorgChunkData).chunkList.getChunk("esli");
        if (!esliChunk) {
          this._esliCache = new EsliMetadata();
        } else {
          this._esliCache = (esliChunk.data as EsliChunkData).esli;
        }
      }
    }
    return this._esliCache;
  }

  set esli(value: EsliMetadata) {
    this._esliCache = value;
  }

  /**
   * Ensure korg/esli chunks exist in the RIFF structure.
   * If missing, creates them from the cached EsliMetadata (or a fresh default).
   * Must be called before serialization if esli was set via the cache (e.g., after import).
   */
  ensureKorgEsli(): EsliMetadata {
    let korgChunk = this.form.chunkList.getChunk("korg");
    if (!korgChunk) {
      const esliData = new EsliChunkData(this._esliCache ?? new EsliMetadata());
      const esliChunk = Chunk.from(ChunkHeader.from("esli", EsliMetadata.BYTE_SIZE), esliData);
      const korgData = new KorgChunkData();
      korgData.chunkList.chunks.push(esliChunk);
      korgChunk = Chunk.from(ChunkHeader.from("korg"), korgData);
      this.form.chunkList.chunks.push(korgChunk);
    } else {
      const esliChunk = (korgChunk.data as KorgChunkData).chunkList.getChunk("esli");
      if (!esliChunk) {
        const esliData = new EsliChunkData(this._esliCache ?? new EsliMetadata());
        const newEsliChunk = Chunk.from(ChunkHeader.from("esli", EsliMetadata.BYTE_SIZE), esliData);
        (korgChunk.data as KorgChunkData).chunkList.chunks.push(newEsliChunk);
      } else if (this._esliCache) {
        (esliChunk.data as EsliChunkData).esli.oscIndex = this._esliCache.oscIndex;
      }
    }
    this._esliCache = null;
    return this.esli;
  }

  get fmt(): WaveFmt {
    const chunk = this.form.chunkList.getChunk("fmt ");
    if (!chunk) throw new Error("Sample has no fmt chunk");
    return chunk.data as WaveFmt;
  }

  get audioData(): Buffer {
    const chunk = this.form.chunkList.getChunk("data");
    if (!chunk) throw new Error("Sample has no data chunk");
    return chunk.data.rawdata;
  }

  set audioData(value: Buffer) {
    const chunk = this.form.chunkList.getChunk("data");
    if (!chunk) throw new Error("Sample has no data chunk");
    chunk.data.rawdata = Buffer.from(value);
  }

  getChunk(chunkId: string): Chunk | undefined {
    return this.form.chunkList.getChunk(chunkId);
  }

  /**
   * Create a clean copy with only fmt, data, and korg chunks (strips smpl/cue/extras).
   * Used by the writer to normalize RIFF structure before serialization.
   */
  cleanCopy(): Sample {
    const newForm = new Form(ElectribeChunkList.EXTRA_CHUNKS);
    const fmtChunk = this.form.chunkList.getChunk("fmt ");
    const dataChunk = this.form.chunkList.getChunk("data");
    const korgChunk = this.form.chunkList.getChunk("korg");

    if (fmtChunk) {
      const cleanFmt = new Chunk();
      cleanFmt.header = ChunkHeader.from(fmtChunk.header.id);
      const fmtData = new WaveFmt();
      fmtData.formatTag = (fmtChunk.data as WaveFmt).formatTag;
      fmtData.channels = (fmtChunk.data as WaveFmt).channels;
      fmtData.samplesPerSec = (fmtChunk.data as WaveFmt).samplesPerSec;
      fmtData.avgBytesPerSec = (fmtChunk.data as WaveFmt).avgBytesPerSec;
      fmtData.blockAlign = (fmtChunk.data as WaveFmt).blockAlign;
      fmtData.bitsPerSample = (fmtChunk.data as WaveFmt).bitsPerSample;
      cleanFmt.data = fmtData;
      newForm.chunkList.chunks.push(cleanFmt);
    }
    if (dataChunk) {
      newForm.chunkList.chunks.push(dataChunk);
    }
    if (korgChunk) {
      newForm.chunkList.chunks.push(korgChunk);
    }

    const sample = new Sample();
    sample.header = ChunkHeader.from("RIFF");
    sample.form = newForm;
    return sample;
  }
}
