import { formatDate, statusLabel } from "../lib/formatters";
import type { DataStatusFile, SeriesStatus } from "../lib/types";

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
  return gapStatuses.has(row.status) || row.message?.toLowerCase().includes("expected release window") === true;
}

export default function DataGapPanel({ status, seriesIds }: DataGapPanelProps) {
  const selectedIds = seriesIds ? new Set(seriesIds) : undefined;
  const rows = Object.entries(status.series).filter(
    ([seriesId, row]) => (!selectedIds || selectedIds.has(seriesId)) && isGapRow(row)
  );

  return (
    <section className="panel data-gap-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Data gaps</p>
          <h3>Freshness and coverage notes</h3>
        </div>
      </div>
      {rows.length > 0 ? (
        <div className="status-table-wrap">
          <table className="status-table">
            <thead>
              <tr>
                <th>Series</th>
                <th>Status</th>
                <th>Observation</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([seriesId, row]) => (
                <tr key={seriesId}>
                  <td>{seriesId}</td>
                  <td>
                    <span className={`status-pill status-${row.status}`}>{statusLabel(row.status)}</span>
                  </td>
                  <td>{row.observation_period ?? formatDate(row.last_observation)}</td>
                  <td>{row.message ?? "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="score-note">No stale, failed, unavailable, or candidate rows in this view.</p>
      )}
    </section>
  );
}
