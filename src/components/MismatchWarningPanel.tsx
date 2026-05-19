import type { ShockRiskMismatchWarning } from "../lib/types";
import { useT } from "../lib/i18n";

interface MismatchWarningPanelProps {
  warnings: ShockRiskMismatchWarning[];
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

export default function MismatchWarningPanel({ warnings }: MismatchWarningPanelProps) {
  const { t } = useT();
  const safeWarnings = safeArray<ShockRiskMismatchWarning>(warnings);

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">{t("sections.confirmation")}</p>
          <h3>{t("sections.mismatchWarnings")}</h3>
          <p>{t("panels.mismatchWarningsDesc")}</p>
        </div>
      </div>
      {safeWarnings.length > 0 ? (
        <div className="candidate-source-list" role="list">
          {safeWarnings.map((warning) => (
            <article className="candidate-source-row" key={warning.id} role="listitem">
              <div>
                <h4>{warning.label}</h4>
                <p>{t("panels.inIdPrefix")} {warning.id}</p>
                <p>{warning.message}</p>
              </div>
              <span className="status-pill status-partial">{t("panels.mismatch")}</span>
            </article>
          ))}
        </div>
      ) : (
        <p className="score-note">{t("panels.mismatchWarningsEmpty")}</p>
      )}
    </section>
  );
}
