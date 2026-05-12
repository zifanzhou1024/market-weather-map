import { mergeExternalResearchLinks, type ExternalResearchLink } from "../lib/externalResearchLinks";

interface ExternalResearchLinksProps {
  id: string;
  label: string;
  links?: readonly ExternalResearchLink[];
  className?: string;
}

export default function ExternalResearchLinks({
  id,
  label,
  links,
  className
}: ExternalResearchLinksProps) {
  const externalLinks = mergeExternalResearchLinks(id, links);
  if (!externalLinks.length) return null;

  return (
    <span
      aria-label={`${label} external research links`}
      className={["external-research-links", className].filter(Boolean).join(" ")}
    >
      {externalLinks.map((link) => (
        <a href={link.url} key={`${id}-${link.label}-${link.url}`} rel="noreferrer" target="_blank">
          {link.label}
        </a>
      ))}
    </span>
  );
}
