import type { DirectionState, YieldDriver } from "./types";

export function directionLabel(direction: DirectionState) {
  const labels: Record<DirectionState, string> = {
    up: "Up",
    down: "Down",
    flat: "Flat",
    unavailable: "Unavailable"
  };
  return labels[direction] ?? "Unavailable";
}

export function yieldDriverLabel(driver: YieldDriver) {
  const labels: Record<YieldDriver, string> = {
    real_yield_driven: "Real-yield driven",
    breakeven_inflation_driven: "Breakeven / inflation driven",
    real_yield_easing: "Real-yield easing",
    safe_haven_or_growth_scare: "Safe-haven / growth-scare",
    mixed: "Mixed",
    unavailable: "Unavailable"
  };
  return labels[driver] ?? "Unavailable";
}

export function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatStateLabel(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
