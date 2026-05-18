import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import AppLayout from "./AppLayout";

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
  if (container.parentNode) {
    container.parentNode.removeChild(container);
  }
});

function renderNav(initialPath: string = "/") {
  act(() => {
    root = createRoot(container);
    root.render(
      <MemoryRouter initialEntries={[initialPath]}>
        <AppLayout />
      </MemoryRouter>
    );
  });
}

describe("AppLayout nav (post-PR-5)", () => {
  test("renders 7 visible nav pills (6 NavLinks + More summary)", () => {
    renderNav("/");
    const directPills = container.querySelectorAll(
      ".site-nav > .nav-link, .site-nav > details > summary.nav-link"
    );
    expect(directPills.length).toBe(7);
  });

  test("primary pill labels are Overview/Short-Term/Long-Term/Fragility/Channels/History + More", () => {
    renderNav("/");
    const directPills = container.querySelectorAll(
      ".site-nav > .nav-link, .site-nav > details > summary.nav-link"
    );
    const labels = Array.from(directPills).map((el) => el.textContent?.trim());
    expect(labels).toEqual([
      "Overview",
      "Short-Term",
      "Long-Term",
      "Fragility",
      "Channels",
      "History",
      "More"
    ]);
  });

  test("More disclosure contains Diff + Calendar + Methodology", () => {
    renderNav("/");
    const moreDetails = container.querySelector(".site-nav__more");
    expect(moreDetails?.tagName.toLowerCase()).toBe("details");
    const moreLinks = moreDetails?.querySelectorAll("a");
    const moreLabels = Array.from(moreLinks ?? []).map((a) => a.textContent?.trim());
    // Diff first under More since it's the newest addition.
    expect(moreLabels).toEqual(["Diff", "Calendar", "Methodology"]);
  });

  test("Channels pill is active when on /channels", () => {
    renderNav("/channels");
    const channelsLink = Array.from(container.querySelectorAll(".site-nav .nav-link")).find(
      (a) => a.textContent?.trim() === "Channels"
    );
    expect(channelsLink?.classList.contains("active")).toBe(true);
  });

  test("Channels pill is active when on /channels?tab=rates", () => {
    renderNav("/channels?tab=rates");
    const channelsLink = Array.from(container.querySelectorAll(".site-nav .nav-link")).find(
      (a) => a.textContent?.trim() === "Channels"
    );
    expect(channelsLink?.classList.contains("active")).toBe(true);
  });

  test("History pill points at /history", () => {
    renderNav("/");
    const historyLink = Array.from(container.querySelectorAll(".site-nav .nav-link")).find(
      (a) => a.textContent?.trim() === "History"
    );
    expect(historyLink?.getAttribute("href")).toBe("/history");
  });
});
