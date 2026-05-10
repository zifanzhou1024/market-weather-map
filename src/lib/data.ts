import type {
  BucketScoresFile,
  DataStatusFile,
  DerivedSeriesFile,
  MacroCalendarFile,
  RegimeReplayFile,
  RegimeScoreFile,
  RegimeSnapshotFile,
  ScoreHistoryFile,
  ScoreSummaryFile,
  ShockRiskSnapshotFile,
  SeriesCatalogEntry,
  SignalPriorityFile,
  SourceRegistryFile,
  TimeSeriesFile
} from "./types";

const baseUrl = (import.meta as ImportMeta & { env: { BASE_URL: string } }).env.BASE_URL.replace(
  /\/$/,
  ""
);
const dataPathPattern = /^\/data\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.json$/;
const seriesIdPattern = /^[a-z0-9_]+$/;

export class DataLoadError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "DataLoadError";
  }
}

export async function loadJson<T>(path: string): Promise<T> {
  if (!dataPathPattern.test(path)) {
    throw new DataLoadError(`Invalid data path ${path}`, path);
  }

  const response = await fetch(`${baseUrl}${path}`);

  if (!response.ok) {
    throw new DataLoadError(`Failed to load ${path}`, path, response.status);
  }

  return (await response.json()) as T;
}

export function loadCatalog(): Promise<SeriesCatalogEntry[]> {
  return loadJson<SeriesCatalogEntry[]>("/data/catalog/series_catalog.json");
}

export async function loadSeries(seriesId: string): Promise<TimeSeriesFile> {
  if (!seriesIdPattern.test(seriesId)) {
    throw new DataLoadError(`Invalid series id ${seriesId}`, seriesId);
  }

  return loadJson<TimeSeriesFile>(`/data/series/${seriesId}.json`);
}

export async function loadDerivedSeries(seriesId: string): Promise<DerivedSeriesFile> {
  if (!seriesIdPattern.test(seriesId)) {
    throw new DataLoadError(`Invalid derived series id ${seriesId}`, seriesId);
  }

  return loadJson<DerivedSeriesFile>(`/data/derived/${seriesId}.json`);
}

export function loadRegimeScore(): Promise<RegimeScoreFile> {
  return loadJson<RegimeScoreFile>("/data/derived/regime_score.json");
}

export function loadRegimeSnapshot(): Promise<RegimeSnapshotFile> {
  return loadJson<RegimeSnapshotFile>("/data/derived/regime_snapshot.json");
}

export function loadRegimeReplay(): Promise<RegimeReplayFile> {
  return loadJson<RegimeReplayFile>("/data/derived/regime_replay.json");
}

export function loadShockRiskSnapshot(): Promise<ShockRiskSnapshotFile> {
  return loadJson<ShockRiskSnapshotFile>("/data/derived/shock_risk_snapshot.json");
}

export function loadBucketScores(): Promise<BucketScoresFile> {
  return loadJson<BucketScoresFile>("/data/derived/bucket_scores.json");
}

export function loadDataStatus(): Promise<DataStatusFile> {
  return loadJson<DataStatusFile>("/data/status/data_status.json");
}

export function loadSourceRegistry(): Promise<SourceRegistryFile> {
  return loadJson<SourceRegistryFile>("/data/catalog/source_registry.json");
}

export function loadScoreSummary(): Promise<ScoreSummaryFile> {
  return loadJson<ScoreSummaryFile>("/data/derived/score_summary.json");
}

export function loadScoreHistory(): Promise<ScoreHistoryFile> {
  return loadJson<ScoreHistoryFile>("/data/derived/score_history.json");
}

export function loadMacroCalendar(): Promise<MacroCalendarFile> {
  return loadJson<MacroCalendarFile>("/data/events/macro_calendar.json");
}

export function loadSignalPriority(): Promise<SignalPriorityFile> {
  return loadJson<SignalPriorityFile>("/data/derived/signal_priority.json");
}
