import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import KeyboardShortcutsHelp from "./KeyboardShortcutsHelp";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement;
let root: Root | undefined;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = undefined;
  }
  if (container.parentNode) container.parentNode.removeChild(container);
});

function render(open: boolean, onClose: () => void = () => {}) {
  act(() => {
    root = createRoot(container);
    root.render(<KeyboardShortcutsHelp open={open} onClose={onClose} />);
  });
}

describe("KeyboardShortcutsHelp", () => {
  test("renders nothing when open=false", () => {
    render(false);
    expect(container.querySelector(".kbd-help")).toBeNull();
    expect(container.querySelector(".kbd-help-backdrop")).toBeNull();
  });

  test("renders dialog + backdrop when open=true", () => {
    render(true);
    expect(container.querySelector(".kbd-help-backdrop")).toBeTruthy();
    const dialog = container.querySelector(".kbd-help");
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-labelledby")).toBe("kbd-help-title");
  });

  test("lists all expected navigation shortcuts", () => {
    render(true);
    const text = container.textContent ?? "";
    expect(text).toContain("g o");
    expect(text).toContain("g s");
    expect(text).toContain("g l");
    expect(text).toContain("g f");
    expect(text).toContain("g c");
    expect(text).toContain("g h");
    expect(text).toContain("g d");
    expect(text).toContain("g m");
  });

  test("lists view + help shortcuts (b, ?, Esc)", () => {
    render(true);
    const rows = Array.from(container.querySelectorAll(".kbd-help__keys"));
    const keys = rows.map((r) => r.textContent?.trim());
    expect(keys).toContain("b");
    expect(keys).toContain("?");
    expect(keys).toContain("Esc");
  });

  test("focuses the close button on mount when open", () => {
    render(true);
    const close = container.querySelector<HTMLButtonElement>(".kbd-help__close");
    expect(close).toBeTruthy();
    // jsdom updates document.activeElement synchronously
    expect(document.activeElement).toBe(close);
  });

  test("backdrop click calls onClose", () => {
    const onClose = vi.fn();
    render(true, onClose);
    const backdrop = container.querySelector<HTMLDivElement>(".kbd-help-backdrop");
    expect(backdrop).toBeTruthy();
    act(() => {
      backdrop!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("clicking inside the dialog does NOT call onClose", () => {
    const onClose = vi.fn();
    render(true, onClose);
    const dialog = container.querySelector<HTMLDivElement>(".kbd-help");
    const title = container.querySelector(".kbd-help__title");
    expect(dialog).toBeTruthy();
    expect(title).toBeTruthy();
    act(() => {
      title!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  test("close button click calls onClose", () => {
    const onClose = vi.fn();
    render(true, onClose);
    const close = container.querySelector<HTMLButtonElement>(".kbd-help__close");
    act(() => {
      close!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
