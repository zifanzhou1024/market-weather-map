export type DataStatus =
  | "ok"
  | "stale"
  | "partial"
  | "failed"
  | "terms_review_needed"
  | "unavailable";
export type SeriesFrequency = "daily" | "weekly" | "monthly" | "quarterly";
export type UpdateStatus = "ok" | "failed";

export type SeriesCategory =
  | "volatility"
  | "rates"
  | "liquidity"
  | "credit"
  | "commodities"
  | "sentiment"
  | "growth"
  | "labor"
  | "inflation"
  | "dollar"
  | "banking";

export type SourceAccessStatus =
  | "free_public"
  | "terms_review_needed"
  | "restricted"
  | "unavailable";

export type SourceTermsStatus =
  | "ok"
  | "review_each_series"
  | "review_needed"
  | "restricted"
  | "unknown";

export type ScoreStatus = "active" | "candidate" | "unavailable";

export type WeatherLabel =
  | "Supportive"
  | "Neutral"
  | "Mixed"
  | "Fragile"
  | "Stressed"
  | "Crowded";

export interface SourceRegistryEntry {
  name: string;
  base_url: string;
  requires_secret: boolean;
  access_status: SourceAccessStatus;
  terms_status: SourceTermsStatus;
  update_cadence: string;
  notes: string;
}

export type SourceRegistryFile = Record<string, SourceRegistryEntry>;

export interface ScoreBlock {
  score: number;
  label:
    | WeatherLabel
    | "Goldilocks"
    | "Reflation"
    | "Disinflationary Slowdown"
    | "Stagflation Pressure"
    | "Credit Stress"
    | "Liquidity Stress"
    | "Crowded Calm"
    | "Risk-Off"
    | "Moderate"
    | "Low Fragility"
    | "Elevated Fragility"
    | "High Fragility";
  confidence: number;
  confidence_breakdown?: Omit<ConfidenceBreakdownData, "reasons">;
  confidence_reasons: string[];
  bucket_scores: Record<string, number>;
  bucket_weights: Record<string, number>;
  top_supports: string[];
  top_risks: string[];
  recent_changes: string[];
  missing_or_stale_notes: string[];
}

export interface ConfidenceBreakdownData {
  coverage_confidence: number;
  freshness_confidence: number;
  model_confidence: number;
  source_confidence: number;
  overall_confidence: number;
  reasons: string[];
}

type ScoreSummaryDataQuality =
  | ConfidenceBreakdownData
  | Pick<ConfidenceBreakdownData, "overall_confidence" | "reasons">;

export interface ScoreSummaryFile {
  generated_at_utc: string;
  date: string;
  method_version: string;
  scores: {
    market_weather: ScoreBlock;
    macro_climate: ScoreBlock;
    fragility: ScoreBlock;
  };
  conflicting_signals: string[];
  data_quality: ScoreSummaryDataQuality;
}

export interface SeriesCatalogEntry {
  id: string;
  name: string;
  category: SeriesCategory;
  source: string;
  provider_id?: string;
  source_url: string;
  endpoint_url?: string;
  frequency: SeriesFrequency;
  units: string;
  higher_is: "supportive" | "riskier" | "contextual";
  public: boolean;
  max_stale_days: number;
  notes: string;
  citation_notes?: string;
  access_status?: SourceAccessStatus;
  terms_status?: SourceTermsStatus;
  score_status?: ScoreStatus;
}

export interface Observation {
  date: string;
  value: number;
  percentile_252d?: number | null;
}

export interface SeriesSummary {
  latest_date: string;
  latest_value: number;
  change_1d: number | null;
  change_1w: number | null;
  change_1m: number | null;
  change_3m?: number | null;
  change_12m?: number | null;
  percentile_252d: number | null;
}

export interface TimeSeriesFile {
  series_id: string;
  generated_at_utc: string;
  source: string;
  source_url: string;
  frequency: SeriesFrequency;
  units: string;
  summary?: SeriesSummary;
  observations: Observation[];
}

export interface DerivedSeriesFile extends TimeSeriesFile {
  depends_on: string[];
  method: string;
}

export interface BucketScoresFile {
  generated_at_utc: string;
  date: string;
  method_version: string;
  buckets: Record<string, number>;
  weights: Record<string, number>;
}

export interface RegimeScoreFile {
  date: string;
  generated_at_utc: string;
  overall_score: number;
  label: WeatherLabel;
  buckets: Record<string, number>;
  top_supports: string[];
  top_risks: string[];
  method_version: string;
}

export interface SeriesStatus {
  status: DataStatus;
  last_observation: string | null;
  observation_period?: string | null;
  source: string;
  expected_frequency: SeriesFrequency;
  freshness_days: number | null;
  max_stale_days: number;
  expected_next_release_window?: {
    start: string;
    end: string;
  } | null;
  message?: string;
}

export interface DataStatusFile {
  last_successful_update_utc: string | null;
  last_attempt_utc?: string;
  generated_at_utc: string;
  overall_status: DataStatus;
  update_status?: UpdateStatus;
  update_message?: string;
  series: Record<string, SeriesStatus>;
}
