import { Folder } from "../../components/icons/index.js";
import { useI18nContext } from "../../i18n/i18n-react.js";
import type { TranslationFunctions } from "../../i18n/i18n-types.js";

interface PidFileTreeEmptyStateProps {
  /** "no-project": no project is active. "empty-project": project has no walked files yet.
   * "no-matches": filter is non-empty but produced zero hits. "error": walk failed. */
  kind: "no-project" | "empty-project" | "no-matches" | "error";
  errorMessage?: string;
}

export function PidFileTreeEmptyState({ kind, errorMessage }: PidFileTreeEmptyStateProps) {
  const { LL } = useI18nContext();
  const message = labelFor(LL, kind);
  return (
    <div className="pid-tree-empty">
      <Folder size={18} aria-hidden />
      <div className="pid-tree-empty-line">{message}</div>
      {kind === "error" && errorMessage ? (
        <div className="pid-tree-empty-detail">{errorMessage}</div>
      ) : null}
    </div>
  );
}

function labelFor(t: TranslationFunctions, kind: PidFileTreeEmptyStateProps["kind"]): string {
  switch (kind) {
    case "no-project":
      return t.files.empty.noProject();
    case "empty-project":
      return t.files.empty.emptyProject();
    case "no-matches":
      return t.files.empty.noMatches();
    case "error":
      return t.files.empty.error();
  }
}
