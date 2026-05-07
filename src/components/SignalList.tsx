interface SignalListProps {
  emptyText: string;
  items: string[];
  title: string;
}

export default function SignalList({ emptyText, items, title }: SignalListProps) {
  return (
    <section>
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul className="score-list">
          {items.map((item, index) => (
            <li key={`${title}-${index}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="score-note">{emptyText}</p>
      )}
    </section>
  );
}
