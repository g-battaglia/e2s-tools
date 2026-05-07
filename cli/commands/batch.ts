import { Command } from "commander";
import * as path from "node:path";
import * as fs from "node:fs";
import { readLibrary } from "../../src/io/reader.js";
import { writeLibrary } from "../../src/io/writer.js";
import { importFromWav } from "../../src/operations/import.js";
import { exportToWav } from "../../src/operations/export.js";
import { SampleLibrary } from "../../src/models/library.js";

export function registerBatchCommands(parent: Command): void {
  const batch = parent.command("batch").description("Batch operations");

  batch
    .command("import")
    .description("Import all WAV files from a directory")
    .requiredOption("-L, --library <path>", "Path to .all file")
    .argument("<wav_dir>", "Directory of WAV files")
    .option("-c, --category <cat>", "Category for all imports", "User")
    .option("--pattern <glob>", "Glob pattern for WAV files", "*.wav")
    .option("--start-from <num>", "Starting OSC number", "19")
    .option("--force-mono", "Convert to mono")
    .option("--dry-run", "Preview without writing")
    .option("-o, --output <path>", "Output file")
    .action((wavDir, opts) => {
      const { library } = readLibrary(opts.library);
      const startFrom = parseInt(opts.startFrom, 10);
      const globPattern = (opts.pattern as string) || "*.wav";
      const ext = globPattern.replace("*", "").toLowerCase();
      const dir = fs.readdirSync(wavDir)
        .filter((f) => f.toLowerCase().endsWith(ext))
        .sort();
      const results: Record<string, unknown>[] = [];

      for (const fileName of dir) {
        const fullPath = path.join(wavDir, fileName);
        try {
          const { sample } = importFromWav(fullPath, {
            category: opts.category || "User",
            forceMono: !!opts.forceMono,
          });
          const oscIndex = library.nextFreeIndex(startFrom - 1);
          if (oscIndex === null) {
            results.push({ file: fileName, success: false, error: "NO_FREE_SLOT" });
            continue;
          }
          library.addSample(sample, oscIndex);
          results.push({ file: fileName, success: true, osc_number: oscIndex + 1 });
        } catch (e: unknown) {
          results.push({ file: fileName, success: false, error: e instanceof Error ? e.message : String(e) });
        }
      }

      if (!opts.dryRun) {
        writeLibrary(library, opts.output || opts.library);
      }
      console.log(JSON.stringify({
        total: dir.length,
        imported: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        dry_run: !!opts.dryRun,
        results,
      }));
    });

  batch
    .command("export")
    .description("Export all samples as WAV files")
    .argument("<path>", "Path to .all file")
    .argument("<output_dir>", "Output directory")
    .option("--smpl-chunk", "Export smpl chunk (default)")
    .option("--no-smpl-chunk", "Skip smpl chunk")
    .option("--cue-chunk", "Export cue chunk (default)")
    .option("--no-cue-chunk", "Skip cue chunk")
    .action((filePath, outputDir, opts) => {
      const { library } = readLibrary(filePath);
      fs.mkdirSync(outputDir, { recursive: true });
      const results: Record<string, unknown>[] = [];

      for (const s of library.samples) {
        const esli = s.esli;
        const filename = `${String(esli.oscNumber).padStart(3, "0")}_${esli.name || "untitled"}.wav`;
        const outPath = path.join(outputDir, filename);
        try {
          exportToWav(s, outPath, { exportSmplChunk: opts.smplChunk !== false, exportCueChunk: opts.cueChunk !== false });
          results.push({ osc_number: esli.oscNumber, file: outPath, success: true });
        } catch (e: unknown) {
          results.push({ osc_number: esli.oscNumber, success: false, error: e instanceof Error ? e.message : String(e) });
        }
      }

      console.log(JSON.stringify({
        total: library.samples.length,
        exported: results.filter((r) => r.success).length,
        results,
      }));
    });

  batch
    .command("compact")
    .description("Renumber samples to remove gaps")
    .requiredOption("-L, --library <path>", "Path to .all file")
    .option("--start-from <num>", "First OSC number", "19")
    .option("--dry-run", "Preview without writing")
    .option("-o, --output <path>", "Output file")
    .action((opts) => {
      const { library } = readLibrary(opts.library);
      const startFrom = parseInt(opts.startFrom, 10);
      const moves: Record<string, number>[] = [];
      let nextIndex = startFrom - 1;

      for (const sample of library.samples) {
        const oldIndex = sample.esli.oscIndex;
        if (oldIndex !== nextIndex) {
          moves.push({ from: oldIndex + 1, to: nextIndex + 1 });
        }
        sample.esli.oscIndex = nextIndex;
        sample.esli.oscIndexMirror = nextIndex;
        nextIndex++;
        while (!SampleLibrary.isValidOscIndex(nextIndex)) {
          nextIndex++;
        }
      }

      if (!opts.dryRun) {
        writeLibrary(library, opts.output || opts.library);
      }
      console.log(JSON.stringify({
        success: true,
        moves,
        dry_run: !!opts.dryRun,
        message: `Compacted ${library.samples.length} samples starting from OSC ${startFrom}`,
      }));
    });
}
