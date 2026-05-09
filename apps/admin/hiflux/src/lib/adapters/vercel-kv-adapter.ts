import type { RuntimeRule } from "../ruleStore";
import type { RuleOverrideStore } from "./override-store";

// @vercel/kv is sunset — use @upstash/redis (env: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
const KEY_PREFIX = "hf:rule:";
const INDEX_KEY = "hf:rules:index";

async function getRedis() {
  const { Redis } = await import("@upstash/redis");
  return Redis.fromEnv();
}

export class VercelKVAdapter implements RuleOverrideStore {
  async get(rulePath: string): Promise<RuntimeRule | undefined> {
    const redis = await getRedis();
    const rule = await redis.get<RuntimeRule>(`${KEY_PREFIX}${rulePath}`);
    return rule ?? undefined;
  }

  async set(rule: RuntimeRule): Promise<void> {
    const redis = await getRedis();
    await Promise.all([
      redis.set(`${KEY_PREFIX}${rule.path}`, rule),
      redis.sadd(INDEX_KEY, rule.path),
    ]);
  }

  async delete(rulePath: string): Promise<void> {
    const redis = await getRedis();
    await Promise.all([
      redis.del(`${KEY_PREFIX}${rulePath}`),
      redis.srem(INDEX_KEY, rulePath),
    ]);
  }

  async getAll(): Promise<RuntimeRule[]> {
    const redis = await getRedis();
    const paths = await redis.smembers<string[]>(INDEX_KEY);
    if (!paths || paths.length === 0) return [];
    const rules = await Promise.all(
      paths.map((p) => redis.get<RuntimeRule>(`${KEY_PREFIX}${p}`))
    );
    return rules.filter((r): r is RuntimeRule => r !== null && r !== undefined);
  }
}
