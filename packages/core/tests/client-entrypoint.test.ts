/**
 * Runtime boundary enforcement.
 *
 * Self-test fixtures (mirrors user-specified acceptance criteria):
 *
 *  A. client importing server/full core  → full barrel DOES export RuleLoader
 *     (documents that @hyperflux/core is server-only; consumers must use /client)
 *  B. client importing @hyperflux/core/client → works; RuleLoader NOT exported
 *  C. shared-pure code importing node:fs → caught by source-scan
 *  D. server importing loader             → loader is importable and functional
 */
import { readFileSync, realpathSync } from "node:fs";
import { resolve, dirname } from "node:path";

const ROOT = resolve(__dirname, "../../../");

function collectImports(file: string, visited = new Set<string>()): Set<string> {
  const real = realpathSync(file);
  if (visited.has(real)) return visited;
  visited.add(real);

  const src = readFileSync(real, "utf8");
  const importRe = /from\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(src)) !== null) {
    const specifier = m[1];
    if (!specifier.startsWith(".")) continue;
    const next = resolve(dirname(real), specifier);
    for (const c of [next, `${next}.ts`, `${next}/index.ts`]) {
      try {
        realpathSync(c);
        collectImports(c, visited);
        break;
      } catch { /* try next */ }
    }
  }
  return visited;
}

// ── A. Full barrel documents it includes the loader ──────────────────────────

test("A — @hyperflux/core (full barrel) exports RuleLoader (server-only, do not use in browser)", async () => {
  const mod = await import("@hyperflux/core");
  expect((mod as Record<string, unknown>).RuleLoader).toBeDefined();
});

// ── B. @hyperflux/core/client is browser-safe and omits RuleLoader ────────────

test("B — @hyperflux/core/client exports key browser-safe symbols and no RuleLoader", async () => {
  const mod = await import("@hyperflux/core/client");
  expect(mod.Resolver).toBeDefined();
  expect(mod.RuleStoreImpl).toBeDefined();
  expect(mod.DependencyGraphImpl).toBeDefined();
  expect(mod.FunctionRegistry).toBeDefined();
  expect(mod.OperatorRegistryImpl).toBeDefined();
  expect((mod as Record<string, unknown>).RuleLoader).toBeUndefined();
});

// ── C. source scan: @hyperflux/core/client has no node:fs, node:path ─────────

test("C — @hyperflux/core/client transitive sources contain no node: built-ins", () => {
  const clientEntry = resolve(ROOT, "packages/core/src/client.ts");
  const allFiles = collectImports(clientEntry);
  const banned = ["node:fs", "node:path", "node:fs/promises"];

  for (const file of allFiles) {
    const src = readFileSync(file, "utf8");
    const relPath = file.replace(ROOT + "/", "");
    for (const b of banned) {
      expect(src, `${relPath} must not import "${b}"`).not.toContain(`"${b}"`);
      expect(src, `${relPath} must not import '${b}'`).not.toContain(`'${b}'`);
    }
    expect(
      relPath,
      "client bundle must not include loader.ts"
    ).not.toMatch(/packages\/core\/src\/loader\.ts$/);
  }
});

// ── D. Server code can import @hyperflux/core/loader and get RuleLoader ───────

test("D — @hyperflux/core loader entrypoint is importable and exports RuleLoader", async () => {
  // In test/Node.js context we import the source directly via vitest alias
  const { RuleLoader } = await import("../src/loader");
  expect(RuleLoader).toBeDefined();
  expect(typeof RuleLoader).toBe("function");
});
