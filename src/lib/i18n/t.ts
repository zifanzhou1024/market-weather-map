// src/lib/i18n/t.ts
import { useLocale } from "./locale";
import { en, type En } from "./en";
import { zh } from "./zh";
import { SIGNAL_NAMES, COCKPIT_ID_TO_SIGNAL_KEY } from "./signals";

type Dict = En;

const warnedKeys = new Set<string>();

function lookupDeep(dict: any, parts: string[]): unknown {
  let cur: any = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
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
  /**
   * Translate a categorical English label emitted by the Python pipeline via
   * the `categoricals.<group>` lookup tables. Falls back to the input when no
   * match is found.
   *
   * For `compositeReading`, `bucketReading`, and `regime` groups the value
   * may also be a slash-separated phrase ("Tightening / risk-off",
   * "Real-yield / dollar"). The helper translates each piece, joining with
   * the original separator, so multi-token labels still localize.
   */
  tCategorical: (group: string, value: string | null | undefined) => string;
  locale: "en" | "zh";
}

const PIECEWISE_GROUPS: ReadonlySet<string> = new Set([
  "regime",
  "compositeReading",
  "bucketReading",
  "confirmation",
  "yieldDriver",
]);

function categoricalDirect(
  dict: Dict,
  group: string,
  value: string
): string | undefined {
  const cats = (dict as any).categoricals;
  if (!cats || typeof cats !== "object") return undefined;
  const table = cats[group];
  if (!table || typeof table !== "object") return undefined;
  const out = table[value];
  return typeof out === "string" ? out : undefined;
}

function categoricalPiecewise(
  dict: Dict,
  group: string,
  value: string
): string {
  // Try direct first; if found, return that (preferred for exact strings).
  const direct = categoricalDirect(dict, group, value);
  if (direct !== undefined) return direct;

  // Split on " / ", " and ", " or " — keep separators verbatim.
  const pattern = /(\s*(?:\/|and|or)\s*)/i;
  const parts = value.split(pattern);
  if (parts.length <= 1) return value;

  let any = false;
  const out = parts.map((part) => {
    if (pattern.test(part)) return part;
    const trimmed = part.trim();
    if (!trimmed) return part;
    const lookup = categoricalDirect(dict, group, trimmed) ?? null;
    if (lookup !== null && lookup !== trimmed) any = true;
    return lookup !== null ? part.replace(trimmed, lookup) : part;
  });
  return any ? out.join("") : value;
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

    if ((val === undefined || typeof val !== "string") && locale !== "en") {
      val = lookupDeep(en, parts);
      if (import.meta.env.DEV && val !== undefined && !warnedKeys.has(key)) {
        warnedKeys.add(key);
        // eslint-disable-next-line no-console
        console.warn(`[i18n] missing zh translation for "${key}" — falling back to en`);
      }
    }

    if (typeof val !== "string") {
      if (import.meta.env.DEV && !warnedKeys.has(key)) {
        warnedKeys.add(key);
        // eslint-disable-next-line no-console
        console.warn(`[i18n] unknown key: ${key}`);
      }
      return key;
    }

    return applyVars(val, opts?.vars);
  };

  const tCategorical = (group: string, value: string | null | undefined): string => {
    if (value === null || value === undefined || value === "") return "";
    const trimmed = value.trim();
    if (!trimmed) return value;
    if (locale !== "zh") return value;
    if (PIECEWISE_GROUPS.has(group)) {
      return categoricalPiecewise(dict, group, value);
    }
    return categoricalDirect(dict, group, trimmed) ?? value;
  };

  return { t, tCategorical, locale };
}

export { SIGNAL_NAMES, COCKPIT_ID_TO_SIGNAL_KEY };
