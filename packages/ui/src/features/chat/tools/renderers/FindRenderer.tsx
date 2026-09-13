import { useI18nContext } from "../../../../i18n/i18n-react.js";
import { truncateEnd } from "../../../../lib/format/truncate.js";
import type { ToolRendererProps, ToolSummarizer } from "../types.js";
import { CodeBlock, extractTextContent } from "./common.js";

interface FindInput {
  pattern?: string;
  path?: string;
}

export function FindRenderer({ call }: ToolRendererProps) {
  const { LL } = useI18nContext();
  const input = (call.input ?? {}) as FindInput;
  const output = extractTextContent(call.result) || extractTextContent(call.partialResult);
  // Header already shows FIND + the pattern.
  return (
    <div className="space-y-2">
      {input.path && (
        <div className="flex flex-wrap items-center gap-2 text-[var(--color-text-muted)] text-xs">
          <span>{LL.chat.tools.find.in({ path: input.path })}</span>
        </div>
      )}
      {output && <CodeBlock text={output} ariaLabel={LL.chat.tools.find.results()} />}
    </div>
  );
}

export const findSummary: ToolSummarizer = (input) => {
  const p = (input as FindInput | null)?.pattern;
  if (!p) return {};
  return { text: truncateEnd(p), title: p };
};
