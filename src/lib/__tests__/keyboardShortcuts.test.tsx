import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useKeyboardShortcuts } from "../keyboardShortcuts";
import { ModeProvider, useMode } from "../mode";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement;
let root: Root | undefined;

// Mount the hook + expose location + mode for assertions.
function Probe({
  onLocation,
  onMode,
  onHelp
}: {
  onLocation?: (path: string) => void;
  onMode?: (m: string) => void;
  onHelp?: (open: boolean) => void;
}) {
  const { showHelp } = useKeyboardShortcuts();
  const loc = useLocation();
  const mode = useMode();
  onLocation?.(loc.pathname);
  onMode?.(mode);
  onHelp?.(showHelp);
  return (
    <div>
      <input data-testid="text-input" />
      <textarea data-testid="text-area" />
      <div contentEditable data-testid="ce" />
    </div>
  );
}

function renderApp(opts: {
  initialPath?: string;
  onLocation?: (path: string) => void;
  onMode?: (m: string) => void;
  onHelp?: (open: boolean) => void;
}) {
  act(() => {
    root = createRoot(container);
    root.render(
      <MemoryRouter initialEntries={[opts.initialPath ?? "/"]}>
        <ModeProvider initialMode="detail">
          <Routes>
            <Route
              path="*"
              element={
                <Probe
                  onLocation={opts.onLocation}
                  onMode={opts.onMode}
                  onHelp={opts.onHelp}
                />
              }
            />
          </Routes>
        </ModeProvider>
      </MemoryRouter>
    );
  });
}

function fireKey(
  key: string,
  init: Partial<KeyboardEventInit> = {},
  target: EventTarget = window
): boolean {
  const ev = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init
  });
  return target.dispatchEvent(ev);
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = undefined;
  }
  if (container.parentNode) container.parentNode.removeChild(container);
});

describe("useKeyboardShortcuts — navigation (g prefix)", () => {
  test("g o navigates to /", () => {
    let path = "";
    renderApp({ initialPath: "/short-term", onLocation: (p) => (path = p) });
    act(() => {
      fireKey("g");
    });
    act(() => {
      fireKey("o");
    });
    expect(path).toBe("/");
  });

  test("g s navigates to /short-term", () => {
    let path = "";
    renderApp({ onLocation: (p) => (path = p) });
    act(() => {
      fireKey("g");
    });
    act(() => {
      fireKey("s");
    });
    expect(path).toBe("/short-term");
  });

  test("g d navigates to /diff", () => {
    let path = "";
    renderApp({ onLocation: (p) => (path = p) });
    act(() => {
      fireKey("g");
    });
    act(() => {
      fireKey("d");
    });
    expect(path).toBe("/diff");
  });

  test("all g <letter> bindings hit the expected route", () => {
    const expected: Array<[string, string]> = [
      ["o", "/"],
      ["s", "/short-term"],
      ["l", "/long-term"],
      ["f", "/fragility"],
      ["c", "/channels"],
      ["h", "/history"],
      ["d", "/diff"],
      ["m", "/methodology"]
    ];
    for (const [letter, route] of expected) {
      let path = "";
      renderApp({ onLocation: (p) => (path = p) });
      act(() => {
        fireKey("g");
      });
      act(() => {
        fireKey(letter);
      });
      expect(path, `g ${letter} should navigate to ${route}`).toBe(route);
      // tear down between iterations so renderApp can re-create cleanly
      act(() => root?.unmount());
      root = undefined;
    }
  });

  test("g prefix times out after 1.2s — second key after the timeout is ignored", () => {
    vi.useFakeTimers();
    try {
      let path = "";
      renderApp({ initialPath: "/short-term", onLocation: (p) => (path = p) });
      act(() => {
        fireKey("g");
      });
      // Advance past the 1.2s timeout
      act(() => {
        vi.advanceTimersByTime(1300);
      });
      act(() => {
        fireKey("o");
      });
      // No navigation should have occurred
      expect(path).toBe("/short-term");
    } finally {
      vi.useRealTimers();
    }
  });

  test("g followed by an unbound letter cancels the prefix without navigating", () => {
    let path = "";
    renderApp({ initialPath: "/short-term", onLocation: (p) => (path = p) });
    act(() => {
      fireKey("g");
    });
    act(() => {
      fireKey("x");
    });
    expect(path).toBe("/short-term");
  });
});

describe("useKeyboardShortcuts — help overlay (?)", () => {
  test("? toggles the help overlay state", () => {
    let open = false;
    renderApp({ onHelp: (o) => (open = o) });
    expect(open).toBe(false);
    act(() => {
      fireKey("?");
    });
    expect(open).toBe(true);
    act(() => {
      fireKey("?");
    });
    expect(open).toBe(false);
  });

  test("Esc closes an open help overlay", () => {
    let open = false;
    renderApp({ onHelp: (o) => (open = o) });
    act(() => {
      fireKey("?");
    });
    expect(open).toBe(true);
    act(() => {
      fireKey("Escape");
    });
    expect(open).toBe(false);
  });

  test("while overlay is open, g and b do nothing", () => {
    let path = "";
    let mode = "";
    renderApp({ onLocation: (p) => (path = p), onMode: (m) => (mode = m) });
    act(() => {
      fireKey("?");
    });
    act(() => {
      fireKey("g");
    });
    act(() => {
      fireKey("d");
    });
    expect(path).toBe("/");
    act(() => {
      fireKey("b");
    });
    expect(mode).toBe("detail");
  });
});

describe("useKeyboardShortcuts — Brief/Detail toggle (b)", () => {
  test("b flips mode from detail to brief", () => {
    let mode = "";
    renderApp({ onMode: (m) => (mode = m) });
    expect(mode).toBe("detail");
    act(() => {
      fireKey("b");
    });
    expect(mode).toBe("brief");
  });

  test("b is reversible — pressing again flips back to detail", () => {
    let mode = "";
    renderApp({ onMode: (m) => (mode = m) });
    act(() => {
      fireKey("b");
    });
    expect(mode).toBe("brief");
    act(() => {
      fireKey("b");
    });
    expect(mode).toBe("detail");
  });
});

describe("useKeyboardShortcuts — skip cases", () => {
  test("Cmd+g does NOT activate the prefix (modifier passes through)", () => {
    let path = "";
    renderApp({ initialPath: "/short-term", onLocation: (p) => (path = p) });
    act(() => {
      fireKey("g", { metaKey: true });
    });
    act(() => {
      fireKey("o");
    });
    // No navigation: Cmd+g was a noop, then a bare "o" with no prefix is also a noop
    expect(path).toBe("/short-term");
  });

  test("Ctrl+b does NOT toggle mode", () => {
    let mode = "";
    renderApp({ onMode: (m) => (mode = m) });
    act(() => {
      fireKey("b", { ctrlKey: true });
    });
    expect(mode).toBe("detail");
  });

  test("Alt+? does NOT open help", () => {
    let open = false;
    renderApp({ onHelp: (o) => (open = o) });
    act(() => {
      fireKey("?", { altKey: true });
    });
    expect(open).toBe(false);
  });

  test("typing 'g' inside an <input> does NOT activate the prefix", () => {
    let path = "";
    renderApp({ initialPath: "/short-term", onLocation: (p) => (path = p) });
    const input = container.querySelector<HTMLInputElement>("[data-testid='text-input']");
    expect(input).toBeTruthy();
    input!.focus();
    act(() => {
      fireKey("g", {}, input!);
    });
    act(() => {
      fireKey("o", {}, input!);
    });
    expect(path).toBe("/short-term");
  });

  test("typing 'b' inside a <textarea> does NOT toggle mode", () => {
    let mode = "";
    renderApp({ onMode: (m) => (mode = m) });
    const ta = container.querySelector<HTMLTextAreaElement>("[data-testid='text-area']");
    expect(ta).toBeTruthy();
    ta!.focus();
    act(() => {
      fireKey("b", {}, ta!);
    });
    expect(mode).toBe("detail");
  });

  test("typing '?' inside a contenteditable does NOT open help", () => {
    let open = false;
    renderApp({ onHelp: (o) => (open = o) });
    const ce = container.querySelector<HTMLDivElement>("[data-testid='ce']");
    expect(ce).toBeTruthy();
    ce!.focus();
    act(() => {
      fireKey("?", {}, ce!);
    });
    expect(open).toBe(false);
  });
});
