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

import type { CommandDefinition, RegisteredCommand, CliContext } from "./types";
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
  throw new Error("Not implemented");
}

/**
 * Resolves the project root directory by walking upward from `startDir`
 * until a `.hyperfluxrc.json` file or a `package.json` with a HyperFlux
 * dependency is found.
 *
 * @param startDir - Directory to start searching from. Defaults to `process.cwd()`.
 * @returns Absolute path to the project root, or `null` if not found.
 * @since 0.1.0
 * @internal
 */
export function findProjectRoot(startDir?: string): string | null {
  throw new Error("Not implemented");
}

/**
 * Builds a `CliContext` from parsed CLI arguments and the detected project root.
 *
 * @param command - The matched command definition.
 * @param argv - Remaining CLI arguments after the command name, e.g. `["--fix"]`.
 * @param projectRoot - Absolute path to the project root.
 * @param configPath - Absolute path to the `.hyperfluxrc.json` file, or `null`.
 * @returns A populated `CliContext` ready to pass to a command runner.
 * @throws {Error} If a required option or argument is missing.
 * @since 0.1.0
 * @internal
 */
export function buildCliContext(
  command: CommandDefinition,
  argv: string[],
  projectRoot: string,
  configPath: string | null
): CliContext {
  throw new Error("Not implemented");
}

/**
 * Main CLI entry point.
 *
 * Parses `process.argv`, locates the project root, dispatches to the matched
 * command runner, and calls `process.exit()` with the returned exit code.
 * Errors thrown by runners are caught and printed to stderr before exiting 1.
 *
 * @returns A promise that resolves when the CLI command completes.
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * // Only invoked when run as a script:
 * if (require.main === module) main();
 * ```
 */
export async function main(): Promise<void> {
  throw new Error("Not implemented");
}
