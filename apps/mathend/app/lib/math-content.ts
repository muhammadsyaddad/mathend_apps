const replaceLaTeXDelimiters = (input: string): string => {
  return input
    .replaceAll(/\$\$([\s\S]*?)\$\$/g, (_match, body: string) => {
      return `$${body.trim()}$`;
    })
    .replaceAll(/\\\[([\s\S]*?)\\\]/g, (_match, body: string) => {
      return `$${body.trim()}$`;
    })
    .replaceAll(/\\\(([\s\S]*?)\\\)/g, (_match, body: string) => {
      return `$${body.trim()}$`;
    });
};

const replaceLatexFractions = (input: string): string => {
  return input.replaceAll(
    /\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g,
    (_match, numerator: string, denominator: string) => {
      return `frac(${numerator.trim()}, ${denominator.trim()})`;
    },
  );
};

const replaceLatexRoots = (input: string): string => {
  let output = input;
  output = output.replaceAll(
    /\\sqrt\s*\{([^{}]+)\}/g,
    (_match, body: string) => {
      return `sqrt(${body.trim()})`;
    },
  );
  output = output.replaceAll(
    /\\sqrt\s*\[([^\]]+)\]\s*\{([^{}]+)\}/g,
    (_match, degree: string, body: string) => {
      return `root(${body.trim()}, ${degree.trim()})`;
    },
  );
  return output;
};

const replaceLatexTextCommands = (input: string): string => {
  return input
    .replaceAll(/\\cdot/g, "·")
    .replaceAll(/\\times/g, "×")
    .replaceAll(/\\to/g, "→")
    .replaceAll(/\\infty/g, "∞")
    .replaceAll(/\\leq/g, "≤")
    .replaceAll(/\\geq/g, "≥")
    .replaceAll(/\\neq/g, "≠")
    .replaceAll(/\\approx/g, "≈")
    .replaceAll(/\\nabla/g, "∇")
    .replaceAll(/\\partial/g, "∂")
    .replaceAll(/\\sum/g, "∑")
    .replaceAll(/\\prod/g, "∏")
    .replaceAll(/\\int/g, "∫")
    .replaceAll(/\\iint/g, "∬")
    .replaceAll(/\\iiint/g, "∭")
    .replaceAll(/\\oint/g, "∮")
    .replaceAll(/\\left/g, "")
    .replaceAll(/\\right/g, "")
    .replaceAll(/\\,/g, " ")
    .replaceAll(/\\;/g, " ");
};

const replaceLatexIntervals = (input: string): string => {
  return input
    .replaceAll(/\\mathrm\{d\}/g, "d")
    .replaceAll(/\^\{([^{}]+)\}/g, "^($1)")
    .replaceAll(/_\{([^{}]+)\}/g, "_($1)");
};

const SUPERSCRIPT_CHARACTER_MAP: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  a: "ᵃ",
  b: "ᵇ",
  c: "ᶜ",
  d: "ᵈ",
  e: "ᵉ",
  f: "ᶠ",
  g: "ᵍ",
  h: "ʰ",
  i: "ⁱ",
  j: "ʲ",
  k: "ᵏ",
  l: "ˡ",
  m: "ᵐ",
  n: "ⁿ",
  o: "ᵒ",
  p: "ᵖ",
  r: "ʳ",
  s: "ˢ",
  t: "ᵗ",
  u: "ᵘ",
  v: "ᵛ",
  w: "ʷ",
  x: "ˣ",
  y: "ʸ",
  z: "ᶻ",
  A: "ᴬ",
  B: "ᴮ",
  D: "ᴰ",
  E: "ᴱ",
  G: "ᴳ",
  H: "ᴴ",
  I: "ᴵ",
  J: "ᴶ",
  K: "ᴷ",
  L: "ᴸ",
  M: "ᴹ",
  N: "ᴺ",
  O: "ᴼ",
  P: "ᴾ",
  R: "ᴿ",
  T: "ᵀ",
  U: "ᵁ",
  V: "ⱽ",
  W: "ᵂ",
};

const canConvertToSuperscript = (value: string): boolean => {
  return value
    .split("")
    .every((character) => Boolean(SUPERSCRIPT_CHARACTER_MAP[character]));
};

const toSuperscript = (value: string): string => {
  return value
    .split("")
    .map((character) => SUPERSCRIPT_CHARACTER_MAP[character])
    .join("");
};

const replaceSimpleCaretExponents = (input: string): string => {
  return input.replaceAll(
    /(^|[^\\])\^([A-Za-z0-9+\-=()]+)/g,
    (_match, prefix: string, exponent: string) => {
      if (!canConvertToSuperscript(exponent)) {
        return `${prefix}^${exponent}`;
      }
      return `${prefix}${toSuperscript(exponent)}`;
    },
  );
};

const normalizeMathPunctuation = (input: string): string => {
  return input
    .replaceAll(/\s+([,.;:])/g, "$1")
    .replaceAll(/([,.;:])(\S)/g, "$1 $2")
    .replaceAll(/([A-Za-z0-9])\s*(frac\(|sqrt\(|root\()/g, "$1 $2")
    .replaceAll(/[ \t]+\n/g, "\n")
    .replaceAll(/\n{3,}/g, "\n\n");
};

const normalizeLinewiseLayout = (input: string): string => {
  const lines = input.split(/\r?\n/);
  const normalizedLines = lines.map((rawLine) => {
    const line = rawLine.replace(/\s+/g, " ").trimEnd();
    if (!line.trim()) {
      return "";
    }

    if (/^\s*[-*]\s+/.test(line)) {
      return line.replace(/^\s*[-*]\s+/, "- ");
    }

    const numberedMatch = line.match(/^\s*(\d+)\s*[.)]\s+(.*)$/);
    if (numberedMatch) {
      return `${numberedMatch[1]}. ${numberedMatch[2]}`;
    }

    return line;
  });

  return normalizedLines.join("\n");
};

const normalizeHeadingSpace = (input: string): string => {
  return input.replaceAll(/^(#{1,6})([^\s#])/gm, "$1 $2");
};

const ensureBalancedFences = (input: string): string => {
  const codeFenceCount = (input.match(/```/g) ?? []).length;
  if (codeFenceCount % 2 === 0) {
    return input;
  }
  return `${input}\n\n\`\`\``;
};

const closeUnclosedMathDollarLine = (line: string): string => {
  const count = (line.match(/\$/g) ?? []).length;
  if (count % 2 === 0) {
    return line;
  }
  return `${line}$`;
};

const closeBracketPairs = (line: string): string => {
  const openRound = (line.match(/\(/g) ?? []).length;
  const closeRound = (line.match(/\)/g) ?? []).length;
  const openSquare = (line.match(/\[/g) ?? []).length;
  const closeSquare = (line.match(/\]/g) ?? []).length;
  const openCurly = (line.match(/\{/g) ?? []).length;
  const closeCurly = (line.match(/\}/g) ?? []).length;

  let next = line;
  if (openRound > closeRound) {
    next += ")".repeat(openRound - closeRound);
  }
  if (openSquare > closeSquare) {
    next += "]".repeat(openSquare - closeSquare);
  }
  if (openCurly > closeCurly) {
    next += "}".repeat(openCurly - closeCurly);
  }

  return next;
};

const applyLineMathFixes = (input: string): string => {
  return input
    .split(/\r?\n/)
    .map((line) => closeBracketPairs(closeUnclosedMathDollarLine(line)))
    .join("\n");
};

export const normalizeMathContent = (
  value: string,
  options?: { target?: "typst" | "plain" },
): string => {
  const target = options?.target ?? "typst";
  let output = value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

  output = replaceLaTeXDelimiters(output);
  output = replaceLatexFractions(output);
  output = replaceLatexRoots(output);
  output = replaceLatexTextCommands(output);
  output = replaceLatexIntervals(output);
  output = replaceSimpleCaretExponents(output);
  output = normalizeHeadingSpace(output);
  output = normalizeLinewiseLayout(output);
  output = normalizeMathPunctuation(output);
  output = ensureBalancedFences(output);
  output = applyLineMathFixes(output);
  output = replaceLatexFractions(output);
  output = replaceLatexRoots(output);
  output = replaceLatexTextCommands(output);
  output = normalizeMathPunctuation(output);

  if (target === "typst") {
    output = output
      .replaceAll(/\blim_\{([^{}]+)\}/g, "lim_($1)")
      .replaceAll(/\bsum_\{([^{}]+)\}/g, "∑_($1)")
      .replaceAll(/\bprod_\{([^{}]+)\}/g, "∏_($1)")
      .replaceAll(/\bint_\{([^{}]+)\}/g, "∫_($1)");
  }

  return output.trim();
};

export const normalizeMathEditorDisplay = (value: string): string => {
  return replaceSimpleCaretExponents(value);
};

export type MathValidationIssue = {
  kind:
    | "unbalanced-dollar"
    | "unbalanced-parenthesis"
    | "unbalanced-brackets"
    | "unbalanced-braces"
    | "latex-fraction";
  message: string;
};

export const validateMathContent = (
  value: string,
): {
  issues: MathValidationIssue[];
  fixedContent: string;
} => {
  const issues: MathValidationIssue[] = [];
  const raw = value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const normalized = normalizeMathContent(value, { target: "typst" });

  const dollarCount = (raw.match(/\$/g) ?? []).length;
  if (dollarCount % 2 !== 0) {
    issues.push({
      kind: "unbalanced-dollar",
      message: "Detected unbalanced math delimiter '$'.",
    });
  }

  const openRound = (raw.match(/\(/g) ?? []).length;
  const closeRound = (raw.match(/\)/g) ?? []).length;
  if (openRound !== closeRound) {
    issues.push({
      kind: "unbalanced-parenthesis",
      message: "Detected unbalanced parentheses '()'.",
    });
  }

  const openSquare = (raw.match(/\[/g) ?? []).length;
  const closeSquare = (raw.match(/\]/g) ?? []).length;
  if (openSquare !== closeSquare) {
    issues.push({
      kind: "unbalanced-brackets",
      message: "Detected unbalanced square brackets '[]'.",
    });
  }

  const openCurly = (raw.match(/\{/g) ?? []).length;
  const closeCurly = (raw.match(/\}/g) ?? []).length;
  if (openCurly !== closeCurly) {
    issues.push({
      kind: "unbalanced-braces",
      message: "Detected unbalanced braces '{}'.",
    });
  }

  if (/\\frac/.test(raw)) {
    issues.push({
      kind: "latex-fraction",
      message: "Found raw LaTeX fraction token; convert to Typst style.",
    });
  }

  return {
    issues,
    fixedContent: normalized,
  };
};
