import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests for the modules that do not need a running server: the wire
// contract and the field rules. Both are the places a silent data-loss bug
// hides (a field missing from the map drops an edit and still reports
// success), so they are worth pinning without a browser or a database.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["api/**/*.test.ts", "lib/**/*.test.ts"],
    environment: "node",
  },
});
