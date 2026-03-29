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

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: matchMediaMock,
});

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
  window.localStorage.clear();
  window.alert = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
