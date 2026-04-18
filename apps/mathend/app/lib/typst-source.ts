import { normalizeMathContent } from "./math-content";

const LIST_PREFIX_PATTERN = /^(\s*(?:[-*+]\s+|\d+[.)]\s+))(.*)$/;

const escapeTypstText = (value: string): string => {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("#", "\\#")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("$", "\\$");
};

const stripListPrefixForMathDetection = (value: string): string => {
  return value.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, "").trim();
};

const looksLikeMathLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  const candidate = stripListPrefixForMathDetection(trimmed);
  if (!candidate) {
    return false;
  }

  if (
    /^(?:\[.*\]|\{.*\}|\(.*\))$/.test(candidate) &&
    /[=<>^_]/.test(candidate)
  ) {
    return true;
  }

  const hasStrongMathToken =
    /[∫∬∭∮∯∑∏√∞π∂∇⋅×≤≥≈≠→]|\b(lim|det|matrix|grad|curl|div|d\/dx)\b|frac\(|sqrt\(|root\(|arg\s+(?:min|max)|Var\(|Cov\(|E\[|L\{|Res\(/i.test(
      candidate,
    );

  if (hasStrongMathToken) {
    return true;
  }

  const hasSuperscriptOrSubscriptToken = /[\^_]|[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾]/.test(
    candidate,
  );
  const hasComparison = /(?:<=|>=|==|!=|=|<|>|≤|≥|≈|≠)/.test(candidate);
  const hasArithmetic =
    /\s[+\-*/]\s/.test(candidate) || /\d\s*\/\s*\d/.test(candidate);

  if (!hasSuperscriptOrSubscriptToken && !hasComparison && !hasArithmetic) {
    return false;
  }

  const letterCount = (candidate.match(/[A-Za-z]/g) ?? []).length;
  const longWordCount = (candidate.match(/[A-Za-z]{4,}/g) ?? []).length;
  const sentencePunctuationCount = (candidate.match(/[,:;.!?]/g) ?? []).length;
  const comparisonCount = (
    candidate.match(/(?:<=|>=|==|!=|=|<|>|≤|≥|≈|≠)/g) ?? []
  ).length;
  const arithmeticCount = (candidate.match(/\s[+\-*/]\s/g) ?? []).length;
  const operatorWeight =
    comparisonCount +
    arithmeticCount +
    (hasSuperscriptOrSubscriptToken ? 1 : 0);

  const looksLikeSentence =
    longWordCount >= 3 &&
    sentencePunctuationCount >= 1 &&
    comparisonCount <= 1 &&
    arithmeticCount === 0 &&
    !hasSuperscriptOrSubscriptToken;

  if (looksLikeSentence) {
    return false;
  }

  if (
    letterCount >= 30 &&
    operatorWeight <= 1 &&
    !hasSuperscriptOrSubscriptToken
  ) {
    return false;
  }

  return true;
};

const renderMathLine = (line: string): string => {
  const listMatch = line.match(LIST_PREFIX_PATTERN);
  if (!listMatch) {
    return `$${line}$`;
  }

  const prefix = listMatch[1] ?? "";
  const body = (listMatch[2] ?? "").trim();
  if (!body) {
    return escapeTypstText(line);
  }

  if (body.startsWith("$") && body.endsWith("$") && body.length > 2) {
    return `${escapeTypstText(prefix)}${body}`;
  }

  if (looksLikeMathLine(body)) {
    return `${escapeTypstText(prefix)}$${body}$`;
  }

  return `$${line}$`;
};

const buildTypstDocument = (title: string, content: string): string => {
  const blocks: string[] = [];
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      blocks.push("");
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push(`=== ${escapeTypstText(trimmed.slice(4).trim())}`);
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(`== ${escapeTypstText(trimmed.slice(3).trim())}`);
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push(`= ${escapeTypstText(trimmed.slice(2).trim())}`);
      continue;
    }

    if (/^teorema\.?/i.test(trimmed)) {
      const body = escapeTypstText(trimmed.replace(/^teorema\.?\s*/i, ""));
      blocks.push(
        `box(stroke: luma(210), inset: 10pt, radius: 6pt)[*Teorema.* ${body}]`,
      );
      continue;
    }

    if (/^lemma\.?/i.test(trimmed)) {
      const body = escapeTypstText(trimmed.replace(/^lemma\.?\s*/i, ""));
      blocks.push(
        `box(stroke: luma(210), inset: 10pt, radius: 6pt)[*Lemma.* ${body}]`,
      );
      continue;
    }

    if (/^definisi\.?/i.test(trimmed) || /^definition\.?/i.test(trimmed)) {
      const body = escapeTypstText(
        trimmed.replace(/^(definisi|definition)\.?\s*/i, ""),
      );
      blocks.push(
        `box(stroke: luma(210), inset: 10pt, radius: 6pt)[*Definisi.* ${body}]`,
      );
      continue;
    }

    if (/^korolari\.?/i.test(trimmed) || /^corollary\.?/i.test(trimmed)) {
      const body = escapeTypstText(
        trimmed.replace(/^(korolari|corollary)\.?\s*/i, ""),
      );
      blocks.push(
        `box(stroke: luma(210), inset: 10pt, radius: 6pt)[*Korolari.* ${body}]`,
      );
      continue;
    }

    if (/^bukti\.?/i.test(trimmed) || /^proof\.?/i.test(trimmed)) {
      const body = escapeTypstText(
        trimmed.replace(/^(bukti|proof)\.?\s*/i, ""),
      );
      blocks.push(`[*Bukti.* ${body}]`);
      continue;
    }

    if (
      trimmed.startsWith("$") &&
      trimmed.endsWith("$") &&
      trimmed.length > 2
    ) {
      blocks.push(trimmed);
      continue;
    }

    if (looksLikeMathLine(trimmed)) {
      blocks.push(renderMathLine(trimmed));
      continue;
    }

    blocks.push(escapeTypstText(line));
  }

  const safeTitle = escapeTypstText(title || "Untitled");
  const body = blocks.join("\n\n");

  return [
    "#set page(width: 210mm, height: 297mm, margin: (x: 22mm, y: 24mm))",
    "#set par(justify: true, leading: 0.7em)",
    '#set heading(numbering: "1.1")',
    "#set text(size: 11pt)",
    "",
    `#align(center)[#text(weight: "semibold", size: 14pt)[${safeTitle}]]`,
    "",
    body,
  ].join("\n");
};

export const buildNormalizedTypstSource = (
  title: string,
  content: string,
): string => {
  const normalizedContent = normalizeMathContent(content, { target: "typst" });
  return buildTypstDocument(title, normalizedContent);
};

export const formatTypstRenderError = (
  error: unknown,
  fallback = "Failed to render Typst.",
): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
};
