import GlossaryTerm from "./GlossaryTerm";
import type { DataQualityTier } from "../lib/types";
import { useT } from "../lib/i18n";

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

const TIER_KEYS: Record<DataQualityTier, string> = {
  high: "dataQuality.tierHigh",
  medium: "dataQuality.tierMedium",
  low: "dataQuality.tierLow",
  thin: "dataQuality.tierThin"
};

// Tier badge keys yield idiomatic full-string labels ("High data quality" /
// "数据质量评级: 高") instead of awkward "tier_word + title" concatenation.
const TIER_BADGE_KEYS: Record<DataQualityTier, string> = {
  high: "dataQuality.tierBadgeHigh",
  medium: "dataQuality.tierBadgeMedium",
  low: "dataQuality.tierBadgeLow",
  thin: "dataQuality.tierBadgeThin"
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
  const { t } = useT();
  const validDataQuality = narrowDataQuality(dataQuality);
  const title = t("dataQuality.title");

  if (!validDataQuality) {
    return (
      <section className="panel data-quality-banner" aria-label={title}>
        <div className="data-quality-banner__summary">
          <p className="eyebrow">{title}</p>
          <h3>{t("dataQuality.unavailable")}</h3>
        </div>
        <p className="score-note">{t("dataQuality.malformed")}</p>
      </section>
    );
  }

  const { tier, overallConfidence, coverage, freshness, model, source, reasons } = validDataQuality;
  const tierTone = TIER_TONE[tier];
  // Idiomatic full string ("High data quality" / "数据质量评级: 高") instead of
  // English-style concatenation that read awkwardly under zh.
  const tierBadge = t(TIER_BADGE_KEYS[tier]);

  return (
    <section className="panel data-quality-banner" aria-label={title}>
      <div className="data-quality-banner__summary">
        <p className="eyebrow">
          <GlossaryTerm term="data quality">{title}</GlossaryTerm>
        </p>
        <div className="data-quality-banner__header">
          <span
            className={`data-quality-banner__tier status-pill ${tierTone}`}
            data-tier={tier}
          >
            {tierBadge}
          </span>
          <span className="data-quality-banner__overall">
            <GlossaryTerm term="confidence aggregate">
              {t("dataQuality.aggregate").toLowerCase()} {formatPercent(overallConfidence)}
            </GlossaryTerm>
          </span>
        </div>
      </div>
      <details className="data-quality-banner__details">
        <summary>{t("dataQuality.whyThisTier")}</summary>
        {reasons.length > 0 ? (
          <ul className="score-list data-quality-banner__reasons">
            {reasons.map((reason, index) => (
              <li key={`${index}-${reason}`}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="score-note">{t("dataQuality.noActiveIssues")}</p>
        )}
        <dl className="data-quality-banner__components">
          <div>
            <dt>
              <GlossaryTerm term="coverage">{t("dataQuality.coverage")}</GlossaryTerm>
            </dt>
            <dd>{formatPercent(coverage)}</dd>
          </div>
          <div>
            <dt>
              <GlossaryTerm term="freshness">{t("dataQuality.freshness")}</GlossaryTerm>
            </dt>
            <dd>{formatPercent(freshness)}</dd>
          </div>
          <div>
            <dt>
              <GlossaryTerm term="model">{t("dataQuality.model")}</GlossaryTerm>
            </dt>
            <dd>{formatPercent(model)}</dd>
          </div>
          <div>
            <dt>{t("dataQuality.sourceMix")}</dt>
            <dd>{formatPercent(source)}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
