import type { SignalFreshnessStatus } from "../lib/types";

type FocusBlockProps = {
  variant: "section" | "compact";
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
  const isStale = props.freshnessStatus && props.freshnessStatus !== "ok";
  const className =
    `focus-block focus-block--${props.variant}` + (isStale ? " focus-block--stale" : "");
  return (
    <section className={className} aria-label={props.ariaLabel ?? props.question}>
      {props.eyebrow && <p className="focus-block__eyebrow">{props.eyebrow}</p>}
      <h2 className="focus-block__question">{props.question}</h2>
      <p className="focus-block__answer">{props.answer}</p>
      {props.why && <p className="focus-block__why">{props.why}</p>}
      <dl className="focus-block__signals">
        {props.risk && (
          <>
            <dt>Risk</dt>
            <dd>{props.risk}</dd>
          </>
        )}
        {props.support && (
          <>
            <dt>Support</dt>
            <dd>{props.support}</dd>
          </>
        )}
      </dl>
      {props.caveat && <p className="focus-block__caveat">{props.caveat}</p>}
    </section>
  );
}
