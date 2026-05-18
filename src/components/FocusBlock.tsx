import type { SignalFreshnessStatus } from "../lib/types";
import { useT } from "../lib/i18n";

type FocusBlockProps = {
  variant: "section" | "compact";
  /**
   * Optional section.id (matches the SectionId union in types.ts). When set,
   * the eyebrow and question fields are looked up via i18n
   * (focus.<sectionId>.eyebrow / focus.<sectionId>.question). If a key is
   * missing — t() returns the bare key — we gracefully fall back to the
   * raw `eyebrow`/`question` props sourced from the JSON.
   *
   * The dynamic narrative fields (answer, why, risk, support, caveat) come
   * from Python-emitted strings with numeric interpolation and stay English
   * by design; they wrap in lang="en" so CJK font fallback and screen
   * readers behave correctly when zh is active.
   */
  sectionId?: string;
  eyebrow?: string;
  question: string;
  answer: string;
  why?: string;
  risk?: string;
  support?: string;
  caveat?: string;
  freshnessStatus?: SignalFreshnessStatus;
  ariaLabel?: string;
};

export default function FocusBlock(props: FocusBlockProps) {
  const { t, locale } = useT();
  const isStale = props.freshnessStatus && props.freshnessStatus !== "ok";
  const className =
    `focus-block focus-block--${props.variant}` + (isStale ? " focus-block--stale" : "");

  // When sectionId is supplied AND the active locale is zh, try to translate
  // eyebrow/question via i18n. Under en we always use the JSON-sourced strings
  // so the public/data pipeline remains the canonical English copy. useT().t
  // returns the bare key when a lookup misses — fall back to the raw prop in
  // that case so missing zh entries don't render "focus.foo.eyebrow" verbatim.
  let eyebrowText = props.eyebrow;
  let questionText = props.question;
  if (props.sectionId && locale === "zh") {
    const eyebrowKey = `focus.${props.sectionId}.eyebrow`;
    const questionKey = `focus.${props.sectionId}.question`;
    const eyebrowLookup = t(eyebrowKey);
    const questionLookup = t(questionKey);
    if (eyebrowLookup !== eyebrowKey) eyebrowText = eyebrowLookup;
    if (questionLookup !== questionKey) questionText = questionLookup;
  }

  return (
    <section className={className} aria-label={props.ariaLabel ?? questionText}>
      {eyebrowText && <p className="focus-block__eyebrow">{eyebrowText}</p>}
      <h2 className="focus-block__question">{questionText}</h2>
      <p className="focus-block__answer" lang="en">{props.answer}</p>
      {props.why && <p className="focus-block__why" lang="en">{props.why}</p>}
      <dl className="focus-block__signals">
        {props.risk && (
          <>
            <dt>Risk</dt>
            <dd lang="en">{props.risk}</dd>
          </>
        )}
        {props.support && (
          <>
            <dt>Support</dt>
            <dd lang="en">{props.support}</dd>
          </>
        )}
      </dl>
      {props.caveat && <p className="focus-block__caveat" lang="en">{props.caveat}</p>}
    </section>
  );
}
