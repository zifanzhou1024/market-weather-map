import type {
  BucketScoresFile,
  DataStatusFile,
  RegimeScoreFile,
  SeriesCatalogEntry,
  TimeSeriesFile
} from "./types";

const baseUrl = (import.meta as ImportMeta & { env: { BASE_URL: string } }).env.BASE_URL.replace(
  /\/$/,
  ""
);

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
  const response = await fetch(`${baseUrl}${path}`);

  if (!response.ok) {
    throw new DataLoadError(`Failed to load ${path}`, path, response.status);
  }

  return (await response.json()) as T;
}

export function loadCatalog(): Promise<SeriesCatalogEntry[]> {
  return loadJson<SeriesCatalogEntry[]>("/data/catalog/series_catalog.json");
}

export function loadSeries(seriesId: string): Promise<TimeSeriesFile> {
  return loadJson<TimeSeriesFile>(`/data/series/${seriesId}.json`);
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
