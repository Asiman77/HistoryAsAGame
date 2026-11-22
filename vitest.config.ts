import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@data": path.resolve(__dirname, "data"),
      "@locales": path.resolve(__dirname, "locales"),
      "@fixtures": path.resolve(__dirname, "fixtures"),
    },
  },
  test: {
    projects: [
      { extends: true, test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" } },
      {
        extends: true,
        test: {
          name: "component",
          include: ["tests/component/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["tests/component/setup.ts"],
        },
      },
    ],
  },
});
