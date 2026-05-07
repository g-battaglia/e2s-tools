# Changelog

## 1.0.2

### Added
- `e2s analyze <dir>` — new command that scans a directory and produces a comprehensive analysis of all `.all`, `.e2sallpat`, and `.e2pat` files
  - Library analysis: sample count, usage %, duration, stereo/mono, one-shot/loop, categories, sample rates
  - Pattern bank analysis: active/empty patterns, BPM range, scale/key distribution, full pattern table
  - Single pattern analysis: metadata + active parts table with OSC, filter, envelope, steps
- `e2s sample list --verbose` — shows all 15 columns in table output (OSC#, Name, Category, Freq, Stereo, 1Shot, +12dB, Tune, Volume, Dur, DataSize, Start, LoopStart, EndPoint, Slices)
- `e2s pattern bank-list --verbose` — adds "Parts OSC" column showing which parts are active and their OSC assignments (e.g. `P0:259 P1:384 P2:334`)

### Changed
- `render()` in `cli/output.ts` now accepts `RenderOptions` for verbose table rendering

## 1.0.1

### Fixed
- Minor fixes

## 1.0.0

### Added
- Initial release: TypeScript library and CLI for Korg Electribe 2 Sampler file formats
- 49 CLI commands across 5 groups: library, sample, slice, batch, pattern
- Full binary round-trip support for .all, .e2pat, .e2sallpat, .syx files
