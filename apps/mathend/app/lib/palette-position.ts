type PalettePlacementInput = {
  caretTop: number;
  caretLeft: number;
  caretHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  paletteWidth: number;
  estimatedPaletteHeight: number;
  viewportPadding?: number;
  offset?: number;
  minVisibleHeight?: number;
};

export type PalettePlacementResult = {
  top: number;
  left: number;
  maxHeight: number;
  placement: "above" | "below";
};

const clamp = (value: number, min: number, max: number): number => {
  if (min > max) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

export const computePalettePlacement = (
  input: PalettePlacementInput,
): PalettePlacementResult => {
  const viewportPadding = input.viewportPadding ?? 12;
  const offset = input.offset ?? 8;
  const minVisibleHeight = input.minVisibleHeight ?? 180;

  const availableViewportHeight = Math.max(
    120,
    input.viewportHeight - viewportPadding * 2,
  );
  const boundedMinHeight = Math.min(minVisibleHeight, availableViewportHeight);

  const maxLeft = Math.max(
    viewportPadding,
    input.viewportWidth - input.paletteWidth - viewportPadding,
  );
  const left = clamp(input.caretLeft, viewportPadding, maxLeft);

  const belowTop = input.caretTop + input.caretHeight + offset;
  const availableBelow = Math.max(
    0,
    input.viewportHeight - viewportPadding - belowTop,
  );
  const availableAbove = Math.max(0, input.caretTop - viewportPadding - offset);

  const placement: "above" | "below" =
    availableBelow < boundedMinHeight && availableAbove > availableBelow
      ? "above"
      : "below";

  const preferredMaxHeight =
    placement === "above" ? availableAbove : availableBelow;
  const maxHeight = clamp(
    preferredMaxHeight,
    boundedMinHeight,
    availableViewportHeight,
  );

  const preferredTop =
    placement === "above"
      ? input.caretTop -
        offset -
        Math.min(input.estimatedPaletteHeight, maxHeight)
      : belowTop;

  const maxTop = input.viewportHeight - viewportPadding - maxHeight;
  const top = clamp(preferredTop, viewportPadding, maxTop);

  return {
    top,
    left,
    maxHeight,
    placement,
  };
};
