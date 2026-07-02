import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/*.test.ts"],
    // Tests must not pick up the real Supabase creds from .env — force MemStorage.
    env: { NODE_ENV: "test" },
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
