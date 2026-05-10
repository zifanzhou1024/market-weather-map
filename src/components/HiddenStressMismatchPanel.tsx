import type { ShockRiskMismatchWarning } from "../lib/types";

interface HiddenStressMismatchPanelProps {
  warnings: ShockRiskMismatchWarning[];
}

export default function HiddenStressMismatchPanel({ warnings }: HiddenStressMismatchPanelProps) {
  return (
    <section
      className="hidden-stress-mismatch-panel"
      aria-label="Hidden stress mismatches between active channels"
    >
      <header>
        <h3>Hidden stress mismatches</h3>
        <p>Cross-asset conflicts where one channel is calm while another is stressed.</p>
      </header>
      {warnings.length === 0 ? (
        <p className="hidden-stress-mismatch-panel-empty">
          No mismatches between active stress channels in the current snapshot.
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
