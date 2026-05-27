import { Folder } from "../../components/icons/index.js";

interface PidFileTreeEmptyStateProps {
  /** "no-project": no project is active. "empty-project": project has no walked files yet.
   * "no-matches": filter is non-empty but produced zero hits. "error": walk failed. */
  kind: "no-project" | "empty-project" | "no-matches" | "error";
  errorMessage?: string;
}

export function PidFileTreeEmptyState({ kind, errorMessage }: PidFileTreeEmptyStateProps) {
  const message = labelFor(kind);
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

function labelFor(kind: PidFileTreeEmptyStateProps["kind"]): string {
  switch (kind) {
    case "no-project":
      return "Open a project to browse its files.";
    case "empty-project":
      return "This project has no files yet.";
    case "no-matches":
      return "No matches.";
    case "error":
      return "Couldn’t load files.";
  }
}
