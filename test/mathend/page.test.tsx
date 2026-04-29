import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "../../apps/mathend/app/page";

const buildLicensedStatusResponse = () => {
  return {
    configured: true,
    licensed: true,
    checkoutUrl: "https://lemonsqueezy.com",
    productId: "mathend",
    buyerEmail: "tester@example.com",
    licenseKeyPreview: "ABCD...WXYZ",
    activatedAt: "2026-04-01T00:00:00.000Z",
    lastVerifiedAt: "2026-04-01T00:00:00.000Z",
  };
};

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const pathname = new URL(url, "http://localhost").pathname;

    if (pathname === "/api/license/status") {
      return new Response(JSON.stringify(buildLicensedStatusResponse()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (pathname === "/api/license/activate") {
      return new Response(JSON.stringify(buildLicensedStatusResponse()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unhandled fetch request in test: ${pathname}`);
  });
});

describe("mathend home page", () => {
  it("renders initial note content", async () => {
    render(<Home />);
    const textarea = await screen.findByPlaceholderText(
      /start writing your note/i,
    );

    expect(
      screen.getByRole("button", { name: /calculus-notes\.md/i }),
    ).toBeInTheDocument();
    expect((textarea as HTMLTextAreaElement).value).toContain(
      "The derivative of a function measures",
    );
  });

  it("creates a new note and allows editing body", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(await screen.findByRole("button", { name: /new file/i }));

    const textarea = screen.getByPlaceholderText(
      /start writing your note/i,
    ) as HTMLTextAreaElement;

    fireEvent.change(textarea, {
      target: {
        value: "Integral practice set",
        selectionStart: 21,
        selectionEnd: 21,
      },
    });

    expect(textarea).toHaveValue("Integral practice set");
  });

  it("switches notes when selecting a file", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findByRole("button", { name: /new file/i });
    await user.click(
      screen.getByRole("button", { name: /linear-algebra\.md/i }),
    );

    expect(
      screen.getByDisplayValue(/A matrix can represent scaling/i),
    ).toBeInTheDocument();
  });

  it("applies slash command from command palette", async () => {
    render(<Home />);
    await screen.findByRole("button", { name: /new file/i });

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

    expect(screen.getByLabelText("Math commands")).toBeInTheDocument();

    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => {
      expect(textarea).toHaveValue("calc sqrt(x)");
    });
  });
});
