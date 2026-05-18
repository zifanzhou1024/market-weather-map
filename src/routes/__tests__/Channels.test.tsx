import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import Channels from "../Channels";

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

async function renderChannels(initialPath: string) {
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Channels />
      </MemoryRouter>
    );
  });
  await flushLazy();
  return root;
}

describe("Channels", () => {
  test("default (no ?tab) renders volatility tab", async () => {
    await renderChannels("/channels");
    expect(container.querySelector("[data-testid='volatility-tab']")).not.toBeNull();
  });

  test("?tab=rates renders rates tab", async () => {
    await renderChannels("/channels?tab=rates");
    expect(container.querySelector("[data-testid='rates-tab']")).not.toBeNull();
  });

  test("?tab=positioning renders positioning tab (renamed from sentiment)", async () => {
    await renderChannels("/channels?tab=positioning");
    expect(container.querySelector("[data-testid='positioning-tab']")).not.toBeNull();
  });

  test("invalid ?tab= falls back to volatility", async () => {
    await renderChannels("/channels?tab=garbage");
    expect(container.querySelector("[data-testid='volatility-tab']")).not.toBeNull();
  });

  test("ChannelTabs strip is rendered above the tab body", async () => {
    await renderChannels("/channels");
    expect(container.querySelector(".channel-tabs")).not.toBeNull();
    expect(container.querySelector("[data-testid='volatility-tab']")).not.toBeNull();
  });
});
