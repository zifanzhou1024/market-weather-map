import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import FocusBlock from "./FocusBlock";

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

describe("FocusBlock", () => {
  it("renders question and answer (section variant)", () => {
    const c = render(
      <FocusBlock
        variant="section"
        question="What is volatility signaling right now?"
        answer="The term structure is in contango, suggesting near-term calm."
      />
    );
    expect(c.textContent).toContain("What is volatility signaling right now?");
    expect(c.textContent).toContain("The term structure is in contango, suggesting near-term calm.");
  });

  it("renders eyebrow when provided", () => {
    const c = render(
      <FocusBlock
        variant="section"
        eyebrow="Volatility Complex"
        question="What does the vol surface say?"
        answer="Front-end implied vol is below the one-year median."
      />
    );
    const eyebrow = c.querySelector(".focus-block__eyebrow");
    expect(eyebrow).not.toBeNull();
    expect(eyebrow?.textContent).toBe("Volatility Complex");
  });

  it("renders why, risk, support, and caveat when provided", () => {
    const c = render(
      <FocusBlock
        variant="section"
        question="Is rates pressure building?"
        answer="Real yields are rising at a pace consistent with demand-driven moves."
        why="Higher real yields compress equity multiples and widen credit spreads."
        risk="If real yields overshoot 2.5%, risk assets face multiple compression."
        support="Breakeven inflation is stable, limiting stagflation framing."
        caveat="TIPS liquidity is thinner in summer months; use with care."
      />
    );
    expect(c.querySelector(".focus-block__why")?.textContent).toContain(
      "Higher real yields compress equity multiples"
    );
    expect(c.textContent).toContain("If real yields overshoot");
    expect(c.textContent).toContain("Breakeven inflation is stable");
    expect(c.querySelector(".focus-block__caveat")?.textContent).toContain(
      "TIPS liquidity is thinner"
    );
  });

  it("omits eyebrow when not provided", () => {
    const c = render(
      <FocusBlock
        variant="section"
        question="What does positioning show?"
        answer="Asset managers are net long; leveraged money is flat."
      />
    );
    expect(c.querySelector(".focus-block__eyebrow")).toBeNull();
  });

  it("omits why when not provided", () => {
    const c = render(
      <FocusBlock
        variant="section"
        question="What does the regime signal?"
        answer="Risk-on easing quadrant — dollar soft, real yields falling."
      />
    );
    expect(c.querySelector(".focus-block__why")).toBeNull();
  });

  it("omits risk and support when neither is provided", () => {
    const c = render(
      <FocusBlock
        variant="section"
        question="What does the tactical board show?"
        answer="Elevated volatility with mixed credit."
      />
    );
    const dl = c.querySelector(".focus-block__signals");
    expect(dl?.textContent?.trim()).toBe("");
  });

  it("omits caveat when not provided", () => {
    const c = render(
      <FocusBlock
        variant="section"
        question="What is the outlook?"
        answer="Conditions are supportive but confidence is moderate."
      />
    );
    expect(c.querySelector(".focus-block__caveat")).toBeNull();
  });

  it("compact variant applies focus-block--compact class", () => {
    const c = render(
      <FocusBlock
        variant="compact"
        question="Is the VIX curve inverted?"
        answer="No, the curve is in mild contango."
      />
    );
    const section = c.querySelector("section");
    expect(section?.classList.contains("focus-block--compact")).toBe(true);
    expect(section?.classList.contains("focus-block--section")).toBe(false);
  });

  it("applies focus-block--stale class for freshnessStatus stale", () => {
    const c = render(
      <FocusBlock
        variant="section"
        question="Is the signal fresh?"
        answer="Data is five days stale — interpret with caution."
        freshnessStatus="stale"
      />
    );
    const section = c.querySelector("section");
    expect(section?.classList.contains("focus-block--stale")).toBe(true);
  });

  it("applies focus-block--stale class for freshnessStatus unavailable", () => {
    const c = render(
      <FocusBlock
        variant="section"
        question="Is this section active?"
        answer="Data not yet active for this section."
        freshnessStatus="unavailable"
      />
    );
    const section = c.querySelector("section");
    expect(section?.classList.contains("focus-block--stale")).toBe(true);
  });

  it("does not apply focus-block--stale class for freshnessStatus ok", () => {
    const c = render(
      <FocusBlock
        variant="section"
        question="Is the signal fresh?"
        answer="Data is current as of today."
        freshnessStatus="ok"
      />
    );
    const section = c.querySelector("section");
    expect(section?.classList.contains("focus-block--stale")).toBe(false);
  });

  it("does not apply focus-block--stale class when freshnessStatus is absent", () => {
    const c = render(
      <FocusBlock
        variant="section"
        question="No freshness prop."
        answer="Should not be stale-styled."
      />
    );
    const section = c.querySelector("section");
    expect(section?.classList.contains("focus-block--stale")).toBe(false);
  });

  it("uses ariaLabel when provided", () => {
    const c = render(
      <FocusBlock
        variant="section"
        question="What does volatility signal?"
        answer="Calm near-term structure."
        ariaLabel="Volatility section focus block"
      />
    );
    const section = c.querySelector("section");
    expect(section?.getAttribute("aria-label")).toBe("Volatility section focus block");
  });

  it("falls back to question as aria-label when ariaLabel is not provided", () => {
    const c = render(
      <FocusBlock
        variant="section"
        question="What does rates pressure look like?"
        answer="Real yields are elevated and rising."
      />
    );
    const section = c.querySelector("section");
    expect(section?.getAttribute("aria-label")).toBe("What does rates pressure look like?");
  });

  it("signals grid renders both Risk and Support when both present", () => {
    const c = render(
      <FocusBlock
        variant="section"
        question="What are the key signals?"
        answer="Mixed signals across credit and volatility."
        risk="Credit spreads are widening."
        support="VIX remains below 20."
      />
    );
    const dl = c.querySelector(".focus-block__signals");
    const dts = dl?.querySelectorAll("dt");
    const dds = dl?.querySelectorAll("dd");
    expect(dts?.length).toBe(2);
    expect(dds?.length).toBe(2);
    expect(dts?.[0]?.textContent).toBe("Risk");
    expect(dts?.[1]?.textContent).toBe("Support");
    expect(dds?.[0]?.textContent).toContain("Credit spreads are widening.");
    expect(dds?.[1]?.textContent).toContain("VIX remains below 20.");
  });

  it("signals grid renders only Risk when only risk is provided", () => {
    const c = render(
      <FocusBlock
        variant="section"
        question="What is the main risk?"
        answer="Credit stress is building at the margin."
        risk="HY spreads have widened 80bps in 30 days."
      />
    );
    const dl = c.querySelector(".focus-block__signals");
    const dts = dl?.querySelectorAll("dt");
    expect(dts?.length).toBe(1);
    expect(dts?.[0]?.textContent).toBe("Risk");
  });

  it("signals grid renders only Support when only support is provided", () => {
    const c = render(
      <FocusBlock
        variant="section"
        question="What is the main support?"
        answer="Liquidity conditions remain accommodative."
        support="Fed balance sheet is stable."
      />
    );
    const dl = c.querySelector(".focus-block__signals");
    const dts = dl?.querySelectorAll("dt");
    expect(dts?.length).toBe(1);
    expect(dts?.[0]?.textContent).toBe("Support");
  });
});
