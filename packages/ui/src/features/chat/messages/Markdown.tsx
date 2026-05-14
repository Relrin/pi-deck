import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../../lib/cn.js";
import { highlight } from "./code-highlight.js";

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
            const content = String(children).replace(/\n$/, "");
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
            return (
              <CodeBlock code={content} lang={langMatch?.[1] ?? "text"} highlight={isComplete} />
            );
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
          ul({ children }) {
            return <ul className="list-disc pl-5 my-1.5 space-y-0.5">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 my-1.5 space-y-0.5">{children}</ol>;
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
      className={cn(
        frameClass,
        "bg-[var(--color-panel-2)]",
        shouldHighlight && "motion-safe:opacity-90",
      )}
      aria-busy={shouldHighlight && !html ? true : undefined}
    >
      <pre className="m-0 p-3 text-xs font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}
