# electribe2

TypeScript library + CLI for Korg Electribe 2 Sampler file formats.

## Quick Start
- `npm install` — install dependencies
- `npm test` — vitest (29 tests, binary round-trip is critical)
- `npm run build` — compile TypeScript
- `npm run check` — build + test

## Architecture
- `src/` — library core (RIFF parsing, models, operations, I/O, SysEx)
- `cli/` — Commander.js CLI, thin wrapper over core
- `test/` — tests with real binary fixtures

## Key Conventions
- Buffer-backed models: Pattern and Sample wrap Buffer with getter/setter at fixed offsets
- `fromBuffer()` / `toBuffer()` for binary serialization
- Operations are pure functions (no I/O except io/reader and io/writer)
- CLI emits JSON by default; `--format table|text` for humans
- Pattern index 0-based, OSC number 1-based, pattern_number 1-based (1-250)
- Unknown bytes in patterns preserved byte-for-byte in round-trip
- Round-trip tests are CRITICAL: every change must pass roundtrip.test.ts
- OSC gap at 422-499 (0-based), display gap at 423-501

## Binary Formats
- e2sSample.all: 16-byte header + 1020 RIFF pointers + sample data
- Pattern raw: 16384 bytes, wrapped .e2pat: 16640 bytes, allpattern: 4161792 bytes
- esli chunk: 1172 bytes with 25+ fields, fixed byte patterns must be preserved
- SysEx: Korg 8-bit/7-bit encoding, commands 0x40 (current) and 0x4C (numbered)

## CLI Groups (49 commands)
- `e2s library` — info, validate, create, free-slots
- `e2s sample` — list, get, set, import, export, delete, swap, move, trim, to-mono, replace
- `e2s slice` — list, get, set, steps
- `e2s batch` — import, export, compact
- `e2s pattern` — 25 commands (info, set, part, step, bank, sysex, motion, etc.)
