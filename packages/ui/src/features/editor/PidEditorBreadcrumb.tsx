import { Fragment } from "react";
import { selectActiveTab, useEditorStore } from "./useEditorStore.js";

/** Styled breadcrumb of the active file's project-relative path (`src › components › file.tsx`). */
export function PidEditorBreadcrumb() {
  const relPath = useEditorStore((s) => selectActiveTab(s)?.relPath);
  if (!relPath) return null;
  const segments = relPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  const file = segments[segments.length - 1];
  const dirs = segments.slice(0, -1);

  return (
    <div className="pid-editor-crumbs">
      {dirs.map((seg, i) => (
        // Path segments aren't unique on their own; index-keying a static breadcrumb is fine.
        // biome-ignore lint/suspicious/noArrayIndexKey: breadcrumb segments are positional + static.
        <Fragment key={i}>
          <span className="crumb">{seg}</span>
          <span className="sep">›</span>
        </Fragment>
      ))}
      <span className="crumb file">{file}</span>
    </div>
  );
}
