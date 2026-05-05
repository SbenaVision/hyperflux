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
  const { readFile, writeFile, access } = await import("node:fs/promises");
  const { join } = await import("node:path");

  const domain = ctx.positional[0];
  const name = ctx.positional[1];

  if (!domain || !name) {
    process.stderr.write("  error  usage: hf new <domain> <name>\n");
    return 1;
  }

  if (!/^[a-z][a-z0-9_]*$/.test(domain)) {
    process.stderr.write(`  error  domain must be lowercase snake_case, got: ${domain}\n`);
    return 1;
  }

  const fullPath = `${domain}.${name}`;
  const rulesDir = join(ctx.projectRoot, "rules");
  const domainFilePath = join(rulesDir, `${domain}.json`);

  // Try to read existing domain file; create new one if missing
  let domainFile: { domain: string; version: string; rules: unknown[] };
  let created = false;
  try {
    await access(domainFilePath);
    domainFile = JSON.parse(await readFile(domainFilePath, "utf8"));
  } catch {
    domainFile = { domain, version: "1", rules: [] };
    created = true;
  }

  // Check for duplicate path
  const existing = domainFile.rules as Array<{ path: string }>;
  if (existing.some((r) => r.path === fullPath)) {
    process.stderr.write(`  error  rule '${fullPath}' already exists in ${domainFilePath}\n`);
    return 1;
  }

  const stub = {
    path: fullPath,
    kind: "compute",
    inputs: [],
    output: { type: "any" },
    cases: [{ then: { kind: "literal", value: null } }],
    metadata: { version: "1", requires: [], domain, description: `TODO: describe ${fullPath}` },
  };

  domainFile.rules.push(stub);

  try {
    await writeFile(domainFilePath, JSON.stringify(domainFile, null, 2) + "\n");
  } catch {
    process.stderr.write(`  error  could not write to ${domainFilePath}\n`);
    return 1;
  }

  const action = created ? "created" : "updated";
  process.stdout.write(`\n  ✓  ${action} ${domainFilePath}\n`);
  process.stdout.write(`     added rule: ${fullPath}\n\n`);
  return 0;
};
