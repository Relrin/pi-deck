import { isValidElement, type ReactNode, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../../lib/cn.js";
import { CheckboxItem, TaskListItem } from "../markdown/CheckboxItem.js";
import { highlight } from "./code-highlight.js";

/**
 * Recursively concatenate the text content of a React children tree. Used in the fenced
 * code block renderer below so empty / streaming-broken code blocks don't get rendered as
 * the literal string `"undefined"` via `String(children)` — `String(undefined)` is
 * `"undefined"`, which leaks into the UI when the agent emits an opening fence followed
 * by a tool call that splits the assistant text segment.
 */
function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    return extractText((node.props as { children?: ReactNode }).children);
  }
  return "";
}

interface MarkdownProps {
  text: string;
  /** When true, fenced code blocks are syntax-highlighted via Shiki. */
  isComplete: boolean;
}

export function Markdown({ text, isComplete }: MarkdownProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...rest }) {
            const langMatch = /language-(\w+)/.exec(className ?? "");
            const inline = !langMatch;
            if (inline) {
              return (
                <code
                  className="rounded bg-[var(--color-panel-2)] px-1 py-0.5 font-mono text-[0.85em]"
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            // Fenced code blocks: walk children for the actual text rather than coercing
            // with `String(children)`. When the agent streams an opening fence followed by
            // a tool call, the assistant text segment gets `\`\`\`bash\n\n\`\`\`` (the tool
            // body lives in a sibling toolCallEntry, not the text). react-markdown then
            // calls this component with `children: undefined`, which `String()` would turn
            // into the literal word "undefined". Suppress empty blocks entirely — the tool
            // call card below already carries the same information.
            const content = extractText(children).replace(/\n$/, "");
            if (!content) return null;
            return (
              <CodeBlock code={content} lang={langMatch?.[1] ?? "text"} highlight={isComplete} />
            );
          },
          pre({ children }) {
            // react-markdown wraps every fenced code block in `<pre>` before handing the
            // inner `<code>` to our component. When our `code` renderer returns `null` for
            // an empty block, the `<pre>` shell would still render as a stray frame —
            // suppress it here too so empty blocks leave no visual trace.
            if (!extractText(children).trim()) return null;
            return <pre>{children}</pre>;
          },
          a({ children, href }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-accent-hover)]"
              >
                {children}
              </a>
            );
          },
          p({ children }) {
            return <p className="my-1.5 leading-relaxed">{children}</p>;
          },
          ul({ children, className }) {
            // GFM task lists arrive with className "contains-task-list" — strip the disc so
            // the row layout reads as a checklist rather than a bulleted list.
            const isTaskList = (className ?? "").includes("contains-task-list");
            return (
              <ul
                className={cn(
                  "pl-5 my-1.5 space-y-0.5",
                  isTaskList ? "list-none pl-0 space-y-1" : "list-disc",
                )}
              >
                {children}
              </ul>
            );
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 my-1.5 space-y-0.5">{children}</ol>;
          },
          li({ children, className }) {
            // remark-gfm tags task list items with `className="task-list-item"`. Reroute
            // those to our wrapper so we get the strikethrough treatment when checked.
            if ((className ?? "").includes("task-list-item")) {
              return <TaskListItem className={className}>{children}</TaskListItem>;
            }
            return <li className={className}>{children}</li>;
          },
          input({ type, checked, disabled, ...rest }) {
            // Non-checkbox inputs are not expected in assistant text, but we let them
            // through unchanged just in case (e.g. if a user pastes raw HTML).
            if (type === "checkbox") {
              return <CheckboxItem checked={checked} />;
            }
            return <input type={type} checked={checked} disabled={disabled} {...rest} />;
          },
          h1: ({ children }) => <h1 className="text-lg font-semibold mt-3 mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold mt-3 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
          table({ children }) {
            return <table className="my-2 border-collapse text-xs">{children}</table>;
          },
          th({ children }) {
            return (
              <th className="border border-[var(--color-border)] px-2 py-1 text-left bg-[var(--color-panel-2)]">
                {children}
              </th>
            );
          },
          td({ children }) {
            return <td className="border border-[var(--color-border)] px-2 py-1">{children}</td>;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({
  code,
  lang,
  highlight: shouldHighlight,
}: {
  code: string;
  lang: string;
  highlight: boolean;
}) {
  const [html, setHtml] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!shouldHighlight) {
      setHtml(undefined);
      return;
    }
    let cancelled = false;
    highlight({ code, lang })
      .then((output) => {
        if (!cancelled) setHtml(output);
      })
      .catch(() => {
        if (!cancelled) setHtml(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [code, lang, shouldHighlight]);

  // The two paths share dimensions so the swap is a crossfade, not a relayout.
  const frameClass = cn(
    "my-2 overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] transition-opacity duration-200",
    "[&>pre]:m-0 [&>pre]:p-3 [&>pre]:text-xs [&>pre]:font-mono",
  );

  if (html) {
    return (
      <div
        className={frameClass}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki output is sanitised HTML
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div
      className={cn(frameClass, "bg-[var(--code-bg)]", shouldHighlight && "motion-safe:opacity-90")}
      aria-busy={shouldHighlight && !html ? true : undefined}
    >
      <pre className="m-0 p-3 text-xs font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}
