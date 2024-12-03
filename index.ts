#!/usr/bin/env node
// src/cli.ts

import { Command } from "commander";
import { checkFileLengths } from "./checkFileLengths";
import pkg from "./package.json";
import { stat, readdir, readFile } from "fs/promises";

const program = new Command();

program
  .name("crufty")
  .description("Check for files exceeding line count thresholds")
  .version(pkg.version)
  .argument(
    "[patterns...]",
    "File patterns or paths to check (defaults to current directory)"
  )
  .option("-t, --threshold <number>", "Line count threshold", "100")
  .option("-w, --warn", "Warn instead of throwing error", false)
  .option("--no-gitignore", "Disable gitignore patterns")
  .option("-s, --silent", "Suppress all output except errors", false)
  .option(
    "-i, --ignore <patterns>",
    "Additional patterns to ignore (comma-separated)",
    ""
  )
  .action(async (filePaths, options) => {
    try {
      const result = await checkFileLengths(
        { stat, readdir, readFile },
        filePaths,
        {
          threshold: parseInt(options.threshold),
          throwOnFound: !options.warn,
          useGitignore: options.gitignore,
          silent: options.silent,
          ignore: options.ignore,
        }
      );

      process.exit(result.length > 0 && !options.warn ? 1 : 0);
    } catch (error: any) {
      console.error(error.message);
      process.exit(1);
    }
  });

program.parse();
