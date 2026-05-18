import { useEffect, useRef } from "react";

interface Group {
  title: string;
  items: Array<{ keys: string; label: string }>;
}

const GROUPS: Group[] = [
  {
    title: "Navigation",
    items: [
      { keys: "g o", label: "Overview" },
      { keys: "g s", label: "Short-Term" },
      { keys: "g l", label: "Long-Term" },
      { keys: "g f", label: "Fragility" },
      { keys: "g c", label: "Channels" },
      { keys: "g h", label: "History" },
      { keys: "g d", label: "Diff" },
      { keys: "g m", label: "Methodology" }
    ]
  },
  {
    title: "View",
    items: [{ keys: "b", label: "Toggle Brief / Detail mode" }]
  },
  {
    title: "Help",
    items: [
      { keys: "?", label: "Toggle this overlay" },
      { keys: "Esc", label: "Close overlay / cancel g prefix" }
    ]
  }
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsHelp({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus the close button when the overlay opens, so keyboard users land
  // inside the dialog and Esc / Tab behave as expected.
  useEffect(() => {
    if (open && closeRef.current) closeRef.current.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="kbd-help-backdrop" role="presentation" onClick={onClose}>
      <div
        className="kbd-help"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kbd-help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="kbd-help__header">
          <h2 id="kbd-help-title" className="kbd-help__title">
            Keyboard shortcuts
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="kbd-help__close"
            onClick={onClose}
            aria-label="Close keyboard shortcuts help"
          >
            ×
          </button>
        </header>
        <div className="kbd-help__body">
          {GROUPS.map((group) => (
            <section key={group.title} className="kbd-help__group">
              <h3 className="kbd-help__group-title">{group.title}</h3>
              <dl className="kbd-help__list">
                {group.items.map((item) => (
                  <div key={item.keys} className="kbd-help__row">
                    <dt>
                      <kbd className="kbd-help__keys">{item.keys}</kbd>
                    </dt>
                    <dd>{item.label}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <footer className="kbd-help__footer">
          <p>
            Press <kbd>?</kbd> anytime to toggle this overlay.
          </p>
        </footer>
      </div>
    </div>
  );
}
