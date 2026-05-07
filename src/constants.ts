/**
 * Constants for Korg Electribe 2 Sampler binary formats.
 *
 * The Electribe 2 uses several proprietary binary formats:
 * - `.all` files (e2sSample.all): sample library with up to 1020 RIFF/WAVE samples
 * - `.e2pat` files: single pattern (16640 bytes = 256-byte KORG header + 16384 raw)
 * - `.e2sallpat` files: pattern bank (250 patterns)
 * - `.syx` files: SysEx dumps for MIDI transfer
 */

// --- Library (.all file) ---
// Layout: 16-byte header | 1020 x 4-byte RIFF pointers | sample data starting at 0x1000
export const LIBRARY_HEADER = Buffer.from("e2s sample all\x1A\x00", "binary");
export const LIBRARY_HEADER_SIZE = 16;
export const LIBRARY_POINTER_COUNT = 1020;
export const LIBRARY_POINTER_SIZE = 4;
/** Sample data begins at byte 4096 (after header + pointer table) */
export const LIBRARY_DATA_OFFSET = 0x1000;

// --- ESLI chunk ---
// Korg-specific RIFF sub-chunk inside each sample: metadata for the Electribe firmware
export const ESLI_CHUNK_ID = "esli";
/** ESLI chunk is always exactly 1172 bytes (0x494) */
export const ESLI_CHUNK_SIZE = 1172;

// --- Sample limits ---
export const MAX_SAMPLES = 1020;
export const MAX_SLICES = 64;
export const MAX_SLICE_STEPS = 64;
export const MAX_SAMPLE_NAME_LENGTH = 16;
/** Maximum total audio data size in a library (~25 MiB), enforced by firmware */
export const WAV_DATA_MAX_SIZE = 26_214_396;

// --- OSC numbering ---
// OSC numbers are 1-based for display (OSC 1..1020), 0-based internally (index 0..1019).
// Factory samples occupy indices 0-17 (OSC 1-18). User samples start at index 18 (OSC 19).
// There is a gap at indices 422-499 (OSC 423-500) reserved by the firmware.
export const OSC_USER_RANGE_1_START = 19;
export const OSC_USER_RANGE_1_END = 421;
/** First index in the reserved firmware gap (0-based). OSC 423-500 are not usable. */
export const OSC_GAP_START = 422;
/** Last index in the reserved firmware gap (0-based, inclusive) */
export const OSC_GAP_END = 499;
export const OSC_USER_RANGE_2_START = 500;
export const OSC_USER_RANGE_2_END = 999;

// --- Tune ---
export const TUNE_MIN = -63;
export const TUNE_MAX = 63;

// --- Volume ---
export const VOLUME_MIN = 0;
export const VOLUME_MAX = 65535;

// --- Frequency ---
export const FREQ_MIN = 1000;
export const FREQ_MAX = 192_000;

// --- Factory import number mapping ---
// Maps user OSC indices (starting from 18) to Korg's internal import IDs.
// The gaps between ranges correspond to factory-reserved firmware slots.
export const FACTORY_IMPORT_NUMS: number[] = [
  ...range(50, 86),
  ...range(87, 113),
  ...range(114, 126),
  ...range(127, 136),
  ...range(137, 182),
  ...range(183, 184),
  ...range(185, 186),
  ...range(187, 189),
  ...range(190, 461),
];

// --- Fixed byte patterns in ESLI ---
// These are byte sequences observed in all Electribe 2 samples at specific offsets.
// The firmware expects these exact values; altering them may cause load failures.

/** ESLI bytes 0x16-0x21: unknown purpose, includes 0x7F at offset 0x19 */
export const FIXED_BYTES_16_22 = Buffer.from([0x00, 0x00, 0x00, 0x7F, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
/** ESLI byte 0x27: always 0x00 */
export const FIXED_BYTES_27 = Buffer.from([0x00]);
/** ESLI bytes 0x35-0x3B: always zero, between oneShot flag and wavDataSize */
export const FIXED_BYTES_35_3C = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
/** ESLI bytes 0x43-0x47: includes 0x01 0xB0 0x04, likely playback engine flags */
export const FIXED_BYTES_43_48 = Buffer.from([0x01, 0xB0, 0x04, 0x00, 0x00]);
/** ESLI byte 0x4C: always 0x00 */
export const FIXED_BYTES_4C = Buffer.from([0x00]);
/** ESLI byte 0x40: "use channel 0" routing flag, always 1 */
export const FIXED_USE_CHAN0 = 1;

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start }, (_, i) => start + i);
}
