import type { SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

interface SourceNoteProps {
  series: TimeSeriesFile;
  catalogEntry?: SeriesCatalogEntry;
}

export default function SourceNote({ series, catalogEntry }: SourceNoteProps) {
  const source = catalogEntry?.source ?? series.source;
  const sourceUrl = catalogEntry?.source_url ?? series.source_url;
  const frequency = catalogEntry?.frequency ?? series.frequency;

  return (
    <section className="panel source-note">
      <div>
        <p className="eyebrow">Source</p>
        <h3>{source}</h3>
      </div>
      <p>{catalogEntry?.notes ?? "Public static time-series data."}</p>
      <dl className="detail-list">
        <div>
          <dt>Frequency</dt>
          <dd>{frequency}</dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd>
            <a href={sourceUrl} rel="noreferrer" target="_blank">
              Source reference
            </a>
          </dd>
        </div>
      </dl>
    </section>
  );
}
