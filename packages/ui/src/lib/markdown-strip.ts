/**
 * Strip the common markdown syntax markers from a string so it pastes cleanly into
 * non-markdown contexts (terminals, plain-text inputs). Not a full parser — covers the
 * subset we routinely produce: fenced code, inline code, bold/italic, headings, list
 * bullets, and links.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```[a-z]*\n?|```/gi, ""))
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}
