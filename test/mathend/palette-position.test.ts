import { describe, expect, it } from "vitest";
import { computePalettePlacement } from "../../apps/mathend/app/lib/palette-position";

describe("palette position", () => {
  it("places below caret when there is enough space", () => {
    const placement = computePalettePlacement({
      caretTop: 180,
      caretLeft: 220,
      caretHeight: 20,
      viewportWidth: 1200,
      viewportHeight: 900,
      paletteWidth: 352,
      estimatedPaletteHeight: 420,
    });

    expect(placement.placement).toBe("below");
    expect(placement.top).toBeGreaterThan(200);
    expect(placement.maxHeight).toBeGreaterThanOrEqual(180);
  });

  it("flips above caret near the viewport bottom", () => {
    const placement = computePalettePlacement({
      caretTop: 842,
      caretLeft: 360,
      caretHeight: 20,
      viewportWidth: 1200,
      viewportHeight: 900,
      paletteWidth: 352,
      estimatedPaletteHeight: 420,
    });

    expect(placement.placement).toBe("above");
    expect(placement.top).toBeLessThan(842);
    expect(placement.top).toBeGreaterThanOrEqual(12);
  });

  it("keeps palette within horizontal viewport bounds", () => {
    const placement = computePalettePlacement({
      caretTop: 240,
      caretLeft: 1300,
      caretHeight: 20,
      viewportWidth: 1280,
      viewportHeight: 900,
      paletteWidth: 352,
      estimatedPaletteHeight: 420,
    });

    expect(placement.left).toBeLessThanOrEqual(916);
    expect(placement.left).toBeGreaterThanOrEqual(12);
  });
});
