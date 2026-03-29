import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Code } from "../../../packages/ui/src/code";

describe("Code", () => {
  it("renders children inside code element", () => {
    render(<Code>x^2 + y^2 = z^2</Code>);

    const codeElement = screen.getByText("x^2 + y^2 = z^2");
    expect(codeElement.tagName).toBe("CODE");
  });

  it("applies className when provided", () => {
    render(<Code className="inline-code">formula</Code>);

    expect(screen.getByText("formula")).toHaveClass("inline-code");
  });
});
