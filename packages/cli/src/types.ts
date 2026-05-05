/**
 * @file CLI infrastructure types.
 *
 * The `hf` CLI reads its command structure — names, aliases, descriptions,
 * options, and default values — from `defaults/cli-commands.json`. These
 * TypeScript types describe the shape of that JSON and the runtime interfaces
 * used by the CLI runner to dispatch to command handlers.
 *
 * Adding a new subcommand or flag means editing `defaults/cli-commands.json`,
 * not this file or any command handler source.
 *
 * @module @hyperflux/cli/types
 * @since 0.1.0
 */

// ---------------------------------------------------------------------------
// Command definition (loaded from defaults/cli-commands.json)
// ---------------------------------------------------------------------------

/**
 * A single option (flag) that a CLI command accepts.
 *
 * The shape mirrors how options are declared in `defaults/cli-commands.json`.
 * The CLI runner reads these at startup and builds the option parser from them.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const fixOption: CommandOption = {
 *   flag: "--fix",
 *   short: "-f",
 *   description: "Apply unambiguous fixes automatically.",
 *   type: "boolean",
 *   default: false,
 * };
 * ```
 */
export interface CommandOption {
  /** Long flag name including `--`, e.g. `"--fix"`. */
  flag: string;

  /** Optional short alias including `-`, e.g. `"-f"`. */
  short?: string;

  /** Human-readable description shown in `--help` output. */
  description: string;

  /** Value type parsed from the CLI argument. */
  type: "boolean" | "string" | "number";

  /**
   * Default value used when the option is not provided.
   * Must match `type`.
   */
  default?: boolean | string | number;

  /**
   * When `true`, the CLI will error if this option is not provided.
   * @defaultValue `false`
   */
  required?: boolean;
}

/**
 * A positional argument that a CLI command accepts.
 *
 * @since 0.1.0
 * @public
 */
export interface CommandArgument {
  /** Argument name shown in usage, e.g. `"domain"`. */
  name: string;

  /** Human-readable description shown in `--help` output. */
  description: string;

  /**
   * When `true`, the CLI will error if this argument is not provided.
   * @defaultValue `false`
   */
  required?: boolean;
}

/**
 * The definition of a CLI subcommand, loaded from `defaults/cli-commands.json`.
 *
 * The CLI runner matches the first CLI argument to `name` (or `aliases`),
 * then dispatches to the registered handler. All user-facing text (descriptions,
 * usage, help) comes from this object, not from handler source code.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const lintDef: CommandDefinition = {
 *   name: "lint",
 *   aliases: ["check"],
 *   description: "Run HyperFlux lint rules against source and rule files.",
 *   usage: "hf lint [options]",
 *   options: [fixOption, configOption],
 *   args: [],
 * };
 * ```
 */
export interface CommandDefinition {
  /** Primary command name, e.g. `"lint"`. */
  name: string;

  /** Optional aliases, e.g. `["check"]`. */
  aliases?: string[];

  /** One-line description shown in `hf --help`. */
  description: string;

  /** Full usage string shown in `hf <command> --help`. */
  usage: string;

  /** Options (flags) accepted by this command. */
  options: CommandOption[];

  /** Positional arguments accepted by this command. */
  args?: CommandArgument[];
}

// ---------------------------------------------------------------------------
// CLI context
// ---------------------------------------------------------------------------

/**
 * Runtime context passed to every command handler.
 *
 * Contains the project root, parsed options, and shared infrastructure.
 * Constructed once per CLI invocation and threaded through all handlers.
 *
 * @since 0.1.0
 * @public
 */
export interface CliContext {
  /**
   * Absolute path to the project root directory.
   * Determined by walking up from `process.cwd()` until `.hyperfluxrc.json`
   * or a HyperFlux `package.json` is found.
   */
  projectRoot: string;

  /**
   * Absolute path to the `.hyperfluxrc.json` file in use, or `null` if none
   * was found (commands that require it will error).
   */
  configPath: string | null;

  /**
   * The command definition that was matched (from `defaults/cli-commands.json`).
   */
  command: CommandDefinition;

  /**
   * Parsed option values from the CLI arguments, keyed by option `flag` name
   * without dashes (e.g. `"fix"` for `--fix`).
   */
  options: Record<string, boolean | string | number>;

  /**
   * Parsed positional arguments, in the order declared in `CommandDefinition.args`.
   */
  positional: string[];
}

// ---------------------------------------------------------------------------
// Command runner
// ---------------------------------------------------------------------------

/**
 * A function that implements a CLI subcommand.
 *
 * Each command module exports a `run` function matching this signature.
 * The CLI dispatches to it after populating `ctx` from the parsed arguments.
 *
 * @param ctx - The populated CLI context for this invocation.
 * @returns A promise that resolves to the exit code (0 for success, non-zero for error).
 * @since 0.1.0
 * @public
 *
 * @see {@link CliContext}
 */
export type CommandRunner = (ctx: CliContext) => Promise<number>;

/**
 * A registered CLI command: its definition paired with its runner function.
 *
 * The CLI entry point builds this map from `defaults/cli-commands.json`
 * (for definitions) and the static command module imports (for runners).
 *
 * @since 0.1.0
 * @public
 */
export interface RegisteredCommand {
  /** The command definition loaded from `defaults/cli-commands.json`. */
  definition: CommandDefinition;

  /** The handler that executes this command. */
  runner: CommandRunner;
}
