import { useI18nContext } from "../../../../i18n/i18n-react.js";
import { truncateMiddle } from "../../../../lib/format/truncate.js";
import { DiffView } from "../../../diff/DiffView.js";
import { deriveToolFileDiff } from "../toolFileDiff.js";
import type { ToolRendererProps, ToolSummarizer } from "../types.js";
import { CodeBlock } from "./common.js";

interface WriteInput {
  path?: string;
  content?: string;
}

export function WriteRenderer({ call }: ToolRendererProps) {
  const { LL } = useI18nContext();
  const fileDiff = deriveToolFileDiff(call);
  if (fileDiff) return <DiffView fileDiff={fileDiff.fileDiff} />;

  const input = (call.input ?? {}) as WriteInput;
  // The header already shows "WRITE · <path>" so we don't repeat the path/operation here.
  return (
    <div className="space-y-2">
      {input.content && (
        <CodeBlock text={input.content} ariaLabel={LL.chat.tools.write.contents()} />
      )}
    </div>
  );
}

export const writeSummary: ToolSummarizer = (input) => {
  const path = (input as WriteInput | null)?.path;
  if (!path) return {};
  return { text: truncateMiddle(path), title: path };
};
