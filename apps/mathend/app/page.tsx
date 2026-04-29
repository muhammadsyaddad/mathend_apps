"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ExportModal, type ExportFormat } from "./components/export-modal";
import LicenseGate from "./components/license-gate";
import SettingsTrigger from "./components/setting-triger";
import {
  MATH_COMMANDS as commands,
  buildIntentSnippet,
  getMathCommandCategoryLabel,
  getMathCommandSearchScore,
  getIntentCategoryFromQuery,
  isAdvancedIntentQuery,
  type MathCommandItem as CommandItem,
} from "./lib/math-command-map";
import {
  normalizeMathContent,
  normalizeMathEditorDisplay,
  validateMathContent,
} from "./lib/math-content";
import { computePalettePlacement } from "./lib/palette-position";
import {
  buildNormalizedTypstSource,
  formatTypstRenderError,
} from "./lib/typst-source";
import type { LicenseStatusResponse } from "./lib/license-types";

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

type PalettePosition = {
  top: number;
  left: number;
  maxHeight: number;
  placement: "above" | "below";
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

const LONG_PRESS_DURATION_MS = 430;

const STORAGE_NOTES_KEY = "mathend.notes.v1";
const STORAGE_SELECTED_NOTE_KEY = "mathend.selected-note.v1";
const STORAGE_SIDEBAR_COLLAPSED_KEY = "mathend.sidebar-collapsed.v1";
const STORAGE_OPEN_TABS_KEY = "mathend.open-tabs.v1";

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
  const paletteContainerRef = useRef<HTMLElement | null>(null);
  const paletteListRef = useRef<HTMLDivElement | null>(null);
  const paletteItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const noteActionMenuRef = useRef<HTMLDivElement | null>(null);
  const noteLongPressTimeoutRef = useRef<number | null>(null);
  const suppressNoteClickRef = useRef(false);
  const saveToastTimeoutRef = useRef<number | null>(null);
  const compileTimerRef = useRef<number | null>(null);
  const compileRequestIdRef = useRef(0);

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
  const [saveToastMessage, setSaveToastMessage] = useState("Saved");
  const [savedNotesSnapshot, setSavedNotesSnapshot] = useState(() =>
    JSON.stringify(initialNotes),
  );
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
  const [isLicenseStatusLoading, setIsLicenseStatusLoading] = useState(true);
  const [isActivatingLicense, setIsActivatingLicense] = useState(false);
  const [licenseActivationError, setLicenseActivationError] = useState<
    string | null
  >(null);

  const refreshLicenseStatus = useCallback(async () => {
    setIsLicenseStatusLoading(true);

    try {
      const response = await fetch("/api/license/status", {
        cache: "no-store",
      });
      const payload = (await response.json()) as LicenseStatusResponse;
      setLicenseStatus(payload);
      if (!response.ok && payload.error) {
        setLicenseActivationError(payload.error);
      } else {
        setLicenseActivationError(null);
      }
    } catch {
      setLicenseStatus({
        configured: false,
        licensed: false,
        checkoutUrl: "https://lemonsqueezy.com",
        reason: "network",
        error: "Failed to check license status. Please retry.",
      });
      setLicenseActivationError(
        "Failed to check license status. Please retry.",
      );
    } finally {
      setIsLicenseStatusLoading(false);
    }
  }, []);

  const activateLicense = useCallback(
    async (params: { licenseKey: string; email: string }) => {
      setIsActivatingLicense(true);
      setLicenseActivationError(null);

      try {
        const response = await fetch("/api/license/activate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        });
        const payload = (await response.json()) as LicenseStatusResponse;
        if (!response.ok) {
          setLicenseActivationError(
            payload.error ?? "Failed to activate license.",
          );
          return;
        }
        setLicenseStatus(payload);
        setLicenseActivationError(null);
      } catch {
        setLicenseActivationError("Failed to activate license. Please retry.");
      } finally {
        setIsActivatingLicense(false);
      }
    },
    [],
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
  const serializedNotes = useMemo(() => JSON.stringify(notes), [notes]);
  const hasUnsavedChanges =
    isHydratedFromStorage && serializedNotes !== savedNotesSnapshot;

  const handleManualSave = useCallback(() => {
    if (!isHydratedFromStorage) {
      return;
    }

    window.localStorage.setItem(STORAGE_NOTES_KEY, serializedNotes);
    window.localStorage.setItem(STORAGE_SELECTED_NOTE_KEY, selectedNoteId);
    window.localStorage.setItem(
      STORAGE_SIDEBAR_COLLAPSED_KEY,
      isSidebarCollapsed ? "true" : "false",
    );
    window.localStorage.setItem(
      STORAGE_OPEN_TABS_KEY,
      JSON.stringify(openTabIds),
    );
    setSavedNotesSnapshot(serializedNotes);
    setSaveToastMessage("Saved");
    setShowSaveToast(true);
    if (saveToastTimeoutRef.current) {
      window.clearTimeout(saveToastTimeoutRef.current);
    }
    saveToastTimeoutRef.current = window.setTimeout(() => {
      setShowSaveToast(false);
    }, 1200);
  }, [
    isHydratedFromStorage,
    isSidebarCollapsed,
    openTabIds,
    selectedNoteId,
    serializedNotes,
  ]);

  const promptSaveBeforeFileSwitch = useCallback(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const shouldSave = window.confirm("Do you want to save the changes?");
    if (shouldSave) {
      handleManualSave();
    }
  }, [handleManualSave, hasUnsavedChanges]);

  const activeAgentFile = useMemo(() => {
    if (!selectedNote) {
      return null;
    }

    return {
      id: selectedNote.id,
      title: selectedNote.title,
      content: selectedNote.content.join("\n\n"),
    };
  }, [selectedNote]);

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

    const category = getIntentCategoryFromQuery(query);
    const advancedIntent = isAdvancedIntentQuery(query);

    return {
      id: "intent-natural-math",
      label: "Natural Math Intent",
      shortcut: "auto",
      preview: intentSnippet,
      insertText: intentSnippet,
      appendSpace: false,
      cursorOffset: 0,
      keywords: ["intent", "auto", "natural"],
      category,
      level: advancedIntent ? "advanced" : "core",
    } satisfies CommandItem;
  }, [paletteQuery]);

  const filteredCommands = useMemo(() => {
    const query = paletteQuery.trim();
    const ranked = commands
      .map((command) => ({
        command,
        score: getMathCommandSearchScore(command, query),
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

  const activePaletteCommand =
    filteredCommands.length > 0 ? filteredCommands[paletteIndex] : null;

  const activePaletteCategoryLabel = activePaletteCommand
    ? getMathCommandCategoryLabel(activePaletteCommand.category)
    : "Typst Math";

  const groupedPaletteCommands = useMemo(() => {
    const groups = new Map<string, CommandItem[]>();
    for (const command of filteredCommands) {
      const categoryLabel = getMathCommandCategoryLabel(command.category);
      const existing = groups.get(categoryLabel);
      if (existing) {
        existing.push(command);
      } else {
        groups.set(categoryLabel, [command]);
      }
    }

    return Array.from(groups.entries()).map(([label, items]) => ({
      label,
      items,
    }));
  }, [filteredCommands]);

  const paletteCommandIndexById = useMemo(() => {
    const indexMap = new Map<string, number>();
    for (const [index, command] of filteredCommands.entries()) {
      indexMap.set(command.id, index);
    }
    return indexMap;
  }, [filteredCommands]);

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
      if (noteId !== selectedNoteId) {
        promptSaveBeforeFileSwitch();
      }

      openNoteInTab(noteId);
      setSelectedNoteId(noteId);
      setIsSidebarOpenMobile(false);
      setNoteActionMenu(null);
    },
    [openNoteInTab, promptSaveBeforeFileSwitch, selectedNoteId],
  );

  const closeTab = useCallback(
    (noteId: string) => {
      if (selectedNoteId === noteId) {
        promptSaveBeforeFileSwitch();
      }

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
    [openNoteInTab, promptSaveBeforeFileSwitch, selectedNoteId, visibleNotes],
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

      if (noteId === selectedNoteId) {
        promptSaveBeforeFileSwitch();
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
    [notes, openNoteInTab, promptSaveBeforeFileSwitch, selectedNoteId],
  );

  const handleExportNote = useCallback(
    (noteId: string) => {
      if (noteId !== selectedNoteId) {
        promptSaveBeforeFileSwitch();
      }

      setSelectedNoteId(noteId);
      openNoteInTab(noteId);
      setNoteActionMenu(null);
      setIsExportOpen(true);
    },
    [openNoteInTab, promptSaveBeforeFileSwitch, selectedNoteId],
  );

  const handlePreviewPaper = useCallback(
    (noteId: string) => {
      if (noteId !== selectedNoteId) {
        promptSaveBeforeFileSwitch();
      }

      setSelectedNoteId(noteId);
      openNoteInTab(noteId);
      setNoteActionMenu(null);
      setIsPaperPreviewOpen(true);
    },
    [openNoteInTab, promptSaveBeforeFileSwitch, selectedNoteId],
  );

  const updateNoteById = useCallback(
    (noteId: string, updater: (note: NoteItem) => NoteItem) => {
      const now = Date.now();

      setNotes((previous) =>
        previous.map((note) => {
          if (note.id !== noteId) {
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
    [],
  );

  const updateSelectedNote = useCallback(
    (updater: (note: NoteItem) => NoteItem) => {
      if (!selectedNoteId) {
        return;
      }

      updateNoteById(selectedNoteId, updater);
    },
    [selectedNoteId, updateNoteById],
  );

  const normalizeForMathWorkspace = useCallback((value: string): string => {
    const normalized = normalizeMathContent(value, {
      target: "typst",
    });
    const validation = validateMathContent(normalized);
    return validation.fixedContent;
  }, []);

  const writeNoteContentById = useCallback(
    (noteId: string, nextContent: string): boolean => {
      if (!notes.some((note) => note.id === noteId)) {
        return false;
      }

      const normalizedContent = normalizeForMathWorkspace(nextContent);
      updateNoteById(noteId, (note) => ({
        ...note,
        content: [normalizedContent],
        subtitle: getNoteSubtitle(
          normalizeMathEditorDisplay(normalizedContent),
        ),
      }));
      return true;
    },
    [normalizeForMathWorkspace, notes, updateNoteById],
  );

  const overwriteActiveFile = useCallback(
    (fileId: string, nextContent: string): boolean => {
      return writeNoteContentById(fileId, nextContent);
    },
    [writeNoteContentById],
  );

  const appendToActiveFile = useCallback(
    (fileId: string, appendContent: string): boolean => {
      const targetNote = notes.find((note) => note.id === fileId);
      if (!targetNote) {
        return false;
      }

      const currentValue = targetNote.content.join("\n\n");
      const shouldInsertBlockGap =
        currentValue.trim().length > 0 &&
        appendContent.trim().length > 0 &&
        !appendContent.startsWith("\n");
      const nextValue = shouldInsertBlockGap
        ? `${currentValue}\n\n${appendContent}`
        : `${currentValue}${appendContent}`;

      return writeNoteContentById(fileId, nextValue);
    },
    [notes, writeNoteContentById],
  );

  const replaceInActiveFile = useCallback(
    (fileId: string, find: string, replaceWith: string): number => {
      if (!find) {
        return 0;
      }

      const targetNote = notes.find((note) => note.id === fileId);
      if (!targetNote) {
        return 0;
      }

      const currentValue = targetNote.content.join("\n\n");
      const parts = currentValue.split(find);
      const replacementCount = Math.max(parts.length - 1, 0);
      if (replacementCount === 0) {
        return 0;
      }

      const nextValue = parts.join(replaceWith);
      writeNoteContentById(fileId, nextValue);

      return replacementCount;
    },
    [notes, writeNoteContentById],
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
        const measuredPaletteHeight =
          paletteContainerRef.current?.offsetHeight ?? 420;
        const placement = computePalettePlacement({
          caretTop: caretPosition.top,
          caretLeft: caretPosition.left,
          caretHeight: caretPosition.height,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          paletteWidth: 352,
          estimatedPaletteHeight: measuredPaletteHeight,
        });
        setPalettePosition(placement);
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
      const normalizedNextValue = normalizeForMathWorkspace(nextValue);

      updateSelectedNote((note) => ({
        ...note,
        content: [normalizedNextValue],
        subtitle: getNoteSubtitle(normalizedNextValue),
      }));

      closePalette();

      const nextCursorPosition =
        triggerStart + replacement.length - (command.cursorOffset ?? 0);
      window.requestAnimationFrame(() => {
        editor.focus();
        editor.setSelectionRange(nextCursorPosition, nextCursorPosition);
      });
    },
    [
      closePalette,
      normalizeForMathWorkspace,
      paletteTrigger,
      selectedNoteContent,
      updateSelectedNote,
    ],
  );

  const handleEditorChange = useCallback(
    (nextValue: string, cursorPosition: number) => {
      const normalizedDisplay = normalizeMathEditorDisplay(nextValue);
      updateSelectedNote((note) => ({
        ...note,
        content: [normalizedDisplay],
        subtitle: getNoteSubtitle(normalizedDisplay),
      }));

      if (isPaletteOpen && paletteTrigger?.source === "manual") {
        evaluateManualTrigger(normalizedDisplay, cursorPosition);
        return;
      }

      evaluateSlashTrigger(normalizedDisplay, cursorPosition);
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

  const handleExport = (format: ExportFormat) => {
    setIsExportOpen(false);
    const runtime = window.$typst;
    if (!runtime || !selectedNote) {
      window.alert("Typst runtime belum siap untuk export.");
      return;
    }

    const source = buildNormalizedTypstSource(
      selectedNote.title,
      selectedNoteContent,
    );

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
          const message = formatTypstRenderError(
            error,
            "Failed to export PDF.",
          );
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
    promptSaveBeforeFileSwitch();

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
    let resolvedNotes = initialNotes;

    try {
      const rawNotes = window.localStorage.getItem(STORAGE_NOTES_KEY);
      const rawSelectedNote = window.localStorage.getItem(
        STORAGE_SELECTED_NOTE_KEY,
      );
      const rawSidebarCollapsed = window.localStorage.getItem(
        STORAGE_SIDEBAR_COLLAPSED_KEY,
      );
      const rawOpenTabs = window.localStorage.getItem(STORAGE_OPEN_TABS_KEY);

      if (rawNotes) {
        const parsed = JSON.parse(rawNotes) as unknown;
        if (Array.isArray(parsed)) {
          const validNotes = parsed.filter((item) => {
            if (typeof item !== "object" || item === null) {
              return false;
            }
            const candidate = item as Partial<NoteItem>;
            return (
              typeof candidate.id === "string" &&
              typeof candidate.title === "string" &&
              typeof candidate.subtitle === "string" &&
              typeof candidate.modifiedLabel === "string" &&
              typeof candidate.modifiedAt === "number" &&
              Array.isArray(candidate.content)
            );
          }) as NoteItem[];

          if (validNotes.length === parsed.length) {
            resolvedNotes = validNotes;
            setNotes(validNotes);
            if (!rawSelectedNote) {
              setSelectedNoteId(validNotes[0]?.id ?? "");
            }
          }
        }
      }

      if (rawSelectedNote) {
        setSelectedNoteId(rawSelectedNote);
      }

      if (rawSidebarCollapsed === "false") {
        setIsSidebarCollapsed(false);
      }
      if (rawOpenTabs) {
        const parsedTabs = JSON.parse(rawOpenTabs) as unknown;
        if (
          Array.isArray(parsedTabs) &&
          parsedTabs.every((id) => typeof id === "string")
        ) {
          setOpenTabIds(parsedTabs);
        }
      }
    } catch {
      resolvedNotes = initialNotes;
      setNotes(initialNotes);
      setOpenTabIds(initialNotes.slice(0, 2).map((note) => note.id));
    } finally {
      setSavedNotesSnapshot(JSON.stringify(resolvedNotes));
      setIsHydratedFromStorage(true);
    }
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
    const noteIds = new Set(notes.map((note) => note.id));
    setOpenTabIds((previous) => {
      const filtered = previous.filter((id) => noteIds.has(id));
      if (filtered.length > 0) {
        return filtered;
      }
      const fallback =
        selectedNoteId && noteIds.has(selectedNoteId)
          ? [selectedNoteId]
          : notes[0]?.id
            ? [notes[0].id]
            : [];
      return fallback;
    });
  }, [notes, selectedNoteId]);

  useEffect(() => {
    if (!isHydratedFromStorage) {
      return;
    }

    window.localStorage.setItem(STORAGE_SELECTED_NOTE_KEY, selectedNoteId);
    window.localStorage.setItem(
      STORAGE_SIDEBAR_COLLAPSED_KEY,
      isSidebarCollapsed ? "true" : "false",
    );
    window.localStorage.setItem(
      STORAGE_OPEN_TABS_KEY,
      JSON.stringify(openTabIds),
    );
  }, [isHydratedFromStorage, isSidebarCollapsed, openTabIds, selectedNoteId]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

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

    void import("@myriaddreamin/typst-all-in-one.ts")
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
      //ctrl + s
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleManualSave();
        return;
      }

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
    handleManualSave,
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
    if (!isPaletteOpen || !paletteTrigger) {
      return;
    }

    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const updatePosition = () => {
      const cursorPosition = editor.selectionStart ?? paletteTrigger.end;
      positionPaletteAtCursor(cursorPosition);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    editor.addEventListener("scroll", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      editor.removeEventListener("scroll", updatePosition);
    };
  }, [isPaletteOpen, paletteQuery, paletteTrigger, positionPaletteAtCursor]);

  useEffect(() => {
    if (!isTypstReady || typeof window === "undefined") {
      return;
    }

    if (!selectedNote) {
      compileRequestIdRef.current += 1;
      setTypstPreviewSvg("");
      setTypstError(null);
      setIsTypstCompiling(false);
      return;
    }

    if (compileTimerRef.current) {
      window.clearTimeout(compileTimerRef.current);
    }

    const requestId = compileRequestIdRef.current + 1;
    compileRequestIdRef.current = requestId;

    compileTimerRef.current = window.setTimeout(() => {
      if (compileRequestIdRef.current !== requestId) {
        return;
      }

      const runtime = window.$typst;
      if (!runtime) {
        if (compileRequestIdRef.current !== requestId) {
          return;
        }
        setTypstError("Typst runtime is not available.");
        setIsTypstCompiling(false);
        return;
      }

      const source = buildNormalizedTypstSource(
        selectedNote.title,
        selectedNoteContent,
      );
      setIsTypstCompiling(true);
      setTypstError(null);

      runtime
        .svg({ mainContent: source })
        .then((svg) => {
          if (compileRequestIdRef.current !== requestId) {
            return;
          }
          setTypstPreviewSvg(svg);
        })
        .catch((error: unknown) => {
          if (compileRequestIdRef.current !== requestId) {
            return;
          }
          const message = formatTypstRenderError(error);
          setTypstError(message);
        })
        .finally(() => {
          if (compileRequestIdRef.current !== requestId) {
            return;
          }
          setIsTypstCompiling(false);
        });
    }, 200);

    return () => {
      if (compileTimerRef.current) {
        window.clearTimeout(compileTimerRef.current);
      }
      compileRequestIdRef.current += 1;
    };
  }, [isTypstReady, selectedNote, selectedNoteContent]);

  if (isLicenseStatusLoading || !licenseStatus?.licensed) {
    return (
      <LicenseGate
        status={licenseStatus}
        isLoading={isLicenseStatusLoading}
        isActivating={isActivatingLicense}
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
          <div className="recent-label"> Notes</div>
          <div className="notes-list">
            {visibleNotes.map((note) => (
              <button
                key={note.id}
                type="button"
                className={
                  note.id === selectedNote?.id
                    ? "note-card note-card-button"
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
          activeFile={activeAgentFile}
          onOverwriteActiveFile={overwriteActiveFile}
          onAppendToActiveFile={appendToActiveFile}
          onReplaceInActiveFile={replaceInActiveFile}
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
            <div className="editor-save-controls">
              <span
                className={
                  hasUnsavedChanges
                    ? "editor-save-indicator editor-save-indicator-dirty"
                    : "editor-save-indicator"
                }
              >
                {hasUnsavedChanges
                  ? "Unsaved changes (Ctrl+S to save)"
                  : "All changes saved"}
              </span>
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
                  onBlur={(event) => {
                    const element = event.currentTarget;
                    const normalizedValue = normalizeForMathWorkspace(
                      element.value,
                    );
                    if (normalizedValue === element.value) {
                      return;
                    }
                    updateSelectedNote((note) => ({
                      ...note,
                      content: [normalizedValue],
                      subtitle: getNoteSubtitle(normalizedValue),
                    }));
                  }}
                />

                {isPaletteOpen && (
                  <section
                    ref={paletteContainerRef}
                    className={`command-palette command-palette-animate ${palettePosition?.placement === "above" ? "command-palette-above" : "command-palette-below"}`}
                    aria-label="Math commands"
                    style={
                      palettePosition
                        ? {
                            position: "fixed",
                            top: `${palettePosition.top}px`,
                            left: `${palettePosition.left}px`,
                            maxHeight: `${palettePosition.maxHeight}px`,
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
                    <div className="palette-head">
                      <span className="palette-head-title">Typst Math Map</span>
                      <span className="palette-head-category">
                        {activePaletteCategoryLabel}
                      </span>
                    </div>
                    <div className="palette-list" ref={paletteListRef}>
                      {groupedPaletteCommands.map((group) => {
                        return (
                          <Fragment key={group.label}>
                            <div className="palette-group-label">
                              {group.label}
                            </div>
                            {group.items.map((command) => {
                              const globalIndex =
                                paletteCommandIndexById.get(command.id) ?? -1;
                              if (globalIndex < 0) {
                                return null;
                              }
                              return (
                                <button
                                  type="button"
                                  key={command.id}
                                  ref={(element) => {
                                    paletteItemRefs.current[globalIndex] =
                                      element;
                                  }}
                                  className={
                                    globalIndex === paletteIndex
                                      ? "palette-item palette-item-active"
                                      : "palette-item"
                                  }
                                  onMouseEnter={() =>
                                    setPaletteIndex(globalIndex)
                                  }
                                  onClick={() => applyPaletteCommand(command)}
                                >
                                  <div className="palette-item-left">
                                    <div className="palette-glyph" aria-hidden>
                                      {command.preview}
                                    </div>
                                    <div className="palette-item-meta">
                                      <span className="palette-name">
                                        {command.label}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="palette-shortcut-wrap">
                                    {command.level === "advanced" && (
                                      <span className="palette-advanced-tag">
                                        ADV
                                      </span>
                                    )}
                                    <span className="palette-shortcut">
                                      {command.shortcut}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </Fragment>
                        );
                      })}
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
