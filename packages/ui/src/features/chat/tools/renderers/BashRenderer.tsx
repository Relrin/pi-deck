import type { ToolRendererProps, ToolSummarizer } from "../types.js";
import { CodeBlock, extractTextContent } from "./common.js";

interface BashInput {
  command?: string;
  timeout?: number;
}

export function BashRenderer({ call }: ToolRendererProps) {
  const input = (call.input ?? {}) as BashInput;
  const output = extractTextContent(call.result);
  return (
    <div className="space-y-2">
      <div className="bg-[var(--color-panel-2)] rounded-[var(--radius-sm)] p-2 font-mono text-xs text-[var(--color-text)]">
        <span className="text-[var(--color-accent)]">$</span> {input.command ?? ""}
      </div>
      {output && <CodeBlock text={output} />}
    </div>
  );
}

export const bashSummary: ToolSummarizer = (input) => {
  const cmd = (input as BashInput | null)?.command;
  if (!cmd) return {};
  return { text: cmd.length > 60 ? `${cmd.slice(0, 60)}…` : cmd };
};
