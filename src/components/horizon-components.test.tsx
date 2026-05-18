import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import HorizonImpactMatrix from "./HorizonImpactMatrix";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let root: Root | undefined;

function render(element: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);

  act(() => {
    root = createRoot(container);
    root.render(element);
  });

  return {
    container,
    getByText(text: string) {
      const match = Array.from(container.querySelectorAll("*")).find((element) => element.textContent === text);
      if (!match) throw new Error(`Unable to find text: ${text}`);
      return match;
    },
    queryByText(text: string) {
      return Array.from(container.querySelectorAll("*")).find((element) => element.textContent === text) ?? null;
    }
  };
}

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
});

describe("horizon display components", () => {
  it("renders horizon impact matrix rows", () => {
    const container = render(<HorizonImpactMatrix />);

    expect(container.getByText("VIX / VIX curve")).toBeTruthy();
    expect(container.getByText("Treasury supply / term premium")).toBeTruthy();
  });
});
