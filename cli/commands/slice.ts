import { Command } from "commander";
import { readLibrary } from "../../src/io/reader.js";
import { writeLibrary } from "../../src/io/writer.js";
import { render } from "../output.js";

function exitError(code: string, message: string): never {
  console.log(JSON.stringify({ success: false, error: code, message }));
  process.exit(1);
}

export function registerSliceCommands(parent: Command): void {
  const slice = parent.command("slice").description("Manage sample slices");

  slice
    .command("list")
    .description("List slices for a sample")
    .argument("<path>", "Path to .all file")
    .argument("<osc_number>", "1-based OSC number")
    .option("-a, --active-only", "Show only active slices")
    .option("-f, --format <fmt>", "Output format", "json")
    .action((filePath, oscStr, opts) => {
      const oscNumber = parseInt(oscStr, 10);
      const { library } = readLibrary(filePath);
      const s = library.getByOscNumber(oscNumber);
      if (!s) exitError("SAMPLE_NOT_FOUND", `No sample at OSC ${oscNumber}`);

      const slices = s.esli.slices
        .map((sl, i) => ({ index: i, start: sl.start, length: sl.length, attack_length: sl.attackLength, amplitude: sl.amplitude }))
        .filter((sl) => !opts.activeOnly || sl.length > 0);

      console.log(render({ osc_number: oscNumber, count: slices.length, slices }, opts.format));
    });

  slice
    .command("get")
    .description("Get details for a specific slice")
    .argument("<path>", "Path to .all file")
    .argument("<osc_number>", "1-based OSC number")
    .argument("<slice_index>", "Slice index (0-63)")
    .option("-f, --format <fmt>", "Output format", "json")
    .action((filePath, oscStr, sliceIdxStr, opts) => {
      const oscNumber = parseInt(oscStr, 10);
      const sliceIndex = parseInt(sliceIdxStr, 10);
      const { library } = readLibrary(filePath);
      const s = library.getByOscNumber(oscNumber);
      if (!s) exitError("SAMPLE_NOT_FOUND", `No sample at OSC ${oscNumber}`);
      if (sliceIndex < 0 || sliceIndex >= 64) exitError("INVALID_SLICE_INDEX", "Must be 0-63");

      const sl = s.esli.slices[sliceIndex];
      console.log(render({
        osc_number: oscNumber,
        slice_index: sliceIndex,
        start: sl.start,
        length: sl.length,
        attack_length: sl.attackLength,
        amplitude: sl.amplitude,
      }, opts.format));
    });

  slice
    .command("set")
    .description("Edit a slice's properties")
    .requiredOption("-L, --library <path>", "Path to .all file")
    .argument("<osc_number>", "1-based OSC number")
    .argument("<slice_index>", "Slice index (0-63)")
    .option("--start <val>", "Start offset")
    .option("--length <val>", "Length")
    .option("--attack-length <val>", "Attack length")
    .option("--amplitude <val>", "Amplitude")
    .option("-o, --output <path>", "Output file")
    .action((oscStr, sliceIdxStr, opts) => {
      const oscNumber = parseInt(oscStr, 10);
      const sliceIndex = parseInt(sliceIdxStr, 10);
      const { library } = readLibrary(opts.library);
      const s = library.getByOscNumber(oscNumber);
      if (!s) exitError("SAMPLE_NOT_FOUND", `No sample at OSC ${oscNumber}`);
      if (sliceIndex < 0 || sliceIndex >= 64) exitError("INVALID_SLICE_INDEX", "Must be 0-63");

      const sl = s.esli.slices[sliceIndex];
      if (opts.start != null) sl.start = parseInt(opts.start, 10);
      if (opts.length != null) sl.length = parseInt(opts.length, 10);
      if (opts.attackLength != null) sl.attackLength = parseInt(opts.attackLength, 10);
      if (opts.amplitude != null) sl.amplitude = parseInt(opts.amplitude, 10);

      writeLibrary(library, opts.output || opts.library);
      console.log(JSON.stringify({ success: true, osc_number: oscNumber, slice_index: sliceIndex }));
    });

  slice
    .command("steps")
    .description("Get step sequencer state for a sample")
    .argument("<path>", "Path to .all file")
    .argument("<osc_number>", "1-based OSC number")
    .option("-f, --format <fmt>", "Output format", "json")
    .action((filePath, oscStr, opts) => {
      const oscNumber = parseInt(oscStr, 10);
      const { library } = readLibrary(filePath);
      const s = library.getByOscNumber(oscNumber);
      if (!s) exitError("SAMPLE_NOT_FOUND", `No sample at OSC ${oscNumber}`);

      const esli = s.esli;
      const data = {
        osc_number: oscNumber,
        slicing_num_steps: esli.slicingNumSteps,
        slicing_beat: esli.slicingBeatDisplayName,
        num_active_steps: esli.numActiveSteps,
        steps: esli.sliceActiveSteps.slice(0, esli.numActiveSteps || 0),
      };
      console.log(render(data, opts.format));
    });
}
