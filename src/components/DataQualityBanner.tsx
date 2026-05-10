import { formatNumber } from "../lib/formatters";

interface DataQualityBannerProps {
  dataQuality?: unknown;
}

interface ValidDataQuality {
  overallConfidence: number;
  reasons: string[];
}

const priorityReasonPattern = /stale|inactive|not active|unavailable|failed|source|terms|candidate|review/i;

function narrowDataQuality(value: unknown): ValidDataQuality | null {
  if (!value || typeof value !== "object") return null;

  const dataQuality = value as { overall_confidence?: unknown; reasons?: unknown };
  if (typeof dataQuality.overall_confidence !== "number" || !Number.isFinite(dataQuality.overall_confidence)) {
    return null;
  }

  const reasons = Array.isArray(dataQuality.reasons)
    ? dataQuality.reasons.filter((reason): reason is string => typeof reason === "string" && reason.trim().length > 0)
    : [];

  return {
    overallConfidence: dataQuality.overall_confidence,
    reasons: reasons.map((reason) => reason.trim())
  };
}

function qualityLabel(overallConfidence: number) {
  if (overallConfidence >= 0.9) return "High data quality";
  if (overallConfidence >= 0.7) return "Mixed data quality";
  return "Low data quality";
}

function prioritizedReasons(reasons: string[]) {
  const priorityReasons = reasons.filter((reason) => priorityReasonPattern.test(reason));
  const lowerPriorityReasons = reasons.filter((reason) => !priorityReasonPattern.test(reason));
  return priorityReasons.concat(lowerPriorityReasons).slice(0, 4);
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

  const reasons = prioritizedReasons(validDataQuality.reasons);

  return (
    <section className="panel data-quality-banner" aria-label="Data quality">
      <div className="data-quality-banner__summary">
        <p className="eyebrow">Data quality</p>
        <h3>{qualityLabel(validDataQuality.overallConfidence)}</h3>
        <p className="score-note">Overall confidence {formatNumber(validDataQuality.overallConfidence)}.</p>
      </div>
      {reasons.length > 0 ? (
        <ul className="score-list data-quality-banner__reasons">
          {reasons.map((reason, index) => (
            <li key={`${index}-${reason}`}>{reason}</li>
          ))}
        </ul>
      ) : (
        <p className="score-note">No data-quality caveats in the current score summary.</p>
      )}
    </section>
  );
}
