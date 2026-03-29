import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../../../packages/ui/src/button";

describe("Button", () => {
  it("renders button text and className", () => {
    render(
      <Button appName="docs" className="cta">
        Open alert
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Open alert" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("cta");
  });

  it("shows alert with app name on click", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {
      return;
    });

    render(<Button appName="mathend">Click me</Button>);

    await user.click(screen.getByRole("button", { name: "Click me" }));

    expect(alertSpy).toHaveBeenCalledWith("Hello from your mathend app!");
  });
});
