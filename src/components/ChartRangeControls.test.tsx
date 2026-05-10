import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChartRangeControls from "./ChartRangeControls";
import type { RangePreset } from "../charts/buildTimeWindow";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

function render(element: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(element);
  });
  return container;
}

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
});

describe("ChartRangeControls", () => {
  it("renders all 6 presets by default", () => {
    const container = render(
      <ChartRangeControls value="1Y" onChange={() => undefined} />
    );
    const buttons = container.querySelectorAll('[role="radio"]');
    expect(buttons).toHaveLength(6);
    const labels = Array.from(buttons, (b) => b.textContent);
    expect(labels).toEqual(["1M", "3M", "6M", "1Y", "3Y", "All"]);
  });

  it("renders only the subset specified by `available`", () => {
    const container = render(
      <ChartRangeControls value="3M" onChange={() => undefined} available={["1M", "3M", "6M"]} />
    );
    const buttons = container.querySelectorAll('[role="radio"]');
    expect(buttons).toHaveLength(6); // still rendered, but ones outside available are disabled
    const enabled = Array.from(buttons).filter(
      (b) => b.getAttribute("aria-disabled") !== "true"
    );
    expect(enabled.map((b) => b.textContent)).toEqual(["1M", "3M", "6M"]);
  });

  it("marks presets not in `available` with aria-disabled=true and a title for the disabled reason", () => {
    const container = render(
      <ChartRangeControls
        value="1M"
        onChange={() => undefined}
        available={["1M", "3M"]}
        disabledReason="Not enough history for this preset."
      />
    );
    const disabled = Array.from(container.querySelectorAll('[role="radio"]')).filter(
      (b) => b.getAttribute("aria-disabled") === "true"
    );
    expect(disabled.length).toBeGreaterThan(0);
    for (const btn of disabled) {
      expect(btn.getAttribute("title")).toBe("Not enough history for this preset.");
    }
  });

  it("calls onChange when a non-active preset is clicked", () => {
    const onChange = vi.fn();
    const container = render(<ChartRangeControls value="1Y" onChange={onChange} />);
    const buttons = container.querySelectorAll('[role="radio"]');
    const threeMonth = Array.from(buttons).find((b) => b.textContent === "3M") as HTMLButtonElement;
    act(() => {
      threeMonth.click();
    });
    expect(onChange).toHaveBeenCalledWith("3M");
  });

  it("does not call onChange when a disabled preset is clicked", () => {
    const onChange = vi.fn();
    const container = render(
      <ChartRangeControls value="1Y" onChange={onChange} available={["1Y", "3Y", "All"]} />
    );
    const buttons = container.querySelectorAll('[role="radio"]');
    const oneMonth = Array.from(buttons).find((b) => b.textContent === "1M") as HTMLButtonElement;
    act(() => {
      oneMonth.click();
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("marks the active preset with aria-checked=true", () => {
    const container = render(
      <ChartRangeControls value="6M" onChange={() => undefined} />
    );
    const buttons = container.querySelectorAll('[role="radio"]');
    const sixMonth = Array.from(buttons).find((b) => b.textContent === "6M");
    expect(sixMonth?.getAttribute("aria-checked")).toBe("true");
    const others = Array.from(buttons).filter((b) => b.textContent !== "6M");
    for (const b of others) {
      expect(b.getAttribute("aria-checked")).toBe("false");
    }
  });

  it("uses role=radiogroup on the outer container", () => {
    const container = render(
      <ChartRangeControls value="1Y" onChange={() => undefined} />
    );
    const group = container.querySelector('[role="radiogroup"]');
    expect(group).not.toBeNull();
  });

  it("ArrowRight moves selection to the next enabled preset on keydown", () => {
    const onChange = vi.fn();
    const container = render(
      <ChartRangeControls value="1Y" onChange={onChange} />
    );
    const oneYear = Array.from(container.querySelectorAll('[role="radio"]')).find(
      (b) => b.textContent === "1Y"
    ) as HTMLButtonElement;
    oneYear.focus();
    act(() => {
      oneYear.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
    });
    expect(onChange).toHaveBeenCalledWith("3Y");
  });

  it("ArrowLeft moves selection to the previous enabled preset on keydown", () => {
    const onChange = vi.fn();
    const container = render(
      <ChartRangeControls value="3M" onChange={onChange} />
    );
    const threeMonth = Array.from(container.querySelectorAll('[role="radio"]')).find(
      (b) => b.textContent === "3M"
    ) as HTMLButtonElement;
    threeMonth.focus();
    act(() => {
      threeMonth.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
      );
    });
    expect(onChange).toHaveBeenCalledWith("1M");
  });

  it("ArrowRight skips disabled presets", () => {
    const onChange = vi.fn();
    const container = render(
      <ChartRangeControls value="1M" onChange={onChange} available={["1M", "1Y"]} />
    );
    const oneMonth = Array.from(container.querySelectorAll('[role="radio"]')).find(
      (b) => b.textContent === "1M"
    ) as HTMLButtonElement;
    oneMonth.focus();
    act(() => {
      oneMonth.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
    });
    // Should skip 3M and 6M (disabled), land on 1Y.
    expect(onChange).toHaveBeenCalledWith("1Y");
  });

  it("preserves the type identity of RangePreset values passed to onChange", () => {
    const onChange = vi.fn<(p: RangePreset) => void>();
    const container = render(<ChartRangeControls value="1Y" onChange={onChange} />);
    const all = Array.from(container.querySelectorAll('[role="radio"]')).find(
      (b) => b.textContent === "All"
    ) as HTMLButtonElement;
    act(() => {
      all.click();
    });
    expect(onChange).toHaveBeenCalledWith("All");
  });
});
