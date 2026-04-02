import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../../packages/ui/src/button";

describe("docs page trust checks", () => {
  it("shared button still triggers alert with app name", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {
      return;
    });

    render(<Button appName="docs">Open alert</Button>);

    await user.click(screen.getByRole("button", { name: /open alert/i }));

    expect(alertSpy).toHaveBeenCalledWith("Hello from your docs app!");
  });
});
