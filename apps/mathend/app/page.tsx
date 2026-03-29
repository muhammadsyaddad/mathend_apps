"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExportModal, type ExportFormat } from "./components/export-modal";

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

type NoteActionMenuState = {
  noteId: string;
  top: number;
  left: number;
};

const recentNotes: NoteItem[] = [
  {
    id: "n-1",
    title: "Calculus Notes",
    subtitle: "Limits and Derivatives",
    category: "Calculus",
    modifiedLabel: "Oct 24",
    modifiedAt: new Date("2026-10-24T10:00:00Z").getTime(),
    content: [
      "Welcome to your distraction-free workspace. Use the sidebar to navigate or create new notes.\n\nThe derivative of a function measures how the function value changes as its input changes.",
    ],
  },
  {
    id: "n-2",
    title: "Linear Algebra",
    subtitle: "Matrix Transformations",
    category: "Algebra",
    modifiedLabel: "Oct 22",
    modifiedAt: new Date("2026-10-22T10:00:00Z").getTime(),
    content: [
      "Matrices let us describe linear transformations in a compact form.\n\nA basis change can simplify a transformation by diagonalizing the matrix when possible.",
    ],
  },
  {
    id: "n-3",
    title: "Physics Formulas",
    subtitle: "Kinematics Equations",
    category: "Physics",
    modifiedLabel: "Oct 18",
    modifiedAt: new Date("2026-10-18T10:00:00Z").getTime(),
    content: [
      "Uniform acceleration can be modeled with s = ut + 1/2 at^2.\n\nVector form is useful when splitting motion into x and y components.",
    ],
  },
  {
    id: "n-4",
    title: "Thermodynamics",
    subtitle: "Laws of Thermo",
    category: "Thermo",
    modifiedLabel: "Oct 15",
    modifiedAt: new Date("2026-10-15T10:00:00Z").getTime(),
    content: [
      "The first law states that energy is conserved in closed systems.\n\nEntropy tends to increase for spontaneous processes in isolated systems.",
    ],
  },
];

const commands: CommandItem[] = [
  {
    id: "c-1",
    label: "Fraction",
    shortcut: "/frac",
    preview: "a\n──\nb",
    insertText: "□\n───\n□",
    appendSpace: false,
    cursorOffset: 7,
    active: true,
  },
  {
    id: "c-2",
    label: "Square Root",
    shortcut: "/sqrt",
    preview: "√x",
    insertText: "√()",
    cursorOffset: 2,
  },
  {
    id: "c-3",
    label: "Integral",
    shortcut: "/int",
    preview: "∫",
    insertText: "∫() dx",
    cursorOffset: 5,
  },
  {
    id: "c-4",
    label: "Limit",
    shortcut: "/lim",
    preview: "lim",
    insertText: "lim(x→)",
    cursorOffset: 2,
  },
  {
    id: "c-5",
    label: "Differential",
    shortcut: "/diff",
    preview: "d/dx",
    insertText: "d/dx",
  },
  {
    id: "c-6",
    label: "Dot Product",
    shortcut: "/dot",
    preview: "⋅",
    insertText: "⋅",
  },
  {
    id: "c-7",
    label: "N-th Root",
    shortcut: "/root",
    preview: "ⁿ√x",
    insertText: "ⁿ√()",
    cursorOffset: 2,
  },
  {
    id: "c-8",
    label: "Summation",
    shortcut: "/sum",
    preview: "∑",
    insertText: "∑",
  },
  { id: "c-9", label: "Pi", shortcut: "/pi", preview: "π", insertText: "π" },
  {
    id: "c-10",
    label: "Infinity",
    shortcut: "/inf",
    preview: "∞",
    insertText: "∞",
  },
  {
    id: "c-11",
    label: "Superscript",
    shortcut: "/sup",
    preview: "xⁿ",
    insertText: "xⁿ",
  },
  {
    id: "c-12",
    label: "Subscript",
    shortcut: "/sub",
    preview: "xₙ",
    insertText: "xₙ",
  },
];

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

const LONG_PRESS_DURATION_MS = 430;

const STORAGE_NOTES_KEY = "mathend.notes.v1";
const STORAGE_SELECTED_NOTE_KEY = "mathend.selected-note.v1";
const STORAGE_SIDEBAR_COLLAPSED_KEY = "mathend.sidebar-collapsed.v1";

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

export default function Home() {
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const paletteListRef = useRef<HTMLDivElement | null>(null);
  const paletteItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const noteActionMenuRef = useRef<HTMLDivElement | null>(null);
  const noteLongPressTimeoutRef = useRef<number | null>(null);
  const suppressNoteClickRef = useRef(false);
  const saveToastTimeoutRef = useRef<number | null>(null);
  const didInitPersistRef = useRef(false);
  const suppressAutoSaveToastRef = useRef(false);

  const [notes, setNotes] = useState<NoteItem[]>(recentNotes);
  const [selectedNoteId, setSelectedNoteId] = useState(
    recentNotes[0]?.id ?? "",
  );
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
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
  const [palettePosition, setPalettePosition] =
    useState<PalettePosition | null>(null);
  const [noteActionMenu, setNoteActionMenu] =
    useState<NoteActionMenuState | null>(null);

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

  const filteredCommands = useMemo(() => {
    const query = paletteQuery.trim().toLowerCase();
    if (!query) {
      return commands;
    }
    return commands.filter((command) => {
      return (
        command.label.toLowerCase().includes(query) ||
        command.shortcut.toLowerCase().includes(`/${query}`)
      );
    });
  }, [paletteQuery]);

  const isDesktopViewport = useCallback((): boolean => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.matchMedia("(min-width: 981px)").matches;
  }, []);

  const openExportModal = useCallback(() => {
    setIsExportOpen(true);
  }, []);

  const closeExportModal = useCallback(() => {
    setIsExportOpen(false);
  }, []);

  const closeNoteActionMenu = useCallback(() => {
    setNoteActionMenu(null);
  }, []);

  const openNoteActionMenu = useCallback(
    (noteId: string, anchorElement: HTMLElement) => {
      const rect = anchorElement.getBoundingClientRect();
      const menuWidth = 168;
      const menuHeight = 96;
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

  const selectNote = useCallback((noteId: string) => {
    setSelectedNoteId(noteId);
    setIsSidebarOpenMobile(false);
    setNoteActionMenu(null);
  }, []);

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
        const stillHasSelected = next.some(
          (note) => note.id === selectedNoteId,
        );

        if (!stillHasSelected) {
          setSelectedNoteId(next[0]?.id ?? "");
        }

        return next;
      });
    },
    [notes, selectedNoteId],
  );

  const handleExportNote = useCallback(
    (noteId: string) => {
      setSelectedNoteId(noteId);
      setNoteActionMenu(null);
      openExportModal();
    },
    [openExportModal],
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

  const evaluateSlashTrigger = useCallback(
    (text: string, cursorPosition: number) => {
      const beforeCursor = text.slice(0, cursorPosition);
      const triggerMatch = beforeCursor.match(/(^|\s)\/([^\s/]*)$/);

      if (!triggerMatch) {
        setIsPaletteOpen(false);
        setPaletteQuery("");
        setPalettePosition(null);
        return;
      }

      setPaletteQuery(triggerMatch[2] ?? "");
      setPaletteIndex(0);

      const editor = editorRef.current;
      if (editor && window.innerWidth > 640) {
        const caretPosition = getCaretPositionInTextarea(
          editor,
          cursorPosition,
        );
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
        }
      } else {
        setPalettePosition(null);
      }

      setIsPaletteOpen(true);
    },
    [],
  );

  const applyPaletteCommand = useCallback(
    (command: CommandItem) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      const selectionStart = editor.selectionStart ?? 0;
      const selectionEnd = editor.selectionEnd ?? selectionStart;
      const before = selectedNoteContent.slice(0, selectionStart);
      const triggerMatch = before.match(/(^|\s)\/([^\s/]*)$/);
      if (!triggerMatch || triggerMatch.index === undefined) {
        return;
      }

      const leadingWhitespace = triggerMatch[1] ?? "";
      const triggerStart = triggerMatch.index + leadingWhitespace.length;
      const replacement =
        command.appendSpace === false
          ? command.insertText
          : `${command.insertText} `;
      const nextValue =
        selectedNoteContent.slice(0, triggerStart) +
        replacement +
        selectedNoteContent.slice(selectionEnd);

      updateSelectedNote((note) => ({
        ...note,
        content: [nextValue],
        subtitle: nextValue.slice(0, 38),
      }));

      setPaletteQuery("");
      setIsPaletteOpen(false);
      setPalettePosition(null);

      const nextCursorPosition =
        triggerStart + replacement.length - (command.cursorOffset ?? 0);
      window.requestAnimationFrame(() => {
        editor.focus();
        editor.setSelectionRange(nextCursorPosition, nextCursorPosition);
      });
    },
    [selectedNoteContent, updateSelectedNote],
  );

  const handleEditorChange = useCallback(
    (nextValue: string, cursorPosition: number) => {
      updateSelectedNote((note) => ({
        ...note,
        content: [nextValue],
        subtitle: nextValue.slice(0, 38),
      }));
      evaluateSlashTrigger(nextValue, cursorPosition);
    },
    [evaluateSlashTrigger, updateSelectedNote],
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
    window.alert(`Prototype export started: ${format.toUpperCase()}`);
  };

  const createNewNote = () => {
    const timestamp = Date.now();
    const newNote: NoteItem = {
      id: `n-${timestamp}`,
      title: "Untitled Note",
      subtitle: "Quick draft",
      category: "Calculus",
      modifiedLabel: "Now",
      modifiedAt: timestamp,
      content: ["Start writing your new note here."],
    };

    setNotes((previous) => [newNote, ...previous]);
    setSelectedNoteId(newNote.id);
    setNoteActionMenu(null);
    setIsSidebarOpenMobile(false);
  };

  useEffect(() => {
    try {
      const rawNotes = window.localStorage.getItem(STORAGE_NOTES_KEY);
      const rawSelectedNote = window.localStorage.getItem(
        STORAGE_SELECTED_NOTE_KEY,
      );
      const rawSidebarCollapsed = window.localStorage.getItem(
        STORAGE_SIDEBAR_COLLAPSED_KEY,
      );

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
            setNotes(validNotes);
            if (!rawSelectedNote) {
              const firstNote = validNotes.at(0);
              setSelectedNoteId(firstNote?.id ?? "");
            }
          }
        }
      }

      if (rawSelectedNote) {
        setSelectedNoteId(rawSelectedNote);
      }

      if (rawSidebarCollapsed === "true") {
        setIsSidebarCollapsed(true);
      }
    } catch {
      setNotes(recentNotes);
    } finally {
      setIsHydratedFromStorage(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydratedFromStorage) {
      return;
    }

    if (!didInitPersistRef.current) {
      didInitPersistRef.current = true;
      return;
    }

    window.localStorage.setItem(STORAGE_NOTES_KEY, JSON.stringify(notes));
    window.localStorage.setItem(STORAGE_SELECTED_NOTE_KEY, selectedNoteId);
    window.localStorage.setItem(
      STORAGE_SIDEBAR_COLLAPSED_KEY,
      isSidebarCollapsed ? "true" : "false",
    );

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
  }, [isHydratedFromStorage, isSidebarCollapsed, notes, selectedNoteId]);

  useEffect(() => {
    return () => {
      if (saveToastTimeoutRef.current) {
        window.clearTimeout(saveToastTimeoutRef.current);
      }
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
    if (!selectedNote) {
      return;
    }

    const noteStillVisible = visibleNotes.some(
      (note) => note.id === selectedNote.id,
    );
    if (!noteStillVisible && visibleNotes[0]) {
      setSelectedNoteId(visibleNotes[0].id);
    }
  }, [selectedNote, visibleNotes]);

  return (
    <div
      className={`library-app-shell ${isSidebarOpenMobile ? "sidebar-open-mobile" : ""} ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}
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
            aria-label="Collapse sidebar"
            className="icon-action sidebar-shrink-toggle"
            onClick={toggleSidebarMode}
          >
            {isSidebarCollapsed ? "››" : "‹‹"}
          </button>
          <button
            type="button"
            className="new-note-button"
            onClick={createNewNote}
          >
            <span aria-hidden>+</span>
            New Note
          </button>
        </div>

        <div className="sidebar-content">
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
                  <span className="note-icon" aria-hidden>
                    •
                  </span>
                  <h2 className="note-title">{note.title}</h2>
                </div>
                <div className="note-subrow">
                  <p className="note-subtitle">{note.subtitle}</p>
                  <span className="note-date">{note.modifiedLabel}</span>
                </div>
              </button>
            ))}

            {visibleNotes.length === 0 && (
              <div className="no-note-state">No notes yet. Create one now.</div>
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <Link href="/settings" className="nav-item settings-link">
            <span className="nav-icon" aria-hidden>
              ⚙
            </span>
            <span className="nav-item-label">Settings</span>
          </Link>
        </div>
      </aside>

      <main className="editor-canvas">
        <div className="editor-wrap">
          <div className="editor-heading-row">
            <div className="editor-title-group">
              <button
                type="button"
                className="mobile-sidebar-toggle"
                onClick={() => setIsSidebarOpenMobile((value) => !value)}
              >
                Notes
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
                      selectedNote?.title ?? "Document Library";
                    return;
                  }
                  updateSelectedNote((note) => ({ ...note, title: nextTitle }));
                }}
              >
                {selectedNote?.title ?? "Document Library"}
              </h2>
            </div>
          </div>

          <div className="editor-body">
            <div key={selectedNote?.id ?? "palette"} className="palette-anchor">
              <textarea
                key={selectedNote?.id ?? "editor"}
                ref={editorRef}
                className="note-editor-textarea"
                value={selectedNoteContent}
                placeholder="Start writing your note..."
                onKeyDown={(event) => {
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
                }}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  const cursor =
                    event.target.selectionStart ?? nextValue.length;
                  handleEditorChange(nextValue, cursor);
                }}
                onClick={(event) => {
                  const element = event.currentTarget;
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
                      event.key === "Enter")
                  ) {
                    return;
                  }

                  const element = event.currentTarget;
                  evaluateSlashTrigger(
                    element.value,
                    element.selectionStart ?? element.value.length,
                  );
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
                  <div className="palette-head">Math Commands</div>
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
                          <span className="palette-name">{command.label}</span>
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
                    <span>Use arrows + Enter</span>
                    <span className="enter-key">↵</span>
                  </div>
                </section>
              )}
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
            className="note-action-menu-item note-action-menu-danger"
            onClick={() => handleDeleteNote(noteActionMenu.noteId)}
          >
            Delete note
          </button>
        </div>
      )}

      {showSaveToast && <div className="save-toast">{saveToastMessage}</div>}

      <ExportModal
        isOpen={isExportOpen}
        onClose={closeExportModal}
        onExport={handleExport}
      />
    </div>
  );
}
