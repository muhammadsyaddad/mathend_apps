import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

const testDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(testDir, "..");
const testReactDir = resolve(testDir, "node_modules/react");
const testReactDomDir = resolve(testDir, "node_modules/react-dom");

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      {
        find: /^react$/,
        replacement: resolve(testReactDir, "index.js"),
      },
      {
        find: /^react-dom$/,
        replacement: resolve(testReactDomDir, "index.js"),
      },
      {
        find: /^react\/jsx-runtime$/,
        replacement: resolve(testReactDir, "jsx-runtime.js"),
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: resolve(testReactDir, "jsx-dev-runtime.js"),
      },
      {
        find: /^react\/(.*)$/,
        replacement: `${testReactDir}/$1`,
      },
      {
        find: /^react-dom\/(.*)$/,
        replacement: `${testReactDomDir}/$1`,
      },
      {
        find: /^lucide-react$/,
        replacement: resolve(testDir, "mocks/lucide-react.tsx"),
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
