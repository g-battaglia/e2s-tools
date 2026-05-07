/**
 * Typed error hierarchy for Electribe 2 operations.
 * All errors have a `code` property for structured error handling in CLI/API contexts.
 */

/** Base error for all Electribe 2 operations. */
export class E2SError extends Error {
  code: string = "UNKNOWN";
  constructor(message: string) {
    super(message);
    this.name = "E2SError";
  }
}

// --- Library errors ---
/** Error related to sample library (.all file) operations. */
export class LibraryError extends E2SError { code = "LIBRARY_ERROR"; }
/** Library file has not been loaded or is null. */
export class LibraryNotLoadedError extends LibraryError { code = "LIBRARY_NOT_LOADED"; }
/** File does not have a valid e2sSample.all header. */
export class InvalidLibraryFileError extends LibraryError { code = "INVALID_LIBRARY_FILE"; }
/** No free OSC slots available (max 1020 samples). */
export class LibraryFullError extends LibraryError { code = "LIBRARY_FULL"; }
/** Total audio data exceeds the firmware limit (~25 MiB). */
export class DataSizeExceededError extends LibraryError { code = "DATA_SIZE_EXCEEDED"; }

// --- Sample errors ---
/** Error related to individual sample operations. */
export class SampleError extends E2SError { code = "SAMPLE_ERROR"; }
/** No sample found at the specified OSC index/number. */
export class SampleNotFoundError extends SampleError { code = "SAMPLE_NOT_FOUND"; }
/** OSC index is outside the valid range or falls in the reserved gap (422-499). */
export class InvalidOSCNumberError extends SampleError { code = "INVALID_OSC_NUMBER"; }
/** WAV file is not in PCM format. */
export class InvalidWavFormatError extends SampleError { code = "INVALID_WAV_FORMAT"; }
/** WAV file has zero-length audio data. */
export class EmptyWavError extends SampleError { code = "EMPTY_WAV"; }
/** WAV bit depth is not 8, 16, or 24. */
export class UnsupportedBitDepthError extends SampleError { code = "UNSUPPORTED_BIT_DEPTH"; }
/** Attempted to add a sample to an OSC slot that already has one. */
export class DuplicateOSCNumberError extends SampleError { code = "DUPLICATE_OSC_NUMBER"; }

// --- Slice errors ---
/** Error related to sample slice operations. */
export class SliceError extends E2SError { code = "SLICE_ERROR"; }
/** Slice index is outside the valid range (0-63). */
export class InvalidSliceIndexError extends SliceError { code = "INVALID_SLICE_INDEX"; }

// --- Validation errors ---
/** Generic validation error for malformed data. */
export class ValidationError extends E2SError { code = "VALIDATION_ERROR"; }
