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
  // resolved component on the next act-flushed pass. Two short awaits inside
  // act covers both the dynamic-import settle and the post-resolve re-render
  // under any vitest worker load.
  for (let i = 0; i < 5; i++) {
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
