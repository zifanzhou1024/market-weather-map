import type { WeatherLabel } from "./types";

export function labelForScore(score: number): WeatherLabel {
  if (score <= -50) return "Stressed";
  if (score <= -20) return "Fragile";
  if (score < 20) return "Neutral";
  if (score < 50) return "Supportive";
  return "Supportive";
}

export function scoreTone(score: number): "positive" | "neutral" | "warning" | "negative" {
  if (score <= -50) return "negative";
  if (score <= -20) return "warning";
  if (score < 20) return "neutral";
  return "positive";
}
