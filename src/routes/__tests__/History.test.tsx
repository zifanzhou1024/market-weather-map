import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import History from "../History";

let container: HTMLDivElement;
beforeEach(() => {
  // @ts-expect-error react test environment flag
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
});
afterEach(() => { document.body.removeChild(container); });

async function flushLazy() {
  // React.lazy resolves via a dynamic import (microtask) and then renders the
  // resolved component on the next act-flushed pass. Tab bodies (post-5.3
  // extraction) pull in ECharts modules and large dependency graphs, so the
  // dynamic-import settle can take longer than a few microtasks. We loop a
  // generous number of short awaits inside act so the resolved component has
  // time to mount on any vitest worker load. The outer `<section data-testid>`
  // renders synchronously after lazy resolution; the test only asserts the
  // testid, not the data-loaded body, so this is sufficient.
  for (let i = 0; i < 50; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
    });
  }
}

async function renderHistory(initialPath: string) {
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[initialPath]}>
        <History />
      </MemoryRouter>
    );
  });
  await flushLazy();
  return root;
}

describe("History", () => {
  test("default (no ?tab) renders regime tab", async () => {
    await renderHistory("/history");
    expect(container.querySelector("[data-testid='regime-tab']")).not.toBeNull();
  });

  test("?tab=replay renders replay tab", async () => {
    await renderHistory("/history?tab=replay");
    expect(container.querySelector("[data-testid='replay-tab']")).not.toBeNull();
  });

  test("invalid ?tab= falls back to regime", async () => {
    await renderHistory("/history?tab=garbage");
    expect(container.querySelector("[data-testid='regime-tab']")).not.toBeNull();
  });

  test("HistoryTabs strip is rendered above the tab body", async () => {
    await renderHistory("/history");
    expect(container.querySelector(".history-tabs")).not.toBeNull();
    expect(container.querySelector("[data-testid='regime-tab']")).not.toBeNull();
  });
});
