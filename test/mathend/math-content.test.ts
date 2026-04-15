import { describe, expect, it } from "vitest";
import {
  normalizeMathContent,
  normalizeMathEditorDisplay,
  validateMathContent,
} from "../../apps/mathend/app/lib/math-content";

describe("math content normalization", () => {
  it("converts common LaTeX wrappers to Typst-friendly syntax", () => {
    const input = [
      "# Newton's Second Law",
      "",
      "\\[",
      "F = \\frac{dp}{dt}",
      "\\]",
      "",
      "\\[",
      "p = m\\sqrt{x}",
      "\\]",
    ].join("\n");

    const normalized = normalizeMathContent(input, { target: "typst" });

    expect(normalized).toContain("$F = frac(dp, dt)$");
    expect(normalized).toContain("$p = m sqrt(x)$");
    expect(normalized).not.toContain("\\[");
    expect(normalized).not.toContain("\\frac");
  });

  it("normalizes list and numbering punctuation", () => {
    const input = "1) step one\n2) step two\n* bullet";
    const normalized = normalizeMathContent(input, { target: "typst" });

    expect(normalized).toBe("1. step one\n2. step two\n- bullet");
  });

  it("returns fixed content and reports validation issues", () => {
    const input = "F = \\frac{dp}{dt";
    const validation = validateMathContent(input);

    expect(validation.fixedContent).toContain("F = frac(dp, dt)");
    expect(validation.issues.length).toBeGreaterThan(0);
  });

  it("renders simple caret exponents as superscript characters", () => {
    const input = "r^2 + t^10 + x^n + y^AB";

    expect(normalizeMathContent(input, { target: "typst" })).toBe(
      "r² + t¹⁰ + xⁿ + yᴬᴮ",
    );
    expect(normalizeMathEditorDisplay(input)).toBe("r² + t¹⁰ + xⁿ + yᴬᴮ");
  });

  it("keeps unsupported exponent tokens with caret syntax", () => {
    const input = "f^q + g^C";

    expect(normalizeMathContent(input, { target: "typst" })).toBe("f^q + g^C");
    expect(normalizeMathEditorDisplay(input)).toBe("f^q + g^C");
  });
});
