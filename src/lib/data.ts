import type {
  BucketScoresFile,
  DataStatusFile,
  DerivedSeriesFile,
  RegimeScoreFile,
  SeriesCatalogEntry,
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

export function loadBucketScores(): Promise<BucketScoresFile> {
  return loadJson<BucketScoresFile>("/data/derived/bucket_scores.json");
}

export function loadDataStatus(): Promise<DataStatusFile> {
  return loadJson<DataStatusFile>("/data/status/data_status.json");
}
