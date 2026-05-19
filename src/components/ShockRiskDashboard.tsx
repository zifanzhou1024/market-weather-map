import { formatDate, formatNumber, formatSigned, statusLabel } from "../lib/formatters";
import type { ShockRiskSnapshotFile } from "../lib/types";
import { useT } from "../lib/i18n";

interface ShockRiskDashboardProps {
  snapshot: ShockRiskSnapshotFile;
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

export default function ShockRiskDashboard({ snapshot }: ShockRiskDashboardProps) {
  const { t, tCategorical, tDriver, tNarrative, locale } = useT();
  const activeSignals = safeArray<(typeof snapshot.active_signals)[number]>(snapshot.active_signals);
  const sourceGaps = safeArray<(typeof snapshot.source_gaps)[number]>(snapshot.source_gaps);
  const label = tCategorical("compositeReading", snapshot.label);

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">{t("sections.shockRisk")}</p>
          <h3>{label}</h3>
          <p>
            {t("panels.shockRiskSnapshotMeta", {
              vars: { date: formatDate(snapshot.date), generated: formatDate(snapshot.generated_at_utc) },
            })}
          </p>
        </div>
        <strong className="score-card__value">{formatNumber(snapshot.score)}</strong>
      </div>

      <div className="metric-grid" aria-label="Shock risk summary">
        <article className="candidate-source-row">
          <div>
            <h4>{t("sections.activeSignals")}</h4>
            <p>{t("panels.shockRiskActiveSignalsCount", { vars: { count: activeSignals.length } })}</p>
          </div>
        </article>
        <article className="candidate-source-row">
          <div>
            <h4>{t("sections.sourceGaps")}</h4>
            <p>{t("panels.shockRiskSourceGapsCount", { vars: { count: sourceGaps.length } })}</p>
          </div>
        </article>
      </div>

      <div className="section-heading">
        <h3>{t("sections.activeSignalRows")}</h3>
      </div>
      {activeSignals.length > 0 ? (
        <div className="candidate-source-list" role="list">
          {activeSignals.map((signal) => {
            const msg = tNarrative(signal.message);
            return (
              <article className="candidate-source-row" key={signal.id} role="listitem">
                <div>
                  <h4>{tDriver(signal.label)}</h4>
                  <p lang={locale === "zh" && !msg.matched ? "en" : undefined}>{msg.text}</p>
                  <p>
                    {t("panels.valuePrefix")} {formatNumber(signal.value)}; {t("panels.changePrefix")} {formatSigned(signal.change)}.
                  </p>
                </div>
                <span className="status-pill status-partial">{t("panels.scorePrefix")} {formatSigned(signal.score)}</span>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="score-note">{t("panels.noVisibleSignals")}</p>
      )}

      <div className="section-heading">
        <h3>{t("sections.sourceGapRows")}</h3>
      </div>
      {sourceGaps.length > 0 ? (
        <div className="candidate-source-list" role="list">
          {sourceGaps.map((gap) => {
            const gapMsg = tNarrative(gap.message);
            return (
              <article className="candidate-source-row" key={gap.id} role="listitem">
                <div>
                  <h4>{tDriver(gap.label)}</h4>
                  <p lang={locale === "zh" && !gapMsg.matched ? "en" : undefined}>{gapMsg.text}</p>
                </div>
                <span className={`status-pill status-${gap.status}`}>
                  {tCategorical("status", statusLabel(gap.status))}
                </span>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="score-note">{t("panels.sourceGapsEmpty")}</p>
      )}
    </section>
  );
}
