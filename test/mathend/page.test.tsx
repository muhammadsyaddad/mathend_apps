import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Home from "../../apps/mathend/app/page";

describe("mathend home page", () => {
  it("renders initial note content", () => {
    render(<Home />);

    expect(screen.getByText("Buku Catatan")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Calculus Notes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(/The derivative of a function measures/i),
    ).toBeInTheDocument();
  });

  it("creates a new note and allows editing body", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: /new note/i }));

    const textarea = screen.getByRole("textbox", {
      name: "",
    }) as HTMLTextAreaElement;

    fireEvent.change(textarea, {
      target: {
        value: "Integral practice set",
        selectionStart: 21,
        selectionEnd: 21,
      },
    });

    expect(textarea).toBe("Integral practice set");
  });

  it("filters notes by search query", async () => {
    const user = userEvent.setup();
    render(<Home />);

    const search = screen.getByRole("textbox", { name: /search notes/i });
    await user.type(search, "zzz-not-found");

    expect(
      screen.getByText(/No notes match your current search\/filter/i),
    ).toBeInTheDocument();
  });

  it("applies slash command from command palette", async () => {
    render(<Home />);

    const textarea = screen.getByDisplayValue(
      /The derivative of a function measures/i,
    ) as HTMLTextAreaElement;

    fireEvent.change(textarea, {
      target: {
        value: "calc /sqrt",
        selectionStart: 10,
        selectionEnd: 10,
      },
    });

    expect(screen.getByText("Math Commands")).toBeInTheDocument();

    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => {
      expect(textarea).toBe("calc √() ");
    });
  });
});
