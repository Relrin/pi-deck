import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

const CONTENT_CLASSES =
  "z-50 min-w-[14rem] rounded-[var(--radius-md)] bg-[var(--color-panel-2)] border border-[var(--color-border)] py-1 shadow-lg";

const ITEM_CLASSES =
  "flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--color-text)] cursor-pointer outline-none data-[highlighted]:bg-[var(--color-panel-hover)] data-[disabled]:text-[var(--color-text-subtle)] data-[disabled]:cursor-not-allowed";

export interface DropdownItem {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export interface DropdownMenuProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "start" | "center" | "end";
}

export function DropdownMenu({ trigger, items, align = "start" }: DropdownMenuProps) {
  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>{trigger}</RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content align={align} sideOffset={4} className={CONTENT_CLASSES}>
          {items.map((item) => (
            <div key={item.key}>
              {item.separatorBefore && (
                <RadixDropdown.Separator className="my-1 h-px bg-[var(--color-border)]" />
              )}
              <RadixDropdown.Item
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(ITEM_CLASSES)}
              >
                {item.label}
              </RadixDropdown.Item>
            </div>
          ))}
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}
