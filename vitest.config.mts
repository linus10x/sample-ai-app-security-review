import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "app/actions/**/*.ts"],
      reporter: ["text", "json-summary", "lcov"],
      thresholds: { lines: 80 },
    },
  },
});
