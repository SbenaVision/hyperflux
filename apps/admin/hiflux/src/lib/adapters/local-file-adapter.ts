import fs from "node:fs";
import path from "node:path";
import type { RuntimeRule } from "../ruleStore";
import type { RuleOverrideStore } from "./override-store";

const OVERRIDES_FILE = path.join(process.cwd(), "data", "overrides.json");

export class LocalFileAdapter implements RuleOverrideStore {
  private readAll(): RuntimeRule[] {
    try {
      if (!fs.existsSync(OVERRIDES_FILE)) return [];
      return JSON.parse(fs.readFileSync(OVERRIDES_FILE, "utf-8")) as RuntimeRule[];
    } catch {
      return [];
    }
  }

  private writeAll(rules: RuntimeRule[]): void {
    const dir = path.dirname(OVERRIDES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(rules, null, 2));
  }

  async get(rulePath: string): Promise<RuntimeRule | undefined> {
    return this.readAll().find((r) => r.path === rulePath);
  }

  async set(rule: RuntimeRule): Promise<void> {
    const all = this.readAll().filter((r) => r.path !== rule.path);
    this.writeAll([...all, rule]);
  }

  async delete(rulePath: string): Promise<void> {
    this.writeAll(this.readAll().filter((r) => r.path !== rulePath));
  }

  async getAll(): Promise<RuntimeRule[]> {
    return this.readAll();
  }
}
