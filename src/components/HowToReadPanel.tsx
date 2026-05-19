import { useT } from "../lib/i18n";

interface HowToReadPanelProps {
  title?: string;
  description: string;
}

export default function HowToReadPanel({
  title,
  description
}: HowToReadPanelProps) {
  const { t } = useT();
  const resolvedTitle = title ?? t("panels.howToReadTitle");
  return (
    <section className="panel how-to-read">
      <h3>{resolvedTitle}</h3>
      <p>{description}</p>
    </section>
  );
}
