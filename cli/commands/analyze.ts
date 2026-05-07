import { Command } from "commander";
import * as path from "node:path";
import * as fs from "node:fs";
import { readLibrary } from "../../src/io/reader.js";
import { readPattern, readPatternBank } from "../../src/io/reader.js";
import { PATTERN_BANK_PATTERN_COUNT } from "../../src/models/pattern.js";
import { render } from "../output.js";

const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length);
}

interface AnalyzeResult {
  directory: string;
  files: FileResult[];
}

interface FileResult {
  file: string;
  type: "library" | "pattern_bank" | "pattern";
  analysis: Record<string, unknown>;
}

function analyzeLibrary(filePath: string): FileResult {
  const { library, errors } = readLibrary(filePath);
  const categories: Record<string, number> = {};
  const freqStats: Record<string, number> = {};
  let totalDuration = 0;
  let stereoCount = 0;
  let oneShotCount = 0;

  for (const s of library.samples) {
    const esli = s.esli;
    const cat = esli.categoryDisplayName;
    categories[cat] = (categories[cat] || 0) + 1;
    const freq = String(esli.samplingFreq);
    freqStats[freq] = (freqStats[freq] || 0) + 1;
    if (esli.stereo) stereoCount++;
    if (esli.oneShot) oneShotCount++;
    const fmt = s.fmt;
    if (fmt.avgBytesPerSec) {
      totalDuration += s.audioData.length / fmt.avgBytesPerSec;
    }
  }

  const totalDataSize = library.totalDataSize;
  const analysis: Record<string, unknown> = {
    total_samples: library.samples.length,
    total_data_size: totalDataSize,
    max_data_size: 26214396,
    usage_percent: Math.round((totalDataSize / 26214396) * 1000) / 10,
    free_slots: 1020 - library.samples.length,
    load_errors: errors,
    total_duration_seconds: Math.round(totalDuration * 100) / 100,
    stereo_count: stereoCount,
    mono_count: library.samples.length - stereoCount,
    one_shot_count: oneShotCount,
    loop_count: library.samples.length - oneShotCount,
    categories,
    frequencies: freqStats,
  };
  return { file: path.basename(filePath), type: "library", analysis };
}

function analyzePatternBank(filePath: string): FileResult {
  const bank = readPatternBank(filePath);
  const tempoMin = { value: Infinity, name: "" };
  const tempoMax = { value: -Infinity, name: "" };
  const scaleCounts: Record<string, number> = {};
  const keyCounts: Record<string, number> = {};
  let totalActiveParts = 0;
  let totalStepsOn = 0;
  let patternsWithSteps = 0;
  let emptyPatterns = 0;

  const patterns: Record<string, unknown>[] = [];
  for (let index = 0; index < PATTERN_BANK_PATTERN_COUNT; index++) {
    const p = bank.getPattern(index);
    const s = p.summary();
    let activeParts = 0;
    let stepsOn = 0;
    for (let pi = 0; pi < 16; pi++) {
      for (let si = 0; si < 64; si++) {
        if (p.getStep(pi, si).on) { stepsOn++; activeParts = pi + 1; }
      }
    }
    if (stepsOn > 0) {
      totalActiveParts += activeParts;
      totalStepsOn += stepsOn;
      patternsWithSteps++;
    } else {
      emptyPatterns++;
    }

    const tempo = s.tempo as number;
    if (tempo < tempoMin.value && stepsOn > 0) { tempoMin.value = tempo; tempoMin.name = s.name as string; }
    if (tempo > tempoMax.value && stepsOn > 0) { tempoMax.value = tempo; tempoMax.name = s.name as string; }

    const scaleName = (s.scaleName as string) || String(s.scale);
    scaleCounts[scaleName] = (scaleCounts[scaleName] || 0) + 1;
    const keyName = KEY_NAMES[s.key as number] ?? String(s.key);
    keyCounts[keyName] = (keyCounts[keyName] || 0) + 1;

    patterns.push({
      number: index + 1,
      name: s.name,
      tempo,
      scale: scaleName,
      key: keyName,
      active_parts: activeParts,
      total_steps_on: stepsOn,
    });
  }

  const analysis: Record<string, unknown> = {
    total_patterns: PATTERN_BANK_PATTERN_COUNT,
    patterns_with_steps: patternsWithSteps,
    empty_patterns: emptyPatterns,
    total_steps_on: totalStepsOn,
    avg_steps_per_pattern: patternsWithSteps > 0 ? Math.round(totalStepsOn / patternsWithSteps) : 0,
    tempo_range: {
      min: tempoMin.value === Infinity ? null : tempoMin.value,
      min_name: tempoMin.name || null,
      max: tempoMax.value === -Infinity ? null : tempoMax.value,
      max_name: tempoMax.name || null,
    },
    scales: scaleCounts,
    keys: keyCounts,
    patterns,
  };
  return { file: path.basename(filePath), type: "pattern_bank", analysis };
}

function analyzePattern(filePath: string): FileResult {
  const pattern = readPattern(filePath);
  const s = pattern.summary();
  let activeParts = 0;
  let totalStepsOn = 0;
  const parts: Record<string, unknown>[] = [];

  for (let pi = 0; pi < 16; pi++) {
    const part = pattern.getPart(pi);
    let stepsOn = 0;
    for (let si = 0; si < 64; si++) {
      if (pattern.getStep(pi, si).on) stepsOn++;
    }
    if (stepsOn > 0) activeParts++;
    totalStepsOn += stepsOn;
    parts.push({
      part: pi,
      oscillator: part.oscillator,
      last_step: part.lastStep,
      level: part.level,
      pan: part.pan,
      pitch: part.pitch,
      filter_type: part.filterType,
      cutoff: part.cutoff,
      resonance: part.resonance,
      attack: part.attack,
      decay: part.decay,
      steps_on: stepsOn,
    });
  }

  const analysis: Record<string, unknown> = {
    name: s.name,
    tempo: s.tempo,
    swing: s.swing,
    length: (s.length as number) < 4 ? (s.length as number) + 1 : 4,
    beat: s.beat,
    key: KEY_NAMES[s.key as number] ?? String(s.key),
    scale: s.scaleName,
    level: s.level,
    gate_arp: s.gateArp,
    mfx_type: s.mfxType,
    active_parts: activeParts,
    total_steps_on: totalStepsOn,
    parts,
  };
  return { file: path.basename(filePath), type: "pattern", analysis };
}

function renderAnalyzeTable(result: AnalyzeResult): string {
  const lines: string[] = [];
  lines.push(`Analysis: ${result.directory}`);
  lines.push("=".repeat(80));

  for (const f of result.files) {
    lines.push("");
    const typeLabel = f.type === "library" ? "LIBRARY" : f.type === "pattern_bank" ? "PATTERN BANK" : "PATTERN";
    lines.push(`--- ${f.file} (${typeLabel}) ---`);

    const a = f.analysis;
    if (f.type === "library") {
      lines.push(`${pad("Samples", 25)} ${a.total_samples}`);
      lines.push(`${pad("Data size", 25)} ${_fmtSize(a.total_data_size as number)} / ${_fmtSize(a.max_data_size as number)} (${a.usage_percent}%)`);
      lines.push(`${pad("Free slots", 25)} ${a.free_slots}`);
      lines.push(`${pad("Duration", 25)} ${_fmtDuration(a.total_duration_seconds as number)}`);
      lines.push(`${pad("Stereo/Mono", 25)} ${a.stereo_count} / ${a.mono_count}`);
      lines.push(`${pad("One-shot/Loop", 25)} ${a.one_shot_count} / ${a.loop_count}`);
      if (a.load_errors as number > 0) {
        lines.push(`${pad("Load errors", 25)} ${a.load_errors}`);
      }
      const cats = a.categories as Record<string, number>;
      const catEntries = Object.entries(cats).sort(([, a], [, b]) => b - a);
      lines.push(`${pad("Categories", 25)} ${catEntries.map(([k, v]) => `${k}(${v})`).join(", ")}`);
      const freqs = a.frequencies as Record<string, number>;
      lines.push(`${pad("Sample rates", 25)} ${Object.entries(freqs).map(([k, v]) => `${k}Hz(${v})`).join(", ")}`);
    } else if (f.type === "pattern_bank") {
      lines.push(`${pad("Patterns", 25)} ${a.patterns_with_steps} active / ${a.empty_patterns} empty`);
      lines.push(`${pad("Total steps on", 25)} ${a.total_steps_on}`);
      lines.push(`${pad("Avg steps/pattern", 25)} ${a.avg_steps_per_pattern}`);
      const tr = a.tempo_range as { min: number | null; max: number | null; min_name: string | null; max_name: string | null };
      if (tr.min !== null) {
        lines.push(`${pad("Tempo range", 25)} ${tr.min} - ${tr.max} BPM`);
      }
      const scales = a.scales as Record<string, number>;
      const scaleEntries = Object.entries(scales).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);
      lines.push(`${pad("Scales", 25)} ${scaleEntries.map(([k, v]) => `${k}(${v})`).join(", ")}`);
      const keys = a.keys as Record<string, number>;
      const keyEntries = Object.entries(keys).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);
      lines.push(`${pad("Keys", 25)} ${keyEntries.map(([k, v]) => `${k}(${v})`).join(", ")}`);

      // Pattern table
      const patterns = (a.patterns as Array<Record<string, unknown>>).filter((p) => (p.total_steps_on as number) > 0);
      if (patterns.length > 0) {
        lines.push("");
        const cols = ["#", "Name", "BPM", "Key", "Scale", "Prt", "Stp"];
        const widths = [4, 16, 7, 4, 12, 4, 4];
        lines.push(cols.map((c, i) => pad(c, widths[i])).join(" "));
        lines.push("-".repeat(widths.reduce((a, b) => a + b, 0) + cols.length));
        for (const p of patterns) {
          const vals = [
            String(p.number), String(p.name),
            typeof p.tempo === "number" ? (p.tempo as number).toFixed(1) : String(p.tempo),
            String(p.key), String(p.scale),
            String(p.active_parts), String(p.total_steps_on),
          ];
          lines.push(vals.map((v, i) => pad(v, widths[i]).substring(0, widths[i])).join(" "));
        }
      }
    } else {
      lines.push(`${pad("Name", 25)} ${a.name}`);
      lines.push(`${pad("Tempo", 25)} ${a.tempo} BPM`);
      lines.push(`${pad("Key / Scale", 25)} ${a.key} ${a.scale}`);
      lines.push(`${pad("Active parts", 25)} ${a.active_parts}`);
      lines.push(`${pad("Total steps on", 25)} ${a.total_steps_on}`);

      const parts = a.parts as Array<Record<string, unknown>>;
      const activeParts = parts.filter((p) => (p.steps_on as number) > 0);
      if (activeParts.length > 0) {
        lines.push("");
        const cols = ["Pt", "OSC", "LastSt", "Lvl", "Pan", "Pitch", "Flt", "Cut", "Res", "Atk", "Dec", "Stp"];
        const widths = [4, 6, 7, 4, 4, 6, 4, 4, 4, 4, 4, 4];
        lines.push(cols.map((c, i) => pad(c, widths[i])).join(" "));
        lines.push("-".repeat(widths.reduce((a, b) => a + b, 0) + cols.length));
        for (const p of activeParts) {
          const vals = [
            String(p.part), String(p.oscillator), String(p.last_step),
            String(p.level), String(p.pan), String(p.pitch),
            String(p.filter_type), String(p.cutoff), String(p.resonance),
            String(p.attack), String(p.decay), String(p.steps_on),
          ];
          lines.push(vals.map((v, i) => pad(v, widths[i]).substring(0, widths[i])).join(" "));
        }
      }
    }
  }

  return lines.join("\n");
}

function _fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function _fmtDuration(seconds: number): string {
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)}h`;
  if (seconds >= 60) return `${(seconds / 60).toFixed(1)}m`;
  return `${seconds.toFixed(1)}s`;
}

export function registerAnalyzeCommands(parent: Command): void {
  parent
    .command("analyze")
    .description("Analyze all electribe files in a directory")
    .argument("<dir>", "Directory to scan")
    .option("-f, --format <fmt>", "Output format: json, table", "table")
    .action((dirPath, opts) => {
      const resolvedDir = path.resolve(dirPath);
      if (!fs.statSync(resolvedDir).isDirectory()) {
        console.log(JSON.stringify({ success: false, error: "NOT_A_DIRECTORY", message: `${resolvedDir} is not a directory` }));
        process.exit(1);
      }

      const entries = fs.readdirSync(resolvedDir).sort();
      const result: AnalyzeResult = { directory: resolvedDir, files: [] };

      for (const entry of entries) {
        const fullPath = path.join(resolvedDir, entry);
        if (!fs.statSync(fullPath).isFile()) continue;

        try {
          const ext = path.extname(entry).toLowerCase();
          if (ext === ".all") {
            result.files.push(analyzeLibrary(fullPath));
          } else if (ext === ".e2sallpat") {
            result.files.push(analyzePatternBank(fullPath));
          } else if (ext === ".e2pat") {
            result.files.push(analyzePattern(fullPath));
          }
        } catch (e: unknown) {
          result.files.push({
            file: entry,
            type: "library",
            analysis: { error: e instanceof Error ? e.message : String(e) },
          });
        }
      }

      if (result.files.length === 0) {
        console.log(JSON.stringify({ success: false, message: "No electribe files found", directory: resolvedDir }));
        process.exit(1);
      }

      if (opts.format === "json") {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(renderAnalyzeTable(result));
      }
    });
}
