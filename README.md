# e2s-tools

> TypeScript library and CLI for Korg e2s Sampler files — read, write, and manipulate sample libraries, patterns, and SysEx dumps.

[![npm version](https://img.shields.io/npm/v/e2s-tools.svg)](https://www.npmjs.com/package/e2s-tools)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org)

---

## What is this?

The Korg Electribe 2 Sampler stores sounds and patterns in proprietary binary formats (`.all`, `.e2pat`, `.e2sallpat`, `.syx`). This library gives you **full programmatic access** to these files — no hardware needed.

**Use cases:**

- 🎛️ **Build custom editors** — create desktop or web apps for the Electribe 2
- 🤖 **AI-powered workflows** — the CLI outputs structured JSON, designed for AI agents
- 📦 **Batch processing** — import/export hundreds of samples in one command
- 🔄 **SysEx transfer** — convert patterns to MIDI SysEx and back
- 🎹 **Pattern generation** — create patterns programmatically from code

## Install

```bash
npm install e2s-tools        # Library
npm install -g e2s-tools     # CLI (e2s command)
```

## Quick Start

### CLI

```bash
# Inspect a pattern
e2s pattern info my_beat.e2pat

# List all samples in a library
e2s sample list e2sSample.all

# Import a WAV into a library
e2s sample import -L e2sSample.all kick.wav --category Kick

# Convert a pattern to SysEx for MIDI transfer
e2s pattern to-syx my_beat.e2pat -p 42

# Split a pattern bank into 250 individual files
e2s pattern split-all my_bank.e2sallpat ./patterns/

# Batch import a folder of WAVs
e2s batch import -L e2sSample.all ./samples/ --category User
```

All commands output **structured JSON** by default. Add `--format table` for human-readable output.

### Library API

```typescript
import {
  readLibrary, readPattern, writePattern,
  patternToSysex, importFromWav,
} from 'e2s-tools';  // npm package name

// Read a sample library (e2sSample.all)
const { library } = readLibrary('e2sSample.all');
console.log(`${library.samples.length} samples loaded`);

// Edit a pattern
const pattern = readPattern('my_beat.e2pat');
pattern.tempo = 128;
pattern.name = 'Techno Kick';
pattern.setStep(0, 0, { on: true, velocity: 110, notes: [36] });
pattern.setStep(0, 4, { on: true, velocity: 90, notes: [36] });
writePattern(pattern, 'my_beat.e2pat');

// Import a WAV sample
const { sample } = importFromWav('kick.wav', { category: 'Kick' });
library.addSample(sample);

// Convert to SysEx for MIDI transfer
const syx = patternToSysex(pattern, { patternNumber: 42 });
```

## Supported Formats

| Format | Extension | Description |
|---|---|---|
| Sample Library | `.all` | Up to 1020 samples with Korg metadata |
| Single Pattern | `.e2pat` | 16 parts x 64 steps, synth parameters |
| Pattern Bank | `.e2sallpat` | 250 patterns in one file |
| SysEx Dump | `.syx` | MIDI transfer format (7-bit encoded) |

## CLI Reference

**49 commands** across 5 groups:

| Group | Commands | Description |
|---|---|---|
| `e2s library` | `info` `validate` `create` `free-slots` | Manage sample libraries |
| `e2s sample` | `list` `get` `set` `import` `export` `delete` `swap` `move` `trim` `to-mono` `replace` | Sample CRUD + audio conversion |
| `e2s slice` | `list` `get` `set` `steps` | Edit sample slices (up to 64) |
| `e2s batch` | `import` `export` `compact` | Bulk operations |
| `e2s pattern` | `info` `set` `part` `set-part` `step` `set-step` `clear-step` `toggle-note` `copy-bar` `clear-bar` `rotate` `blocks` `set-touch-scale` `set-master-fx` `export-motion` `import-motion` `to-syx` `from-syx` `bank-info` `bank-list` `split-all` `merge-all` `replace-in-all` | Full pattern editing |

<details>
<summary><strong>Example: Create a techno pattern from scratch</strong></summary>

```bash
# Start with any .e2pat file as a template
e2s pattern set -P template.e2pat --name "Techno 001" --tempo 130 --key 0 --scale 0

# Program a four-on-the-floor kick (part 0, every 4th step)
for step in 0 4 8 12 16 20 24 28 32 36 40 44 48 52 56 60; do
  e2s pattern set-step -P template.e2pat 0 $step --on --velocity 110 --notes 36
done

# Add hi-hats on off-beats (part 1)
for step in 2 6 10 14 18 22 26 30; do
  e2s pattern set-step -P template.e2pat 1 $step --on --velocity 80 --notes 42
done

# Convert to SysEx and send to hardware
e2s pattern to-syx template.e2pat -p 1
```

</details>

<details>
<summary><strong>Example: Manage a sample library</strong></summary>

```bash
# Check library stats
e2s library info e2sSample.all
# → { "total_samples": 251, "usage_percent": 47.2, "free_slots": 769 }

# Find all kick samples
e2s sample list e2sSample.all --category Kick

# Import a folder of WAV files
e2s batch import -L e2sSample.all ./my_kicks/ --category Kick --start-from 100

# Export all samples as WAV
e2s batch export e2sSample.all ./exported/

# Remove gaps in OSC numbering
e2s batch compact -L e2sSample.all --start-from 19
```

</details>

## AI Agent Integration

This library includes a **SKILL.md** file for [Claude Code](https://claude.ai/code) and other AI coding agents. When the skill is active, an AI agent can:

- Read and modify Electribe 2 files using the CLI
- Create patterns programmatically
- Manage sample libraries
- Convert between formats (WAV <-> Library, Pattern <-> SysEx)

The CLI's JSON-first output design makes it ideal for AI tool use.

## Binary Format Details

<details>
<summary><strong>ESLI chunk layout (1172 bytes)</strong></summary>

Each sample contains a Korg-proprietary `esli` sub-chunk with metadata:

| Offset | Size | Field |
|--------|------|-------|
| 0x000 | 2 | OSC index |
| 0x002 | 16 | Sample name (ASCII) |
| 0x012 | 2 | Category |
| 0x022 | 2 | Play log period |
| 0x024 | 2 | Volume (0-65535) |
| 0x028 | 4 | Start point |
| 0x02C | 4 | Loop start offset |
| 0x030 | 4 | End point offset |
| 0x034 | 1 | One-shot flag |
| 0x03C | 4 | WAV data size |
| 0x048 | 4 | Sampling frequency |
| 0x04D | 1 | Tune (-63 to +63) |
| 0x050 | 1024 | 64 slices x 16 bytes |

</details>

<details>
<summary><strong>Pattern layout (16384 bytes)</strong></summary>

| Offset | Size | Content |
|--------|------|---------|
| 0x010 | 16 | Pattern name |
| 0x022 | 2 | Tempo (BPM x 10) |
| 0x024 | 1 | Swing |
| 0x025 | 1 | Length (0-3 bars) |
| 0x027 | 1 | Key (0-11) |
| 0x028 | 1 | Scale (0-34) |
| 0x100 | 1584 | Motion sequence |
| 0x800 | 13056 | 16 parts x 816 bytes |

Each part contains 64 steps of 12 bytes: on/off, gate, velocity, chord, 4 notes.

</details>

## Constraints

| Parameter | Limit |
|---|---|
| Samples per library | 1020 |
| Audio data limit | ~25 MiB |
| User OSC range | 19-422, 502-1020 |
| Slices per sample | 64 |
| Parts per pattern | 16 |
| Steps per part | 64 |
| Patterns per bank | 250 |
| WAV formats | PCM 8/16/24-bit |

## Development

```bash
git clone https://github.com/g-battaglia/e2s-tools
cd e2s-tools
npm install
npm test          # 29 tests
npm run build     # Compile TypeScript
```

## License

[MIT](LICENSE) — use it however you want.

---

*Built for musicians, producers, and hackers who push their Electribe 2 further than Korg intended.*
