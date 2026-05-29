import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@agent-suite/config": new URL("./packages/config/src/index.ts", import.meta.url).pathname,
      "@agent-suite/shared-types": new URL("./packages/shared-types/src/index.ts", import.meta.url).pathname
    }
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"]
  }
});
