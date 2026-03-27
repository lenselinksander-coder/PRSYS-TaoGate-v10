import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/__tests__/**/*.test.ts"],
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["server/**/*.ts"],
      exclude: [
        "server/**/__tests__/**",
        "server/index.ts",
        "server/vite.ts",
        "server/static.ts",
        "server/db.ts",
        "server/seed*.ts",
      ],
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 30,
      },
    },
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client/src"),
    },
  },
});
