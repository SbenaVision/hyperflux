#!/usr/bin/env node
/**
 * @file CLI entry point for the `hf` command.
 *
 * Bootstraps the CLI by loading command definitions from
 * `defaults/cli-commands.json`, registering command runners, parsing
 * `process.argv`, resolving the project root, and dispatching to the
 * appropriate handler.
 *
 * The CLI source contains **only** dispatch and I/O logic. All command names,
 * aliases, descriptions, option flags, and default values come from
 * `defaults/cli-commands.json` (REQ-605). Adding a new command requires
 * editing that file and adding a runner — not modifying this file.
 *
 * @module @hyperflux/cli
 * @since 0.1.0
 */

import type { CommandDefinition, RegisteredCommand, CliContext, CommandRunner } from "./types";
import { run as runValidate } from "./commands/validate";
import { run as runTest } from "./commands/test";
import { run as runNew } from "./commands/new";
import { run as runLint } from "./commands/lint";
import { run as runTrace } from "./commands/trace";
import { run as runInit } from "./commands/init";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type {
  CommandDefinition,
  CommandOption,
  CommandArgument,
  RegisteredCommand,
  CliContext,
  CommandRunner,
} from "./types";

// Re-export command option types for programmatic CLI use
export type { ValidateResult } from "./commands/validate";
export type { TestResult } from "./commands/test";
export type { NewOptions, NewResult } from "./commands/new";
export type { LintCliOptions, LintCliResult } from "./commands/lint";
export type { TraceCliOptions } from "./commands/trace";
export { buildFormatOptions } from "./commands/trace";
export type { InitOptions, InitResult } from "./commands/init";

// ---------------------------------------------------------------------------
// CLI bootstrap
// ---------------------------------------------------------------------------

/**
 * Loads all command definitions from `defaults/cli-commands.json` and returns
 * the registered command map.
 *
 * This function is called once at CLI startup. It is separate from `main` to
 * allow testing the registration logic in isolation.
 *
 * @returns An array of registered commands (definition + runner pairs).
 * @throws {Error} If `defaults/cli-commands.json` cannot be read or is malformed.
 * @since 0.1.0
 * @internal
 */
export function buildCommandRegistry(): RegisteredCommand[] {
  const { readFileSync } = require("node:fs");
  const { join } = require("node:path");

  const defaultsDir = join(__dirname, "..", "..", "..", "defaults");
  const raw = JSON.parse(readFileSync(join(defaultsDir, "cli-commands.json"), "utf8"));
  const defs: CommandDefinition[] = raw.commands;

  const runnerMap: Record<string, CommandRunner> = {
    validate: runValidate,
    test: runTest,
    new: runNew,
    lint: runLint,
    trace: runTrace,
    init: runInit,
  };

  return defs.map((def) => ({
    definition: def,
    runner: runnerMap[def.name] ?? (async () => { process.stderr.write(`  error  no runner for command '${def.name}'\n`); return 1; }),
  }));
}

export function findProjectRoot(startDir?: string): string | null {
  const { existsSync } = require("node:fs");
  const { join, dirname } = require("node:path");
  let dir = startDir ?? process.cwd();
  while (true) {
    if (existsSync(join(dir, ".hyperfluxrc.json"))) return dir;
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function buildCliContext(
  command: CommandDefinition,
  argv: string[],
  projectRoot: string,
  configPath: string | null
): CliContext {
  const options: Record<string, boolean | string | number> = {};
  const positional: string[] = [];

  // Set defaults
  for (const opt of command.options) {
    const key = opt.flag.replace(/^--/, "");
    if (opt.default !== undefined) options[key] = opt.default;
  }

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const optDef = command.options.find((o) => o.flag === arg || o.flag === `--${key}`);
      if (optDef && optDef.type === "boolean") {
        options[key] = true;
        i++;
      } else if (optDef && i + 1 < argv.length) {
        const raw = argv[i + 1];
        options[key] = optDef.type === "number" ? Number(raw) : raw;
        i += 2;
      } else {
        options[key] = true;
        i++;
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      const optDef = command.options.find((o) => o.short === arg);
      if (optDef) {
        const key = optDef.flag.replace(/^--/, "");
        options[key] = optDef.type === "boolean" ? true : argv[++i] ?? "";
      }
      i++;
    } else {
      positional.push(arg);
      i++;
    }
  }

  return { projectRoot, configPath, command, options, positional };
}

export async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    printHelp();
    process.exit(0);
  }

  let registry: RegisteredCommand[];
  try {
    registry = buildCommandRegistry();
  } catch (err) {
    process.stderr.write(`  error  failed to load command registry: ${String(err)}\n`);
    process.exit(1);
  }

  const commandName = argv[0];
  const matched = registry.find(
    (r) => r.definition.name === commandName || (r.definition.aliases ?? []).includes(commandName)
  );

  if (!matched) {
    process.stderr.write(`  error  unknown command: '${commandName}'\n`);
    process.stderr.write(`  run 'hf --help' for available commands\n`);
    process.exit(1);
  }

  const projectRoot = findProjectRoot() ?? process.cwd();
  const { existsSync } = require("node:fs");
  const { join } = require("node:path");
  const configCandidate = join(projectRoot, ".hyperfluxrc.json");
  const configPath = existsSync(configCandidate) ? configCandidate : null;

  const ctx = buildCliContext(matched.definition, argv.slice(1), projectRoot, configPath);

  try {
    const exitCode = await matched.runner(ctx);
    process.exit(exitCode);
  } catch (err) {
    process.stderr.write(`  error  ${String(err)}\n`);
    process.exit(1);
  }
}

function printHelp() {
  process.stdout.write("\n  hf — HyperFlux CLI\n\n");
  process.stdout.write("  Commands:\n");
  process.stdout.write("    validate   Validate all rule files\n");
  process.stdout.write("    lint       Enforce HyperFlux discipline\n");
  process.stdout.write("    test       Run snapshot tests for rules\n");
  process.stdout.write("    trace      Render a saved evaluation trace\n");
  process.stdout.write("    new        Scaffold a new rule stub\n");
  process.stdout.write("    init       Scaffold a new HyperFlux project\n");
  process.stdout.write("\n  Run 'hf <command> --help' for details.\n\n");
}

// Invoke main when run as a script
main();
