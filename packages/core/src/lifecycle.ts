/**
 * @file LifecycleEngine — server-side lifecycle hook evaluation.
 *
 * The engine loads a LifecycleManifest (JSON registry of addresses) and a
 * Resolver, then evaluates before/during/after hooks for each registered
 * lifecycle address.
 *
 * All real enforcement happens here on the server. The browser may hold
 * UI hints sourced from the same lifecycle rules, but the engine is the
 * authoritative gate.
 *
 * @module @hyperflux/core/lifecycle
 * @since 0.2.0
 */

import { Resolver, RequestContext } from "./resolver";

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

export interface LifecycleStageConfig {
  externalizable: boolean;
  rules: string[];
  retry_policy?: "none" | "exponential";
}

export interface LifecycleAddressConfig {
  before: LifecycleStageConfig;
  during: LifecycleStageConfig;
  after: LifecycleStageConfig;
}

export interface LifecycleManifest {
  version: string;
  namespace: string;
  addresses: Record<string, LifecycleAddressConfig>;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface AuditEntry {
  address: string;
  stage: "before" | "during" | "after";
  timestamp: string;
  inputs: Record<string, unknown>;
  result: unknown;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Explain / dry-run
// ---------------------------------------------------------------------------

export interface ExplainResult {
  address: string;
  stage: "before" | "during" | "after";
  wouldBlock: boolean;
  blockReason?: string;
  blockingRule?: string;
  rulesEvaluated: Array<{ path: string; output: unknown }>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class LifecycleBlockedError extends Error {
  constructor(
    public readonly address: string,
    public readonly stage: "before",
    public readonly reason: string,
    public readonly blockingRule: string
  ) {
    super(`[lifecycle] blocked at "${address}" before: ${reason}`);
    this.name = "LifecycleBlockedError";
  }
}

export class UnknownLifecycleAddressError extends Error {
  constructor(public readonly address: string) {
    super(
      `[lifecycle] unknown address "${address}" — register it in lifecycle/manifest.json`
    );
    this.name = "UnknownLifecycleAddressError";
  }
}

export class ProtectedLifecycleStageError extends Error {
  constructor(
    public readonly address: string,
    public readonly stage: string
  ) {
    super(
      `[lifecycle] stage "${stage}" at "${address}" is protected and cannot be externalized`
    );
    this.name = "ProtectedLifecycleStageError";
  }
}

// ---------------------------------------------------------------------------
// LifecycleEngine
// ---------------------------------------------------------------------------

type Stage = "before" | "during" | "after";

export class LifecycleEngine {
  constructor(
    private readonly manifest: LifecycleManifest,
    private readonly resolver: Resolver,
    private readonly auditWriter?: (
      entry: AuditEntry
    ) => void | Promise<void>
  ) {}

  /**
   * Run a lifecycle stage for the given address.
   *
   * - `before`: evaluates guard rules; throws `LifecycleBlockedError` on block.
   * - `during`: protected no-op; returns inputs unchanged.
   * - `after`: evaluates event rules; results are captured in the audit entry.
   */
  async run(
    address: string,
    stage: Stage,
    inputs: Record<string, unknown>
  ): Promise<unknown> {
    const config = this.manifest.addresses[address];
    if (!config) throw new UnknownLifecycleAddressError(address);

    const t0 = Date.now();
    let result: unknown;

    if (stage === "during") {
      result = inputs;
    } else if (stage === "before") {
      result = await this._runBefore(address, config.before, inputs);
    } else {
      result = await this._runAfter(config.after, inputs);
    }

    await this.auditWriter?.({
      address,
      stage,
      timestamp: new Date().toISOString(),
      inputs,
      result,
      durationMs: Date.now() - t0,
    });

    return result;
  }

  /**
   * Dry-run a lifecycle stage: returns what would happen without executing it.
   */
  explain(
    address: string,
    stage: Stage,
    inputs: Record<string, unknown>
  ): ExplainResult {
    const config = this.manifest.addresses[address];
    if (!config) throw new UnknownLifecycleAddressError(address);

    const stageConfig = config[stage];
    const rulesEvaluated: ExplainResult["rulesEvaluated"] = [];
    let wouldBlock = false;
    let blockReason: string | undefined;
    let blockingRule: string | undefined;

    for (const rulePath of stageConfig.rules) {
      const ctx = new RequestContext();
      try {
        const output = this.resolver.evaluate<Record<string, unknown>>(
          rulePath,
          inputs,
          ctx
        );
        rulesEvaluated.push({ path: rulePath, output });
        if (
          stage === "before" &&
          output?.["blocked"] === true &&
          !wouldBlock
        ) {
          wouldBlock = true;
          blockReason =
            typeof output["reason"] === "string" ? output["reason"] : undefined;
          blockingRule = rulePath;
        }
      } catch (err) {
        rulesEvaluated.push({
          path: rulePath,
          output: { error: String(err) },
        });
      }
    }

    return {
      address,
      stage,
      wouldBlock,
      blockReason,
      blockingRule,
      rulesEvaluated,
    };
  }

  private async _runBefore(
    address: string,
    config: LifecycleStageConfig,
    inputs: Record<string, unknown>
  ): Promise<void> {
    for (const rulePath of config.rules) {
      const ctx = new RequestContext();
      const output = this.resolver.evaluate<Record<string, unknown>>(
        rulePath,
        inputs,
        ctx
      );
      if (output?.["blocked"] === true) {
        const reason =
          typeof output["reason"] === "string"
            ? output["reason"]
            : "blocked by lifecycle rule";
        throw new LifecycleBlockedError(address, "before", reason, rulePath);
      }
    }
  }

  private async _runAfter(
    config: LifecycleStageConfig,
    inputs: Record<string, unknown>
  ): Promise<unknown[]> {
    const results: unknown[] = [];
    for (const rulePath of config.rules) {
      const ctx = new RequestContext();
      results.push(this.resolver.evaluate(rulePath, inputs, ctx));
    }
    return results;
  }
}
