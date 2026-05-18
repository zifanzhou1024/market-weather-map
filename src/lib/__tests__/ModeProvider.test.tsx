import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ModeProvider, useMode, setMode } from "../mode";

function ModeReader() {
  const mode = useMode();
  return <span data-testid="mode">{mode}</span>;
}

let container: HTMLDivElement;

beforeEach(() => {
  // @ts-expect-error -- vitest test environment flag
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  document.body.removeChild(container);
});

describe("ModeProvider + useMode", () => {
  test("useMode returns the resolved mode at mount", () => {
    window.history.replaceState({}, "", "/?mode=brief");
    const root = createRoot(container);
    act(() => root.render(<ModeProvider><ModeReader /></ModeProvider>));
    expect(container.querySelector("[data-testid='mode']")?.textContent).toBe("brief");
  });

  test("setMode updates the URL, localStorage, and the rendered mode", () => {
    const root = createRoot(container);
    act(() => root.render(<ModeProvider><ModeReader /></ModeProvider>));
    act(() => setMode("brief"));
    expect(localStorage.getItem("mwm.mode")).toBe("brief");
    expect(new URLSearchParams(window.location.search).get("mode")).toBe("brief");
    expect(container.querySelector("[data-testid='mode']")?.textContent).toBe("brief");
  });

  test("explicit-mode persistence: viewport resize past 900px does NOT change mode", () => {
    // User explicitly chose detail
    localStorage.setItem("mwm.mode", "detail");
    const root = createRoot(container);
    act(() => root.render(<ModeProvider><ModeReader /></ModeProvider>));
    expect(container.querySelector("[data-testid='mode']")?.textContent).toBe("detail");

    // Simulate resize to 400px
    Object.defineProperty(window, "innerWidth", { writable: true, value: 400 });
    act(() => window.dispatchEvent(new Event("resize")));

    // Mode does NOT flip — user choice persists
    expect(container.querySelector("[data-testid='mode']")?.textContent).toBe("detail");
  });
});
