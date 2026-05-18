import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import ContextBlock from "./ContextBlock";

let container: HTMLDivElement;
beforeEach(() => {
  // @ts-expect-error -- vitest test environment flag
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
});
afterEach(() => {
  document.body.removeChild(container);
});

function renderBlock(node: React.ReactNode) {
  const root = createRoot(container);
  act(() => root.render(node));
  return root;
}

describe("ContextBlock", () => {
  test("renders details element with label as summary", () => {
    renderBlock(
      <ContextBlock label="More context">
        <p>inner</p>
      </ContextBlock>
    );
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.querySelector("summary")?.textContent).toContain(
      "More context"
    );
  });

  test("starts collapsed by default", () => {
    renderBlock(
      <ContextBlock label="X">
        <p>inner</p>
      </ContextBlock>
    );
    const details = container.querySelector("details");
    expect(details?.open).toBe(false);
  });

  test("supports initially-open via prop", () => {
    renderBlock(
      <ContextBlock label="X" defaultOpen>
        <p>inner</p>
      </ContextBlock>
    );
    const details = container.querySelector("details");
    expect(details?.open).toBe(true);
  });

  test("renders children", () => {
    renderBlock(
      <ContextBlock label="X" defaultOpen>
        <p>hello world</p>
      </ContextBlock>
    );
    expect(container.textContent).toContain("hello world");
  });
});
