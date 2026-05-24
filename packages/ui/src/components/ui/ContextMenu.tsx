import * as RadixContextMenu from "@radix-ui/react-context-menu";
import type { ReactNode } from "react";
import { Glyph, type GlyphKind } from "../glyph/index.js";

export interface ContextMenuActionItem {
  kind?: "action";
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Glyph kind rendered in the left icon column. */
  icon?: GlyphKind;
  /** Right-aligned shortcut hint shown next to the label. Display only. */
  shortcut?: string;
}

/** Horizontal divider between groups of related actions. */
export interface ContextMenuSeparatorItem {
  kind: "separator";
}

export type ContextMenuItem = ContextMenuActionItem | ContextMenuSeparatorItem;

export interface ContextMenuProps {
  items: ContextMenuItem[];
  children: ReactNode;
}

export function ContextMenu({ items, children }: ContextMenuProps) {
  return (
    <RadixContextMenu.Root>
      <RadixContextMenu.Trigger asChild>{children}</RadixContextMenu.Trigger>
      <RadixContextMenu.Portal>
        <RadixContextMenu.Content className="pid-context-menu">
          {items.map((item, idx) => {
            if (item.kind === "separator") {
              // Derive a stable key from adjacent action labels so React doesn't recreate
              // the divider on every render (and the linter doesn't flag a bare index key).
              const before = items[idx - 1];
              const after = items[idx + 1];
              const beforeLabel = before && before.kind !== "separator" ? before.label : "_top";
              const afterLabel = after && after.kind !== "separator" ? after.label : "_bottom";
              return (
                <RadixContextMenu.Separator
                  key={`sep:${beforeLabel}>${afterLabel}`}
                  className="pid-context-menu-separator"
                />
              );
            }
            return (
              <RadixContextMenu.Item
                key={item.label}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className="pid-context-menu-item"
                data-danger={item.danger || undefined}
              >
                <span className="pid-context-menu-icon" aria-hidden>
                  {item.icon ? <Glyph kind={item.icon} size={12} /> : null}
                </span>
                <span className="pid-context-menu-label">{item.label}</span>
                {item.shortcut ? (
                  <span className="pid-context-menu-shortcut">{item.shortcut}</span>
                ) : null}
              </RadixContextMenu.Item>
            );
          })}
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  );
}
