import { Command } from "commander";
import * as path from "node:path";
import * as fs from "node:fs";
import { readPattern, readPatternBank } from "../../src/io/reader.js";
import { writePattern, writePatternBank } from "../../src/io/writer.js";
import { patternToSysex, sysexToPattern } from "../../src/sysex.js";
import { rotateSteps, updatePatternGlobals, updatePart, updateStep, replacePatternInBank } from "../../src/operations/pattern.js";
import { Pattern, PATTERN_BANK_PATTERN_COUNT } from "../../src/models/pattern.js";
import { render } from "../output.js";

const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function exitError(code: string, message: string): never {
  console.log(JSON.stringify({ success: false, error: code, message }));
  process.exit(1);
}

function parseNotes(value: string | undefined): number[] | undefined {
  if (value === undefined) return undefined;
  if (value.trim() === "") return [];
  return value.split(",").map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
}

function parseIntAutoRadix(value: string): number {
  return parseInt(value, 0);
}

function writePatternResult(pattern: Pattern, filePath: string, output: string | undefined, changes: Record<string, string | number | boolean | number[] | null>): void {
  const outPath = output || filePath;
  writePattern(pattern, outPath);
  console.log(JSON.stringify({ success: true, output: path.resolve(outPath), changes }, null, 2));
}

function safePatternFilename(number: number, name: string, suffix: string): string {
  const clean = name.trim().replace(/[^a-zA-Z0-9\-_]/g, "_");
  return `${String(number).padStart(3, "0")}_${clean || "Pattern"}${suffix}`;
}

function patternNumberFromPath(filePath: string): number | null {
  const stem = path.basename(filePath, path.extname(filePath));
  const match = stem.match(/^(\d{1,3})/);
  if (!match) return null;
  const number = parseInt(match[1], 10);
  return number >= 1 && number <= 250 ? number : null;
}

export function registerPatternCommands(parent: Command): void {
  const pat = parent.command("pattern").description("Manage patterns (.e2pat, .e2sallpat)");

  pat
    .command("info")
    .description("Show pattern metadata")
    .argument("<path>", "Path to .e2pat or raw pattern file")
    .option("--parts", "Include part summaries")
    .option("-f, --format <fmt>", "Output format", "json")
    .action((filePath, opts) => {
      const pattern = readPattern(filePath);
      const data: Record<string, unknown> = pattern.summary();
      if (opts.parts) {
        data.parts = Array.from({ length: 16 }, (_, i) => pattern.getPart(i));
      }
      console.log(render(data, opts.format, path.basename(filePath)));
    });

  pat
    .command("blocks")
    .description("Show mapped global raw blocks")
    .argument("<path>", "Path to pattern file")
    .option("-f, --format <fmt>", "Output format", "json")
    .action((filePath, opts) => {
      const pattern = readPattern(filePath);
      console.log(render(pattern.globalBlocks(), opts.format, path.basename(filePath)));
    });

  pat
    .command("set")
    .description("Edit global pattern metadata")
    .requiredOption("-P, --pattern <path>", "Path to pattern file")
    .option("-n, --name <name>", "Pattern name")
    .option("--tempo <bpm>", "Tempo in BPM")
    .option("--swing <val>", "Swing (-127 to 127)")
    .option("--length <bars>", "Pattern length in bars")
    .option("--beat <val>", "Beat value")
    .option("--key <val>", "Key value")
    .option("--scale <val>", "Scale value")
    .option("--chord-set <val>", "Chord set value")
    .option("--level <val>", "Pattern level (0-127)")
    .option("--gate-arp <val>", "Gate arp value")
    .option("--mfx-type <val>", "Master FX type")
    .option("--alternate-13-14 <val>", "Alternate 13/14")
    .option("--alternate-15-16 <val>", "Alternate 15/16")
    .option("-o, --output <path>", "Output file")
    .action((opts) => {
      const pattern = readPattern(opts.pattern);
      const changes: Record<string, string | number | null> = {};
      if (opts.name != null) changes.name = opts.name;
      if (opts.tempo != null) changes.tempo = parseFloat(opts.tempo);
      if (opts.swing != null) changes.swing = parseInt(opts.swing, 10);
      if (opts.length != null) changes.length = parseInt(opts.length, 10);
      if (opts.beat != null) changes.beat = parseInt(opts.beat, 10);
      if (opts.key != null) changes.key = parseInt(opts.key, 10);
      if (opts.scale != null) changes.scale = parseInt(opts.scale, 10);
      if (opts.chordSet != null) changes.chordSet = parseInt(opts.chordSet, 10);
      if (opts.level != null) changes.level = parseInt(opts.level, 10);
      if (opts.gateArp != null) changes.gateArp = parseInt(opts.gateArp, 10);
      if (opts.mfxType != null) changes.mfxType = parseInt(opts.mfxType, 10);
      if (opts.alternate1314 != null) changes.alternate1314 = parseInt(opts.alternate1314, 10);
      if (opts.alternate1516 != null) changes.alternate1516 = parseInt(opts.alternate1516, 10);

      updatePatternGlobals(pattern, changes);
      writePatternResult(pattern, opts.pattern, opts.output, changes);
    });

  pat
    .command("part")
    .description("Show one part summary")
    .argument("<path>", "Path to pattern file")
    .argument("<part>", "0-based part index (0-15)")
    .option("-f, --format <fmt>", "Output format", "json")
    .action((filePath, partStr, opts) => {
      const part = parseInt(partStr, 10);
      const pattern = readPattern(filePath);
      console.log(render(pattern.getPart(part), opts.format));
    });

  pat
    .command("set-part")
    .description("Edit a single part field")
    .requiredOption("-P, --pattern <path>", "Path to pattern file")
    .argument("<part>", "0-based part index (0-15)")
    .argument("<field>", "Part field name")
    .argument("<value>", "New integer value")
    .option("-o, --output <path>", "Output file")
    .action((partStr, field, valueStr, opts) => {
      const part = parseInt(partStr, 10);
      const value = parseInt(valueStr, 10);
      const pattern = readPattern(opts.pattern);
      updatePart(pattern, part, { [field]: value });
      writePatternResult(pattern, opts.pattern, opts.output, { part, [field]: value });
    });

  pat
    .command("set-touch-scale")
    .description("Edit one touch-scale raw byte")
    .requiredOption("-P, --pattern <path>", "Path to pattern file")
    .argument("<index>", "Touch scale byte index 0-15")
    .argument("<value>", "New byte value")
    .option("-o, --output <path>", "Output file")
    .action((indexStr, valueStr, opts) => {
      const index = parseInt(indexStr, 10);
      const value = parseInt(valueStr, 10);
      const pattern = readPattern(opts.pattern);
      pattern.setTouchScaleValue(index, value);
      writePatternResult(pattern, opts.pattern, opts.output, { touch_scale_index: index, value });
    });

  pat
    .command("set-master-fx")
    .description("Edit one master-FX raw byte")
    .requiredOption("-P, --pattern <path>", "Path to pattern file")
    .argument("<index>", "Master FX byte index 0-7")
    .argument("<value>", "New byte value")
    .option("-o, --output <path>", "Output file")
    .action((indexStr, valueStr, opts) => {
      const index = parseInt(indexStr, 10);
      const value = parseInt(valueStr, 10);
      const pattern = readPattern(opts.pattern);
      pattern.setMasterFxValue(index, value);
      writePatternResult(pattern, opts.pattern, opts.output, { master_fx_index: index, value });
    });

  pat
    .command("export-motion")
    .description("Export the raw 1584-byte motion sequence block")
    .argument("<path>", "Path to pattern file")
    .argument("<output>", "Output motion sequence binary path")
    .action((filePath, outputPath) => {
      const pattern = readPattern(filePath);
      const data = pattern.getMotionSequence();
      fs.writeFileSync(outputPath, data);
      console.log(JSON.stringify({ success: true, output: path.resolve(outputPath), bytes: data.length }));
    });

  pat
    .command("import-motion")
    .description("Replace the raw motion sequence block")
    .requiredOption("-P, --pattern <path>", "Path to pattern file")
    .argument("<motion_path>", "1584-byte motion block")
    .option("-o, --output <path>", "Output file")
    .action((motionPath, opts) => {
      const pattern = readPattern(opts.pattern);
      const data = fs.readFileSync(motionPath);
      pattern.setMotionSequence(data);
      writePatternResult(pattern, opts.pattern, opts.output, { motion_sequence_bytes: data.length });
    });

  pat
    .command("step")
    .description("Show one sequence step")
    .argument("<path>", "Path to pattern file")
    .argument("<part>", "0-based part index (0-15)")
    .argument("<step>", "0-based step index (0-63)")
    .option("-f, --format <fmt>", "Output format", "json")
    .action((filePath, partStr, stepStr, opts) => {
      const part = parseInt(partStr, 10);
      const step = parseInt(stepStr, 10);
      const pattern = readPattern(filePath);
      console.log(render(pattern.getStep(part, step), opts.format));
    });

  pat
    .command("set-step")
    .description("Edit one sequence step")
    .requiredOption("-P, --pattern <path>", "Path to pattern file")
    .argument("<part>", "0-based part index (0-15)")
    .argument("<step>", "0-based step index (0-63)")
    .option("--on", "Set step on")
    .option("--off", "Set step off")
    .option("--gate <val>", "Gate time")
    .option("--velocity <val>", "Velocity")
    .option("--chord <val>", "Chord value")
    .option("--notes <val>", "Comma-separated MIDI notes")
    .option("-o, --output <path>", "Output file")
    .action((partStr, stepStr, opts) => {
      const part = parseInt(partStr, 10);
      const step = parseInt(stepStr, 10);
      const pattern = readPattern(opts.pattern);
      const parsedNotes = parseNotes(opts.notes);
      updateStep(pattern, part, step, {
        on: opts.on !== undefined ? true : (opts.off !== undefined ? false : undefined),
        gate: opts.gate != null ? parseInt(opts.gate, 10) : undefined,
        velocity: opts.velocity != null ? parseInt(opts.velocity, 10) : undefined,
        chord: opts.chord != null ? parseInt(opts.chord, 10) : undefined,
        notes: parsedNotes,
      });
      const changes: Record<string, string | number | boolean | number[] | null> = { part, step };
      if (opts.on !== undefined) changes.on = true;
      if (opts.off !== undefined) changes.on = false;
      if (opts.gate != null) changes.gate = parseInt(opts.gate, 10);
      if (opts.velocity != null) changes.velocity = parseInt(opts.velocity, 10);
      if (opts.chord != null) changes.chord = parseInt(opts.chord, 10);
      if (parsedNotes !== undefined) changes.notes = parsedNotes;
      writePatternResult(pattern, opts.pattern, opts.output, changes);
    });

  pat
    .command("clear-step")
    .description("Clear notes and off flag for one step")
    .requiredOption("-P, --pattern <path>", "Path to pattern file")
    .argument("<part>", "0-based part index (0-15)")
    .argument("<step>", "0-based step index (0-63)")
    .option("-o, --output <path>", "Output file")
    .action((partStr, stepStr, opts) => {
      const part = parseInt(partStr, 10);
      const step = parseInt(stepStr, 10);
      const pattern = readPattern(opts.pattern);
      pattern.clearStep(part, step);
      writePatternResult(pattern, opts.pattern, opts.output, { part, step, cleared: true });
    });

  pat
    .command("toggle-note")
    .description("Toggle a MIDI note on a step")
    .requiredOption("-P, --pattern <path>", "Path to pattern file")
    .argument("<part>", "0-based part index (0-15)")
    .argument("<step>", "0-based step index (0-63)")
    .argument("<note>", "MIDI note number (0-127)")
    .option("-o, --output <path>", "Output file")
    .action((partStr, stepStr, noteStr, opts) => {
      const part = parseInt(partStr, 10);
      const step = parseInt(stepStr, 10);
      const note = parseInt(noteStr, 10);
      const pattern = readPattern(opts.pattern);
      const notes = pattern.toggleNote(part, step, note);
      writePatternResult(pattern, opts.pattern, opts.output, { part, step, notes });
    });

  pat
    .command("copy-bar")
    .description("Copy 16 steps from one bar to another")
    .requiredOption("-P, --pattern <path>", "Path to pattern file")
    .argument("<part>", "0-based part index (0-15)")
    .argument("<source_bar>", "0-based source bar (0-3)")
    .argument("<target_bar>", "0-based target bar (0-3)")
    .option("-o, --output <path>", "Output file")
    .action((partStr, sourceBarStr, targetBarStr, opts) => {
      const part = parseInt(partStr, 10);
      const sourceBar = parseInt(sourceBarStr, 10);
      const targetBar = parseInt(targetBarStr, 10);
      const pattern = readPattern(opts.pattern);
      pattern.copyBar(part, sourceBar, targetBar);
      writePatternResult(pattern, opts.pattern, opts.output, { part, source_bar: sourceBar, target_bar: targetBar });
    });

  pat
    .command("clear-bar")
    .description("Clear all 16 steps in a bar")
    .requiredOption("-P, --pattern <path>", "Path to pattern file")
    .argument("<part>", "0-based part index (0-15)")
    .argument("<bar>", "0-based bar (0-3)")
    .option("-o, --output <path>", "Output file")
    .action((partStr, barStr, opts) => {
      const part = parseInt(partStr, 10);
      const bar = parseInt(barStr, 10);
      const pattern = readPattern(opts.pattern);
      pattern.clearBar(part, bar);
      writePatternResult(pattern, opts.pattern, opts.output, { part, bar, cleared: true });
    });

  pat
    .command("rotate")
    .description("Rotate a part sequence by step records")
    .requiredOption("-P, --pattern <path>", "Path to pattern file")
    .argument("<part>", "0-based part index (0-15)")
    .argument("<steps>", "Rotation amount in steps")
    .option("--start-step <val>", "First step to rotate", "0")
    .option("--count <val>", "Number of steps to rotate", "64")
    .option("-o, --output <path>", "Output file")
    .action((partStr, stepsStr, opts) => {
      const part = parseInt(partStr, 10);
      const steps = parseInt(stepsStr, 10);
      const startStep = parseInt(opts.startStep, 10);
      const count = parseInt(opts.count, 10);
      const pattern = readPattern(opts.pattern);
      rotateSteps(pattern, part, steps, startStep, count);
      writePatternResult(pattern, opts.pattern, opts.output, { part, steps, start_step: startStep, count });
    });

  pat
    .command("to-syx")
    .description("Convert a pattern file to SysEx")
    .argument("<path>", "Path to .e2pat file")
    .option("-o, --output <path>", "Output .syx path")
    .option("-p, --pattern-number <num>", "Destination pattern 1-250")
    .option("--device-id <val>", "7-bit device id", "0x23")
    .option("--global-channel <val>", "Global channel 0-15", "0")
    .action((filePath, opts) => {
      const pattern = readPattern(filePath);
      const outPath = opts.output || filePath.replace(/\.[^.]+$/, ".syx");
      const syx = patternToSysex(pattern, {
        patternNumber: opts.patternNumber ? parseInt(opts.patternNumber, 10) : undefined,
        deviceId: parseIntAutoRadix(opts.deviceId),
        globalChannel: parseInt(opts.globalChannel, 10),
      });
      fs.writeFileSync(outPath, syx);
      console.log(JSON.stringify({
        success: true,
        output: path.resolve(outPath),
        bytes: syx.length,
        pattern_number: opts.patternNumber ? parseInt(opts.patternNumber, 10) : null,
      }));
    });

  pat
    .command("from-syx")
    .description("Convert SysEx dump to .e2pat")
    .argument("<path>", "Path to .syx file")
    .option("-o, --output <path>", "Output .e2pat path")
    .option("--device-name <name>", "KORG header device name", "e2sampler")
    .action((filePath, opts) => {
      const data = fs.readFileSync(filePath);
      const pattern = sysexToPattern(data, opts.deviceName);
      const outPath = opts.output || filePath.replace(/\.[^.]+$/, ".e2pat");
      writePattern(pattern, outPath);
      console.log(JSON.stringify({ success: true, output: path.resolve(outPath) }));
    });

  pat
    .command("bank-info")
    .description("Show allpattern file summary")
    .argument("<path>", "Path to .e2sallpat file")
    .option("--patterns", "Include all pattern names")
    .option("-f, --format <fmt>", "Output format", "json")
    .action((filePath, opts) => {
      const bank = readPatternBank(filePath);
      const data: Record<string, unknown> = bank.summary();
      if (opts.patterns) {
        data.patterns = bank.listPatterns();
      }
      console.log(render(data, opts.format, path.basename(filePath)));
    });

  pat
    .command("bank-list")
    .description("List all 250 patterns with details")
    .argument("<path>", "Path to .e2sallpat file")
    .option("--parts", "Include per-part detail")
    .option("-v, --verbose", "Show extra columns (parts OSC summary)")
    .option("-f, --format <fmt>", "Output format", "table")
    .action((filePath, opts) => {
      const bank = readPatternBank(filePath);
      const rows: Record<string, unknown>[] = [];
      const verbose = opts.verbose ?? false;

      for (let index = 0; index < PATTERN_BANK_PATTERN_COUNT; index++) {
        const p = bank.getPattern(index);
        const s = p.summary();
        let activeParts = 0;
        let totalStepsOn = 0;
        const partOscs: string[] = [];
        for (let pi = 0; pi < 16; pi++) {
          let stepsOn = 0;
          for (let si = 0; si < 64; si++) {
            if (p.getStep(pi, si).on) stepsOn++;
          }
          if (stepsOn > 0) {
            activeParts++;
            totalStepsOn += stepsOn;
          }
          if (verbose) {
            const part = p.getPart(pi);
            if (part.oscillator > 0) {
              partOscs.push(`P${pi}:${part.oscillator}`);
            }
          }
        }
        const row: Record<string, unknown> = {
          number: index + 1,
          name: s.name,
          tempo: s.tempo,
          swing: s.swing,
          length: (s.length as number) < 4 ? (s.length as number) + 1 : 4,
          beat: s.beat,
          key: KEY_NAMES[s.key as number] ?? String(s.key),
          scale: (s.scaleName as string) || String(s.scale),
          chord_set: s.chordSet,
          level: s.level,
          gate_arp: s.gateArp,
          mfx_type: s.mfxType,
          alt_13_14: s.alternate1314,
          alt_15_16: s.alternate1516,
          active_parts: activeParts,
          total_steps_on: totalStepsOn,
        };
        if (verbose) {
          row.parts_osc = partOscs.join(" ");
        }
        if (opts.parts) {
          row.parts_detail = Array.from({ length: 16 }, (_, i) => p.getPart(i));
        }
        rows.push(row);
      }

      if (opts.format === "json") {
        console.log(JSON.stringify(rows, null, 2));
      } else {
        const lines: string[] = [`Pattern Bank: ${path.basename(filePath)}`];
        const cols = verbose
          ? ["#", "Name", "BPM", "Swng", "Bar", "Bt", "Key", "Scale", "Chd", "Lvl", "GArp", "MFX", "A13", "A15", "Prt", "Stp", "Parts OSC"]
          : ["#", "Name", "BPM", "Swng", "Bar", "Bt", "Key", "Scale", "Chd", "Lvl", "GArp", "MFX", "A13", "A15", "Prt", "Stp"];
        const widths = verbose
          ? [4, 16, 7, 5, 4, 3, 4, 12, 4, 4, 5, 4, 4, 4, 4, 4, 50]
          : [4, 16, 7, 5, 4, 3, 4, 12, 4, 4, 5, 4, 4, 4, 4, 4];
        lines.push(cols.map((c, i) => c.padEnd(widths[i])).join(" "));
        lines.push("-".repeat(widths.reduce((a, b) => a + b, 0) + cols.length));
        for (const r of rows) {
          const vals = [
            String(r.number), String(r.name), typeof r.tempo === "number" ? r.tempo.toFixed(1) : String(r.tempo),
            String(r.swing), String(r.length), String(r.beat), String(r.key), String(r.scale),
            String(r.chord_set), String(r.level), String(r.gate_arp), String(r.mfx_type),
            String(r.alt_13_14), String(r.alt_15_16), String(r.active_parts), String(r.total_steps_on),
          ];
          if (verbose) {
            vals.push(String(r.parts_osc ?? ""));
          }
          lines.push(vals.map((v, i) => v.padEnd(widths[i]).substring(0, widths[i])).join(" "));
        }
        console.log(lines.join("\n"));
      }
    });

  pat
    .command("split-all")
    .description("Split an allpattern file into 250 pattern files")
    .argument("<path>", "Path to .e2sallpat file")
    .argument("<output_dir>", "Output directory")
    .option("--raw", "Write raw 16 KiB pattern files")
    .action((filePath, outputDir, opts) => {
      const bank = readPatternBank(filePath);
      fs.mkdirSync(outputDir, { recursive: true });
      const suffix = opts.raw ? ".bin" : ".e2pat";
      const files: string[] = [];
      for (let index = 0; index < 250; index++) {
        const pattern = bank.getPattern(index);
        const outPath = path.join(outputDir, safePatternFilename(index + 1, pattern.name, suffix));
        const data = opts.raw ? pattern.raw : pattern.toWrappedBytes();
        fs.writeFileSync(outPath, data);
        files.push(outPath);
      }
      console.log(JSON.stringify({ success: true, count: files.length, output_dir: path.resolve(outputDir) }));
    });

  pat
    .command("merge-all")
    .description("Merge numbered pattern files into an allpattern template")
    .argument("<pattern_dir>", "Pattern directory")
    .requiredOption("-t, --template <path>", "Template allpattern file")
    .requiredOption("-o, --output <path>", "Output allpattern path")
    .action((patternDir, opts) => {
      const bank = readPatternBank(opts.template);
      const replaced: Record<string, unknown>[] = [];
      const entries = fs.readdirSync(patternDir).sort();
      for (const entry of entries) {
        const fullPath = path.join(patternDir, entry);
        if (!fs.statSync(fullPath).isFile()) continue;
        const ext = path.extname(entry).toLowerCase();
        if (![".e2pat", ".bin", ".dat"].includes(ext)) continue;
        const number = patternNumberFromPath(fullPath);
        if (number === null) continue;
        replacePatternInBank(bank, number, readPattern(fullPath));
        replaced.push({ number, file: fullPath });
      }
      writePatternBank(bank, opts.output);
      console.log(JSON.stringify({ success: true, output: path.resolve(opts.output), replaced: replaced.length, patterns: replaced }));
    });

  pat
    .command("replace-in-all")
    .description("Replace one pattern slot inside an allpattern file")
    .requiredOption("-A, --allpatterns <path>", "Path to .e2sallpat file")
    .requiredOption("-P, --pattern <path>", "Path to replacement pattern file")
    .argument("<pattern_number>", "Destination pattern number 1-250")
    .option("-o, --output <path>", "Output file")
    .action((patternNumberStr, opts) => {
      const patternNumber = parseInt(patternNumberStr, 10);
      const bank = readPatternBank(opts.allpatterns);
      const pattern = readPattern(opts.pattern);
      replacePatternInBank(bank, patternNumber, pattern);
      const outPath = opts.output || opts.allpatterns;
      writePatternBank(bank, outPath);
      console.log(JSON.stringify({ success: true, output: path.resolve(outPath), pattern_number: patternNumber }));
    });
}
