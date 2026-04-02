import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExportModal } from "../../apps/mathend/app/components/export-modal";

describe("ExportModal", () => {
  it("does not render when closed initially", () => {
    render(<ExportModal isOpen={false} onClose={vi.fn()} onExport={vi.fn()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog and exports selected format", () => {
    const onExport = vi.fn();

    render(<ExportModal isOpen onClose={vi.fn()} onExport={onExport} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /png image/i }));
    fireEvent.click(screen.getByRole("button", { name: /ekspor/i }));

    expect(onExport).toHaveBeenCalledWith("png");
  });

  it("calls onClose when escape is pressed", () => {
    const onClose = vi.fn();

    render(<ExportModal isOpen onClose={onClose} onExport={vi.fn()} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when clicking backdrop", () => {
    const onClose = vi.fn();

    const { container } = render(
      <ExportModal isOpen onClose={onClose} onExport={vi.fn()} />,
    );

    const backdrop = container.querySelector(".modal-backdrop");
    if (!backdrop) {
      throw new Error("Backdrop not found");
    }

    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalled();
  });
});
