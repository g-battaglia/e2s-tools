#!/usr/bin/env node
import { Command } from "commander";
import { registerLibraryCommands } from "./commands/library.js";
import { registerSampleCommands } from "./commands/sample.js";
import { registerSliceCommands } from "./commands/slice.js";
import { registerBatchCommands } from "./commands/batch.js";
import { registerPatternCommands } from "./commands/pattern.js";

const program = new Command();
program
  .name("e2s")
  .description("Manage Korg Electribe 2 Sampler sound libraries and patterns.")
  .version("1.0.0");

registerLibraryCommands(program);
registerSampleCommands(program);
registerSliceCommands(program);
registerBatchCommands(program);
registerPatternCommands(program);

program.parse();
