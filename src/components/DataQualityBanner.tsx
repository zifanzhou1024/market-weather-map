import GlossaryTerm from "./GlossaryTerm";
import type { DataQualityTier } from "../lib/types";

interface DataQualityBannerProps {
  dataQuality?: unknown;
}

interface ValidDataQuality {
  overallConfidence: number;
  tier: DataQualityTier;
  coverage: number | null;
  freshness: number | null;
  model: number | null;
  source: number | null;
  reasons: string[];
}

const TIER_TONE: Record<DataQualityTier, string> = {
  high: "tone-positive",
  medium: "tone-neutral",
  low: "tone-warning",
  thin: "tone-negative"
};

const TIER_LABEL: Record<DataQualityTier, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  thin: "Thin"
};

const VALID_TIERS: ReadonlySet<DataQualityTier> = new Set<DataQualityTier>([
  "high",
  "medium",
  "low",
  "thin"
]);

function tierFromConfidence(value: number): DataQualityTier {
  if (value >= 0.8) return "high";
  if (value >= 0.6) return "medium";
  if (value >= 0.4) return "low";
  return "thin";
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function narrowDataQuality(value: unknown): ValidDataQuality | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const overall = readNumber(record.overall_confidence);
  if (overall === null) return null;

  const rawTier = record.tier;
  const tier: DataQualityTier =
    typeof rawTier === "string" && VALID_TIERS.has(rawTier as DataQualityTier)
      ? (rawTier as DataQualityTier)
      : tierFromConfidence(overall);

  const reasons = Array.isArray(record.reasons)
    ? record.reasons
        .filter((reason): reason is string => typeof reason === "string" && reason.trim().length > 0)
        .map((reason) => reason.trim())
    : [];

  return {
    overallConfidence: overall,
    tier,
    coverage: readNumber(record.coverage_confidence),
    freshness: readNumber(record.freshness_confidence),
    model: readNumber(record.model_confidence),
    source: readNumber(record.source_confidence),
    reasons
  };
}

function formatPercent(value: number | null): string {
  if (value === null) return "n/a";
  return `${Math.round(value * 100)}%`;
}

export default function DataQualityBanner({ dataQuality }: DataQualityBannerProps) {
  const validDataQuality = narrowDataQuality(dataQuality);

  if (!validDataQuality) {
    return (
      <section className="panel data-quality-banner" aria-label="Data quality">
        <div className="data-quality-banner__summary">
          <p className="eyebrow">Data quality</p>
          <h3>Data quality unavailable</h3>
        </div>
        <p className="score-note">Score-summary data quality is missing or malformed.</p>
      </section>
    );
  }

  const { tier, overallConfidence, coverage, freshness, model, source, reasons } = validDataQuality;
  const tierTone = TIER_TONE[tier];

  return (
    <section className="panel data-quality-banner" aria-label="Data quality">
      <div className="data-quality-banner__summary">
        <p className="eyebrow">
          <GlossaryTerm term="data quality">Data quality</GlossaryTerm>
        </p>
        <div className="data-quality-banner__header">
          <span
            className={`data-quality-banner__tier status-pill ${tierTone}`}
            data-tier={tier}
          >
            {TIER_LABEL[tier]} data quality
          </span>
          <span className="data-quality-banner__overall">
            <GlossaryTerm term="confidence aggregate">
              aggregate {formatPercent(overallConfidence)}
            </GlossaryTerm>
          </span>
        </div>
      </div>
      <details className="data-quality-banner__details">
        <summary>Why this tier?</summary>
        {reasons.length > 0 ? (
          <ul className="score-list data-quality-banner__reasons">
            {reasons.map((reason, index) => (
              <li key={`${index}-${reason}`}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="score-note">No active data-quality issues.</p>
        )}
        <dl className="data-quality-banner__components">
          <div>
            <dt>
              <GlossaryTerm term="coverage">Coverage</GlossaryTerm>
            </dt>
            <dd>{formatPercent(coverage)}</dd>
          </div>
          <div>
            <dt>
              <GlossaryTerm term="freshness">Freshness</GlossaryTerm>
            </dt>
            <dd>{formatPercent(freshness)}</dd>
          </div>
          <div>
            <dt>
              <GlossaryTerm term="model">Model</GlossaryTerm>
            </dt>
            <dd>{formatPercent(model)}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{formatPercent(source)}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
