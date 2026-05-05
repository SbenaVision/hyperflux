import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/*/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**"],
      exclude: ["packages/*/src/index.ts"],
    },
  },
  resolve: {
    alias: {
      "@hyperflux/core": new URL("./packages/core/src/index.ts", import.meta.url).pathname,
      "@hyperflux/react": new URL("./packages/react/src/index.ts", import.meta.url).pathname,
      "@hyperflux/lint": new URL("./packages/lint/src/index.ts", import.meta.url).pathname,
      "@hyperflux/cli": new URL("./packages/cli/src/index.ts", import.meta.url).pathname,
    },
  },
});
