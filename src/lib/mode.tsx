import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type Mode = "brief" | "detail";

const STORAGE_KEY = "mwm.mode";
const VIEWPORT_BREAKPOINT = 900;
const VALID_MODES: ReadonlySet<string> = new Set(["brief", "detail"]);

function readUrlMode(): Mode | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("mode");
  return raw && VALID_MODES.has(raw) ? (raw as Mode) : null;
}

function readStorageMode(): Mode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw && VALID_MODES.has(raw) ? (raw as Mode) : null;
  } catch {
    return null;
  }
}

function viewportAutoMode(width: number): Mode {
  return width < VIEWPORT_BREAKPOINT ? "brief" : "detail";
}

/**
 * Resolve the active mode using the precedence:
 *   URL ?mode= > localStorage > viewport-auto.
 *
 * Pass the viewport width for testability.
 */
export function resolveMode(viewportWidth: number): Mode {
  return readUrlMode() ?? readStorageMode() ?? viewportAutoMode(viewportWidth);
}

/**
 * Imperatively set the mode (URL + localStorage). Triggers a custom event
 * so any subscribed <ModeProvider> instances re-resolve and re-render.
 */
export function setMode(mode: Mode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage may be disabled (Safari private mode) — fall through to URL
  }
  const url = new URL(window.location.href);
  url.searchParams.set("mode", mode);
  window.history.replaceState({}, "", url.toString());
  window.dispatchEvent(new CustomEvent("mwm:mode-change"));
}

const ModeContext = createContext<Mode>("detail");

interface ModeProviderProps {
  /** For test injection only — overrides URL/localStorage/viewport resolution. */
  initialMode?: Mode;
  children: ReactNode;
}

export function ModeProvider({ initialMode, children }: ModeProviderProps) {
  // Initial resolution: prefer caller-supplied initialMode, then full precedence chain.
  const [mode, setLocalMode] = useState<Mode>(() => {
    if (initialMode) return initialMode;
    if (typeof window === "undefined") return "detail";
    return resolveMode(window.innerWidth);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Listen for setMode() calls from anywhere in the app
    const onModeChange = () => setLocalMode(resolveMode(window.innerWidth));
    window.addEventListener("mwm:mode-change", onModeChange);

    // Listen for cross-tab localStorage updates
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) onModeChange();
    };
    window.addEventListener("storage", onStorage);

    // Viewport resize: ONLY apply viewport-auto if the user has NOT explicitly
    // set a mode (URL or localStorage). Once explicit, the choice persists.
    const onResize = () => {
      if (readUrlMode() !== null || readStorageMode() !== null) return;
      setLocalMode(viewportAutoMode(window.innerWidth));
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("mwm:mode-change", onModeChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <ModeContext.Provider value={mode}>{children}</ModeContext.Provider>;
}

export function useMode(): Mode {
  return useContext(ModeContext);
}
