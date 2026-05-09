import { defineConfig } from "vitest/config";

const coreClientPath = new URL("./packages/core/src/client.ts", import.meta.url).pathname;
const coreLoaderPath = new URL("./packages/core/src/loader.ts", import.meta.url).pathname;
const corePath = new URL("./packages/core/src/index.ts", import.meta.url).pathname;
const reactPath = new URL("./packages/react/src/index.ts", import.meta.url).pathname;
const lintPath = new URL("./packages/lint/src/index.ts", import.meta.url).pathname;
const cliPath = new URL("./packages/cli/src/index.ts", import.meta.url).pathname;

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "packages/*/tests/**/*.test.ts",
      "packages/*/tests/**/*.test.tsx",
      "apps/admin/*/src/**/__tests__/**/*.test.ts",
    ],
    environmentMatchGlobs: [
      ["packages/react/tests/**", "jsdom"],
    ],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**"],
      exclude: ["packages/*/src/index.ts"],
    },
  },
  resolve: {
    alias: [
      // More-specific sub-path aliases MUST come before the bare package alias.
      // Vite string aliases are prefix-matched, so "@hyperflux/core" would
      // swallow "@hyperflux/core/client". Use regex for exact-match.
      { find: /^@hyperflux\/core\/client$/, replacement: coreClientPath },
      { find: /^@hyperflux\/core\/loader$/, replacement: coreLoaderPath },
      { find: /^@hyperflux\/core$/, replacement: corePath },
      { find: /^@hyperflux\/react$/, replacement: reactPath },
      { find: /^@hyperflux\/lint$/, replacement: lintPath },
      { find: /^@hyperflux\/cli$/, replacement: cliPath },
    ],
  },
});
