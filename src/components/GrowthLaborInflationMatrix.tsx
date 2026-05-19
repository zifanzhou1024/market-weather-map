import { formatNumber, formatSignedScore } from "../charts/chartFormatters";
import type { ScoreSummaryFile } from "../lib/types";
import { useT } from "../lib/i18n";

interface GrowthLaborInflationMatrixProps {
  scoreSummary: ScoreSummaryFile;
}

const FOCUS_BUCKETS = ["growth", "labor", "inflation"] as const;

const EM_DASH = "—";

function humaniseBucketKey(key: string): string {
  if (!key) return key;
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function noteMatchesBucket(note: string, bucket: string): boolean {
  const trimmed = note.trim().toLowerCase();
  const target = bucket.toLowerCase();
  if (!trimmed.startsWith(target)) return false;
  const next = trimmed.charAt(target.length);
  return next === "" || /[^a-z]/.test(next);
}

function pickReadLine(
  bucket: string,
  supports: string[],
  risks: string[]
): string | null {
  for (const note of supports) {
    if (typeof note === "string" && noteMatchesBucket(note, bucket)) return note;
  }
  for (const note of risks) {
    if (typeof note === "string" && noteMatchesBucket(note, bucket)) return note;
  }
  return null;
}

export default function GrowthLaborInflationMatrix({
  scoreSummary
}: GrowthLaborInflationMatrixProps) {
  const { t, tCategorical } = useT();
  const macro = scoreSummary.scores?.macro_climate;
  const bucketScores = macro?.bucket_scores ?? {};
  const bucketWeights = macro?.bucket_weights ?? {};
  const supports = macro?.top_supports ?? [];
  const risks = macro?.top_risks ?? [];

  return (
    <section
      className="growth-labor-inflation-matrix"
      aria-label="Growth, labor, and inflation pulse"
    >
      <header>
        <h3>{t("sections.growthLaborInflationPulse")}</h3>
        <p>{t("panels.gliRowDesc")}</p>
      </header>
      <div className="growth-labor-inflation-row">
        {FOCUS_BUCKETS.map((bucketKey) => {
          const rawScore = bucketScores[bucketKey];
          const rawWeight = bucketWeights[bucketKey];
          const hasScore = isFiniteNumber(rawScore);
          const hasWeight = isFiniteNumber(rawWeight);
          const contribution = hasScore && hasWeight ? rawScore * rawWeight : null;

          const scoreText = hasScore ? formatSignedScore(rawScore) : EM_DASH;
          const weightText = hasWeight ? formatNumber(rawWeight, 2) : EM_DASH;
          const contributionText =
            contribution !== null ? formatSignedScore(contribution) : EM_DASH;

          const readLine = hasScore
            ? pickReadLine(bucketKey, supports, risks) ?? t("panels.gliReadEmpty")
            : t("panels.gliReadNotScored");
          const bucketLabel = tCategorical("bucket", humaniseBucketKey(bucketKey));

          return (
            <article
              key={bucketKey}
              className="growth-labor-inflation-card"
              aria-label={t("panels.bucketPulseAria", { vars: { bucket: bucketLabel } })}
            >
              <h4 className="growth-labor-inflation-card-heading">
                {bucketLabel}
              </h4>
              <div className="gli-stat">
                <span className="gli-stat-label">{t("sections.score")}</span>
                <span className="gli-stat-value">{scoreText}</span>
              </div>
              <div className="gli-stat">
                <span className="gli-stat-label">{t("sections.weight")}</span>
                <span className="gli-stat-value">{weightText}</span>
              </div>
              <div className="gli-stat">
                <span className="gli-stat-label">{t("sections.contribution")}</span>
                <span className="gli-stat-value">{contributionText}</span>
              </div>
              <p className="growth-labor-inflation-read">{readLine}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
