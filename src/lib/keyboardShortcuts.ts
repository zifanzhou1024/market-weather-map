import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setMode, useMode } from "./mode";
import { resolveLocale, setLocale } from "./i18n";

const G_PREFIX_TIMEOUT_MS = 1200;

/**
 * Vim-style "g <letter>" navigation map. Press `g`, then a second key within
 * G_PREFIX_TIMEOUT_MS, to navigate. Channel and history sub-tabs are
 * deliberately not bound — click them from within the parent route.
 */
const NAV_BINDINGS: Record<string, string> = {
  o: "/",
  s: "/short-term",
  l: "/long-term",
  f: "/fragility",
  c: "/channels",
  h: "/history",
  d: "/diff",
  m: "/methodology"
};

/**
 * Skip the global listener when the user is typing into a form field or
 * contenteditable region. Prevents shortcuts from hijacking normal input.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  // Fallback: some environments don't populate isContentEditable for the IDL
  // boolean attribute syntax — inspect the attribute directly.
  const ce = target.getAttribute("contenteditable");
  if (ce !== null && ce !== "false") return true;
  return false;
}

interface UseShortcutsReturn {
  showHelp: boolean;
  closeHelp: () => void;
}

/**
 * Mount once at the app level. Installs a document-level `keydown` listener
 * that wires up Vim-style "g <letter>" navigation, the `?` help overlay,
 * `b` for Brief/Detail toggle, and `Esc` to close the overlay / cancel the
 * `g` prefix.
 *
 * Modifier keys (Cmd, Ctrl, Alt) are never overridden — Cmd+G, Ctrl+R etc.
 * pass through to the browser. Typing into <input>, <textarea>, <select>,
 * or contenteditable regions does not trigger shortcuts.
 */
export function useKeyboardShortcuts(): UseShortcutsReturn {
  const navigate = useNavigate();
  const mode = useMode();
  const [gPrefixActive, setGPrefixActive] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const closeHelp = useCallback(() => setShowHelp(false), []);

  // g-prefix auto-cancels after the timeout
  useEffect(() => {
    if (!gPrefixActive) return;
    const t = setTimeout(() => setGPrefixActive(false), G_PREFIX_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [gPrefixActive]);

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      // Modifier-free only — never override browser shortcuts (Cmd+G, Ctrl+R, etc.)
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Skip when the user is typing in a form field
      if (isEditableTarget(e.target)) return;

      // Esc always closes help / cancels prefix
      if (e.key === "Escape") {
        if (showHelp) {
          e.preventDefault();
          setShowHelp(false);
        }
        if (gPrefixActive) {
          e.preventDefault();
          setGPrefixActive(false);
        }
        return;
      }

      // Shift+/ -> "?" -> toggle help
      if (e.key === "?") {
        e.preventDefault();
        setShowHelp((s) => !s);
        return;
      }

      // Help overlay is open — only Esc / "?" interact; everything else passes through
      if (showHelp) return;

      // g prefix mode: second key picks a destination or action
      if (gPrefixActive) {
        const key = e.key.toLowerCase();
        if (key === "i") {
          // Toggle locale: en <-> zh. `l` is already bound to /long-term, so
          // language toggle uses `i` (i18n / international).
          e.preventDefault();
          const current = resolveLocale();
          setLocale(current === "en" ? "zh" : "en");
        } else if (key in NAV_BINDINGS) {
          e.preventDefault();
          navigate(NAV_BINDINGS[key]);
        }
        setGPrefixActive(false);
        return;
      }

      // Open g prefix
      if (e.key === "g") {
        e.preventDefault();
        setGPrefixActive(true);
        return;
      }

      // Standalone toggles
      if (e.key === "b") {
        e.preventDefault();
        setMode(mode === "brief" ? "detail" : "brief");
        return;
      }
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [navigate, mode, gPrefixActive, showHelp]);

  return { showHelp, closeHelp };
}
