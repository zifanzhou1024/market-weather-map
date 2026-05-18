// src/lib/i18n/locale.tsx
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type Locale = "en" | "zh";

const STORAGE_KEY = "mwm.locale";
const VALID_LOCALES: ReadonlySet<string> = new Set(["en", "zh"]);

function readUrlLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("lang");
  return raw && VALID_LOCALES.has(raw) ? (raw as Locale) : null;
}

function readStorageLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw && VALID_LOCALES.has(raw) ? (raw as Locale) : null;
  } catch {
    return null;
  }
}

export function resolveLocale(): Locale {
  return readUrlLocale() ?? readStorageLocale() ?? "en";
}

export function setLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore localStorage failures
  }
  const url = new URL(window.location.href);
  url.searchParams.set("lang", locale);
  window.history.replaceState({}, "", url.toString());
  window.dispatchEvent(new CustomEvent("mwm:locale-change"));
}

const LocaleContext = createContext<Locale>("en");

interface LocaleProviderProps {
  initialLocale?: Locale;
  children: ReactNode;
}

export function LocaleProvider({ initialLocale, children }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initialLocale) return initialLocale;
    if (typeof window === "undefined") return "en";
    return resolveLocale();
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onChange = () => setLocaleState(resolveLocale());
    window.addEventListener("mwm:locale-change", onChange);

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) onChange();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("mwm:locale-change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}
