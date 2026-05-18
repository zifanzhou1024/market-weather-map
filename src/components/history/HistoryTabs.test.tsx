import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import HistoryTabs, { HISTORY_TAB_IDS } from "./HistoryTabs";

let container: HTMLDivElement;
beforeEach(() => {
  // @ts-expect-error react test environment flag
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
});
afterEach(() => { document.body.removeChild(container); });

function renderTabs(initialPath: string) {
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialPath]}>
        <HistoryTabs />
      </MemoryRouter>
    );
  });
  return root;
}

describe("HistoryTabs", () => {
  test("exports 2 tab ids in expected order", () => {
    expect(HISTORY_TAB_IDS).toEqual(["regime", "replay"]);
  });

  test("renders 2 tab buttons", () => {
    renderTabs("/history?tab=regime");
    const buttons = container.querySelectorAll("button.channel-tab");
    expect(buttons.length).toBe(2);
  });

  test("marks the URL ?tab= as active", () => {
    renderTabs("/history?tab=replay");
    const active = container.querySelector(".channel-tab--active");
    expect(active?.textContent).toMatch(/replay/i);
  });

  test("defaults to regime when no ?tab= param", () => {
    renderTabs("/history");
    const active = container.querySelector(".channel-tab--active");
    expect(active?.textContent).toMatch(/regime/i);
  });

  test("clicking a tab updates the URL ?tab= param", () => {
    renderTabs("/history?tab=regime");
    const replayBtn = Array.from(container.querySelectorAll("button.channel-tab"))
      .find(b => b.textContent?.toLowerCase().includes("replay"));
    expect(replayBtn).not.toBeUndefined();
    act(() => { (replayBtn as HTMLButtonElement).click(); });
    const newActive = container.querySelector(".channel-tab--active");
    expect(newActive?.textContent).toMatch(/replay/i);
  });
});
