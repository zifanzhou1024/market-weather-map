import type { ReactNode } from "react";
import { lookupGlossary } from "../lib/glossary";
import { useT } from "../lib/i18n";

/**
 * Wrap a jargon term with a native browser tooltip explaining it.
 *
 * Design notes:
 * - Renders semantic `<abbr title>` so the tooltip is handled by the browser
 *   and assistive tech without a custom popover library. Native covers
 *   desktop hover, keyboard focus (when the wrapping element is focusable),
 *   and long-press on iOS/Android.
 * - Falls through to bare children when the term isn't in the glossary, so
 *   it's safe to wrap any label without first checking if it's defined —
 *   nothing breaks if a future label is added that the glossary hasn't
 *   caught up with.
 * - Pass `term` for the lookup and optional `children` to override the
 *   visible label. Most call sites just pass `term` and let it double as the
 *   label (the common case for cockpit cell labels).
 */
interface Props {
  /** Glossary key to look up. Defaults to also being the visible label. */
  term: string;
  /** Override the rendered label. Defaults to `term`. */
  children?: ReactNode;
  /** Extra CSS classes added alongside the `glossary` class. */
  className?: string;
}

export default function GlossaryTerm({ term, children, className }: Props) {
  const { locale } = useT();
  const definition = lookupGlossary(term, locale);
  const label = children ?? term;

  if (!definition) {
    // No matching entry — render the label unchanged. This keeps the
    // component safe to sprinkle at every site without first auditing the
    // glossary; tooltips appear only where a definition exists.
    return <>{label}</>;
  }

  const classes = ["glossary", className].filter(Boolean).join(" ");

  return (
    <abbr title={definition} className={classes}>
      {label}
    </abbr>
  );
}
