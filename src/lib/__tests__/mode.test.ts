import { beforeEach, describe, expect, test } from "vitest";
import { resolveMode } from "../mode";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("resolveMode", () => {
  test("URL ?mode=brief wins over localStorage and viewport", () => {
    localStorage.setItem("mwm.mode", "detail");
    window.history.replaceState({}, "", "/?mode=brief");
    expect(resolveMode(1440)).toBe("brief");
  });

  test("URL ?mode=detail wins over viewport-brief default", () => {
    window.history.replaceState({}, "", "/?mode=detail");
    expect(resolveMode(400)).toBe("detail");
  });

  test("localStorage wins when no URL param", () => {
    localStorage.setItem("mwm.mode", "brief");
    expect(resolveMode(1440)).toBe("brief");
  });

  test("viewport auto-default at <900px is brief", () => {
    expect(resolveMode(800)).toBe("brief");
  });

  test("viewport auto-default at >=900px is detail", () => {
    expect(resolveMode(1200)).toBe("detail");
  });

  test("invalid URL param falls back to next layer", () => {
    window.history.replaceState({}, "", "/?mode=garbage");
    localStorage.setItem("mwm.mode", "brief");
    expect(resolveMode(1200)).toBe("brief");
  });

  test("invalid localStorage value falls back to viewport-auto", () => {
    localStorage.setItem("mwm.mode", "garbage");
    expect(resolveMode(400)).toBe("brief");
    expect(resolveMode(1200)).toBe("detail");
  });
});
