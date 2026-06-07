import { cn } from "../../lib/cn.js";
import { badgeForFile } from "./languages.js";
import { useEditorStore } from "./useEditorStore.js";

/** The editor's open-file tab strip. Mirrors the mockup `.pid-editor-tabs`. */
export function PidEditorTabBar() {
  const order = useEditorStore((s) => s.order);
  return (
    <div className="pid-editor-tabs" role="tablist" aria-label="Open files">
      {order.map((id) => (
        <PidEditorTab key={id} id={id} />
      ))}
    </div>
  );
}

/** A single tab row. Subscribes only to its own name + dirty + active so cursor churn on the
 * active tab doesn't re-render the whole strip. */
function PidEditorTab({ id }: { id: string }) {
  const fileName = useEditorStore((s) => s.tabs[id]?.fileName ?? "");
  const dirty = useEditorStore((s) => s.tabs[id]?.dirty ?? false);
  const active = useEditorStore((s) => s.activeTabId === id);
  const setActive = useEditorStore((s) => s.setActive);
  const closeTab = useEditorStore((s) => s.closeTab);
  const badge = badgeForFile(fileName);

  return (
    <div
      className={cn("pid-editor-tab", active && "active")}
      role="tab"
      aria-selected={active}
      tabIndex={0}
      onClick={() => setActive(id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setActive(id);
        }
      }}
    >
      <span className="pid-ft-icon" style={{ color: badge.color, borderColor: badge.color }}>
        {badge.text}
      </span>
      <span className="name">{fileName}</span>
      {dirty ? <span className="dot" role="img" aria-label="Unsaved changes" /> : null}
      <button
        type="button"
        className="close"
        aria-label={`Close ${fileName}`}
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          closeTab(id);
        }}
      >
        ✕
      </button>
    </div>
  );
}
