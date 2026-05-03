export type DataStatus = "ok" | "stale" | "partial" | "failed";

export type WeatherLabel =
  | "Supportive"
  | "Neutral"
  | "Mixed"
  | "Fragile"
  | "Stressed"
  | "Crowded";

export interface SeriesCatalogEntry {
  id: string;
  name: string;
  category: "volatility" | "rates" | "liquidity" | "credit" | "commodities" | "sentiment";
  source: string;
  source_url: string;
  endpoint_url?: string;
  frequency: "daily" | "weekly";
  units: string;
  higher_is: "supportive" | "riskier" | "contextual";
  public: boolean;
  max_stale_days: number;
  notes: string;
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
  percentile_252d: number | null;
}

export interface TimeSeriesFile {
  series_id: string;
  generated_at_utc: string;
  source: string;
  source_url: string;
  frequency: "daily" | "weekly";
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
  source: string;
  expected_frequency: "daily" | "weekly";
  freshness_days: number | null;
  max_stale_days: number;
  message?: string;
}

export interface DataStatusFile {
  last_successful_update_utc: string | null;
  generated_at_utc: string;
  overall_status: DataStatus;
  series: Record<string, SeriesStatus>;
}
