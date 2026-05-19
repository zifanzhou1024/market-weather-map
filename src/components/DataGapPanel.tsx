import { formatDate, statusLabel } from "../lib/formatters";
import type { DataStatusFile, SeriesStatus } from "../lib/types";
import { useT } from "../lib/i18n";

interface DataGapPanelProps {
  status: DataStatusFile;
  seriesIds?: string[];
}

const gapStatuses = new Set<SeriesStatus["status"]>([
  "stale",
  "failed",
  "terms_review_needed",
  "unavailable"
]);

function isGapRow(row: SeriesStatus) {
  return (
    gapStatuses.has(row.status) ||
    (row.expected_next_release_window !== null && row.expected_next_release_window !== undefined)
  );
}

export default function DataGapPanel({ status, seriesIds }: DataGapPanelProps) {
  const { t, tCategorical } = useT();
  const selectedIds = seriesIds ? new Set(seriesIds) : undefined;
  const rows = Object.entries(status.series).filter(
    ([seriesId, row]) => (!selectedIds || selectedIds.has(seriesId)) && isGapRow(row)
  );

  return (
    <section className="panel data-gap-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">{t("sections.dataGaps")}</p>
          <h3>{t("sections.dataGapsTitle")}</h3>
        </div>
      </div>
      {rows.length > 0 ? (
        <div className="status-table-wrap">
          <table className="status-table">
            <thead>
              <tr>
                <th>{t("panels.colSeries")}</th>
                <th>{t("panels.colStatus")}</th>
                <th>{t("panels.colObservation")}</th>
                <th>{t("panels.colNote")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([seriesId, row]) => (
                <tr key={seriesId}>
                  <td>{seriesId}</td>
                  <td>
                    <span className={`status-pill status-${row.status}`}>
                      {tCategorical("status", statusLabel(row.status))}
                    </span>
                  </td>
                  <td>{row.observation_period ?? formatDate(row.last_observation)}</td>
                  <td>{row.message ?? t("chrome.notAvailable")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="score-note">{t("panels.dataGapsEmpty")}</p>
      )}
    </section>
  );
}
