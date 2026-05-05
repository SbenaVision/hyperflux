/**
 * @file `hf init` — scaffolds a new HyperFlux project.
 *
 * Generates a starter project structure in the current directory (or a named
 * subdirectory): `rules/`, `hyperflux.config.ts`, `.hyperfluxrc.json`,
 * `CLAUDE.md`, and a starter domain file. Templates are read from the
 * `templates/` directory bundled with `@hyperflux/cli`.
 *
 * @module @hyperflux/cli/commands/init
 * @since 0.1.0
 */

import type { CliContext, CommandRunner } from "../types";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Options parsed from the `hf init` CLI invocation.
 *
 * @since 0.1.0
 * @public
 */
export interface InitOptions {
  /**
   * Target directory for the new project.
   * Defaults to the current working directory.
   */
  directory: string;

  /**
   * When `true`, overwrites existing files without prompting.
   * Corresponds to `--force`.
   * @defaultValue `false`
   */
  force: boolean;

  /**
   * Starter domain name used to create `rules/<domain>.json`.
   * @defaultValue `"app"`
   */
  domain: string;
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/**
 * Structured result returned by `runInit`.
 *
 * @since 0.1.0
 * @public
 */
export interface InitResult {
  /** `0` on success; `1` on failure. */
  exitCode: 0 | 1;

  /** Absolute paths of all files written. */
  filesWritten: string[];

  /** Absolute paths of files that were skipped because they already existed
   * and `--force` was not set. */
  filesSkipped: string[];
}

// ---------------------------------------------------------------------------
// Command runner
// ---------------------------------------------------------------------------

/**
 * Implements the `hf init` command.
 *
 * Reads scaffolding templates from `templates/` (bundled with `@hyperflux/cli`),
 * substitutes project-specific values (domain name, package manager), and
 * writes the resulting files to the target directory. The list of templates
 * and substitution rules are defined in `templates/` and driven by
 * `defaults/cli-commands.json`, not hardcoded here.
 *
 * @param ctx - The CLI context for this invocation.
 * @returns A promise resolving to the exit code: `0` on success, `1` on failure.
 * @throws {Error} If the target directory is not writable.
 * @since 0.1.0
 * @public
 *
 * @example
 * ```bash
 * hf init                  # scaffold in current directory
 * hf init --domain billing # scaffold with "billing" as the starter domain
 * hf init ./my-app --force # scaffold into ./my-app, overwriting existing files
 * ```
 *
 * @see {@link InitOptions}
 * @see {@link InitResult}
 */
export const run: CommandRunner = async function runInit(
  ctx: CliContext
): Promise<number> {
  throw new Error("Not implemented");
};
