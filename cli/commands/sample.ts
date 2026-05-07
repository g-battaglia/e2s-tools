import { Command } from "commander";
import * as path from "node:path";
import * as fs from "node:fs";
import { readLibrary } from "../../src/io/reader.js";
import { writeLibrary } from "../../src/io/writer.js";
import { importFromWav } from "../../src/operations/import.js";
import { exportToWav } from "../../src/operations/export.js";
import { trimSample } from "../../src/operations/trim.js";
import { stereoToMono } from "../../src/operations/convert.js";
import { categoryFromDisplayName } from "../../src/models/enums.js";
import { render } from "../output.js";

function sampleToDict(s: import("../../src/models/sample.js").Sample): Record<string, unknown> {
  const esli = s.esli;
  const fmt = s.fmt;
  const duration = fmt.avgBytesPerSec ? s.audioData.length / fmt.avgBytesPerSec : 0;
  return {
    osc_number: esli.oscNumber,
    name: esli.name,
    category: esli.categoryDisplayName,
    one_shot: esli.oneShot,
    plus_12db: esli.plus12db,
    tune: esli.sampleTune,
    sampling_freq: esli.samplingFreq,
    play_volume: esli.playVolume,
    duration_seconds: Math.round(duration * 10000) / 10000,
    is_stereo: esli.stereo,
    data_size: esli.wavDataSize,
    start_point: esli.startPoint,
    loop_start_offset: esli.loopStartOffset,
    end_point_offset: esli.endPointOffset,
    num_active_slices: esli.slices.filter((sl) => sl.length > 0).length,
  };
}

function exitError(code: string, message: string): never {
  console.log(JSON.stringify({ success: false, error: code, message }));
  process.exit(1);
}

export function registerSampleCommands(parent: Command): void {
  const sample = parent.command("sample").description("Manage samples in a library");

  sample
    .command("list")
    .description("List all samples in a library")
    .argument("<path>", "Path to .all file")
    .option("-c, --category <cat>", "Filter by category")
    .option("-s, --search <term>", "Filter by name")
    .option("-v, --verbose", "Show all columns in table output")
    .option("-f, --format <fmt>", "Output format", "json")
    .action((filePath, opts) => {
      const { library } = readLibrary(filePath);
      const samples: Record<string, unknown>[] = [];
      for (const s of library.samples) {
        const info = sampleToDict(s);
        if (opts.category && (info.category as string).toLowerCase() !== opts.category.toLowerCase()) continue;
        if (opts.search && !(info.name as string).toLowerCase().includes(opts.search.toLowerCase())) continue;
        samples.push(info);
      }
      console.log(render({ count: samples.length, samples }, opts.format, path.basename(filePath), { verbose: opts.verbose }));
    });

  sample
    .command("get")
    .description("Get detailed info about a sample")
    .argument("<path>", "Path to .all file")
    .argument("<osc_number>", "1-based OSC number")
    .option("-f, --format <fmt>", "Output format", "json")
    .action((filePath, oscStr, opts) => {
      const oscNumber = parseInt(oscStr, 10);
      const { library } = readLibrary(filePath);
      const s = library.getByOscNumber(oscNumber);
      if (!s) exitError("SAMPLE_NOT_FOUND", `No sample at OSC ${oscNumber}`);
      const info = sampleToDict(s);
      const esli = s.esli;
      info.play_log_period = esli.playLogPeriod;
      info.slices = esli.slices
        .filter((sl) => sl.length > 0)
        .map((sl, i) => ({ index: i, start: sl.start, length: sl.length, attack_length: sl.attackLength, amplitude: sl.amplitude }));
      console.log(render(info, opts.format));
    });

  sample
    .command("set")
    .description("Edit sample metadata")
    .requiredOption("-L, --library <path>", "Path to .all file")
    .argument("<osc_number>", "1-based OSC number")
    .option("-n, --name <name>", "Sample name (max 16 chars)")
    .option("-c, --category <cat>", "Category name")
    .option("-t, --tune <val>", "Tune (-63 to +63)")
    .option("-v, --volume <val>", "Volume (0-65535)")
    .option("--one-shot", "Set one-shot mode")
    .option("--loop", "Set loop mode")
    .option("--plus-12db", "Enable +12dB gain")
    .option("--no-plus-12db", "Disable +12dB gain")
    .option("-o, --output <path>", "Output file")
    .action((oscStr, opts) => {
      const oscNumber = parseInt(oscStr, 10);
      const { library } = readLibrary(opts.library);
      const s = library.getByOscNumber(oscNumber);
      if (!s) exitError("SAMPLE_NOT_FOUND", `No sample at OSC ${oscNumber}`);

      const changes: string[] = [];
      const esli = s.esli;
      if (opts.name != null) { esli.name = opts.name; changes.push(`name='${opts.name}'`); }
      if (opts.category != null) { esli.category = categoryFromDisplayName(opts.category); changes.push(`category='${opts.category}'`); }
      if (opts.tune != null) { esli.sampleTune = parseInt(opts.tune, 10); changes.push(`tune=${opts.tune}`); }
      if (opts.volume != null) { esli.playVolume = parseInt(opts.volume, 10); changes.push(`volume=${opts.volume}`); }
      if (opts.oneShot !== undefined || opts.loop !== undefined) { esli.oneShot = !!opts.oneShot; changes.push(`one_shot=${esli.oneShot}`); }
      if (opts.plus12db !== undefined) { esli.plus12db = opts.plus12db; changes.push(`plus_12db=${esli.plus12db}`); }

      const outPath = opts.output || opts.library;
      writeLibrary(library, outPath);
      console.log(JSON.stringify({ success: true, message: `Sample ${oscNumber} updated: ${changes.join(", ")}`, output: path.resolve(outPath) }));
    });

  sample
    .command("import")
    .description("Import a WAV file into the library")
    .requiredOption("-L, --library <path>", "Path to .all file")
    .argument("<wav_path>", "WAV file to import")
    .option("-s, --slot <num>", "Target OSC number (1-based)")
    .option("-c, --category <cat>", "Category", "User")
    .option("--force-mono", "Convert to mono")
    .option("--mono-mix <val>", "Mono mix (-1=L, 0=C, 1=R)", "0")
    .option("-o, --output <path>", "Output file")
    .action((wavPath, opts) => {
      const { library } = readLibrary(opts.library);
      const { sample, convertedFrom, convertedToMono } = importFromWav(wavPath, {
        category: opts.category || "User",
        forceMono: !!opts.forceMono,
        monoMix: parseFloat(opts.monoMix),
      });

      const oscIndex = opts.slot ? parseInt(opts.slot, 10) - 1 : undefined;
      const assigned = library.addSample(sample, oscIndex);

      const outPath = opts.output || opts.library;
      writeLibrary(library, outPath);
      console.log(JSON.stringify({ success: true, osc_number: assigned + 1, converted_from_bits: convertedFrom, converted_to_mono: convertedToMono, output: path.resolve(outPath) }));
    });

  sample
    .command("export")
    .description("Export a sample as WAV")
    .argument("<path>", "Path to .all file")
    .argument("<osc_number>", "1-based OSC number")
    .argument("<output>", "Output WAV path")
    .option("--smpl-chunk", "Export smpl chunk (default)")
    .option("--no-smpl-chunk", "Skip smpl chunk")
    .option("--cue-chunk", "Export cue chunk (default)")
    .option("--no-cue-chunk", "Skip cue chunk")
    .action((filePath, oscStr, outputPath, opts) => {
      const oscNumber = parseInt(oscStr, 10);
      const { library } = readLibrary(filePath);
      const s = library.getByOscNumber(oscNumber);
      if (!s) exitError("SAMPLE_NOT_FOUND", `No sample at OSC ${oscNumber}`);
      exportToWav(s, outputPath, { exportSmplChunk: opts.smplChunk !== false, exportCueChunk: opts.cueChunk !== false });
      console.log(JSON.stringify({ success: true, osc_number: oscNumber, output: path.resolve(outputPath) }));
    });

  sample
    .command("delete")
    .description("Delete a sample from the library")
    .requiredOption("-L, --library <path>", "Path to .all file")
    .argument("<osc_number>", "1-based OSC number")
    .option("-o, --output <path>", "Output file")
    .option("--dry-run", "Preview without writing")
    .action((oscStr, opts) => {
      const oscNumber = parseInt(oscStr, 10);
      const { library } = readLibrary(opts.library);
      const s = library.getByOscNumber(oscNumber);
      if (!s) exitError("SAMPLE_NOT_FOUND", `No sample at OSC ${oscNumber}`);

      const name = s.esli.name;
      if (!opts.dryRun) {
        library.removeSample(oscNumber - 1);
        writeLibrary(library, opts.output || opts.library);
      }
      console.log(JSON.stringify({
        success: true,
        message: `${opts.dryRun ? "Would delete" : "Deleted"} sample ${oscNumber} ('${name}')`,
        dry_run: !!opts.dryRun,
      }));
    });

  sample
    .command("swap")
    .description("Swap two samples' positions")
    .requiredOption("-L, --library <path>", "Path to .all file")
    .argument("<osc_a>", "First OSC number")
    .argument("<osc_b>", "Second OSC number")
    .option("-o, --output <path>", "Output file")
    .action((oscAStr, oscBStr, opts) => {
      const oscA = parseInt(oscAStr, 10);
      const oscB = parseInt(oscBStr, 10);
      const { library } = readLibrary(opts.library);
      library.swapSamples(oscA - 1, oscB - 1);
      const outPath = opts.output || opts.library;
      writeLibrary(library, outPath);
      console.log(JSON.stringify({ success: true, swapped: [oscA, oscB], output: path.resolve(outPath) }));
    });

  sample
    .command("move")
    .description("Move a sample to a different slot")
    .requiredOption("-L, --library <path>", "Path to .all file")
    .argument("<osc_number>", "Current OSC number")
    .argument("<target>", "Target OSC number")
    .option("-o, --output <path>", "Output file")
    .option("--dry-run", "Preview without writing")
    .action((oscStr, targetStr, opts) => {
      const oscNumber = parseInt(oscStr, 10);
      const target = parseInt(targetStr, 10);
      const { library } = readLibrary(opts.library);
      const s = library.getByOscNumber(oscNumber);
      if (!s) exitError("SAMPLE_NOT_FOUND", `No sample at OSC ${oscNumber}`);

      s.esli.oscIndex = target - 1;
      s.esli.oscIndexMirror = target - 1;
      library.sort();

      if (!opts.dryRun) {
        writeLibrary(library, opts.output || opts.library);
      }
      console.log(JSON.stringify({ success: true, message: `Moved sample from OSC ${oscNumber} to ${target}`, dry_run: !!opts.dryRun }));
    });

  sample
    .command("trim")
    .description("Trim a sample to the specified range")
    .requiredOption("-L, --library <path>", "Path to .all file")
    .argument("<osc_number>", "1-based OSC number")
    .option("--start <frame>", "Start frame", "0")
    .requiredOption("--end <frame>", "End frame")
    .option("-o, --output <path>", "Output file")
    .action((oscStr, opts) => {
      const oscNumber = parseInt(oscStr, 10);
      const start = parseInt(opts.start, 10);
      const end = parseInt(opts.end, 10);
      const { library } = readLibrary(opts.library);
      const s = library.getByOscNumber(oscNumber);
      if (!s) exitError("SAMPLE_NOT_FOUND", `No sample at OSC ${oscNumber}`);
      trimSample(s, start, end);
      writeLibrary(library, opts.output || opts.library);
      console.log(JSON.stringify({ success: true, osc_number: oscNumber, trimmed_to: [start, end] }));
    });

  sample
    .command("to-mono")
    .description("Convert a stereo sample to mono")
    .requiredOption("-L, --library <path>", "Path to .all file")
    .argument("<osc_number>", "1-based OSC number")
    .option("--mix <val>", "Pan: -1=L, 0=C, 1=R", "0")
    .option("-o, --output <path>", "Output file")
    .action((oscStr, opts) => {
      const oscNumber = parseInt(oscStr, 10);
      const { library } = readLibrary(opts.library);
      const s = library.getByOscNumber(oscNumber);
      if (!s) exitError("SAMPLE_NOT_FOUND", `No sample at OSC ${oscNumber}`);
      stereoToMono(s, parseFloat(opts.mix));
      writeLibrary(library, opts.output || opts.library);
      console.log(JSON.stringify({ success: true, osc_number: oscNumber, converted_to_mono: true }));
    });

  sample
    .command("replace")
    .description("Replace a sample's audio data with a new WAV file")
    .requiredOption("-L, --library <path>", "Path to .all file")
    .argument("<osc_number>", "1-based OSC number")
    .argument("<wav_path>", "New WAV file")
    .option("-o, --output <path>", "Output file")
    .action((oscStr, wavPath, opts) => {
      const oscNumber = parseInt(oscStr, 10);
      const { library } = readLibrary(opts.library);
      const old = library.getByOscNumber(oscNumber);
      if (!old) exitError("SAMPLE_NOT_FOUND", `No sample at OSC ${oscNumber}`);

      const { sample: newSample } = importFromWav(wavPath);
      newSample.esli.oscIndex = old.esli.oscIndex;
      newSample.esli.oscIndexMirror = old.esli.oscIndexMirror;
      library.samples = library.samples.filter((s) => s.esli.oscIndex !== old.esli.oscIndex);
      library.samples.push(newSample);
      library.sort();

      writeLibrary(library, opts.output || opts.library);
      console.log(JSON.stringify({ success: true, osc_number: oscNumber, output: path.resolve(opts.output || opts.library) }));
    });
}
