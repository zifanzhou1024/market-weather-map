interface HowToReadPanelProps {
  title?: string;
  description: string;
}

export default function HowToReadPanel({
  title = "How to read this",
  description
}: HowToReadPanelProps) {
  return (
    <section className="panel how-to-read">
      <h3>{title}</h3>
      <p>{description}</p>
    </section>
  );
}
