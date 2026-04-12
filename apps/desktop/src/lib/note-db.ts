import Database from "@tauri-apps/plugin-sql";
import type { LicenseSessionPayload } from "./license-types";

export type NoteCategory = "Calculus" | "Algebra" | "Physics" | "Thermo";

export type NoteRecord = {
  id: string;
  title: string;
  subtitle: string;
  category: NoteCategory;
  modifiedAt: number;
  content: string;
};

export type AppStateRecord = {
  selectedNoteId: string | null;
  sidebarCollapsed: boolean;
  openTabIds: string[];
};

const DB_URL = "sqlite:mathend.db";
const APP_STATE_ID = "singleton";
const LICENSE_STATE_ID = "singleton";

const seedNotes: NoteRecord[] = [
  {
    id: "n-1",
    title: "calculus-notes.md",
    subtitle: "Limits and derivatives",
    category: "Calculus",
    modifiedAt: 1792836000000,
    content:
      "# Limits and Derivatives\n\nThe derivative of a function measures the rate of change.\n\nPress Ctrl+K or type / to open the math palette.",
  },
  {
    id: "n-2",
    title: "linear-algebra.md",
    subtitle: "Matrix transformations",
    category: "Algebra",
    modifiedAt: 1792663200000,
    content:
      "# Matrix Transformations\n\nA matrix can represent scaling, rotation, and projection in compact form.",
  },
  {
    id: "n-3",
    title: "physics-formulas.md",
    subtitle: "Kinematics equations",
    category: "Physics",
    modifiedAt: 1792317600000,
    content:
      "# Kinematics\n\ns = ut + 1/2 at^2\n\nSplit vectors into x and y components for easier solving.",
  },
  {
    id: "n-4",
    title: "thermodynamics.md",
    subtitle: "Laws of thermodynamics",
    category: "Thermo",
    modifiedAt: 1792058400000,
    content:
      "# Thermodynamics\n\nFirst law: energy is conserved in a closed system.\nSecond law: entropy tends to increase in isolated systems.",
  },
];

let dbPromise: Promise<Database> | null = null;

const getDb = async (): Promise<Database> => {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL);
  }
  return dbPromise;
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    return value === "1" || value.toLowerCase() === "true";
  }
  return false;
};

const parseOpenTabs = (raw: unknown): string[] => {
  if (typeof raw !== "string" || raw.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
};

export const initNoteDb = async (): Promise<void> => {
  const db = await getDb();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      category TEXT NOT NULL,
      modified_at INTEGER NOT NULL,
      content TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_state (
      id TEXT PRIMARY KEY,
      selected_note_id TEXT,
      sidebar_collapsed INTEGER NOT NULL DEFAULT 0,
      open_tab_ids TEXT NOT NULL DEFAULT '[]'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS license_state (
      id TEXT PRIMARY KEY,
      session_json TEXT NOT NULL
    )
  `);

  const noteCountRows = await db.select<Array<{ count: number }>>(
    "SELECT COUNT(*) as count FROM notes",
  );
  const noteCount = noteCountRows[0]?.count ?? 0;

  if (noteCount === 0) {
    for (const note of seedNotes) {
      await db.execute(
        "INSERT INTO notes (id, title, subtitle, category, modified_at, content) VALUES (?, ?, ?, ?, ?, ?)",
        [
          note.id,
          note.title,
          note.subtitle,
          note.category,
          note.modifiedAt,
          note.content,
        ],
      );
    }
  }

  await db.execute(
    "INSERT OR IGNORE INTO app_state (id, selected_note_id, sidebar_collapsed, open_tab_ids) VALUES (?, ?, ?, ?)",
    [
      APP_STATE_ID,
      seedNotes[0]?.id ?? null,
      0,
      JSON.stringify(seedNotes.slice(0, 2).map((note) => note.id)),
    ],
  );
};

export const loadNotesFromDb = async (): Promise<NoteRecord[]> => {
  const db = await getDb();
  const rows = await db.select<
    Array<{
      id: string;
      title: string;
      subtitle: string;
      category: string;
      modified_at: number;
      content: string;
    }>
  >(
    "SELECT id, title, subtitle, category, modified_at, content FROM notes ORDER BY modified_at DESC",
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    category:
      row.category === "Algebra" ||
      row.category === "Physics" ||
      row.category === "Thermo"
        ? row.category
        : "Calculus",
    modifiedAt: row.modified_at,
    content: row.content,
  }));
};

export const loadAppStateFromDb = async (): Promise<AppStateRecord> => {
  const db = await getDb();
  const rows = await db.select<
    Array<{
      selected_note_id: string | null;
      sidebar_collapsed: number | boolean;
      open_tab_ids: string;
    }>
  >(
    "SELECT selected_note_id, sidebar_collapsed, open_tab_ids FROM app_state WHERE id = ? LIMIT 1",
    [APP_STATE_ID],
  );

  const row = rows[0];
  return {
    selectedNoteId: row?.selected_note_id ?? null,
    sidebarCollapsed: toBoolean(row?.sidebar_collapsed ?? 0),
    openTabIds: parseOpenTabs(row?.open_tab_ids ?? "[]"),
  };
};

export const saveNotesToDb = async (notes: NoteRecord[]): Promise<void> => {
  const db = await getDb();
  await db.execute("DELETE FROM notes");

  for (const note of notes) {
    await db.execute(
      "INSERT INTO notes (id, title, subtitle, category, modified_at, content) VALUES (?, ?, ?, ?, ?, ?)",
      [
        note.id,
        note.title,
        note.subtitle,
        note.category,
        note.modifiedAt,
        note.content,
      ],
    );
  }
};

export const saveAppStateToDb = async (
  state: AppStateRecord,
): Promise<void> => {
  const db = await getDb();
  await db.execute(
    "INSERT OR REPLACE INTO app_state (id, selected_note_id, sidebar_collapsed, open_tab_ids) VALUES (?, ?, ?, ?)",
    [
      APP_STATE_ID,
      state.selectedNoteId,
      state.sidebarCollapsed ? 1 : 0,
      JSON.stringify(state.openTabIds),
    ],
  );
};

const parseLicenseSession = (raw: unknown): LicenseSessionPayload | null => {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LicenseSessionPayload>;
    if (
      parsed.version !== 1 ||
      typeof parsed.productId !== "string" ||
      typeof parsed.checkoutUrl !== "string" ||
      typeof parsed.licenseKey !== "string" ||
      typeof parsed.licenseKeyPreview !== "string" ||
      typeof parsed.buyerEmail !== "string" ||
      typeof parsed.saleId !== "string" ||
      typeof parsed.activatedAt !== "string" ||
      typeof parsed.lastVerifiedAt !== "string"
    ) {
      return null;
    }

    return {
      version: 1,
      productId: parsed.productId,
      checkoutUrl: parsed.checkoutUrl,
      licenseKey: parsed.licenseKey,
      licenseKeyPreview: parsed.licenseKeyPreview,
      buyerEmail: parsed.buyerEmail,
      saleId: parsed.saleId,
      activatedAt: parsed.activatedAt,
      lastVerifiedAt: parsed.lastVerifiedAt,
    };
  } catch {
    return null;
  }
};

export const loadLicenseSessionFromDb =
  async (): Promise<LicenseSessionPayload | null> => {
    const db = await getDb();
    const rows = await db.select<
      Array<{
        session_json: string;
      }>
    >("SELECT session_json FROM license_state WHERE id = ? LIMIT 1", [
      LICENSE_STATE_ID,
    ]);

    return parseLicenseSession(rows[0]?.session_json ?? null);
  };

export const saveLicenseSessionToDb = async (
  payload: LicenseSessionPayload,
): Promise<void> => {
  const db = await getDb();
  await db.execute(
    "INSERT OR REPLACE INTO license_state (id, session_json) VALUES (?, ?)",
    [LICENSE_STATE_ID, JSON.stringify(payload)],
  );
};

export const clearLicenseSessionInDb = async (): Promise<void> => {
  const db = await getDb();
  await db.execute("DELETE FROM license_state WHERE id = ?", [
    LICENSE_STATE_ID,
  ]);
};
