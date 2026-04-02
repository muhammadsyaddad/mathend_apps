import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

const matchMediaMock = vi.fn((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

const ensureLocalStorage = () => {
  if (typeof window.localStorage?.clear === "function") {
    return;
  }

  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
      key: (index: number) => {
        return Array.from(store.keys())[index] ?? null;
      },
      get length() {
        return store.size;
      },
    } satisfies Storage,
  });
};

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: matchMediaMock,
});

ensureLocalStorage();

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return window.setTimeout(() => callback(Date.now()), 0);
  };
}

if (!window.cancelAnimationFrame) {
  window.cancelAnimationFrame = (id: number) => {
    window.clearTimeout(id);
  };
}

beforeEach(() => {
  ensureLocalStorage();
  window.localStorage.clear();
  window.alert = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
