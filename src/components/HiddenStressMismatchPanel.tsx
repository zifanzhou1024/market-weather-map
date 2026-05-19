import type { ShockRiskMismatchWarning } from "../lib/types";
import { useT } from "../lib/i18n";

interface HiddenStressMismatchPanelProps {
  warnings: ShockRiskMismatchWarning[];
}

export default function HiddenStressMismatchPanel({ warnings }: HiddenStressMismatchPanelProps) {
  const { t } = useT();
  return (
    <section
      className="hidden-stress-mismatch-panel"
      aria-label="Hidden stress mismatches between active channels"
    >
      <header>
        <h3>{t("sections.hiddenStressMismatches")}</h3>
        <p>{t("panels.hiddenMismatchesDesc")}</p>
      </header>
      {warnings.length === 0 ? (
        <p className="hidden-stress-mismatch-panel-empty">
          {t("panels.hiddenMismatchesEmpty")}
        </p>
      ) : (
        <ol>
          {warnings.map((warning) => (
            <li key={warning.id} className="hidden-stress-mismatch-panel-row">
              <span className="hidden-stress-mismatch-panel-label">{warning.label}</span>
              <span className="hidden-stress-mismatch-panel-message">{warning.message}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
