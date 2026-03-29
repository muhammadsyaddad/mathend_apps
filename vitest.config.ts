import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const rootReactDir = resolve(rootDir, "node_modules/react");
const rootReactDomDir = resolve(rootDir, "node_modules/react-dom");

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      {
        find: /^react$/,
        replacement: resolve(rootReactDir, "index.js"),
      },
      {
        find: /^react-dom$/,
        replacement: resolve(rootReactDomDir, "index.js"),
      },
      {
        find: /^react\/jsx-runtime$/,
        replacement: resolve(rootReactDir, "jsx-runtime.js"),
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: resolve(rootReactDir, "jsx-dev-runtime.js"),
      },
      {
        find: /^@repo\/ui\/(.*)$/,
        replacement: resolve(rootDir, "packages/ui/src/$1.tsx"),
      },
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "html", "lcov"],
      thresholds: {
        statements: 60,
        branches: 40,
        functions: 55,
        lines: 60,
      },
      include: [
        "apps/**/*.ts",
        "apps/**/*.tsx",
        "packages/**/*.ts",
        "packages/**/*.tsx",
      ],
      exclude: ["**/*.d.ts", "**/.next/**", "**/node_modules/**"],
    },
  },
});
