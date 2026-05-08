import { Link } from "react-router-dom";

interface OverviewDecisionCardProps {
  title: string;
  horizon: string;
  to: string;
  label: string;
  support: string;
  risk: string;
  sourceGapCount?: number;
}

export default function OverviewDecisionCard({
  horizon,
  label,
  risk,
  sourceGapCount = 0,
  support,
  title,
  to
}: OverviewDecisionCardProps) {
  return (
    <article className="decision-card">
      <div>
        <p className="eyebrow">{horizon}</p>
        <h3>{title}</h3>
        <strong>{label}</strong>
      </div>
      <p>Support: {support}</p>
      <p>Risk: {risk}</p>
      <p>{sourceGapCount} source gaps or candidate rows visible.</p>
      <Link className="decision-card__link" to={to}>
        Open view
      </Link>
    </article>
  );
}
