import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import GlossaryTerm from "./GlossaryTerm";

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

function render(node: React.ReactNode) {
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return root;
}

describe("GlossaryTerm", () => {
  test("renders <abbr title> with the definition when the term is known", () => {
    render(<GlossaryTerm term="VIX" />);
    const abbr = container.querySelector("abbr");
    expect(abbr).not.toBeNull();
    expect(abbr?.getAttribute("title")).toMatch(/Cboe Volatility Index/);
    expect(abbr?.textContent).toBe("VIX");
  });

  test("renders bare text (no <abbr>) when the term is unknown", () => {
    render(<GlossaryTerm term="Market Weather" />);
    expect(container.querySelector("abbr")).toBeNull();
    expect(container.textContent).toBe("Market Weather");
  });

  test("custom children render with the title from the term lookup", () => {
    // Use case: render shorter visible text while keeping the canonical key.
    render(
      <GlossaryTerm term="VIX">
        <strong>Volatility</strong>
      </GlossaryTerm>,
    );
    const abbr = container.querySelector("abbr");
    expect(abbr).not.toBeNull();
    expect(abbr?.getAttribute("title")).toMatch(/Cboe Volatility Index/);
    expect(abbr?.querySelector("strong")?.textContent).toBe("Volatility");
  });

  test("applies the .glossary class so CSS styling targets it", () => {
    render(<GlossaryTerm term="HY OAS" />);
    const abbr = container.querySelector("abbr");
    expect(abbr?.className).toContain("glossary");
  });

  test("extra className is appended alongside the .glossary class", () => {
    render(<GlossaryTerm term="HY OAS" className="cockpit-cell__label" />);
    const abbr = container.querySelector("abbr");
    expect(abbr?.className).toContain("glossary");
    expect(abbr?.className).toContain("cockpit-cell__label");
  });

  test("unknown term + custom children renders the children as a plain fragment", () => {
    render(
      <GlossaryTerm term="Unknown-Term-XYZ">
        <span data-testid="bare">just text</span>
      </GlossaryTerm>,
    );
    expect(container.querySelector("abbr")).toBeNull();
    expect(container.querySelector("[data-testid=bare]")).not.toBeNull();
  });
});
