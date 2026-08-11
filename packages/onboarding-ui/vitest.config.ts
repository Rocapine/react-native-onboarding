import { defineConfig } from "vitest/config";

// Node environment on purpose: these tests cover pure modules (variable merging,
// action dispatch), not React Native rendering. Element renderers are verified by
// tsc and the example app.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
