import { formatDate, statusLabel } from "../lib/formatters";
import type { DataStatusFile } from "../lib/types";

interface DataStatusTableProps {
  status: DataStatusFile;
  seriesIds?: string[];
}

function formatFreshness(days: number | null) {
  if (days === null) return "N/A";
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export default function DataStatusTable({ status, seriesIds }: DataStatusTableProps) {
  const selectedIds = seriesIds ? new Set(seriesIds) : undefined;
  const rows = Object.entries(status.series).filter(([seriesId]) => !selectedIds || selectedIds.has(seriesId));

  return (
    <section className="panel status-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Data status</p>
          <h3>Static feed freshness</h3>
        </div>
        <p>Generated {formatDate(status.generated_at_utc)}</p>
      </div>
      <div className="status-table-wrap">
        <table className="status-table">
          <thead>
            <tr>
              <th>Series</th>
              <th>Status</th>
              <th>Last observation</th>
              <th>Freshness</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([seriesId, row]) => (
              <tr key={seriesId}>
                <td>{seriesId}</td>
                <td>
                  <span className={`status-pill status-${row.status}`}>{statusLabel(row.status)}</span>
                </td>
                <td>{formatDate(row.last_observation)}</td>
                <td>{formatFreshness(row.freshness_days)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
