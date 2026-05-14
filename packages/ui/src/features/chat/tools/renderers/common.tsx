import { useState } from "react";
import { cn } from "../../../../lib/cn.js";
import {
  CODE_BLOCK_COLLAPSED_LINES,
  CODE_BLOCK_MAX_HEIGHT_REM,
} from "../../../../lib/ui-constants.js";

export function Chip({
  children,
  mono = true,
  title,
}: {
  children: React.ReactNode;
  mono?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-block max-w-full truncate align-bottom rounded-[var(--radius-sm)] bg-[var(--color-panel-2)] border border-[var(--color-border)] px-1.5 py-0.5 text-[var(--color-text)]",
        mono && "font-mono",
      )}
    >
      {children}
    </span>
  );
}

export interface CodeBlockProps {
  text: string;
  collapsedLines?: number;
  className?: string;
  /** When true, lines stay on one row and the block scrolls horizontally (default). */
  preserveLines?: boolean;
  /** Optional accessible name applied to the scrollable region. */
  ariaLabel?: string;
}

export function CodeBlock({
  text,
  collapsedLines = CODE_BLOCK_COLLAPSED_LINES,
  className,
  preserveLines = true,
  ariaLabel,
}: CodeBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const lines = text.split("\n");
  const overflow = lines.length > collapsedLines;
  const display = expanded || !overflow ? text : lines.slice(0, collapsedLines).join("\n");
  const hiddenCount = lines.length - collapsedLines;
  const body = (
    <>
      <pre
        className={cn(
          "m-0 p-2 text-xs font-mono",
          preserveLines ? "whitespace-pre overflow-auto" : "whitespace-pre-wrap break-words",
        )}
        style={{ maxHeight: `${CODE_BLOCK_MAX_HEIGHT_REM}rem` }}
      >
        {display}
        {overflow && !expanded && (
          <>
            {"\n"}
            <span className="text-[var(--color-text-subtle)]">
              ⋯ {hiddenCount} more line{hiddenCount === 1 ? "" : "s"}
            </span>
          </>
        )}
      </pre>
      {overflow && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          title={`${lines.length} lines total`}
          aria-expanded={expanded}
          className="block w-full text-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors py-1 border-t border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-b-[var(--radius-sm)]"
        >
          {expanded ? "Show less" : `Show full output (${lines.length} lines)`}
        </button>
      )}
    </>
  );

  const wrapperClass = cn("bg-[var(--color-panel-2)] rounded-[var(--radius-sm)]", className);

  // When an ariaLabel is provided, render as a labelled region so screen readers can name
  // the code block. Otherwise stay a plain container to keep the a11y tree clean.
  if (ariaLabel) {
    return (
      <section className={wrapperClass} aria-label={ariaLabel}>
        {body}
      </section>
    );
  }
  return <div className={wrapperClass}>{body}</div>;
}

export function extractTextContent(result: unknown): string {
  if (typeof result === "string") return result;
  if (typeof result !== "object" || result === null) return "";
  const r = result as { content?: unknown };
  if (Array.isArray(r.content)) {
    return r.content
      .filter(
        (b): b is { type: string; text: string } =>
          typeof b === "object" &&
          b !== null &&
          (b as { type?: unknown }).type === "text" &&
          typeof (b as { text?: unknown }).text === "string",
      )
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}
