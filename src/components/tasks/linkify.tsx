import { ReactNode } from "react";

// Matches markdown-style [label](url) links, falling back to bare http(s) URLs.
const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+[^\s<.,:;!?)'"\]])/g;

// Renders plain text with markdown links and bare URLs turned into clickable anchors.
export function renderWithLinks(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(LINK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));
    const [full, mdLabel, mdUrl, bareUrl] = match;
    const url = mdUrl ?? bareUrl;
    const label = mdLabel ?? bareUrl;
    nodes.push(
      <a
        key={key++}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-gold underline decoration-gold/40 hover:decoration-gold break-words"
      >
        {label}
      </a>
    );
    lastIndex = index + full.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
