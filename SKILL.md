---
name: electribe2-skill
description: CLI tool and library for managing Korg Electribe 2 Sampler files (.all, .e2pat, .e2sallpat, .syx). Use when working with electribe, sampler, Korg, e2s, e2sSample, samples, patterns, SysEx, MIDI, or RIFF/WAV files.
triggers:
  - .all
  - e2sSample
  - .e2pat
  - .e2sallpat
  - .syx
  - electribe
  - e2s
  - sysex
  - korg sampler
  - pattern bank
  - sample library
  - osc number
  - slice
  - riff
---

# Electribe 2 Sampler — Node.js CLI & Library

AI-friendly command-line tool and TypeScript library for managing Korg Electribe 2 Sampler sound libraries and patterns.

## Installation

```bash
npm install -g electribe2     # CLI (e2s command)
npm install electribe2        # Library in a Node.js project
```

## When to Apply

Activate when the user mentions:
- Electribe 2, Electribe Sampler, Korg Electribe
- File types: `.all`, `.e2pat`, `.e2sallpat`, `.syx`
- Workflows: sample management, pattern editing, SysEx transfer, sample import/export
- Keywords: e2s, sample library, pattern bank, OSC number, slice, RIFF

## Programmatic Usage

```javascript
import {
  readLibrary, readPattern, readPatternBank,
  writeLibrary, writePattern, writePatternBank,
  importFromWav, exportToWav,
  patternToSysex, sysexToPattern,
  SampleLibrary, Sample, Pattern, PatternBank,
  EsliMetadata, OscCategory,
  pcm8bTo16b, pcm24bTo16b, stereoToMono, trimSample,
} from 'electribe2';

// Read a library
const { library, errors } = readLibrary('/path/to/e2sSample.all');
console.log(library.samples.length);

// Import a WAV
const { sample } = importFromWav('/path/to/kick.wav', { category: 'Kick' });
library.addSample(sample, 42);
writeLibrary(library, '/path/to/output.all');

// Edit a pattern
const pattern = readPattern('/path/to/beat.e2pat');
pattern.tempo = 128;
pattern.setStep(0, 0, { on: true, velocity: 100, notes: [36] });
writePattern(pattern, '/path/to/beat.e2pat');
```

## Key Concepts

### Library (.all file)
- 16-byte header + 1020 RIFF address pointers (4 bytes each) + sample data
- Each sample is a RIFF/WAVE with fmt, data, and Korg/esli (1172 bytes) chunks
- Max 1020 samples, max 26,214,396 bytes total audio data

### OSC Numbering (1-based display)
- User area 1: OSC 19-422 (0-based index 18-421)
- Gap: OSC 423-501 (reserved, not usable)
- User area 2: OSC 502-1020 (0-based index 501-1019)
- Factory range: OSC 1-18

### 18 Sample Categories
Analog, Audio In, Kick, Snare, Clap, HiHat, Cymbal, Hits, Shots, Voice, SE, FX, Tom, Perc., Phrase, Loop, PCM, User

### Pattern File Sizes
- Raw pattern: 16,384 bytes (0x4000)
- Wrapped .e2pat: 16,640 bytes (0x4100) = 0x100 KORG header + raw
- Allpattern .e2sallpat: 0x10100 header + 250 raw patterns = 4,161,792 bytes

### Pattern Structure
- 16 parts (0-15), each with oscillator, filter, envelope, etc.
- 64 steps per part (0-63), 12 bytes per step
- 4 bars of 16 steps each
- Motion sequence: 1584 bytes at offset 0x100

### SysEx
- Korg 8-bit/7-bit encoding for MIDI transfer
- Current dump (command 0x40): no pattern number
- Numbered dump (command 0x4C): pattern number 1-250

## CLI Command Reference

All commands emit structured JSON. Add `--format table` or `--format text` for human-readable output.

### Library Commands

```bash
e2s library info <path>                              # Library summary
e2s library validate <path>                          # Check for errors
e2s library create -o <output.all>                   # Create empty library
e2s library free-slots <path> [--from 18] [--count 20]  # List free OSC slots
```

### Sample Commands

```bash
e2s sample list <path> [-c Kick] [-s search]         # List samples
e2s sample get <path> <osc_number>                   # Get sample details
e2s sample set -L <path> <osc_number> [-n name] [-c category] [-t tune] [-v volume] [--one-shot/--loop] [--plus-12db] [-o output]
e2s sample import -L <path> <wav_path> [-s slot] [-c category] [--force-mono] [-o output]
e2s sample export <path> <osc_number> <output.wav>   # Export as WAV
e2s sample delete -L <path> <osc_number> [--dry-run] # Delete sample
e2s sample swap -L <path> <osc_a> <osc_b>            # Swap positions
e2s sample move -L <path> <osc_number> <target> [--dry-run]
e2s sample trim -L <path> <osc_number> --end <frame> [--start 0]
e2s sample to-mono -L <path> <osc_number> [--mix 0]
e2s sample replace -L <path> <osc_number> <wav_path> # Replace audio
```

### Slice Commands

```bash
e2s slice list <path> <osc_number> [-a]              # List slices
e2s slice get <path> <osc_number> <slice_index>      # Get slice details
e2s slice set -L <path> <osc_number> <slice_index> [--start N] [--length N] [--attack-length N] [--amplitude N]
e2s slice steps <path> <osc_number>                  # Step sequencer state
```

### Batch Commands

```bash
e2s batch import -L <path> <wav_dir> [-c category] [--pattern *.wav] [--start-from 19] [--force-mono] [--dry-run]
e2s batch export <path> <output_dir>                  # Export all as WAVs
e2s batch compact -L <path> [--start-from 19] [--dry-run]  # Remove OSC gaps
```

### Pattern Commands

```bash
e2s pattern info <path> [--parts]                    # Pattern metadata
e2s pattern set -P <path> [--name X] [--tempo 128] [--swing 0] [--length 4] [--beat 0] [--key 0] [--scale 0] [--chord-set 0] [--level 100] [--gate-arp 0] [--mfx-type 0]
e2s pattern part <path> <part>                       # Show part details
e2s pattern set-part -P <path> <part> <field> <value>
e2s pattern step <path> <part> <step>                # Show step
e2s pattern set-step -P <path> <part> <step> [--on] [--gate 72] [--velocity 100] [--chord 0] [--notes 36,40,43]
e2s pattern clear-step -P <path> <part> <step>
e2s pattern toggle-note -P <path> <part> <step> <note>
e2s pattern copy-bar -P <path> <part> <source_bar> <target_bar>
e2s pattern clear-bar -P <path> <part> <bar>
e2s pattern rotate -P <path> <part> <steps> [--start-step 0] [--count 64]
e2s pattern blocks <path>                            # Raw global blocks
e2s pattern set-touch-scale -P <path> <index> <value>
e2s pattern set-master-fx -P <path> <index> <value>
e2s pattern export-motion <path> <output>
e2s pattern import-motion -P <path> <motion_path>
e2s pattern to-syx <path> [-p 42] [--device-id 0x23] [--global-channel 0]
e2s pattern from-syx <path> [--device-name e2sampler]
e2s pattern bank-info <path> [--patterns]
e2s pattern bank-list <path> [--parts]
e2s pattern split-all <path> <output_dir> [--raw]
e2s pattern merge-all <pattern_dir> -t <template> -o <output>
e2s pattern replace-in-all -A <allpat> -P <pattern> <pattern_number>
```

## Constraints

| Parameter | Value |
|---|---|
| Max samples | 1020 |
| OSC user range 1 | 19-422 |
| OSC gap (reserved) | 423-501 |
| OSC user range 2 | 502-1020 |
| Max sample name | 16 chars |
| Tune range | -63 to +63 |
| Volume range | 0-65535 |
| Max slices per sample | 64 |
| Slice index range | 0-63 |
| Pattern parts | 16 (0-15) |
| Pattern steps | 64 (0-63) |
| Pattern bars | 4 (0-3) |
| Bank patterns | 250 |
| Max audio data | 26,214,396 bytes |
| WAV formats | PCM 8/16/24-bit |
| SysEx device ID | 7-bit (0-127) |
