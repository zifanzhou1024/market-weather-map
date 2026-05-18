import type { ReactNode } from "react";

interface Props {
  label: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function ContextBlock({
  label,
  defaultOpen = false,
  children
}: Props) {
  return (
    <details className="context-block" open={defaultOpen}>
      <summary className="context-block__summary">{label}</summary>
      <div className="context-block__body">{children}</div>
    </details>
  );
}
