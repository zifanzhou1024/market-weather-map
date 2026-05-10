export type DataStatus =
  | "ok"
  | "stale"
  | "partial"
  | "failed"
  | "terms_review_needed"
  | "unavailable";
export type SeriesFrequency = "daily" | "weekly" | "monthly" | "quarterly";
export type UpdateStatus = "ok" | "failed";
export type MacroEventImportance = "high" | "medium" | "low";
export type MacroEventStatus = "scheduled" | "source_link" | "estimated";

export type SeriesCategory =
  | "volatility"
  | "rates"
  | "liquidity"
  | "credit"
  | "commodities"
  | "sentiment"
  | "growth"
  | "housing"
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

export type Horizon = "tactical" | "strategic" | "both";

export type DirectionState = "up" | "down" | "flat" | "unavailable";

export type YieldDriver =
  | "real_yield_driven"
  | "breakeven_inflation_driven"
  | "real_yield_easing"
  | "safe_haven_or_growth_scare"
  | "mixed"
  | "unavailable";

export type RegimeRole =
  | "real_yield"
  | "nominal_yield"
  | "inflation_expectation"
  | "dollar"
  | "credit"
  | "volatility"
  | "liquidity"
  | "growth"
  | "labor"
  | "housing"
  | "commodity"
  | "sentiment"
  | "tail_risk"
  | "bond_volatility"
  | "banking";

export type PreferredChart =
  | "line"
  | "multi_line"
  | "curve"
  | "heatmap"
  | "quadrant"
  | "decomposition";

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
  data_quality: ConfidenceBreakdownData;
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
  horizon?: Horizon;
  regime_role?: RegimeRole[];
  preferred_chart?: PreferredChart;
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

export interface RegimeSnapshotFile {
  generated_at_utc: string;
  date: string;
  method_version: string;
  regime: {
    label: string;
    tips_direction: DirectionState;
    dollar_direction: DirectionState;
    nominal_yield_direction: DirectionState;
    yield_driver: YieldDriver;
  };
  checklist: Array<{ id: string; label: string; state: string; message: string }>;
  confirmations: Array<{ id: string; label: string; status: string; message: string }>;
  quadrant_trail: Array<{
    date: string;
    dollar_change: number;
    real_yield_change: number;
    nominal_yield_change: number;
    vix_percentile?: number | null;
    credit_change?: number | null;
  }>;
  yield_decomposition: Array<{
    date: string;
    nominal_10y: number;
    real_yield_10y: number;
    breakeven_10y: number;
  }>;
}

export interface RegimeReplayOccurrence {
  date: string;
  real_yield_20obs_change: number;
  dollar_20obs_change: number;
  credit_20obs_change: number;
  vix_curve_20obs_change: number;
  nominal_10y_20obs_change: number;
}

export interface RegimeReplayScenario {
  id: string;
  label: string;
  description: string;
  occurrence_count: number;
  last_occurrence_date: string | null;
  occurrences: RegimeReplayOccurrence[];
  caveat: string;
}

export interface RegimeReplayFile {
  generated_at_utc: string;
  method_version: string;
  scenarios: RegimeReplayScenario[];
}

export interface ScoreHistoryObservation {
  date: string;
  market_weather: number;
  macro_climate: number;
  fragility: number;
}

export interface ScoreHistoryAttributionBlock {
  recent_changes: string[];
  top_risks: string[];
  top_supports: string[];
}

export interface ScoreHistoryFile {
  generated_at_utc: string;
  method_version: string;
  observations: ScoreHistoryObservation[];
  latest_attribution: {
    market_weather: ScoreHistoryAttributionBlock;
    macro_climate: ScoreHistoryAttributionBlock;
    fragility: ScoreHistoryAttributionBlock;
  };
}

export interface ShockRiskSignal {
  id: string;
  label: string;
  score: number;
  value: number | null;
  change: number | null;
  message: string;
}

export interface ShockRiskSourceGap {
  id: string;
  label: string;
  status: DataStatus;
  message: string;
}

export interface ShockRiskMismatchWarning {
  id: string;
  label: string;
  message: string;
}

export interface ShockRiskSnapshotFile {
  generated_at_utc: string;
  date: string;
  method_version: string;
  score: number;
  label: "Elevated shock risk" | "Mixed shock risk" | "Contained shock risk";
  active_signals: ShockRiskSignal[];
  source_gaps: ShockRiskSourceGap[];
  mismatch_warnings: ShockRiskMismatchWarning[];
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

export interface MacroCalendarEvent {
  id: string;
  title: string;
  category: string;
  importance: MacroEventImportance;
  date: string | null;
  time: string | null;
  timezone: string | null;
  source: string;
  source_url: string;
  notes: string;
  status: MacroEventStatus;
}

export interface MacroCalendarFile {
  generated_at_utc: string;
  method_version: string;
  events: MacroCalendarEvent[];
}

export type SignalHorizon = "short_term" | "long_term" | "both" | "fragility";

export type SignalCategory =
  | "volatility"
  | "rates"
  | "credit"
  | "liquidity"
  | "dollar"
  | "positioning"
  | "macro"
  | "event";

export type SignalDirection = "support" | "risk" | "neutral";

export type SignalUrgency = "immediate" | "near_term" | "slow" | "background";

export type SignalFreshnessStatus = "ok" | "stale" | "unavailable";

export interface SignalActiveEntry {
  id: string;
  label: string;
  group: string;
  category: SignalCategory;
  horizon: SignalHorizon;
  importance: number;
  severity: number;
  priority: number;
  direction: SignalDirection;
  urgency: SignalUrgency;
  confidence: number;
  freshness_status: SignalFreshnessStatus;
  source_status: "active";
  message: string;
  why_it_matters: string;
}

export interface SignalMissingEntry {
  id: string;
  label: string;
  group: string;
  category: SignalCategory;
  horizon: SignalHorizon;
  importance: number;
  source_status: DataStatus;
  message: string;
  why_it_matters: string;
}

export interface SignalOverallReadEntry {
  label: string;
  score: number;
  confidence: number;
}

export interface SignalPriorityFile {
  generated_at_utc: string;
  date: string;
  method_version: string;
  overall_read: {
    short_term: SignalOverallReadEntry;
    long_term: SignalOverallReadEntry;
    fragility: SignalOverallReadEntry;
    regime: { label: string };
  };
  top_warnings: SignalActiveEntry[];
  top_supports: SignalActiveEntry[];
  missing_high_value_signals: SignalMissingEntry[];
}
