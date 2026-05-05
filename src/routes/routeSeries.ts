import { DataLoadError, loadDerivedSeries, loadSeries } from "../lib/data";
import type { DataStatusFile, DerivedSeriesFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

interface LoadRouteSeriesOptions {
  allowMissing?: ReadonlySet<string>;
}

const placeholderStatuses = new Set(["unavailable", "terms_review_needed"]);

function placeholderSeries(seriesId: string, catalog: SeriesCatalogEntry[]): TimeSeriesFile {
  const catalogEntry = catalog.find((entry) => entry.id === seriesId);

  return {
    frequency: catalogEntry?.frequency ?? "daily",
    generated_at_utc: "",
    observations: [],
    series_id: seriesId,
    source: catalogEntry?.source ?? "Unavailable",
    source_url: catalogEntry?.source_url ?? "",
    units: catalogEntry?.units ?? ""
  };
}

async function loadSeriesWithPlaceholder(
  seriesId: string,
  catalog: SeriesCatalogEntry[],
  dataStatus: DataStatusFile,
  options: LoadRouteSeriesOptions
): Promise<TimeSeriesFile> {
  try {
    return await loadSeries(seriesId);
  } catch (error) {
    if (error instanceof DataLoadError && error.status === 404) {
      const catalogEntry = catalog.find((entry) => entry.id === seriesId);
      const status = dataStatus.series[seriesId]?.status;
      const mayUseStatusPlaceholder = status ? placeholderStatuses.has(status) : false;
      const mayUseExplicitPlaceholder = options.allowMissing?.has(seriesId) ?? false;

      if (catalogEntry && (mayUseStatusPlaceholder || mayUseExplicitPlaceholder)) {
        return placeholderSeries(seriesId, catalog);
      }
    }

    throw error;
  }
}

export function loadRouteSeries(
  seriesIds: string[],
  catalog: SeriesCatalogEntry[],
  dataStatus: DataStatusFile,
  options: LoadRouteSeriesOptions = {}
): Promise<TimeSeriesFile[]> {
  return Promise.all(
    seriesIds.map((seriesId) => loadSeriesWithPlaceholder(seriesId, catalog, dataStatus, options))
  );
}

function placeholderDerivedSeries(seriesId: string, catalogEntry?: SeriesCatalogEntry): DerivedSeriesFile {
  return {
    depends_on: [],
    frequency: catalogEntry?.frequency ?? "daily",
    generated_at_utc: "",
    method: catalogEntry?.notes ?? "Derived data unavailable.",
    observations: [],
    series_id: seriesId,
    source: catalogEntry?.source ?? "Unavailable",
    source_url: catalogEntry?.source_url ?? "",
    units: catalogEntry?.units ?? ""
  };
}

async function loadDerivedSeriesWithPlaceholder(
  seriesId: string,
  catalog: SeriesCatalogEntry[],
  dataStatus: DataStatusFile,
  options: LoadRouteSeriesOptions
): Promise<DerivedSeriesFile> {
  try {
    return await loadDerivedSeries(seriesId);
  } catch (error) {
    if (error instanceof DataLoadError && error.status === 404) {
      const catalogEntry = catalog.find((entry) => entry.id === seriesId);
      const status = dataStatus.series[seriesId]?.status;
      const mayUseStatusPlaceholder = status ? placeholderStatuses.has(status) : false;
      const mayUseExplicitPlaceholder = options.allowMissing?.has(seriesId) ?? false;

      if (mayUseStatusPlaceholder || mayUseExplicitPlaceholder) {
        return placeholderDerivedSeries(seriesId, catalogEntry);
      }
    }

    throw error;
  }
}

export function loadRouteDerivedSeries(
  seriesIds: string[],
  catalog: SeriesCatalogEntry[],
  dataStatus: DataStatusFile,
  options: LoadRouteSeriesOptions = {}
): Promise<DerivedSeriesFile[]> {
  return Promise.all(
    seriesIds.map((seriesId) => loadDerivedSeriesWithPlaceholder(seriesId, catalog, dataStatus, options))
  );
}

export function hasObservations(series: TimeSeriesFile | undefined): series is TimeSeriesFile {
  return Boolean(series && series.observations.length > 0);
}
