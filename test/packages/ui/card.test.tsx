import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "../../../packages/ui/src/card";

describe("Card", () => {
  it("renders a link with title and content", () => {
    const { unmount } = render(
      <Card title="Visit Docs" href="https://example.com/docs">
        Helpful docs here
      </Card>,
    );

    const link = screen.getByRole("link", { name: /visit docs/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent("Helpful docs here");
    unmount();
  });

  it("adds turborepo UTM params to href", () => {
    const { unmount } = render(
      <Card title="Docs" href="https://example.com/docs">
        Read more
      </Card>,
    );

    const link = screen.getByRole("link", { name: /^docs/i });
    expect(link).toHaveAttribute(
      "href",
      "https://example.com/docs?utm_source=create-turbo&utm_medium=basic&utm_campaign=create-turbo",
    );
    unmount();
  });

  it("opens external link in new tab securely", () => {
    const { unmount } = render(
      <Card title="Docs" href="https://example.com/docs">
        Read more
      </Card>,
    );

    const link = screen.getByRole("link", { name: /^docs/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    unmount();
  });
});
