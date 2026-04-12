"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExportModal, type ExportFormat } from "./components/export-modal";
import LicenseGate from "./components/license-gate";
import SettingsTrigger from "./components/setting-triger";
import {
  clearLicenseSessionInDb,
  initNoteDb,
  loadAppStateFromDb,
  loadLicenseSessionFromDb,
  loadNotesFromDb,
  saveAppStateToDb,
  saveLicenseSessionToDb,
  saveNotesToDb,
  type NoteRecord,
} from "./lib/note-db";
import {
  getDesktopLicenseRuntimeConfig,
  isSessionReverifyDue,
  maskLicenseKey,
  toLicensedStatus,
  verifyDesktopGumroadLicense,
} from "./lib/license-runtime";
import type {
  LicenseSessionPayload,
  LicenseStatusResponse,
} from "./lib/license-types";

const typstRuntimeModule = "@myriaddreamin/typst-all-in-one.ts";

type TypstRuntime = {
  svg: (options: { mainContent: string }) => Promise<string>;
  pdf: (options: { mainContent: string }) => Promise<Uint8Array>;
};

declare global {
  interface Window {
    $typst?: TypstRuntime;
  }
}

type NoteItem = {
  id: string;
  title: string;
  subtitle: string;
  category: "Calculus" | "Algebra" | "Physics" | "Thermo";
  modifiedLabel: string;
  modifiedAt: number;
  content: string[];
};

type CommandItem = {
  id: string;
  label: string;
  shortcut: string;
  keywords?: string[];
  preview: string;
  insertText: string;
  appendSpace?: boolean;
  cursorOffset?: number;
  active?: boolean;
};

type PalettePosition = {
  top: number;
  left: number;
};

type PaletteTriggerState = {
  start: number;
  end: number;
  source: "slash" | "manual";
};

type NoteActionMenuState = {
  noteId: string;
  top: number;
  left: number;
};

const initialNotes: NoteItem[] = [
  {
    id: "n-1",
    title: "calculus-notes.md",
    subtitle: "Limits and derivatives",
    category: "Calculus",
    modifiedLabel: "Oct 24",
    modifiedAt: new Date("2026-10-24T10:00:00Z").getTime(),
    content: [
      "# Limits and Derivatives\n\nThe derivative of a function measures the rate of change.\n\nPress Ctrl+K or type / to open the math palette.",
    ],
  },
  {
    id: "n-2",
    title: "linear-algebra.md",
    subtitle: "Matrix transformations",
    category: "Algebra",
    modifiedLabel: "Oct 22",
    modifiedAt: new Date("2026-10-22T10:00:00Z").getTime(),
    content: [
      "# Matrix Transformations\n\nA matrix can represent scaling, rotation, and projection in compact form.",
    ],
  },
  {
    id: "n-3",
    title: "physics-formulas.md",
    subtitle: "Kinematics equations",
    category: "Physics",
    modifiedLabel: "Oct 18",
    modifiedAt: new Date("2026-10-18T10:00:00Z").getTime(),
    content: [
      "# Kinematics\n\ns = ut + 1/2 at^2\n\nSplit vectors into x and y components for easier solving.",
    ],
  },
  {
    id: "n-4",
    title: "thermodynamics.md",
    subtitle: "Laws of thermodynamics",
    category: "Thermo",
    modifiedLabel: "Oct 15",
    modifiedAt: new Date("2026-10-15T10:00:00Z").getTime(),
    content: [
      "# Thermodynamics\n\nFirst law: energy is conserved in a closed system.\nSecond law: entropy tends to increase in isolated systems.",
    ],
  },
];

const commands: CommandItem[] = [
  {
    id: "c-1",
    label: "Fraction",
    shortcut: "pecahan",
    keywords: ["pecahan", "fraction", "frac", "rasio", "bagi"],
    preview: "a/b",
    insertText: "□/□",
    appendSpace: false,
    cursorOffset: 2,
    active: true,
  },
  {
    id: "c-2",
    label: "Square Root",
    shortcut: "akar",
    keywords: ["akar", "sqrt", "root", "akar kuadrat"],
    preview: "√x",
    insertText: "√()",
    cursorOffset: 2,
  },
  {
    id: "c-3",
    label: "N-th Root",
    shortcut: "akar-n",
    keywords: ["akar n", "nth root", "n root", "akar pangkat"],
    preview: "ⁿ√x",
    insertText: "ⁿ√()",
    cursorOffset: 2,
  },
  {
    id: "c-4",
    label: "Integral",
    shortcut: "integral",
    keywords: ["integral", "int", "anti turunan"],
    preview: "∫",
    insertText: "∫_a^b f(x) dx",
    cursorOffset: 5,
  },
  {
    id: "c-5",
    label: "Double Integral",
    shortcut: "integral-ganda",
    keywords: ["integral ganda", "double integral", "iint", "∬"],
    preview: "∬",
    insertText: "∬_D f(x, y) dA",
    cursorOffset: 9,
  },
  {
    id: "c-6",
    label: "Triple Integral",
    shortcut: "integral-tiga",
    keywords: ["integral tiga", "triple integral", "iiint", "∭"],
    preview: "∭",
    insertText: "∭_V f(x, y, z) dV",
    cursorOffset: 9,
  },
  {
    id: "c-7",
    label: "Limit",
    shortcut: "limit",
    keywords: ["limit", "lim", "mendekati"],
    preview: "lim",
    insertText: "lim_(x→a) f(x)",
    cursorOffset: 2,
  },
  {
    id: "c-8",
    label: "Derivative",
    shortcut: "turunan",
    keywords: ["turunan", "derivative", "differential", "diff", "d/dx"],
    preview: "d/dx",
    insertText: "d/dx f(x)",
    cursorOffset: 5,
  },
  {
    id: "c-9",
    label: "Partial Derivative",
    shortcut: "parsial",
    keywords: ["parsial", "partial", "∂", "partial derivative"],
    preview: "∂f/∂x",
    insertText: "∂f/∂x",
  },
  {
    id: "c-10",
    label: "Gradient",
    shortcut: "gradien",
    keywords: ["gradien", "gradient", "nabla", "∇"],
    preview: "∇f",
    insertText: "∇f",
  },
  {
    id: "c-11",
    label: "Divergence",
    shortcut: "divergensi",
    keywords: ["divergensi", "divergence", "div"],
    preview: "∇·F",
    insertText: "∇·F",
  },
  {
    id: "c-12",
    label: "Curl",
    shortcut: "curl",
    keywords: ["curl", "rotasi", "rot"],
    preview: "∇×F",
    insertText: "∇×F",
  },
  {
    id: "c-13",
    label: "Laplacian",
    shortcut: "laplace",
    keywords: ["laplace", "laplacian", "∇²"],
    preview: "∇²f",
    insertText: "∇²f",
  },
  {
    id: "c-14",
    label: "Summation",
    shortcut: "sigma",
    keywords: ["sigma", "sum", "summation", "jumlah", "∑"],
    preview: "∑",
    insertText: "∑_(k=1)^n",
    cursorOffset: 1,
  },
  {
    id: "c-15",
    label: "Product",
    shortcut: "produk",
    keywords: ["produk", "product", "pi product", "∏"],
    preview: "∏",
    insertText: "∏_(k=1)^n",
    cursorOffset: 1,
  },
  {
    id: "c-16",
    label: "Matrix 2x2",
    shortcut: "matriks-2",
    keywords: ["matriks", "matrix", "2x2"],
    preview: "[a b; c d]",
    insertText: "[a  b; c  d]",
    cursorOffset: 8,
  },
  {
    id: "c-17",
    label: "Matrix 3x3",
    shortcut: "matriks-3",
    keywords: ["matrix 3", "matriks 3", "3x3"],
    preview: "[a b c; d e f; g h i]",
    insertText: "[a  b  c; d  e  f; g  h  i]",
    cursorOffset: 17,
  },
  {
    id: "c-18",
    label: "Determinant",
    shortcut: "determinan",
    keywords: ["determinan", "determinant", "det"],
    preview: "det(A)",
    insertText: "det(A)",
  },
  {
    id: "c-19",
    label: "Piecewise Function",
    shortcut: "piecewise",
    keywords: ["piecewise", "cases", "kasus", "fungsi potongan"],
    preview: "{...}",
    insertText: "{ f(x), x>=0; g(x), x<0 }",
    cursorOffset: 18,
  },
  {
    id: "c-20",
    label: "Dot Product",
    shortcut: "dot",
    keywords: ["dot", "dot product", "hasil kali titik"],
    preview: "⋅",
    insertText: "u ⋅ v",
  },
  {
    id: "c-21",
    label: "Cross Product",
    shortcut: "cross",
    keywords: ["cross", "cross product", "hasil kali silang"],
    preview: "×",
    insertText: "u × v",
  },
  {
    id: "c-22",
    label: "Norm",
    shortcut: "norma",
    keywords: ["norma", "norm", "panjang vektor"],
    preview: "||v||",
    insertText: "||v||",
    cursorOffset: 2,
  },
  {
    id: "c-23",
    label: "Infinity",
    shortcut: "tak-hingga",
    keywords: ["tak hingga", "infinity", "inf", "∞"],
    preview: "∞",
    insertText: "∞",
  },
  {
    id: "c-24",
    label: "Pi",
    shortcut: "pi",
    keywords: ["pi", "konstanta", "π"],
    preview: "π",
    insertText: "π",
  },
  {
    id: "c-25",
    label: "Superscript",
    shortcut: "pangkat",
    keywords: ["pangkat", "superscript", "power", "eksponen"],
    preview: "xⁿ",
    insertText: "xⁿ",
  },
  {
    id: "c-26",
    label: "Subscript",
    shortcut: "subskrip",
    keywords: ["subskrip", "subscript", "index"],
    preview: "xₙ",
    insertText: "xₙ",
  },
  {
    id: "c-27",
    label: "System of Equations",
    shortcut: "sistem",
    keywords: ["sistem", "system", "persamaan linear"],
    preview: "{a+b=0}",
    insertText: "{ a + b = 0; c - d = 1 }",
    cursorOffset: 18,
  },
  {
    id: "c-28",
    label: "Aligned Equations",
    shortcut: "align",
    keywords: ["align", "aligned", "turunan langkah"],
    preview: "= =",
    insertText: "a = b\n  = c\n  = d",
    cursorOffset: 9,
  },
  {
    id: "c-29",
    label: "Theorem Block",
    shortcut: "teorema",
    keywords: ["teorema", "theorem", "proposisi"],
    preview: "Thm",
    insertText: "Teorema.\nTuliskan pernyataan teorema di sini.",
    cursorOffset: 31,
  },
  {
    id: "c-30",
    label: "Lemma Block",
    shortcut: "lemma",
    keywords: ["lemma", "lemma block", "bantuan teorema"],
    preview: "Lem",
    insertText: "Lemma.\nTuliskan lemma pendukung di sini.",
    cursorOffset: 30,
  },
  {
    id: "c-31",
    label: "Proof Block",
    shortcut: "bukti",
    keywords: ["bukti", "proof", "pembuktian"],
    preview: "QED",
    insertText: "Bukti.\nLangkah 1.\nLangkah 2.\nSelesai.",
    cursorOffset: 26,
  },
];

const LONG_PRESS_DURATION_MS = 430;

const getNoteSubtitle = (content: string): string =>
  content.replace(/\s+/g, " ").trim().slice(0, 42);

const getModifiedLabel = (timestamp: number): string => {
  const now = Date.now();
  const diffHours = (now - timestamp) / (1000 * 60 * 60);
  if (diffHours < 1) {
    return "Now";
  }
  if (diffHours < 24) {
    return "Today";
  }

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const toNoteItem = (record: NoteRecord): NoteItem => ({
  id: record.id,
  title: record.title,
  subtitle: record.subtitle,
  category: record.category,
  modifiedAt: record.modifiedAt,
  modifiedLabel: getModifiedLabel(record.modifiedAt),
  content: [record.content],
});

const toNoteRecord = (note: NoteItem): NoteRecord => ({
  id: note.id,
  title: note.title,
  subtitle: note.subtitle,
  category: note.category,
  modifiedAt: note.modifiedAt,
  content: note.content.join("\n\n"),
});

const escapeTypstText = (value: string): string => {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("#", "\\#")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("$", "\\$");
};

const looksLikeMathLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  if (/^(?:\[.*\]|\{.*\}|\(.*\))$/.test(trimmed) && /[=<>^_]/.test(trimmed)) {
    return true;
  }

  return /[∫∬∭∑∏√∞π∂∇⋅×≤≥≈≠→]|\b(lim|det|matrix|grad|curl|div|d\/dx)\b|[=^_]/i.test(
    trimmed,
  );
};

const normalizeIntentText = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll("∞", "tak hingga")
    .replaceAll("→", "menuju")
    .replaceAll(/\s+/g, " ")
    .trim();

const buildIntentSnippet = (query: string): string | null => {
  const normalized = normalizeIntentText(query);

  const boundedIntegral = normalized.match(
    /integral\s+(.+?)\s+sampai\s+(.+?)(?:\s+of|\s+untuk|\s+fungsi)?\s+(.+?)(?:\s+d([a-z]))?$/i,
  );
  if (boundedIntegral) {
    const lower = boundedIntegral[1]?.trim() ?? "a";
    const upper = boundedIntegral[2]?.trim() ?? "b";
    const body = boundedIntegral[3]?.trim() ?? "f(x)";
    const variable = boundedIntegral[4]?.trim() ?? "x";
    const resolvedUpper =
      upper === "tak hingga" || upper === "infinity" ? "∞" : upper;
    return `∫_(${lower})^(${resolvedUpper}) ${body} d${variable}`;
  }

  const integralInfinity = normalized.match(
    /integral\s+(.+?)\s+sampai\s+(tak hingga|infinity)(?:\s+of|\s+untuk|\s+fungsi)?\s+(.+?)(?:\s+d([a-z]))?$/i,
  );
  if (integralInfinity) {
    const lower = integralInfinity[1]?.trim() ?? "0";
    const body = integralInfinity[3]?.trim() ?? "f(x)";
    const variable = integralInfinity[4]?.trim() ?? "x";
    return `∫_(${lower})^∞ ${body} d${variable}`;
  }

  const limitIntent = normalized.match(
    /limit\s+([a-z])\s+(menuju|to|->)\s+(.+?)(?:\s+dari\s+(.+))?$/i,
  );
  if (limitIntent) {
    const variable = limitIntent[1] ?? "x";
    const toward = limitIntent[3]?.trim() ?? "a";
    const expr = limitIntent[4]?.trim() ?? "f(x)";
    return `lim_(${variable}→${toward}) ${expr}`;
  }

  const sumIntent = normalized.match(
    /(jumlah|sigma|sum)\s+([a-z])\s+dari\s+(.+?)\s+sampai\s+(.+)$/i,
  );
  if (sumIntent) {
    const variable = sumIntent[2] ?? "k";
    const lower = sumIntent[3]?.trim() ?? "1";
    const upper = sumIntent[4]?.trim() ?? "n";
    return `∑_(${variable}=${lower})^(${upper})`;
  }

  const productIntent = normalized.match(
    /(produk|product)\s+([a-z])\s+dari\s+(.+?)\s+sampai\s+(.+)$/i,
  );
  if (productIntent) {
    const variable = productIntent[2] ?? "k";
    const lower = productIntent[3]?.trim() ?? "1";
    const upper = productIntent[4]?.trim() ?? "n";
    return `∏_(${variable}=${lower})^(${upper})`;
  }

  const derivativeIntent = normalized.match(
    /turunan\s+(.+?)\s+terhadap\s+([a-z])$/i,
  );
  if (derivativeIntent) {
    const expr = derivativeIntent[1]?.trim() ?? "f(x)";
    const variable = derivativeIntent[2] ?? "x";
    return `d/d${variable} ${expr}`;
  }

  const partialIntent = normalized.match(
    /(turunan parsial|partial derivative)\s+(.+?)\s+terhadap\s+([a-z])$/i,
  );
  if (partialIntent) {
    const expr = partialIntent[2]?.trim() ?? "f";
    const variable = partialIntent[3] ?? "x";
    return `∂${expr}/∂${variable}`;
  }

  return null;
};

const intentStopWords = new Set([
  "dari",
  "sampai",
  "terhadap",
  "menuju",
  "ke",
  "untuk",
  "dan",
  "the",
  "to",
  "from",
  "of",
]);

const getCommandSearchScore = (command: CommandItem, query: string): number => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return command.active ? 100 : 0;
  }

  const searchableParts = [
    command.label,
    command.shortcut,
    ...(command.keywords ?? []),
  ].map((item) => item.toLowerCase());
  const searchableText = searchableParts.join(" ");

  let score = -1;
  if (command.shortcut.toLowerCase().startsWith(normalizedQuery)) {
    score += 60;
  }
  if (command.label.toLowerCase().includes(normalizedQuery)) {
    score += 42;
  }
  if (
    (command.keywords ?? []).some((keyword) =>
      keyword.includes(normalizedQuery),
    )
  ) {
    score += 34;
  }

  const tokens = normalizedQuery
    .split(/\s+/)
    .filter((token) => token.length > 0);
  const meaningfulTokens = tokens.filter((token) => {
    if (/^\d+$/.test(token)) {
      return false;
    }
    return !intentStopWords.has(token);
  });

  if (meaningfulTokens.length === 0 && score >= 0) {
    return score;
  }

  let matchedMeaningfulToken = false;
  for (const token of meaningfulTokens) {
    if (searchableText.includes(token)) {
      score += 8;
      matchedMeaningfulToken = true;
    }
  }

  if (meaningfulTokens.length > 0 && !matchedMeaningfulToken && score < 30) {
    return -1;
  }

  return score;
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

    if (/^bukti\.?/i.test(trimmed) || /^proof\.?/i.test(trimmed)) {
      const body = escapeTypstText(
        trimmed.replace(/^(bukti|proof)\.?\s*/i, ""),
      );
      blocks.push(`[*Bukti.* ${body}]`);
      continue;
    }

    if (looksLikeMathLine(trimmed)) {
      blocks.push(`$${trimmed}$`);
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

const getCaretPositionInTextarea = (
  textarea: HTMLTextAreaElement,
  cursorPosition: number,
): { top: number; left: number; height: number } | null => {
  const rect = textarea.getBoundingClientRect();
  const computed = window.getComputedStyle(textarea);

  const mirror = document.createElement("div");
  mirror.style.position = "fixed";
  mirror.style.left = "-9999px";
  mirror.style.top = "0";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordBreak = "break-word";
  mirror.style.overflowWrap = "break-word";
  mirror.style.visibility = "hidden";
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.font = computed.font;
  mirror.style.lineHeight = computed.lineHeight;
  mirror.style.padding = computed.padding;
  mirror.style.border = computed.border;
  mirror.style.letterSpacing = computed.letterSpacing;
  mirror.style.textTransform = computed.textTransform;
  mirror.style.textIndent = computed.textIndent;

  const beforeCursor = textarea.value.slice(0, cursorPosition);
  mirror.textContent = beforeCursor;

  const caretMarker = document.createElement("span");
  caretMarker.textContent = "\u200b";
  mirror.appendChild(caretMarker);

  document.body.appendChild(mirror);
  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = caretMarker.getBoundingClientRect();
  document.body.removeChild(mirror);

  if (!Number.isFinite(markerRect.left) || !Number.isFinite(markerRect.top)) {
    return null;
  }

  const top = rect.top + (markerRect.top - mirrorRect.top) - textarea.scrollTop;
  const left =
    rect.left + (markerRect.left - mirrorRect.left) - textarea.scrollLeft;
  const lineHeight = Number.parseFloat(computed.lineHeight) || 20;

  return { top, left, height: lineHeight };
};

export default function Home() {
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const paletteListRef = useRef<HTMLDivElement | null>(null);
  const paletteItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const noteActionMenuRef = useRef<HTMLDivElement | null>(null);
  const noteLongPressTimeoutRef = useRef<number | null>(null);
  const suppressNoteClickRef = useRef(false);
  const saveToastTimeoutRef = useRef<number | null>(null);
  const compileTimerRef = useRef<number | null>(null);
  const didInitPersistRef = useRef(false);
  const suppressAutoSaveToastRef = useRef(false);
  const isLoadingFromDbRef = useRef(true);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const licenseConfig = useMemo(() => getDesktopLicenseRuntimeConfig(), []);

  const [notes, setNotes] = useState<NoteItem[]>(initialNotes);
  const [selectedNoteId, setSelectedNoteId] = useState(
    initialNotes[0]?.id ?? "",
  );
  const [openTabIds, setOpenTabIds] = useState<string[]>(
    initialNotes.slice(0, 2).map((note) => note.id),
  );
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPaperPreviewOpen, setIsPaperPreviewOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(
    Math.max(
      0,
      commands.findIndex((command) => command.active),
    ),
  );
  const [isHydratedFromStorage, setIsHydratedFromStorage] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [saveToastMessage, setSaveToastMessage] = useState("Auto-saved");
  const [isTypstReady, setIsTypstReady] = useState(false);
  const [isTypstRuntimeLoading, setIsTypstRuntimeLoading] = useState(false);
  const [isTypstCompiling, setIsTypstCompiling] = useState(false);
  const [typstPreviewSvg, setTypstPreviewSvg] = useState("");
  const [typstError, setTypstError] = useState<string | null>(null);
  const [palettePosition, setPalettePosition] =
    useState<PalettePosition | null>(null);
  const [paletteTrigger, setPaletteTrigger] =
    useState<PaletteTriggerState | null>(null);
  const [noteActionMenu, setNoteActionMenu] =
    useState<NoteActionMenuState | null>(null);
  const [licenseStatus, setLicenseStatus] =
    useState<LicenseStatusResponse | null>(null);
  const [licenseActivationError, setLicenseActivationError] = useState<
    string | null
  >(null);
  const [isLicenseStatusLoading, setIsLicenseStatusLoading] = useState(true);
  const [isLicenseActivating, setIsLicenseActivating] = useState(false);
  const [hasResolvedLicenseStatus, setHasResolvedLicenseStatus] =
    useState(false);

  const buildUnlicensedStatus = useCallback(
    (params?: {
      reason?: string;
      error?: string;
      configured?: boolean;
    }): LicenseStatusResponse => ({
      configured: params?.configured ?? licenseConfig.enabled,
      licensed: false,
      checkoutUrl: licenseConfig.checkoutUrl,
      reverifyDays: licenseConfig.reverifyDays,
      reason: params?.reason,
      error: params?.error,
    }),
    [licenseConfig],
  );

  const visibleNotes = useMemo(
    () => [...notes].sort((a, b) => b.modifiedAt - a.modifiedAt),
    [notes],
  );

  const selectedNote =
    visibleNotes.find((note) => note.id === selectedNoteId) ??
    notes.find((note) => note.id === selectedNoteId) ??
    visibleNotes[0] ??
    notes[0];

  const selectedNoteContent = selectedNote?.content.join("\n\n") ?? "";

  const openTabs = useMemo(
    () =>
      openTabIds
        .map((id) => notes.find((note) => note.id === id))
        .filter((note): note is NoteItem => Boolean(note)),
    [notes, openTabIds],
  );

  const intentCommand = useMemo(() => {
    const query = paletteQuery.trim();
    if (!query) {
      return null;
    }

    const intentSnippet = buildIntentSnippet(query);
    if (!intentSnippet) {
      return null;
    }

    return {
      id: "intent-natural-math",
      label: "Natural Math Intent",
      shortcut: "auto",
      preview: intentSnippet,
      insertText: intentSnippet,
      appendSpace: false,
      cursorOffset: 0,
      keywords: ["intent", "auto", "natural"],
    } satisfies CommandItem;
  }, [paletteQuery]);

  const filteredCommands = useMemo(() => {
    const query = paletteQuery.trim();
    const ranked = commands
      .map((command) => ({
        command,
        score: getCommandSearchScore(command, query),
      }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.command);

    if (!intentCommand) {
      return ranked;
    }

    if (
      ranked.some((command) => command.insertText === intentCommand.insertText)
    ) {
      return ranked;
    }

    return [intentCommand, ...ranked];
  }, [intentCommand, paletteQuery]);

  const isDesktopViewport = useCallback((): boolean => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.matchMedia("(min-width: 981px)").matches;
  }, []);

  const closeNoteActionMenu = useCallback(() => {
    setNoteActionMenu(null);
  }, []);

  const openNoteActionMenu = useCallback(
    (noteId: string, anchorElement: HTMLElement) => {
      const rect = anchorElement.getBoundingClientRect();
      const menuWidth = 168;
      const menuHeight = 124;
      const viewportPadding = 12;
      const maxLeft = window.innerWidth - menuWidth - viewportPadding;
      const maxTop = window.innerHeight - menuHeight - viewportPadding;
      const left = Math.max(
        viewportPadding,
        Math.min(rect.left + rect.width / 2 - menuWidth / 2, maxLeft),
      );
      const top = Math.max(viewportPadding, Math.min(rect.bottom + 8, maxTop));

      setNoteActionMenu({ noteId, top, left });
    },
    [],
  );

  const clearNoteLongPress = useCallback(() => {
    if (noteLongPressTimeoutRef.current) {
      window.clearTimeout(noteLongPressTimeoutRef.current);
      noteLongPressTimeoutRef.current = null;
    }
  }, []);

  const startNoteLongPress = useCallback(
    (noteId: string, anchorElement: HTMLElement) => {
      clearNoteLongPress();
      noteLongPressTimeoutRef.current = window.setTimeout(() => {
        suppressNoteClickRef.current = true;
        openNoteActionMenu(noteId, anchorElement);
      }, LONG_PRESS_DURATION_MS);
    },
    [clearNoteLongPress, openNoteActionMenu],
  );

  const openNoteInTab = useCallback((noteId: string) => {
    setOpenTabIds((previous) => {
      if (previous.includes(noteId)) {
        return previous;
      }
      return [...previous, noteId];
    });
  }, []);

  const selectNote = useCallback(
    (noteId: string) => {
      openNoteInTab(noteId);
      setSelectedNoteId(noteId);
      setIsSidebarOpenMobile(false);
      setNoteActionMenu(null);
    },
    [openNoteInTab],
  );

  const closeTab = useCallback(
    (noteId: string) => {
      setOpenTabIds((previous) => {
        const index = previous.indexOf(noteId);
        if (index === -1) {
          return previous;
        }
        const next = previous.filter((id) => id !== noteId);

        if (selectedNoteId === noteId) {
          const fallbackVisible = visibleNotes.find(
            (note) => note.id !== noteId,
          )?.id;
          const nextActiveId =
            next[index] ?? next[index - 1] ?? fallbackVisible ?? "";
          setSelectedNoteId(nextActiveId);
          if (nextActiveId) {
            openNoteInTab(nextActiveId);
          }
        }

        return next;
      });
    },
    [openNoteInTab, selectedNoteId, visibleNotes],
  );

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      const nextToDelete = notes.find((note) => note.id === noteId);
      if (!nextToDelete) {
        return;
      }

      if (!window.confirm(`Delete "${nextToDelete.title}"?`)) {
        return;
      }

      setNoteActionMenu(null);
      setNotes((previous) => {
        const next = previous.filter((note) => note.id !== noteId);
        const fallbackId = next[0]?.id ?? "";
        const stillHasSelected = next.some(
          (note) => note.id === selectedNoteId,
        );

        setOpenTabIds((open) => open.filter((id) => id !== noteId));

        if (!stillHasSelected) {
          setSelectedNoteId(fallbackId);
          if (fallbackId) {
            openNoteInTab(fallbackId);
          }
        }

        return next;
      });
    },
    [notes, openNoteInTab, selectedNoteId],
  );

  const handleExportNote = useCallback(
    (noteId: string) => {
      setSelectedNoteId(noteId);
      openNoteInTab(noteId);
      setNoteActionMenu(null);
      setIsExportOpen(true);
    },
    [openNoteInTab],
  );

  const handlePreviewPaper = useCallback(
    (noteId: string) => {
      setSelectedNoteId(noteId);
      openNoteInTab(noteId);
      setNoteActionMenu(null);
      setIsPaperPreviewOpen(true);
    },
    [openNoteInTab],
  );

  const updateSelectedNote = useCallback(
    (updater: (note: NoteItem) => NoteItem) => {
      if (!selectedNoteId) {
        return;
      }
      const now = Date.now();
      setNotes((previous) =>
        previous.map((note) => {
          if (note.id !== selectedNoteId) {
            return note;
          }
          const updated = updater(note);
          return {
            ...updated,
            modifiedAt: now,
            modifiedLabel: getModifiedLabel(now),
          };
        }),
      );
    },
    [selectedNoteId],
  );

  const navigatePalette = useCallback(
    (direction: "up" | "down") => {
      setPaletteIndex((current) => {
        if (filteredCommands.length === 0) {
          return 0;
        }
        if (direction === "up") {
          return current === 0 ? filteredCommands.length - 1 : current - 1;
        }
        return current === filteredCommands.length - 1 ? 0 : current + 1;
      });
    },
    [filteredCommands.length],
  );

  const closePalette = useCallback(() => {
    setIsPaletteOpen(false);
    setPaletteQuery("");
    setPalettePosition(null);
    setPaletteTrigger(null);
  }, []);

  const positionPaletteAtCursor = useCallback((cursorPosition: number) => {
    const editor = editorRef.current;
    if (editor && window.innerWidth > 640) {
      const caretPosition = getCaretPositionInTextarea(editor, cursorPosition);
      if (caretPosition) {
        const paletteWidth = 352;
        const viewportPadding = 12;
        const maxLeft = window.innerWidth - paletteWidth - viewportPadding;
        const left = Math.max(
          viewportPadding,
          Math.min(caretPosition.left, maxLeft),
        );
        const top = Math.min(
          window.innerHeight - viewportPadding,
          caretPosition.top + caretPosition.height + 8,
        );
        setPalettePosition({ top, left });
        return;
      }
    }

    setPalettePosition(null);
  }, []);

  const openPalette = useCallback(
    (query: string, trigger: PaletteTriggerState, cursorPosition: number) => {
      setPaletteQuery(query);
      setPaletteIndex(0);
      setPaletteTrigger(trigger);
      positionPaletteAtCursor(cursorPosition);
      setIsPaletteOpen(true);
    },
    [positionPaletteAtCursor],
  );

  const openManualPalette = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const cursorPosition = editor.selectionStart ?? 0;
    const beforeCursor = selectedNoteContent.slice(0, cursorPosition);
    const wordMatch = beforeCursor.match(/([A-Za-z0-9_-]+)$/);
    const query = wordMatch?.[1] ?? "";
    const triggerStart = cursorPosition - query.length;

    openPalette(
      query,
      { start: triggerStart, end: cursorPosition, source: "manual" },
      cursorPosition,
    );
  }, [openPalette, selectedNoteContent]);

  const evaluateManualTrigger = useCallback(
    (text: string, cursorPosition: number) => {
      const beforeCursor = text.slice(0, cursorPosition);
      const wordMatch = beforeCursor.match(/([A-Za-z0-9_-]+)$/);
      const query = wordMatch?.[1] ?? "";
      const triggerStart = cursorPosition - query.length;

      openPalette(
        query,
        { start: triggerStart, end: cursorPosition, source: "manual" },
        cursorPosition,
      );
    },
    [openPalette],
  );

  const evaluateSlashTrigger = useCallback(
    (text: string, cursorPosition: number) => {
      const beforeCursor = text.slice(0, cursorPosition);
      const triggerMatch = beforeCursor.match(/(^|\s)\/([^\s/]*)$/);

      if (!triggerMatch) {
        if (paletteTrigger?.source === "slash") {
          closePalette();
        }
        return;
      }

      const leadingWhitespace = triggerMatch[1] ?? "";
      const triggerStart = (triggerMatch.index ?? 0) + leadingWhitespace.length;
      openPalette(
        triggerMatch[2] ?? "",
        { start: triggerStart, end: cursorPosition, source: "slash" },
        cursorPosition,
      );
    },
    [closePalette, openPalette, paletteTrigger?.source],
  );

  const applyPaletteCommand = useCallback(
    (command: CommandItem) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      const selectionStart = editor.selectionStart ?? 0;
      const selectionEnd = editor.selectionEnd ?? selectionStart;
      const triggerStart = paletteTrigger?.start ?? selectionStart;
      const triggerEnd = paletteTrigger?.end ?? selectionEnd;
      const replacement =
        command.appendSpace === false
          ? command.insertText
          : `${command.insertText} `;
      const nextValue =
        selectedNoteContent.slice(0, triggerStart) +
        replacement +
        selectedNoteContent.slice(triggerEnd);

      updateSelectedNote((note) => ({
        ...note,
        content: [nextValue],
        subtitle: getNoteSubtitle(nextValue),
      }));

      closePalette();

      const nextCursorPosition =
        triggerStart + replacement.length - (command.cursorOffset ?? 0);
      window.requestAnimationFrame(() => {
        editor.focus();
        editor.setSelectionRange(nextCursorPosition, nextCursorPosition);
      });
    },
    [closePalette, paletteTrigger, selectedNoteContent, updateSelectedNote],
  );

  const handleEditorChange = useCallback(
    (nextValue: string, cursorPosition: number) => {
      updateSelectedNote((note) => ({
        ...note,
        content: [nextValue],
        subtitle: getNoteSubtitle(nextValue),
      }));

      if (isPaletteOpen && paletteTrigger?.source === "manual") {
        evaluateManualTrigger(nextValue, cursorPosition);
        return;
      }

      evaluateSlashTrigger(nextValue, cursorPosition);
    },
    [
      evaluateManualTrigger,
      evaluateSlashTrigger,
      isPaletteOpen,
      paletteTrigger,
      updateSelectedNote,
    ],
  );

  const toggleSidebarMode = useCallback(() => {
    if (!isDesktopViewport()) {
      setIsSidebarOpenMobile((value) => !value);
      return;
    }
    setIsSidebarCollapsed((value) => !value);
  }, [isDesktopViewport]);

  const refreshLicenseStatus = useCallback(async () => {
    setIsLicenseStatusLoading(true);
    setLicenseActivationError(null);

    if (!licenseConfig.enabled) {
      setLicenseStatus(
        buildUnlicensedStatus({
          configured: false,
          reason: "missing_product_id",
          error:
            "Desktop license is not configured. Set VITE_GUMROAD_PRODUCT_ID in apps/desktop/.env.",
        }),
      );
      setIsLicenseStatusLoading(false);
      return;
    }

    try {
      await initNoteDb();
      const session = await loadLicenseSessionFromDb();

      if (!session || session.productId !== licenseConfig.productId) {
        if (session && session.productId !== licenseConfig.productId) {
          await clearLicenseSessionInDb();
        }
        setLicenseStatus(buildUnlicensedStatus({ reason: "missing_session" }));
        return;
      }

      if (!isSessionReverifyDue(session, licenseConfig.reverifyDays)) {
        setLicenseStatus(toLicensedStatus(session, licenseConfig));
        return;
      }

      const verification = await verifyDesktopGumroadLicense({
        productId: licenseConfig.productId,
        apiBase: licenseConfig.apiBase,
        licenseKey: session.licenseKey,
        incrementUsesCount: false,
      });

      if (!verification.ok) {
        if (verification.reason === "network") {
          setLicenseStatus({
            ...toLicensedStatus(session, licenseConfig),
            reason: "network_reverify_failed",
            error:
              "Using cached desktop license because Gumroad verification is temporarily unavailable.",
          });
          return;
        }

        await clearLicenseSessionInDb();
        setLicenseStatus(
          buildUnlicensedStatus({
            reason: verification.reason,
            error: verification.message,
          }),
        );
        return;
      }

      const refreshedSession: LicenseSessionPayload = {
        ...session,
        buyerEmail:
          (verification.purchase.email ?? "").trim().toLowerCase() ||
          session.buyerEmail,
        saleId: verification.saleId,
        lastVerifiedAt: new Date().toISOString(),
      };

      await saveLicenseSessionToDb(refreshedSession);
      setLicenseStatus(toLicensedStatus(refreshedSession, licenseConfig));
    } catch {
      setLicenseStatus(
        buildUnlicensedStatus({
          reason: "runtime_error",
          error: "Failed to load desktop license state.",
        }),
      );
    } finally {
      setIsLicenseStatusLoading(false);
      setHasResolvedLicenseStatus(true);
    }
  }, [buildUnlicensedStatus, licenseConfig]);

  const activateLicense = useCallback(
    async (params: { licenseKey: string; email: string }) => {
      setIsLicenseActivating(true);
      setLicenseActivationError(null);

      if (!licenseConfig.enabled) {
        const error =
          "Desktop license is not configured. Set VITE_GUMROAD_PRODUCT_ID in apps/desktop/.env.";
        setLicenseStatus(
          buildUnlicensedStatus({
            configured: false,
            reason: "missing_product_id",
            error,
          }),
        );
        setLicenseActivationError(error);
        setIsLicenseActivating(false);
        return;
      }

      const licenseKey = params.licenseKey.trim();
      const emailInput = params.email.trim().toLowerCase();

      if (!licenseKey) {
        const error = "License key is required.";
        setLicenseStatus(
          buildUnlicensedStatus({ reason: "missing_license_key", error }),
        );
        setLicenseActivationError(error);
        setIsLicenseActivating(false);
        return;
      }

      try {
        const verification = await verifyDesktopGumroadLicense({
          productId: licenseConfig.productId,
          apiBase: licenseConfig.apiBase,
          licenseKey,
          incrementUsesCount: false,
        });

        if (!verification.ok) {
          setLicenseStatus(
            buildUnlicensedStatus({
              reason: verification.reason,
              error: verification.message,
            }),
          );
          setLicenseActivationError(verification.message);
          return;
        }

        const buyerEmail =
          (verification.purchase.email ?? "").trim().toLowerCase() ||
          emailInput ||
          "unknown@buyer.local";

        if (emailInput && buyerEmail !== emailInput) {
          const error =
            "Purchase email does not match this license key. Use the same email from your Gumroad receipt.";
          setLicenseStatus(
            buildUnlicensedStatus({ reason: "email_mismatch", error }),
          );
          setLicenseActivationError(error);
          return;
        }

        await initNoteDb();
        const nowIso = new Date().toISOString();
        const sessionPayload: LicenseSessionPayload = {
          version: 1,
          productId: licenseConfig.productId,
          checkoutUrl: licenseConfig.checkoutUrl,
          licenseKey,
          licenseKeyPreview: maskLicenseKey(licenseKey),
          buyerEmail,
          saleId: verification.saleId,
          activatedAt: nowIso,
          lastVerifiedAt: nowIso,
        };

        await saveLicenseSessionToDb(sessionPayload);
        setLicenseStatus(toLicensedStatus(sessionPayload, licenseConfig));
        setLicenseActivationError(null);
      } catch {
        const error = "Failed to activate desktop license. Please retry.";
        setLicenseStatus(
          buildUnlicensedStatus({ reason: "runtime_error", error }),
        );
        setLicenseActivationError(error);
      } finally {
        setIsLicenseActivating(false);
      }
    },
    [buildUnlicensedStatus, licenseConfig],
  );

  const deactivateLicense = useCallback(async () => {
    await clearLicenseSessionInDb();
    setLicenseStatus(buildUnlicensedStatus({ reason: "missing_session" }));
    setLicenseActivationError(null);
  }, [buildUnlicensedStatus]);

  const handleExport = (format: ExportFormat) => {
    setIsExportOpen(false);
    const runtime = window.$typst;
    if (!runtime || !selectedNote) {
      window.alert("Typst runtime belum siap untuk export.");
      return;
    }

    const source = buildTypstDocument(selectedNote.title, selectedNoteContent);

    const triggerDownload = (blob: Blob, fileName: string) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    };

    if (format === "pdf") {
      void runtime
        .pdf({ mainContent: source })
        .then((bytes) => {
          const pdfBytes = new Uint8Array(bytes);
          const fileName = (selectedNote.title || "math-note").replace(
            /\.[^/.]+$/,
            "",
          );
          triggerDownload(
            new Blob([pdfBytes], { type: "application/pdf" }),
            `${fileName}.pdf`,
          );
          setSaveToastMessage("Exported PDF");
          setShowSaveToast(true);
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : "Failed to export PDF.";
          window.alert(message);
        });
      return;
    }

    if (!typstPreviewSvg) {
      window.alert("Preview SVG belum tersedia untuk export PNG.");
      return;
    }

    const svgBlob = new Blob([typstPreviewSvg], { type: "image/svg+xml" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      const width = Math.max(1, Math.round(image.naturalWidth || 1200));
      const height = Math.max(1, Math.round(image.naturalHeight || 1600));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(svgUrl);
        window.alert("Failed to initialize canvas for PNG export.");
        return;
      }

      context.fillStyle = "#f7f4ed";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(svgUrl);
        if (!blob) {
          window.alert("Failed to render PNG blob.");
          return;
        }

        const fileName = (selectedNote.title || "math-note").replace(
          /\.[^/.]+$/,
          "",
        );
        triggerDownload(blob, `${fileName}.png`);
        setSaveToastMessage("Exported PNG");
        setShowSaveToast(true);
      }, "image/png");
    };

    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      window.alert("Failed to load preview for PNG export.");
    };

    image.src = svgUrl;
  };

  const createNewNote = () => {
    const timestamp = Date.now();
    const newNote: NoteItem = {
      id: `n-${timestamp}`,
      title: "untitled.md",
      subtitle: "Start writing your note",
      category: "Calculus",
      modifiedLabel: "Now",
      modifiedAt: timestamp,
      content: ["# Untitled\n\nStart writing your note here."],
    };

    setNotes((previous) => [newNote, ...previous]);
    setOpenTabIds((previous) => {
      if (previous.includes(newNote.id)) {
        return previous;
      }
      return [...previous, newNote.id];
    });
    setSelectedNoteId(newNote.id);
    setNoteActionMenu(null);
    setIsSidebarOpenMobile(false);
  };

  useEffect(() => {
    void refreshLicenseStatus();
  }, [refreshLicenseStatus]);

  useEffect(() => {
    let isCancelled = false;

    const hydrateFromDb = async () => {
      try {
        await initNoteDb();
        const [noteRecords, appState] = await Promise.all([
          loadNotesFromDb(),
          loadAppStateFromDb(),
        ]);

        if (isCancelled) {
          return;
        }

        const nextNotes =
          noteRecords.length > 0 ? noteRecords.map(toNoteItem) : initialNotes;
        const noteIds = new Set(nextNotes.map((note) => note.id));

        const selectedFromState =
          appState.selectedNoteId && noteIds.has(appState.selectedNoteId)
            ? appState.selectedNoteId
            : (nextNotes[0]?.id ?? "");

        const tabsFromState = appState.openTabIds.filter((id) =>
          noteIds.has(id),
        );
        const nextOpenTabs =
          tabsFromState.length > 0
            ? tabsFromState
            : nextNotes.slice(0, 2).map((note) => note.id);

        setNotes(nextNotes);
        setSelectedNoteId(selectedFromState);
        setOpenTabIds(nextOpenTabs);
        setIsSidebarCollapsed(appState.sidebarCollapsed);
      } catch {
        if (isCancelled) {
          return;
        }

        setNotes(initialNotes);
        setSelectedNoteId(initialNotes[0]?.id ?? "");
        setOpenTabIds(initialNotes.slice(0, 2).map((note) => note.id));
        setIsSidebarCollapsed(false);
      } finally {
        if (!isCancelled) {
          isLoadingFromDbRef.current = false;
          setIsHydratedFromStorage(true);
        }
      }
    };

    void hydrateFromDb();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedNoteId || notes.length === 0) {
      return;
    }

    const exists = notes.some((note) => note.id === selectedNoteId);
    if (!exists) {
      setSelectedNoteId(notes[0]?.id ?? "");
    }
  }, [notes, selectedNoteId]);

  useEffect(() => {
    if (!isHydratedFromStorage) {
      return;
    }

    const existingIds = new Set(notes.map((note) => note.id));
    setOpenTabIds((previous) => {
      const filtered = previous.filter((id) => existingIds.has(id));
      if (filtered.length > 0) {
        return filtered;
      }

      const fallbackId =
        selectedNoteId && existingIds.has(selectedNoteId)
          ? selectedNoteId
          : notes[0]?.id;
      return fallbackId ? [fallbackId] : [];
    });
  }, [isHydratedFromStorage, notes, selectedNoteId]);

  useEffect(() => {
    if (!isHydratedFromStorage) {
      return;
    }

    if (!didInitPersistRef.current) {
      didInitPersistRef.current = true;
      return;
    }

    if (!isLoadingFromDbRef.current) {
      const noteRecords = notes.map(toNoteRecord);
      const appState = {
        selectedNoteId: selectedNoteId || null,
        sidebarCollapsed: isSidebarCollapsed,
        openTabIds,
      };
      saveQueueRef.current = saveQueueRef.current
        .then(async () => {
          await Promise.all([
            saveNotesToDb(noteRecords),
            saveAppStateToDb(appState),
          ]);
        })
        .catch(() => undefined);
    }

    if (!suppressAutoSaveToastRef.current) {
      setSaveToastMessage("Auto-saved");
      setShowSaveToast(true);
      if (saveToastTimeoutRef.current) {
        window.clearTimeout(saveToastTimeoutRef.current);
      }
      saveToastTimeoutRef.current = window.setTimeout(() => {
        setShowSaveToast(false);
      }, 1200);
    } else {
      suppressAutoSaveToastRef.current = false;
    }
  }, [
    isHydratedFromStorage,
    isSidebarCollapsed,
    notes,
    openTabIds,
    selectedNoteId,
  ]);

  useEffect(() => {
    return () => {
      if (saveToastTimeoutRef.current) {
        window.clearTimeout(saveToastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.$typst) {
      setIsTypstReady(true);
      return;
    }

    setIsTypstRuntimeLoading(true);
    let isCancelled = false;

    void import(/* @vite-ignore */ typstRuntimeModule)
      .then(() => {
        if (isCancelled) {
          return;
        }

        setIsTypstRuntimeLoading(false);
        setIsTypstReady(Boolean(window.$typst));
        if (!window.$typst) {
          setTypstError("Typst runtime loaded but API is unavailable.");
        }
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setIsTypstRuntimeLoading(false);
        setIsTypstReady(false);
        setTypstError(
          "Failed to load Typst runtime. Reinstall dependencies and reload.",
        );
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      clearNoteLongPress();
    };
  }, [clearNoteLongPress]);

  useEffect(() => {
    if (!noteActionMenu) {
      return;
    }

    const handleOutsideMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (noteActionMenuRef.current?.contains(target)) {
        return;
      }
      closeNoteActionMenu();
    };

    const handleOutsideTouchStart = (event: TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (noteActionMenuRef.current?.contains(target)) {
        return;
      }
      closeNoteActionMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeNoteActionMenu();
      }
    };

    window.addEventListener("mousedown", handleOutsideMouseDown);
    window.addEventListener("touchstart", handleOutsideTouchStart);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handleOutsideMouseDown);
      window.removeEventListener("touchstart", handleOutsideTouchStart);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeNoteActionMenu, noteActionMenu]);

  useEffect(() => {
    if (!isPaperPreviewOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPaperPreviewOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isPaperPreviewOpen]);

  useEffect(() => {
    const handleKeyboardShortcuts = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (isTypingTarget) {
        return;
      }

      if (isPaletteOpen && event.key === "ArrowDown") {
        event.preventDefault();
        navigatePalette("down");
        return;
      }

      if (isPaletteOpen && event.key === "ArrowUp") {
        event.preventDefault();
        navigatePalette("up");
        return;
      }

      if (isPaletteOpen && event.key === "Enter") {
        event.preventDefault();
        const command = filteredCommands[paletteIndex];
        if (command) {
          applyPaletteCommand(command);
        }
        return;
      }

      if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        setIsExportOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcuts);
    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcuts);
    };
  }, [
    applyPaletteCommand,
    filteredCommands,
    isPaletteOpen,
    navigatePalette,
    paletteIndex,
  ]);

  useEffect(() => {
    if (!isPaletteOpen) {
      return;
    }

    if (
      filteredCommands.length === 0 ||
      paletteIndex >= filteredCommands.length
    ) {
      setPaletteIndex(0);
    }
  }, [filteredCommands.length, isPaletteOpen, paletteIndex]);

  useEffect(() => {
    if (!isPaletteOpen || filteredCommands.length === 0) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const listElement = paletteListRef.current;
      const activeItem = paletteItemRefs.current[paletteIndex];

      if (!listElement || !activeItem) {
        return;
      }

      const listRect = listElement.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();

      if (itemRect.top < listRect.top || itemRect.bottom > listRect.bottom) {
        activeItem.scrollIntoView({ block: "nearest" });
      }
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [filteredCommands.length, isPaletteOpen, paletteIndex]);

  useEffect(() => {
    if (!isTypstReady || typeof window === "undefined") {
      return;
    }

    if (!selectedNote) {
      setTypstPreviewSvg("");
      return;
    }

    if (compileTimerRef.current) {
      window.clearTimeout(compileTimerRef.current);
    }

    compileTimerRef.current = window.setTimeout(() => {
      const runtime = window.$typst;
      if (!runtime) {
        setTypstError("Typst runtime is not available.");
        return;
      }

      const source = buildTypstDocument(
        selectedNote.title,
        selectedNoteContent,
      );
      setIsTypstCompiling(true);
      setTypstError(null);

      runtime
        .svg({ mainContent: source })
        .then((svg) => {
          setTypstPreviewSvg(svg);
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : "Failed to render Typst.";
          setTypstError(message);
        })
        .finally(() => {
          setIsTypstCompiling(false);
        });
    }, 200);

    return () => {
      if (compileTimerRef.current) {
        window.clearTimeout(compileTimerRef.current);
      }
    };
  }, [isTypstReady, selectedNote, selectedNoteContent]);

  if (!hasResolvedLicenseStatus || !licenseStatus?.licensed) {
    return (
      <LicenseGate
        status={licenseStatus}
        isLoading={isLicenseStatusLoading}
        isActivating={isLicenseActivating}
        activateError={licenseActivationError}
        onActivate={activateLicense}
        onRefresh={refreshLicenseStatus}
      />
    );
  }

  return (
    <div
      className={`library-app-shell ${isSidebarOpenMobile ? "sidebar-open-mobile" : ""} ${isSidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded"}`}
    >
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Close sidebar"
        onClick={() => setIsSidebarOpenMobile(false)}
      />

      <aside className="library-sidebar">
        <div className="sidebar-header">
          <button
            type="button"
            className="new-note-button"
            onClick={createNewNote}
          >
            <span aria-hidden>+</span>
            New File
          </button>
          <button
            type="button"
            aria-label="Collapse sidebar"
            className="icon-action sidebar-shrink-toggle"
            onClick={toggleSidebarMode}
          >
            {isSidebarCollapsed ? ">" : "<"}
          </button>
        </div>

        <div className="sidebar-content">
          <div className="recent-label">Openable Notes</div>
          <div className="notes-list">
            {visibleNotes.map((note) => (
              <button
                key={note.id}
                type="button"
                className={
                  note.id === selectedNote?.id
                    ? "note-card note-card-active note-card-button"
                    : "note-card note-card-button"
                }
                onClick={() => {
                  if (suppressNoteClickRef.current) {
                    suppressNoteClickRef.current = false;
                    return;
                  }

                  selectNote(note.id);
                }}
                onDoubleClick={(event) => {
                  openNoteActionMenu(note.id, event.currentTarget);
                }}
                onPointerDown={(event) => {
                  if (event.pointerType === "touch") {
                    startNoteLongPress(note.id, event.currentTarget);
                  }
                }}
                onPointerUp={clearNoteLongPress}
                onPointerCancel={clearNoteLongPress}
                onPointerLeave={clearNoteLongPress}
                onPointerMove={(event) => {
                  if (event.pointerType === "touch") {
                    clearNoteLongPress();
                  }
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  openNoteActionMenu(note.id, event.currentTarget);
                }}
                aria-label={note.title}
              >
                <div className="note-row">
                  <h2 className="note-title">{note.title}</h2>
                </div>
                <div className="note-subrow">
                  <p className="note-subtitle">{note.subtitle}</p>
                  <span className="note-date">{note.modifiedLabel}</span>
                </div>
              </button>
            ))}

            {visibleNotes.length === 0 && (
              <div className="no-note-state">No file yet. Create one now.</div>
            )}
          </div>
        </div>
        <SettingsTrigger
          licenseStatus={licenseStatus}
          isLoadingLicense={isLicenseStatusLoading}
          onRefreshLicenseStatus={refreshLicenseStatus}
          onDeactivateLicense={deactivateLicense}
        />
      </aside>

      <main className="editor-canvas">
        <div className="editor-wrap">
          <div className="editor-tabs" role="tablist" aria-label="Open files">
            {openTabs.map((note) => {
              if (!note) {
                return null;
              }

              const isActive = note.id === selectedNote?.id;
              return (
                <button
                  key={note.id}
                  type="button"
                  className={
                    isActive ? "editor-tab editor-tab-active" : "editor-tab"
                  }
                  onClick={() => selectNote(note.id)}
                  role="tab"
                  aria-selected={isActive}
                >
                  <span className="editor-tab-name">{note.title}</span>
                  <span
                    className="editor-tab-close"
                    aria-label={`Close ${note.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      closeTab(note.id);
                    }}
                  >
                    x
                  </span>
                </button>
              );
            })}
          </div>

          <div className="editor-heading-row">
            <div className="editor-title-group">
              <button
                type="button"
                className="mobile-sidebar-toggle"
                onClick={() => setIsSidebarOpenMobile((value) => !value)}
              >
                Files
              </button>
              <h2
                key={selectedNote?.id ?? "empty-title"}
                className="editor-title editor-title-editable"
                contentEditable
                suppressContentEditableWarning
                onBlur={(event) => {
                  const nextTitle = event.currentTarget.textContent?.trim();
                  if (!nextTitle || nextTitle === selectedNote?.title) {
                    event.currentTarget.textContent =
                      selectedNote?.title ?? "workspace.md";
                    return;
                  }
                  updateSelectedNote((note) => ({ ...note, title: nextTitle }));
                }}
              >
                {selectedNote?.title ?? "workspace.md"}
              </h2>
            </div>
          </div>

          <div className="editor-body">
            <div className="editor-body-grid">
              <div
                key={selectedNote?.id ?? "palette"}
                className="palette-anchor"
              >
                <textarea
                  key={selectedNote?.id ?? "editor"}
                  ref={editorRef}
                  className="note-editor-textarea"
                  value={selectedNoteContent}
                  placeholder="Start writing your note... (Ctrl+K or / for math palette)"
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "k") {
                      event.preventDefault();
                      openManualPalette();
                      return;
                    }

                    if (event.key === "Escape" && isPaletteOpen) {
                      event.preventDefault();
                      closePalette();
                      return;
                    }

                    if (!isPaletteOpen) {
                      return;
                    }

                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      navigatePalette("down");
                      return;
                    }

                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      navigatePalette("up");
                      return;
                    }

                    if (event.key === "Enter") {
                      const command = filteredCommands[paletteIndex];
                      if (!command) {
                        return;
                      }

                      event.preventDefault();
                      applyPaletteCommand(command);
                    }

                    if (event.key === "Tab") {
                      event.preventDefault();
                      const command = filteredCommands[paletteIndex];
                      if (command) {
                        applyPaletteCommand(command);
                      }
                    }
                  }}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    const cursor =
                      event.target.selectionStart ?? nextValue.length;
                    handleEditorChange(nextValue, cursor);
                  }}
                  onClick={(event) => {
                    const element = event.currentTarget;
                    if (isPaletteOpen && paletteTrigger?.source === "manual") {
                      evaluateManualTrigger(
                        element.value,
                        element.selectionStart ?? element.value.length,
                      );
                      return;
                    }

                    evaluateSlashTrigger(
                      element.value,
                      element.selectionStart ?? element.value.length,
                    );
                  }}
                  onKeyUp={(event) => {
                    if (
                      isPaletteOpen &&
                      (event.key === "ArrowDown" ||
                        event.key === "ArrowUp" ||
                        event.key === "Enter" ||
                        event.key === "Tab")
                    ) {
                      return;
                    }

                    if (event.key === "Escape") {
                      return;
                    }

                    const element = event.currentTarget;
                    const cursorPosition =
                      element.selectionStart ?? element.value.length;

                    if (isPaletteOpen && paletteTrigger?.source === "manual") {
                      evaluateManualTrigger(element.value, cursorPosition);
                      return;
                    }

                    evaluateSlashTrigger(element.value, cursorPosition);
                  }}
                />

                {isPaletteOpen && (
                  <section
                    className="command-palette command-palette-animate"
                    aria-label="Math commands"
                    style={
                      palettePosition
                        ? {
                            position: "fixed",
                            top: `${palettePosition.top}px`,
                            left: `${palettePosition.left}px`,
                          }
                        : undefined
                    }
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        navigatePalette("down");
                        return;
                      }

                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        navigatePalette("up");
                        return;
                      }

                      if (event.key === "Enter") {
                        event.preventDefault();
                        const command = filteredCommands[paletteIndex];
                        if (command) {
                          applyPaletteCommand(command);
                        }
                      }
                    }}
                  >
                    <div className="palette-head">Math + Structure</div>
                    <div className="palette-list" ref={paletteListRef}>
                      {filteredCommands.map((command, index) => (
                        <button
                          type="button"
                          key={command.id}
                          ref={(element) => {
                            paletteItemRefs.current[index] = element;
                          }}
                          className={
                            index === paletteIndex
                              ? "palette-item palette-item-active"
                              : "palette-item"
                          }
                          onMouseEnter={() => setPaletteIndex(index)}
                          onClick={() => applyPaletteCommand(command)}
                        >
                          <div className="palette-item-left">
                            <div className="palette-glyph" aria-hidden>
                              {command.preview}
                            </div>
                            <span className="palette-name">
                              {command.label}
                            </span>
                          </div>
                          <span className="palette-shortcut">
                            {command.shortcut}
                          </span>
                        </button>
                      ))}
                      {filteredCommands.length === 0 && (
                        <div className="palette-empty">No command found.</div>
                      )}
                    </div>
                    <div className="palette-foot">
                      <span>Arrows + Enter, Tab, Esc</span>
                      <span className="enter-key">↵</span>
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {noteActionMenu && (
        <div
          ref={noteActionMenuRef}
          className="note-action-menu"
          style={{
            top: `${noteActionMenu.top}px`,
            left: `${noteActionMenu.left}px`,
          }}
          role="menu"
          aria-label="Note actions"
        >
          <button
            type="button"
            className="note-action-menu-item"
            onClick={() => handleExportNote(noteActionMenu.noteId)}
          >
            Export note
          </button>
          <button
            type="button"
            className="note-action-menu-item"
            onClick={() => handlePreviewPaper(noteActionMenu.noteId)}
          >
            Preview paper
          </button>
          <button
            type="button"
            className="note-action-menu-item note-action-menu-danger"
            onClick={() => handleDeleteNote(noteActionMenu.noteId)}
          >
            Delete note
          </button>
        </div>
      )}

      {isPaperPreviewOpen && (
        <div
          className="paper-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="paper-preview-title"
        >
          <button
            type="button"
            className="paper-preview-backdrop"
            aria-label="Close paper preview"
            onClick={() => setIsPaperPreviewOpen(false)}
          />
          <section
            className="paper-preview-popover"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="paper-preview-head">
              <span id="paper-preview-title" className="paper-preview-title">
                Paper Preview
              </span>
              <div className="paper-preview-head-actions">
                <span className="paper-preview-status">
                  {isTypstRuntimeLoading
                    ? "Loading Typst"
                    : isTypstCompiling
                      ? "Compiling"
                      : isTypstReady
                        ? "Ready"
                        : "Offline"}
                </span>
                <button
                  type="button"
                  className="paper-preview-close"
                  onClick={() => setIsPaperPreviewOpen(false)}
                  aria-label="Close preview"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="paper-preview-scroll">
              <div className="paper-preview-content">
                {typstError ? (
                  <p className="paper-preview-error">{typstError}</p>
                ) : typstPreviewSvg ? (
                  <div
                    className="paper-preview-sheet"
                    dangerouslySetInnerHTML={{ __html: typstPreviewSvg }}
                  />
                ) : (
                  <p className="paper-preview-empty">
                    Start typing math content to render Typst preview.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {showSaveToast && <div className="save-toast">{saveToastMessage}</div>}

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        onExport={handleExport}
      />
    </div>
  );
}
