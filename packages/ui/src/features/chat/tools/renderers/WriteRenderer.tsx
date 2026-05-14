import type { ToolRendererProps, ToolSummarizer } from "../types.js";
import { Chip, CodeBlock } from "./common.js";

interface WriteInput {
  path?: string;
  content?: string;
}

export function WriteRenderer({ call }: ToolRendererProps) {
  const input = (call.input ?? {}) as WriteInput;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[var(--color-text-muted)]">
        <Chip>{input.path ?? "(no path)"}</Chip>
        <span>write</span>
      </div>
      {input.content && <CodeBlock text={input.content} />}
    </div>
  );
}

export const writeSummary: ToolSummarizer = (input) => {
  const path = (input as WriteInput | null)?.path;
  return { text: path };
};
