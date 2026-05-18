import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import ChannelTabs, { CHANNEL_TAB_IDS } from "./ChannelTabs";

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
        <ChannelTabs />
      </MemoryRouter>
    );
  });
  return root;
}

describe("ChannelTabs", () => {
  test("exports 10 tab ids in expected order", () => {
    expect(CHANNEL_TAB_IDS).toEqual([
      "volatility", "rates", "liquidity", "credit", "dollar",
      "commodities", "growth", "housing", "inflation", "positioning",
    ]);
  });

  test("renders 10 tab buttons", () => {
    renderTabs("/channels?tab=volatility");
    const buttons = container.querySelectorAll("button.channel-tab");
    expect(buttons.length).toBe(10);
  });

  test("marks the URL ?tab= as active", () => {
    renderTabs("/channels?tab=rates");
    const active = container.querySelector(".channel-tab--active");
    expect(active?.textContent).toMatch(/rates/i);
  });

  test("defaults to volatility when no ?tab= param", () => {
    renderTabs("/channels");
    const active = container.querySelector(".channel-tab--active");
    expect(active?.textContent).toMatch(/volatility/i);
  });

  test("clicking a tab updates the URL ?tab= param", () => {
    renderTabs("/channels?tab=volatility");
    const ratesBtn = Array.from(container.querySelectorAll("button.channel-tab"))
      .find(b => b.textContent?.toLowerCase().includes("rates"));
    expect(ratesBtn).not.toBeUndefined();
    act(() => { (ratesBtn as HTMLButtonElement).click(); });
    const newActive = container.querySelector(".channel-tab--active");
    expect(newActive?.textContent).toMatch(/rates/i);
  });
});
