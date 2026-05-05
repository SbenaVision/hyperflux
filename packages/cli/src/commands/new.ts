/**
 * @file `hf new` — scaffolds a new rule using a template.
 *
 * Generates a new rule stub in the appropriate domain JSON file, using
 * `templates/rule-single.template` as the template. If the domain file does
 * not yet exist, it creates it using `templates/rule-domain.template`.
 *
 * Usage: `hf new <domain> <name>`
 *
 * @module @hyperflux/cli/commands/new
 * @since 0.1.0
 */

import type { CliContext, CommandRunner } from "../types";

// ---------------------------------------------------------------------------
// Options derived from CLI context
// ---------------------------------------------------------------------------

/**
 * Options parsed from the `hf new` CLI invocation.
 *
 * These are extracted from `ctx.positional` and `ctx.options` by `runNew`.
 *
 * @since 0.1.0
 * @public
 */
export interface NewOptions {
  /**
   * The domain segment for the new rule, e.g. `"pricing"`.
   * Must match `[a-z][a-z0-9_]*`.
   */
  domain: string;

  /**
   * The remaining path segments joined by dots, e.g. `"atm.fee"`.
   * Combined with `domain` to form the full path `"pricing.atm.fee"`.
   */
  name: string;

  /**
   * Rule kind for the generated stub.
   * @defaultValue `"compute"`
   */
  kind: "compute" | "config";
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/**
 * Structured result returned by `runNew`.
 *
 * @since 0.1.0
 * @public
 */
export interface NewResult {
  /** `0` on success; `1` on failure. */
  exitCode: 0 | 1;

  /** Absolute path to the domain JSON file that was created or modified. */
  domainFilePath: string;

  /** The full rule path that was added, e.g. `"pricing.atm.fee"`. */
  rulePath: string;

  /** `true` if the domain file was newly created; `false` if the rule was appended. */
  domainFileCreated: boolean;
}

// ---------------------------------------------------------------------------
// Command runner
// ---------------------------------------------------------------------------

/**
 * Implements the `hf new <domain> <name>` command.
 *
 * Reads the template from `templates/rule-single.template`, fills in the
 * domain, name, and kind, and writes the result to `rules/<domain>.json`.
 * Templates are read from disk, not hardcoded in this source.
 *
 * @param ctx - The CLI context for this invocation.
 * @returns A promise resolving to the exit code: `0` on success, `1` on failure.
 * @throws {Error} If `domain` or `name` are missing from `ctx.positional`.
 * @throws {Error} If the domain value violates the allowed pattern.
 * @since 0.1.0
 * @public
 *
 * @example
 * ```bash
 * hf new pricing atm.fee
 * # Creates: rules/pricing.json with path "pricing.atm.fee"
 * ```
 *
 * @see {@link NewOptions}
 * @see {@link NewResult}
 */
export const run: CommandRunner = async function runNew(
  ctx: CliContext
): Promise<number> {
  throw new Error("Not implemented");
};
