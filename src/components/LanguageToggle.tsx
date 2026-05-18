// src/components/LanguageToggle.tsx
import { useLocale, setLocale, useT } from "../lib/i18n";

export default function LanguageToggle() {
  const locale = useLocale();
  const { t } = useT();
  const other = locale === "en" ? "zh" : "en";

  return (
    <div
      className="language-toggle"
      role="group"
      aria-label={t("chrome.languageToggle")}
    >
      <button
        type="button"
        className={`language-toggle__option ${locale === "en" ? "is-active" : ""}`}
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        aria-label="English"
      >
        EN
      </button>
      <span className="language-toggle__divider" aria-hidden="true">|</span>
      <button
        type="button"
        className={`language-toggle__option ${locale === "zh" ? "is-active" : ""}`}
        onClick={() => setLocale("zh")}
        aria-pressed={locale === "zh"}
        aria-label="简体中文"
      >
        中
      </button>
    </div>
  );
}
