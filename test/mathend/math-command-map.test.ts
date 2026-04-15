import { describe, expect, it } from "vitest";
import {
  MATH_COMMANDS,
  buildIntentSnippet,
  getIntentCategoryFromQuery,
  getMathCommandSearchScore,
  isAdvancedIntentQuery,
} from "../../apps/mathend/app/lib/math-command-map";

describe("math command map", () => {
  it("contains expanded advanced command coverage", () => {
    const advancedCommands = MATH_COMMANDS.filter(
      (item) => item.level === "advanced",
    );
    expect(advancedCommands.length).toBeGreaterThanOrEqual(20);

    const shortcuts = new Set(MATH_COMMANDS.map((item) => item.shortcut));
    expect(shortcuts.has("jacobian")).toBe(true);
    expect(shortcuts.has("hessian")).toBe(true);
    expect(shortcuts.has("fourier")).toBe(true);
    expect(shortcuts.has("laplace-t")).toBe(true);
    expect(shortcuts.has("kkt")).toBe(true);
  });

  it("scores category-aligned command queries higher", () => {
    const fourier = MATH_COMMANDS.find((item) => item.shortcut === "fourier");
    const theorem = MATH_COMMANDS.find((item) => item.shortcut === "teorema");

    expect(fourier).toBeDefined();
    expect(theorem).toBeDefined();

    const fourierScore = getMathCommandSearchScore(
      fourier!,
      "fourier transform",
    );
    const theoremScore = getMathCommandSearchScore(
      theorem!,
      "fourier transform",
    );

    expect(fourierScore).toBeGreaterThan(theoremScore);
  });

  it("detects advanced intent category and builds snippet", () => {
    const query = "jacobian f terhadap x dan y";
    expect(isAdvancedIntentQuery(query)).toBe(true);
    expect(getIntentCategoryFromQuery(query)).toBe("vector-calculus");

    const snippet = buildIntentSnippet(query);
    expect(snippet).toContain("J =");
  });

  it("builds transform and optimization intent snippets", () => {
    const laplaceSnippet = buildIntentSnippet("laplace transform of f(t)");
    const kktSnippet = buildIntentSnippet("kkt condition");

    expect(laplaceSnippet).toContain("L{f(t)}");
    expect(kktSnippet).toContain("∇_x L = 0");
  });
});
