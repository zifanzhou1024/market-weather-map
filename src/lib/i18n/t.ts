// src/lib/i18n/t.ts
import { useLocale } from "./locale";
import { en, type En } from "./en";
import { zh } from "./zh";
import { SIGNAL_NAMES, COCKPIT_ID_TO_SIGNAL_KEY } from "./signals";

type Dict = En;

const warnedKeys = new Set<string>();

function lookupDeep(dict: any, parts: string[]): string | undefined {
  let cur: any = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

function applyVars(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`));
}

export interface TOpts {
  withOriginal?: boolean;
  vars?: Record<string, string | number>;
}

export interface UseT {
  t: (key: string, opts?: TOpts) => string;
  locale: "en" | "zh";
}

export function useT(): UseT {
  const locale = useLocale();
  const dict: Dict = locale === "zh" ? zh : en;

  const t = (key: string, opts?: TOpts): string => {
    // signals.<key> — special path that respects withOriginal
    if (key.startsWith("signals.")) {
      const sigKey = key.slice("signals.".length);
      const sig = SIGNAL_NAMES[sigKey];
      if (!sig) {
        if (import.meta.env.DEV && !warnedKeys.has(key)) {
          warnedKeys.add(key);
          // eslint-disable-next-line no-console
          console.warn(`[i18n] unknown signal key: ${sigKey}`);
        }
        return sigKey;
      }
      if (locale === "zh") {
        return opts?.withOriginal ? `${sig.zh} (${sig.original})` : sig.zh;
      }
      return sig.original;
    }

    const parts = key.split(".");
    let val = lookupDeep(dict, parts);

    if (val === undefined && locale !== "en") {
      val = lookupDeep(en, parts);
      if (import.meta.env.DEV && val !== undefined && !warnedKeys.has(key)) {
        warnedKeys.add(key);
        // eslint-disable-next-line no-console
        console.warn(`[i18n] missing zh translation for "${key}" — falling back to en`);
      }
    }

    if (val === undefined) {
      if (import.meta.env.DEV && !warnedKeys.has(key)) {
        warnedKeys.add(key);
        // eslint-disable-next-line no-console
        console.warn(`[i18n] unknown key: ${key}`);
      }
      return key;
    }

    return applyVars(val, opts?.vars);
  };

  return { t, locale };
}

export { SIGNAL_NAMES, COCKPIT_ID_TO_SIGNAL_KEY };
