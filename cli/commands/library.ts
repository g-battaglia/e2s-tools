import { Command } from "commander";
import * as path from "node:path";
import { readLibrary } from "../../src/io/reader.js";
import { writeLibrary } from "../../src/io/writer.js";
import { SampleLibrary } from "../../src/models/library.js";
import { render } from "../output.js";

export function registerLibraryCommands(parent: Command): void {
  const lib = parent.command("library").description("Manage sample libraries (.all files)");

  lib
    .command("info")
    .description("Show library summary")
    .argument("<path>", "Path to .all file")
    .option("-f, --format <fmt>", "Output format: json, table, text", "json")
    .action((filePath, opts) => {
      const { library, errors } = readLibrary(filePath);
      const categories: Record<string, number> = {};
      for (const s of library.samples) {
        const cat = s.esli.categoryDisplayName;
        categories[cat] = (categories[cat] || 0) + 1;
      }
      const totalDataSize = library.totalDataSize;
      const data = {
        file_path: path.resolve(filePath),
        total_samples: library.samples.length,
        total_data_size: totalDataSize,
        max_data_size: 26214396,
        usage_percent: Math.round((totalDataSize / 26214396) * 1000) / 10,
        free_slots: 1020 - library.samples.length,
        load_errors: errors,
        categories,
      };
      console.log(render(data, opts.format, path.basename(filePath)));
    });

  lib
    .command("validate")
    .description("Check library for errors and warnings")
    .argument("<path>", "Path to .all file")
    .option("-f, --format <fmt>", "Output format", "json")
    .action((filePath, opts) => {
      const { library, errors } = readLibrary(filePath);
      const warnings: string[] = [];
      const seenIndices = new Set<number>();
      for (const s of library.samples) {
        const esli = s.esli;
        if (seenIndices.has(esli.oscIndex)) {
          warnings.push(`Duplicate OSC index ${esli.oscIndex}`);
        }
        seenIndices.add(esli.oscIndex);
        if (esli.wavDataSize > 26214396) {
          warnings.push(`Sample at OSC ${esli.oscNumber} exceeds max data size`);
        }
      }
      const data = {
        valid: warnings.length === 0 && errors === 0,
        warnings,
        load_errors: errors,
      };
      console.log(render(data, opts.format));
    });

  lib
    .command("create")
    .description("Create an empty library file")
    .requiredOption("-o, --output <path>", "Output .all file path")
    .action((opts) => {
      const library = new SampleLibrary();
      writeLibrary(library, opts.output);
      console.log(JSON.stringify({ success: true, message: `Created empty library: ${opts.output}` }));
    });

  lib
    .command("free-slots")
    .description("List available OSC slot numbers")
    .argument("<path>", "Path to .all file")
    .option("--from <index>", "Start searching from this 0-based index", "18")
    .option("--count <n>", "Max slots to return", "20")
    .option("-f, --format <fmt>", "Output format", "json")
    .action((filePath, opts) => {
      const { library } = readLibrary(filePath);
      const fromIndex = parseInt(opts.from, 10);
      const count = parseInt(opts.count, 10);
      const used = new Set(library.samples.map((s) => s.esli.oscIndex));
      const free: number[] = [];
      for (let idx = fromIndex; idx < 1020; idx++) {
        if (!SampleLibrary.isValidOscIndex(idx)) continue;
        if (!used.has(idx)) {
          free.push(idx + 1);
          if (free.length >= count) break;
        }
      }
      console.log(render({ free_slots: free, count: free.length }, opts.format));
    });
}
