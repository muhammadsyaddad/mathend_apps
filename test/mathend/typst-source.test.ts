import { describe, expect, it } from "vitest";
import {
  buildNormalizedTypstSource,
  formatTypstRenderError,
} from "../../apps/mathend/app/lib/typst-source";

describe("typst source builder", () => {
  it("normalizes LaTeX-style input before Typst compile", () => {
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

    const source = buildNormalizedTypstSource("physics-notes.md", input);

    expect(source).toContain("$F = frac(dp, dt)$");
    expect(source).toContain("$p = m sqrt(x)$");
    expect(source).not.toContain("\\\\[");
    expect(source).not.toContain("\\\\frac");
  });

  it("keeps list markers outside inline math wrappers", () => {
    const source = buildNormalizedTypstSource(
      "list-math.md",
      "1. x = y + z\n- lim_(x->0) f(x)",
    );

    expect(source).toContain("1. $x = y + z$");
    expect(source).toContain("- $lim_(x->0) f(x)$");
    expect(source).not.toContain("$1. x = y + z$");
  });
});

describe("typst render error formatting", () => {
  it("uses Error message when available", () => {
    expect(formatTypstRenderError(new Error("compile failed"))).toBe(
      "compile failed",
    );
  });

  it("uses string error payload", () => {
    expect(formatTypstRenderError("renderer crashed")).toBe("renderer crashed");
  });

  it("falls back for unknown values", () => {
    expect(formatTypstRenderError({ code: 500 })).toBe(
      "Failed to render Typst.",
    );
    expect(formatTypstRenderError(undefined, "Export failed.")).toBe(
      "Export failed.",
    );
  });
});
