import { useI18nContext } from "../../../../i18n/i18n-react.js";
import { DEFAULT_RENDERER_SECTION_MAX_HEIGHT_REM } from "../../../../lib/ui-constants.js";
import type { ToolRendererProps } from "../types.js";

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function DefaultRenderer({ call }: ToolRendererProps) {
  const { LL } = useI18nContext();
  const partial = call.result === undefined && call.partialResult !== undefined;
  return (
    <div className="space-y-2 font-mono">
      <Section label={LL.chat.tools.section.input()}>
        <pre className="whitespace-pre-wrap break-words text-[var(--color-text)] m-0">
          {prettyJson(call.input)}
        </pre>
      </Section>
      {(call.result !== undefined || call.partialResult !== undefined) && (
        <Section
          label={partial ? LL.chat.tools.section.partialResult() : LL.chat.tools.section.result()}
        >
          <pre className="whitespace-pre-wrap break-words text-[var(--color-text)] m-0">
            {prettyJson(call.result ?? call.partialResult)}
          </pre>
        </Section>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[var(--color-text-subtle)] text-[10px] uppercase tracking-wider mb-1">
        {label}
      </div>
      <div
        className="bg-[var(--color-panel-2)] rounded-[var(--radius-sm)] p-2 overflow-auto"
        style={{ maxHeight: `${DEFAULT_RENDERER_SECTION_MAX_HEIGHT_REM}rem` }}
      >
        {children}
      </div>
    </div>
  );
}

export { Section };
