import type { SessionCommandInfo } from "@pi-deck/core/protocol/commands.js";
import { useEffect, useRef } from "react";

interface Props {
  items: readonly SessionCommandInfo[];
  activeIndex: number;
  onPick: (item: SessionCommandInfo) => void;
  onHover: (index: number) => void;
}

const SOURCE_LABEL: Record<SessionCommandInfo["source"], string> = {
  skill: "skill",
  prompt: "template",
  extension: "extension",
};

/**
 * The `/` autocomplete dropdown, anchored above the composer textarea. Pure render — the
 * textarea keeps focus and owns the keyboard (arrows / Enter / Tab / Esc in MessageInput);
 * the mouse path goes through `onPick`.
 */
export function SlashCommandMenu({ items, activeIndex, onPick, onHover }: Props) {
  const listRef = useRef<HTMLDivElement | null>(null);

  // Keep the active row in view while arrowing through a long list.
  useEffect(() => {
    const list = listRef.current;
    const row = list?.children[activeIndex] as HTMLElement | undefined;
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (items.length === 0) return null;

  return (
    <div className="pid-slash-menu" role="listbox" aria-label="Slash commands" ref={listRef}>
      {items.map((item, index) => (
        <button
          key={`${item.source}:${item.name}`}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          className="pid-slash-menu-item"
          data-active={index === activeIndex || undefined}
          title={item.sourcePath}
          // The textarea must keep focus; mousedown would steal it before click lands.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(item)}
          onMouseEnter={() => onHover(index)}
        >
          <span className="pid-slash-menu-name">/{item.name}</span>
          {item.description ? (
            <span className="pid-slash-menu-desc">{item.description}</span>
          ) : null}
          <span className="pid-slash-menu-source" data-source={item.source}>
            {SOURCE_LABEL[item.source]}
          </span>
        </button>
      ))}
    </div>
  );
}
