/**
 * Electribe 2 pattern model and pattern bank.
 *
 * ## Pattern File Formats
 * - Raw pattern: 16384 bytes (0x4000) — the actual pattern data
 * - Wrapped .e2pat: 16640 bytes (0x4100) — 256-byte KORG header + raw pattern
 * - Allpattern .e2sallpat: 0x10100 header + 250 × raw patterns = 4,161,792 bytes
 *
 * ## Raw Pattern Layout (16384 bytes)
 * | Offset  | Size  | Content                                  |
 * |---------|-------|------------------------------------------|
 * | 0x000   | 16    | Pattern header (magic, flags)            |
 * | 0x010   | 16    | Name (ASCII, null-padded)                |
 * | 0x022   | 2     | Tempo (uint16LE, value/10 = BPM)         |
 * | 0x024   | 1     | Swing (-127..127, stored as unsigned)     |
 * | 0x025   | 1     | Length (0-3 = 1-4 bars)                  |
 * | 0x026   | 1     | Beat type                                |
 * | 0x027   | 1     | Key (0-11 = C..B)                        |
 * | 0x028   | 1     | Scale (0-34, see FACTORY_SCALE_NAMES)    |
 * | 0x029   | 1     | Chord set                                |
 * | 0x02A   | 1     | Level (stored inverted: 127 - display)   |
 * | 0x02C   | 16    | Touch scale block                        |
 * | 0x03C   | 8     | Master FX block                          |
 * | 0x031   | 1     | Gate arp                                 |
 * | 0x03D   | 1     | Master FX type                           |
 * | 0x044   | 1     | Alternate 13/14                          |
 * | 0x045   | 1     | Alternate 15/16                          |
 * | 0x100   | 1584  | Motion sequence data                     |
 * | 0x800   | 13056 | 16 parts × 816 bytes each                |
 *
 * ## Part Layout (816 bytes = 0x330)
 * | Offset | Size | Field            | Notes                     |
 * |--------|------|------------------|---------------------------|
 * | 0x00   | 1    | lastStep         | 0-63                      |
 * | 0x02   | 1    | voiceAssign      |                           |
 * | 0x03   | 1    | partPriority     |                           |
 * | 0x04   | 1    | motionSeq        |                           |
 * | 0x05   | 1    | triggerPadVel    |                           |
 * | 0x06   | 1    | scaleMode        |                           |
 * | 0x08   | 2    | oscillator       | uint16LE (OSC number)     |
 * | 0x0B   | 1    | editOsc          |                           |
 * | 0x0C   | 1    | filterType       |                           |
 * | 0x0D   | 1    | cutoff           |                           |
 * | 0x0E   | 1    | resonance        |                           |
 * | 0x0F   | 1    | egInt            |                           |
 * | 0x10   | 1    | modulation       |                           |
 * | 0x11   | 1    | lfoSpeed         |                           |
 * | 0x12   | 1    | lfoDepth         |                           |
 * | 0x14   | 1    | attack           |                           |
 * | 0x15   | 1    | decay            |                           |
 * | 0x18   | 1    | level            |                           |
 * | 0x19   | 1    | pan              |                           |
 * | 0x1A   | 1    | ampEg            |                           |
 * | 0x1B   | 1    | mfx              |                           |
 * | 0x1C   | 1    | grooveType       |                           |
 * | 0x1D   | 1    | grooveDepth      |                           |
 * | 0x20   | 1    | ifx              |                           |
 * | 0x21   | 1    | fx               |                           |
 * | 0x22   | 1    | insertFxAmount   |                           |
 * | 0x24   | 1    | pitch            |                           |
 * | 0x25   | 1    | glide            |                           |
 * | 0x30   | 768  | 64 steps × 12B  | Step sequence data        |
 *
 * ## Step Layout (12 bytes)
 * | Offset | Size | Field    | Notes                              |
 * |--------|------|----------|------------------------------------|
 * | 0      | 1    | on       | 1 = active, 0 = off                |
 * | 1      | 1    | gate     | low 7 bits (0-96), bit 7 reserved  |
 * | 2      | 1    | velocity | 0-127                              |
 * | 3      | 1    | chord    | chord type index                   |
 * | 4-7    | 4    | notes    | MIDI note + 1 (0 = empty slot)     |
 * | 8-11   | 4    | reserved | always observed as zero             |
 */

export const RAW_PATTERN_SIZE = 0x4000;
export const WRAPPED_PATTERN_SIZE = 0x4100;
/** Wrapped .e2pat files have 256 bytes of KORG header before the raw pattern */
export const WRAPPED_PATTERN_DATA_OFFSET = 0x100;
export const PATTERN_BANK_HEADER_SIZE = 0x10100;
export const PATTERN_BANK_PATTERN_COUNT = 250;
export const PATTERN_BANK_SIZE = PATTERN_BANK_HEADER_SIZE + PATTERN_BANK_PATTERN_COUNT * RAW_PATTERN_SIZE;

export const PATTERN_NAME_OFFSET = 0x10;
export const PATTERN_NAME_SIZE = 16;
/** Tempo stored as uint16LE, divide by 10 to get BPM (e.g., 1200 = 120.0 BPM) */
export const PATTERN_TEMPO_OFFSET = 0x22;
/** Swing stored as unsigned byte; values >= 128 represent negative swing */
export const PATTERN_SWING_OFFSET = 0x24;
export const PATTERN_LENGTH_OFFSET = 0x25;
export const PATTERN_BEAT_OFFSET = 0x26;
export const PATTERN_KEY_OFFSET = 0x27;
export const PATTERN_SCALE_OFFSET = 0x28;
export const PATTERN_CHORD_SET_OFFSET = 0x29;
/** Level stored inverted: byte value = 127 - display level */
export const PATTERN_LEVEL_OFFSET = 0x2a;
export const PATTERN_TOUCH_SCALE_OFFSET = 0x2c;
export const PATTERN_TOUCH_SCALE_SIZE = 16;
export const PATTERN_MASTER_FX_OFFSET = 0x3c;
export const PATTERN_MASTER_FX_SIZE = 8;
export const PATTERN_GATE_ARP_OFFSET = 0x31;
export const PATTERN_MFX_TYPE_OFFSET = 0x3d;
export const PATTERN_ALTERNATE_13_14_OFFSET = 0x44;
export const PATTERN_ALTERNATE_15_16_OFFSET = 0x45;
export const PATTERN_MOTION_SEQUENCE_OFFSET = 0x100;
export const PATTERN_MOTION_SEQUENCE_SIZE = 1584;

/** 16 parts start at byte 0x800, each part is 0x330 (816) bytes */
export const PARTS_OFFSET = 0x800;
export const PART_COUNT = 16;
export const PART_SIZE = 0x330;
/** Step sequence data starts 0x30 bytes into each part */
export const SEQUENCE_OFFSET = 0x30;
export const STEP_COUNT = 64;
/** Each step record is 12 bytes: on, gate, velocity, chord, 4 notes, 4 reserved */
export const STEP_SIZE = 12;

export const FACTORY_SCALE_NAMES: string[] = [
  "Chromatic", "Ionian", "Dorian", "Phrygian", "Lydian", "Mixolidian",
  "Aeolian", "Locrian", "Harm minor", "Melo minor", "Major Blues",
  "minor Blues", "Diminished", "Com.Dim", "Major Penta", "minor Penta",
  "Raga 1", "Raga 2", "Raga 3", "Arabic", "Spanish", "Gypsy",
  "Egyptian", "Hawaiian", "Pelog", "Japanese", "Ryuku", "Chinese",
  "Bass Line", "Whole Tone", "minor 3rd", "Major 3rd", "4th Interval",
  "5th Interval", "Octave",
];

/** Build a 256-byte KORG file header for .e2pat files (e.g., "KORG" + device name + flags). */
export function buildPatternFileHeader(deviceName = "e2sampler"): Buffer {
  const encodedName = Buffer.alloc(16);
  Buffer.from(deviceName, "ascii").copy(encodedName, 0, 0, 16);
  const header = Buffer.alloc(0x100);
  Buffer.from("KORG", "ascii").copy(header, 0);
  encodedName.copy(header, 16);
  Buffer.from([0x01, 0x00, 0x00, 0x00]).copy(header, 32);
  header.fill(0xff, 36);
  return header;
}

export function scaleDisplayName(value: number): string | null {
  return FACTORY_SCALE_NAMES[value] ?? null;
}

/** A single step in a part's 64-step sequence. */
export interface PatternStep {
  index: number;
  /** Whether this step is active (triggers sound) */
  on: boolean;
  /** Gate time (0-96), controls note duration */
  gate: number;
  /** Velocity (0-127) */
  velocity: number;
  /** Chord type index */
  chord: number;
  /** Active MIDI note numbers (0-127). Up to 4 notes per step. Stored as note+1 in binary (0 = empty). */
  notes: number[];
  /** 4 reserved bytes, always observed as zero */
  reserved: number[];
}

/** Synth/sample parameters for one of the 16 parts in a pattern. All fields are 0-255 unless noted. */
export interface PatternPart {
  index: number;
  lastStep: number;
  voiceAssign: number;
  partPriority: number;
  motionSeq: number;
  triggerPadVelocity: number;
  scaleMode: number;
  oscillator: number;
  editOsc: number;
  filterType: number;
  cutoff: number;
  resonance: number;
  egInt: number;
  modulation: number;
  lfoSpeed: number;
  lfoDepth: number;
  attack: number;
  decay: number;
  level: number;
  pan: number;
  ampEg: number;
  mfx: number;
  grooveType: number;
  grooveDepth: number;
  ifx: number;
  fx: number;
  insertFxAmount: number;
  pitch: number;
  glide: number;
}

/**
 * Buffer-backed pattern model with getter/setter access to all fields.
 * Accepts both raw (16384 byte) and wrapped (16640 byte) pattern data.
 * All reads/writes go directly to the underlying Buffer — no intermediate state.
 */
export class Pattern {
  private data: Buffer;
  /** Offset where raw pattern data begins (0 for raw, 0x100 for wrapped) */
  private dataOffset: number;

  constructor(data: Buffer) {
    const size = data.length;
    if (size === RAW_PATTERN_SIZE) {
      this.dataOffset = 0;
    } else if (size === WRAPPED_PATTERN_SIZE) {
      this.dataOffset = WRAPPED_PATTERN_DATA_OFFSET;
    } else {
      throw new Error(`Invalid pattern size ${size}; expected ${RAW_PATTERN_SIZE} or ${WRAPPED_PATTERN_SIZE}`);
    }
    this.data = Buffer.from(data);
  }

  static fromBytes(data: Buffer): Pattern {
    return new Pattern(data);
  }

  toBytes(): Buffer {
    return Buffer.from(this.data);
  }

  get raw(): Buffer {
    return Buffer.from(this.data.subarray(this.dataOffset, this.dataOffset + RAW_PATTERN_SIZE));
  }

  get fileHeader(): Buffer {
    if (this.isWrapped) return Buffer.from(this.data.subarray(0, WRAPPED_PATTERN_DATA_OFFSET));
    return buildPatternFileHeader();
  }

  toWrappedBytes(headerOrDeviceName?: Buffer | string): Buffer {
    if (this.isWrapped) return this.toBytes();
    if (Buffer.isBuffer(headerOrDeviceName)) {
      return Buffer.concat([headerOrDeviceName, this.raw]);
    }
    const name: string = typeof headerOrDeviceName === "string" ? headerOrDeviceName : "e2sampler";
    return Buffer.concat([buildPatternFileHeader(name), this.raw]);
  }

  get isWrapped(): boolean {
    return this.dataOffset === WRAPPED_PATTERN_DATA_OFFSET;
  }

  get size(): number {
    return this.data.length;
  }

  private off(rawOffset: number): number {
    return this.dataOffset + rawOffset;
  }

  private getU8(rawOffset: number): number {
    return this.data[this.off(rawOffset)];
  }

  private setU8(rawOffset: number, value: number): void {
    if (value < 0 || value > 255) throw new Error(`Byte value out of range: ${value}`);
    this.data[this.off(rawOffset)] = value;
  }

  private getU16LE(rawOffset: number): number {
    const o = this.off(rawOffset);
    return this.data[o] | (this.data[o + 1] << 8);
  }

  private setU16LE(rawOffset: number, value: number): void {
    if (value < 0 || value > 65535) throw new Error(`16-bit value out of range: ${value}`);
    const o = this.off(rawOffset);
    this.data[o] = value & 0xFF;
    this.data[o + 1] = value >> 8;
  }

  get name(): string {
    const start = this.off(PATTERN_NAME_OFFSET);
    return this.data.subarray(start, start + PATTERN_NAME_SIZE).toString("ascii").split("\0")[0].trim();
  }

  set name(value: string) {
    const encoded = Buffer.from(value, "ascii").subarray(0, PATTERN_NAME_SIZE);
    const start = this.off(PATTERN_NAME_OFFSET);
    encoded.copy(this.data, start);
    if (encoded.length < PATTERN_NAME_SIZE) {
      this.data.fill(0, start + encoded.length, start + PATTERN_NAME_SIZE);
    }
  }

  get tempo(): number {
    return this.getU16LE(PATTERN_TEMPO_OFFSET) / 10;
  }

  set tempo(value: number) {
    if (value < 20 || value > 300) throw new Error("Tempo must be between 20.0 and 300.0 BPM");
    this.setU16LE(PATTERN_TEMPO_OFFSET, Math.round(value * 10));
  }

  get swing(): number {
    const v = this.getU8(PATTERN_SWING_OFFSET);
    return v < 128 ? v : v - 256;
  }

  set swing(value: number) {
    if (value < -127 || value > 127) throw new Error("Swing must be between -127 and 127");
    this.setU8(PATTERN_SWING_OFFSET, value >= 0 ? value : value + 256);
  }

  get length(): number {
    return this.getU8(PATTERN_LENGTH_OFFSET);
  }

  set length(value: number) {
    if (value < 0 || value > 4) throw new Error("Length must be between 0 and 4");
    this.setU8(PATTERN_LENGTH_OFFSET, value);
  }

  summary(): Record<string, unknown> {
    const scale = this.getU8(PATTERN_SCALE_OFFSET);
    return {
      name: this.name,
      tempo: this.tempo,
      swing: this.swing,
      length: this.length,
      beat: this.getU8(PATTERN_BEAT_OFFSET),
      key: this.getU8(PATTERN_KEY_OFFSET),
      scale,
      scaleName: scaleDisplayName(scale),
      chordSet: this.getU8(PATTERN_CHORD_SET_OFFSET),
      level: 127 - this.getU8(PATTERN_LEVEL_OFFSET),
      gateArp: this.getU8(PATTERN_GATE_ARP_OFFSET),
      mfxType: this.getU8(PATTERN_MFX_TYPE_OFFSET),
      alternate1314: this.getU8(PATTERN_ALTERNATE_13_14_OFFSET),
      alternate1516: this.getU8(PATTERN_ALTERNATE_15_16_OFFSET),
      size: this.size,
      wrapped: this.isWrapped,
    };
  }

  globalBlocks(): Record<string, unknown> {
    return {
      touchScale: this.getTouchScale(),
      masterFx: this.getMasterFx(),
      motionSequenceSize: PATTERN_MOTION_SEQUENCE_SIZE,
    };
  }

  setGlobal(field: string, value: number | string): void {
    const setters: Record<string, () => void> = {
      name: () => { this.name = String(value); },
      tempo: () => { this.tempo = Number(value); },
      swing: () => { this.swing = Number(value); },
      length: () => { this.length = Number(value); },
      beat: () => this.setU8(PATTERN_BEAT_OFFSET, Number(value)),
      key: () => this.setU8(PATTERN_KEY_OFFSET, Number(value)),
      scale: () => this.setU8(PATTERN_SCALE_OFFSET, Number(value)),
      chordSet: () => this.setU8(PATTERN_CHORD_SET_OFFSET, Number(value)),
      level: () => this.setU8(PATTERN_LEVEL_OFFSET, 127 - Number(value)),
      gateArp: () => this.setU8(PATTERN_GATE_ARP_OFFSET, Number(value)),
      mfxType: () => this.setU8(PATTERN_MFX_TYPE_OFFSET, Number(value)),
      alternate1314: () => this.setU8(PATTERN_ALTERNATE_13_14_OFFSET, Number(value)),
      alternate1516: () => this.setU8(PATTERN_ALTERNATE_15_16_OFFSET, Number(value)),
    };
    const setter = setters[field];
    if (!setter) throw new Error(`Unknown pattern field: ${field}`);
    setter();
  }

  private getBytes(rawOffset: number, size: number): Buffer {
    return Buffer.from(this.data.subarray(this.off(rawOffset), this.off(rawOffset) + size));
  }

  private setBytes(rawOffset: number, size: number, src: Buffer): void {
    if (src.length !== size) throw new Error(`Expected ${size} bytes, got ${src.length}`);
    src.copy(this.data, this.off(rawOffset));
  }

  getTouchScale(): number[] {
    return [...this.getBytes(PATTERN_TOUCH_SCALE_OFFSET, PATTERN_TOUCH_SCALE_SIZE)];
  }

  setTouchScaleValue(index: number, value: number): void {
    if (index < 0 || index >= PATTERN_TOUCH_SCALE_SIZE) throw new Error("Touch scale index must be between 0 and 15");
    this.setU8(PATTERN_TOUCH_SCALE_OFFSET + index, value);
  }

  getMasterFx(): number[] {
    return [...this.getBytes(PATTERN_MASTER_FX_OFFSET, PATTERN_MASTER_FX_SIZE)];
  }

  setMasterFxValue(index: number, value: number): void {
    if (index < 0 || index >= PATTERN_MASTER_FX_SIZE) throw new Error("Master FX index must be between 0 and 7");
    this.setU8(PATTERN_MASTER_FX_OFFSET + index, value);
  }

  getMotionSequence(): Buffer {
    return this.getBytes(PATTERN_MOTION_SEQUENCE_OFFSET, PATTERN_MOTION_SEQUENCE_SIZE);
  }

  setMotionSequence(data: Buffer): void {
    this.setBytes(PATTERN_MOTION_SEQUENCE_OFFSET, PATTERN_MOTION_SEQUENCE_SIZE, data);
  }

  private partOffset(partIndex: number): number {
    if (partIndex < 0 || partIndex >= PART_COUNT) throw new Error("Part index must be between 0 and 15");
    return PARTS_OFFSET + partIndex * PART_SIZE;
  }

  private stepOffset(partIndex: number, stepIndex: number): number {
    if (stepIndex < 0 || stepIndex >= STEP_COUNT) throw new Error("Step index must be between 0 and 63");
    return this.partOffset(partIndex) + SEQUENCE_OFFSET + stepIndex * STEP_SIZE;
  }

  getPart(partIndex: number): PatternPart {
    const o = this.partOffset(partIndex);
    return {
      index: partIndex,
      lastStep: this.getU8(o + 0x00),
      voiceAssign: this.getU8(o + 0x02),
      partPriority: this.getU8(o + 0x03),
      motionSeq: this.getU8(o + 0x04),
      triggerPadVelocity: this.getU8(o + 0x05),
      scaleMode: this.getU8(o + 0x06),
      oscillator: this.getU16LE(o + 0x08),
      editOsc: this.getU8(o + 0x0b),
      filterType: this.getU8(o + 0x0c),
      cutoff: this.getU8(o + 0x0d),
      resonance: this.getU8(o + 0x0e),
      egInt: this.getU8(o + 0x0f),
      modulation: this.getU8(o + 0x10),
      lfoSpeed: this.getU8(o + 0x11),
      lfoDepth: this.getU8(o + 0x12),
      attack: this.getU8(o + 0x14),
      decay: this.getU8(o + 0x15),
      level: this.getU8(o + 0x18),
      pan: this.getU8(o + 0x19),
      ampEg: this.getU8(o + 0x1a),
      mfx: this.getU8(o + 0x1b),
      grooveType: this.getU8(o + 0x1c),
      grooveDepth: this.getU8(o + 0x1d),
      ifx: this.getU8(o + 0x20),
      fx: this.getU8(o + 0x21),
      insertFxAmount: this.getU8(o + 0x22),
      pitch: this.getU8(o + 0x24),
      glide: this.getU8(o + 0x25),
    };
  }

  setPartField(partIndex: number, field: string, value: number): void {
    const offset = this.partOffset(partIndex);
    const fields: Record<string, [number, number]> = {
      lastStep: [0x00, 1], voiceAssign: [0x02, 1], partPriority: [0x03, 1],
      motionSeq: [0x04, 1], triggerPadVelocity: [0x05, 1], scaleMode: [0x06, 1],
      oscillator: [0x08, 2], editOsc: [0x0b, 1], filterType: [0x0c, 1],
      cutoff: [0x0d, 1], resonance: [0x0e, 1], egInt: [0x0f, 1],
      modulation: [0x10, 1], lfoSpeed: [0x11, 1], lfoDepth: [0x12, 1],
      attack: [0x14, 1], decay: [0x15, 1], level: [0x18, 1], pan: [0x19, 1],
      ampEg: [0x1a, 1], mfx: [0x1b, 1], grooveType: [0x1c, 1],
      grooveDepth: [0x1d, 1], ifx: [0x20, 1], fx: [0x21, 1],
      insertFxAmount: [0x22, 1], pitch: [0x24, 1], glide: [0x25, 1],
    };
    const entry = fields[field];
    if (!entry) throw new Error(`Unknown part field: ${field}`);
    const [relOffset, size] = entry;
    if (size === 2) this.setU16LE(offset + relOffset, value);
    else this.setU8(offset + relOffset, value);
  }

  getStep(partIndex: number, stepIndex: number): PatternStep {
    const o = this.stepOffset(partIndex, stepIndex);
    const notes = [this.getU8(o + 4), this.getU8(o + 5), this.getU8(o + 6), this.getU8(o + 7)];
    const reserved = [this.getU8(o + 8), this.getU8(o + 9), this.getU8(o + 10), this.getU8(o + 11)];
    return {
      index: stepIndex,
      on: this.getU8(o) === 1,
      gate: this.getU8(o + 1) & 0x7f,
      velocity: this.getU8(o + 2),
      chord: this.getU8(o + 3),
      notes: notes.filter(n => n > 0).map(n => n - 1),
      reserved,
    };
  }

  setStep(partIndex: number, stepIndex: number, opts: Partial<{ on: boolean; gate: number; velocity: number; chord: number; notes: number[] }>): void {
    const o = this.stepOffset(partIndex, stepIndex);
    if (opts.on !== undefined) this.setU8(o, opts.on ? 1 : 0);
    if (opts.gate !== undefined) this.setU8(o + 1, (opts.gate >= 0 && opts.gate <= 96) ? opts.gate : 255);
    if (opts.velocity !== undefined) this.setU8(o + 2, opts.velocity);
    if (opts.chord !== undefined) this.setU8(o + 3, opts.chord);
    if (opts.notes !== undefined) {
      if (opts.notes.length > 4) throw new Error("A step can contain at most 4 notes");
      const encoded = [...opts.notes].map(n => n + 1).sort((a, b) => a - b);
      if (encoded.some(n => n < 1 || n > 128)) throw new Error("Notes must be MIDI note numbers between 0 and 127");
      while (encoded.length < 4) encoded.push(0);
      for (let i = 0; i < 4; i++) this.setU8(o + 4 + i, encoded[i]);
      this.setU8(o, opts.notes.length > 0 ? 1 : 0);
    }
  }

  clearStep(partIndex: number, stepIndex: number): void {
    this.setStep(partIndex, stepIndex, { on: false, notes: [] });
  }

  toggleNote(partIndex: number, stepIndex: number, note: number): number[] {
    const current = [...this.getStep(partIndex, stepIndex).notes];
    const idx = current.indexOf(note);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(note);
    this.setStep(partIndex, stepIndex, { notes: current });
    return this.getStep(partIndex, stepIndex).notes;
  }

  copyBar(partIndex: number, sourceBar: number, targetBar: number): void {
    if (sourceBar < 0 || sourceBar >= 4 || targetBar < 0 || targetBar >= 4) {
      throw new Error("Bar index must be between 0 and 3");
    }
    for (let i = 0; i < 16; i++) {
      const src = this.off(this.stepOffset(partIndex, sourceBar * 16 + i));
      const dst = this.off(this.stepOffset(partIndex, targetBar * 16 + i));
      this.data.copy(this.data, dst, src, src + STEP_SIZE);
    }
  }

  clearBar(partIndex: number, bar: number): void {
    if (bar < 0 || bar >= 4) throw new Error("Bar index must be between 0 and 3");
    for (let i = 0; i < 16; i++) this.clearStep(partIndex, bar * 16 + i);
  }

  /** Rotate step records within a range. Positive = shift right, negative = shift left. */
  rotateSteps(partIndex: number, steps: number, startStep = 0, stepCount = STEP_COUNT): void {
    if (startStep < 0 || startStep >= STEP_COUNT) throw new Error("Start step must be between 0 and 63");
    if (stepCount < 1 || startStep + stepCount > STEP_COUNT) throw new Error("Step count must stay within the 64-step sequence");
    const amount = ((steps % stepCount) + stepCount) % stepCount;
    if (amount === 0) return;
    const start = this.off(this.stepOffset(partIndex, startStep));
    const size = stepCount * STEP_SIZE;
    const chunk = Buffer.from(this.data.subarray(start, start + size));
    const split = amount * STEP_SIZE;
    const rotated = Buffer.concat([chunk.subarray(chunk.length - split), chunk.subarray(0, chunk.length - split)]);
    rotated.copy(this.data, start);
  }
}

export class PatternBank {
  private data: Buffer;

  constructor(data: Buffer) {
    if (data.length < PATTERN_BANK_SIZE) {
      throw new Error(`Invalid allpattern size ${data.length}; expected at least ${PATTERN_BANK_SIZE}`);
    }
    this.data = Buffer.from(data);
  }

  static fromBytes(data: Buffer): PatternBank {
    return new PatternBank(data);
  }

  toBytes(): Buffer {
    return Buffer.from(this.data);
  }

  get header(): Buffer {
    return Buffer.from(this.data.subarray(0, PATTERN_BANK_HEADER_SIZE));
  }

  get patternFileHeader(): Buffer {
    return Buffer.from(this.data.subarray(0, WRAPPED_PATTERN_DATA_OFFSET));
  }

  private patternOffset(patternIndex: number): number {
    if (patternIndex < 0 || patternIndex >= PATTERN_BANK_PATTERN_COUNT) {
      throw new Error("Pattern index must be between 0 and 249");
    }
    return PATTERN_BANK_HEADER_SIZE + patternIndex * RAW_PATTERN_SIZE;
  }

  getPattern(patternIndex: number): Pattern {
    const offset = this.patternOffset(patternIndex);
    return Pattern.fromBytes(Buffer.from(this.data.subarray(offset, offset + RAW_PATTERN_SIZE)));
  }

  setPattern(patternIndex: number, pattern: Pattern): void {
    const offset = this.patternOffset(patternIndex);
    pattern.raw.copy(this.data, offset);
  }

  listPatterns(): Array<{ index: number; number: number; name: string }> {
    return Array.from({ length: PATTERN_BANK_PATTERN_COUNT }, (_, i) => ({
      index: i,
      number: i + 1,
      name: this.getPattern(i).name,
    }));
  }

  summary(): Record<string, unknown> {
    return {
      size: this.data.length,
      headerSize: PATTERN_BANK_HEADER_SIZE,
      patternCount: PATTERN_BANK_PATTERN_COUNT,
      patternSize: RAW_PATTERN_SIZE,
    };
  }
}
