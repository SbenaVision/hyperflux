import type { RuleOverrideStore } from "./override-store";

let _store: RuleOverrideStore | null = null;

export function getOverrideStore(): RuleOverrideStore {
  if (_store) return _store;

  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    const { VercelKVAdapter } = require("./vercel-kv-adapter") as typeof import("./vercel-kv-adapter");
    _store = new VercelKVAdapter();
  } else {
    const { LocalFileAdapter } = require("./local-file-adapter") as typeof import("./local-file-adapter");
    _store = new LocalFileAdapter();
  }

  return _store;
}

export type { RuleOverrideStore } from "./override-store";
