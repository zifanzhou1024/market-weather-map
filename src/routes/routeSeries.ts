import { DataLoadError, loadSeries } from "../lib/data";
import type { DataStatusFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

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
      const mayUseExplicitPlaceholder = !status && options.allowMissing?.has(seriesId);

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

export function hasObservations(series: TimeSeriesFile | undefined): series is TimeSeriesFile {
  return Boolean(series && series.observations.length > 0);
}
