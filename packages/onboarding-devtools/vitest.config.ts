import { defineConfig } from "vitest/config";

// Node environment: capture.ts takes every device API (captureRef, fetch, timers)
// as an injected dependency, so nothing here loads React Native.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
