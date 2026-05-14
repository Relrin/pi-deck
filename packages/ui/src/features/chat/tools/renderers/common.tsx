import { useState } from "react";
import { cn } from "../../../../lib/cn.js";

export function Chip({ children, mono = true }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <span
      className={cn(
        "inline-block rounded-[var(--radius-sm)] bg-[var(--color-panel-2)] border border-[var(--color-border)] px-1.5 py-0.5 text-[var(--color-text)]",
        mono && "font-mono",
      )}
    >
      {children}
    </span>
  );
}

export function CodeBlock({
  text,
  collapsedLines = 40,
  className,
}: {
  text: string;
  collapsedLines?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const lines = text.split("\n");
  const overflow = lines.length > collapsedLines;
  const display = expanded || !overflow ? text : lines.slice(0, collapsedLines).join("\n");
  return (
    <div className={cn("bg-[var(--color-panel-2)] rounded-[var(--radius-sm)]", className)}>
      <pre className="m-0 p-2 text-xs font-mono whitespace-pre-wrap break-words overflow-auto max-h-[28rem]">
        {display}
        {overflow && !expanded && "\n…"}
      </pre>
      {overflow && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="block w-full text-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-1 border-t border-[var(--color-border)]"
        >
          {expanded ? "Show less" : `Show full output (${lines.length} lines)`}
        </button>
      )}
    </div>
  );
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
