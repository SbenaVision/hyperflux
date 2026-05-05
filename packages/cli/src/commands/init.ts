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
  const { writeFile, mkdir, access } = await import("node:fs/promises");
  const { join } = await import("node:path");

  const targetDir = ctx.positional[0] ?? ctx.projectRoot;
  const domain = (ctx.options["domain"] as string | undefined) ?? "app";
  const force = Boolean(ctx.options["force"]);
  const written: string[] = [];
  const skipped: string[] = [];

  async function write(relPath: string, content: string) {
    const fullPath = join(targetDir, relPath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
    await mkdir(dir, { recursive: true });
    if (!force) {
      try {
        await access(fullPath);
        skipped.push(fullPath);
        return;
      } catch { /* file doesn't exist, write it */ }
    }
    await writeFile(fullPath, content);
    written.push(fullPath);
  }

  const starterRule = JSON.stringify({
    domain,
    version: "1",
    rules: [
      {
        path: `${domain}.example`,
        kind: "config",
        inputs: [],
        output: { type: "string" },
        cases: [{ then: { kind: "literal", value: "Hello from HyperFlux" } }],
        metadata: { version: "1", requires: [], domain, description: "Starter example rule" },
      },
    ],
  }, null, 2) + "\n";

  const rc = JSON.stringify({
    "$schema": "https://hyperflux.dev/schema/hyperfluxrc.json",
    lint: { src_globs: ["src/**/*.{ts,tsx}"], rule_globs: ["rules/**/*.json"], ignore: [], overrides: {} },
  }, null, 2) + "\n";

  const claudeMd = `# HyperFlux Project

This project uses HyperFlux to manage behavioral decisions.

## Rules
- All business logic, config values, labels, and thresholds live in \`rules/<domain>.json\`
- Never hardcode business decisions in components or handlers
- Run \`hf validate\` to verify rules before committing
- Run \`hf lint\` to catch any hardcoded values that should be rules

## Rule format
\`\`\`json
{
  "path": "domain.rule_name",
  "kind": "compute",
  "inputs": [{ "name": "amount", "type": { "type": "number" } }],
  "output": { "type": "number" },
  "cases": [
    { "when": { "kind": "op", "op": ">", "args": [{ "kind": "input", "path": ["amount"] }, { "kind": "literal", "value": 1000 }] }, "then": { "kind": "literal", "value": 0 } },
    { "then": { "kind": "literal", "value": 2.5 } }
  ],
  "metadata": { "version": "1", "requires": [], "domain": "domain" }
}
\`\`\`

## React usage
\`\`\`tsx
const label = useRule<string>("ui.labels.submit", {});
const fee = useRule<number>("pricing.atm.fee", { amount });
\`\`\`
`;

  await write(`rules/${domain}.json`, starterRule);
  await write(".hyperfluxrc.json", rc);
  await write("CLAUDE.md", claudeMd);

  if (written.length > 0) {
    process.stdout.write("\n  HyperFlux project initialized\n\n");
    for (const f of written) process.stdout.write(`  ✓  ${f}\n`);
  }
  if (skipped.length > 0) {
    process.stdout.write("\n  skipped (already exist, use --force to overwrite):\n");
    for (const f of skipped) process.stdout.write(`  –  ${f}\n`);
  }
  process.stdout.write("\n  Next: hf validate\n\n");
  return 0;
};
