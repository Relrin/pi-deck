import * as RadixContextMenu from "@radix-ui/react-context-menu";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

const CONTENT_CLASSES =
  "z-50 min-w-[12rem] rounded-[var(--radius-md)] bg-[var(--color-panel-2)] border border-[var(--color-border)] py-1 shadow-lg";

const ITEM_CLASSES =
  "flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--color-text)] cursor-pointer outline-none data-[highlighted]:bg-[var(--color-panel-hover)] data-[disabled]:text-[var(--color-text-subtle)] data-[disabled]:cursor-not-allowed";

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  children: ReactNode;
}

export function ContextMenu({ items, children }: ContextMenuProps) {
  return (
    <RadixContextMenu.Root>
      <RadixContextMenu.Trigger asChild>{children}</RadixContextMenu.Trigger>
      <RadixContextMenu.Portal>
        <RadixContextMenu.Content className={CONTENT_CLASSES}>
          {items.map((item) => (
            <RadixContextMenu.Item
              key={item.label}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={cn(ITEM_CLASSES, item.danger && "text-[var(--color-danger)]")}
            >
              {item.label}
            </RadixContextMenu.Item>
          ))}
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  );
}
