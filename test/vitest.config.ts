import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

const testDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(testDir, "..");
const rootReactDir = resolve(repoRoot, "node_modules/react");
const rootReactDomDir = resolve(repoRoot, "node_modules/react-dom");

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
        find: /^react\/(.*)$/,
        replacement: `${rootReactDir}/$1`,
      },
      {
        find: /^react-dom\/(.*)$/,
        replacement: `${rootReactDomDir}/$1`,
      },
      {
        find: /^@repo\/ui\/(.*)$/,
        replacement: resolve(repoRoot, "packages/ui/src/$1.tsx"),
      },
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./setup.ts"],
    include: [
      "./docs/**/*.test.ts",
      "./docs/**/*.test.tsx",
      "./mathend/**/*.test.ts",
      "./mathend/**/*.test.tsx",
    ],
    exclude: [
      "./node_modules/**",
      "./apps/mathend/try-undersnd-unit-test.test.tsx",
    ],
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
        "../apps/**/*.ts",
        "../apps/**/*.tsx",
        "../packages/**/*.ts",
        "../packages/**/*.tsx",
      ],
      exclude: ["**/*.d.ts", "**/.next/**", "**/node_modules/**"],
    },
  },
});
