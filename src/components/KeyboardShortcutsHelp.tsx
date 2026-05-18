import { useEffect, useRef } from "react";
import { useT } from "../lib/i18n";

interface Group {
  title: string;
  items: Array<{ keys: string; label: string }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsHelp({ open, onClose }: Props) {
  const { t } = useT();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus the close button when the overlay opens, so keyboard users land
  // inside the dialog and Esc / Tab behave as expected.
  useEffect(() => {
    if (open && closeRef.current) closeRef.current.focus();
  }, [open]);

  if (!open) return null;

  const groups: Group[] = [
    {
      title: t("shortcuts.groupNavigation"),
      items: [
        { keys: "g o", label: t("shortcuts.goOverview") },
        { keys: "g s", label: t("shortcuts.goShortTerm") },
        { keys: "g l", label: t("shortcuts.goLongTerm") },
        { keys: "g f", label: t("shortcuts.goFragility") },
        { keys: "g c", label: t("shortcuts.goChannels") },
        { keys: "g h", label: t("shortcuts.goHistory") },
        { keys: "g d", label: t("shortcuts.goDiff") },
        { keys: "g m", label: t("shortcuts.goMethodology") }
      ]
    },
    {
      title: t("shortcuts.groupView"),
      items: [
        { keys: "b", label: t("shortcuts.toggleMode") },
        { keys: "g i", label: t("shortcuts.toggleLanguage") }
      ]
    },
    {
      title: t("shortcuts.groupHelp"),
      items: [
        { keys: "?", label: t("shortcuts.showHelp") },
        { keys: "Esc", label: t("shortcuts.closeHelp") }
      ]
    }
  ];

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
            {t("chrome.keyboardShortcuts")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="kbd-help__close"
            onClick={onClose}
            aria-label={t("shortcuts.closeAria")}
          >
            ×
          </button>
        </header>
        <div className="kbd-help__body">
          {groups.map((group) => (
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
            {t("shortcuts.footerPrefix")} <kbd>?</kbd> {t("shortcuts.footerSuffix")}
          </p>
        </footer>
      </div>
    </div>
  );
}
