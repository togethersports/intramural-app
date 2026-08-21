import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    // `@core` is where the logic that goes wrong silently lives, so it was
    // the whole suite for a long time. `lib/` joined it when the senders
    // grew rules of their own — which channels a person actually gets, and
    // what Apple's rejection bodies mean — that are worth pinning even
    // though the surrounding code talks to the network.
    include: ["mobile/core/**/*.test.ts", "lib/**/*.test.ts"],
  },
});
