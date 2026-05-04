import { DataLoadError, loadSeries } from "../lib/data";
import type { SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

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
  catalog: SeriesCatalogEntry[]
): Promise<TimeSeriesFile> {
  try {
    return await loadSeries(seriesId);
  } catch (error) {
    if (error instanceof DataLoadError && error.status === 404) {
      return placeholderSeries(seriesId, catalog);
    }

    throw error;
  }
}

export function loadRouteSeries(
  seriesIds: string[],
  catalog: SeriesCatalogEntry[]
): Promise<TimeSeriesFile[]> {
  return Promise.all(seriesIds.map((seriesId) => loadSeriesWithPlaceholder(seriesId, catalog)));
}
