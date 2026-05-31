import { Children, type CSSProperties, isValidElement, type ReactNode } from "react";
import { Square, SquareCheck, SquareMinus } from "../../../components/icons/index.js";
import { cn } from "../../../lib/cn.js";

/**
 * Inline replacement for `react-markdown`'s default `<input type="checkbox" disabled />` that
 * GitHub-flavoured-markdown produces for task list items (`- [ ]` / `- [x]`).
 */
export interface CheckboxItemProps {
  /**
   * `true` for `- [x]`, `false` for `- [ ]`. react-markdown forwards the parsed value via
   * the `checked` prop on the `<input>` it would otherwise render — we read it and pick
   * the icon from there.
   */
  checked?: boolean | "indeterminate";
}

export function CheckboxItem({ checked }: CheckboxItemProps) {
  const state: "checked" | "indeterminate" | "unchecked" =
    checked === true ? "checked" : checked === "indeterminate" ? "indeterminate" : "unchecked";

  // The icon swap is the satisfying animation — Lucide draws the strokes; we apply a CSS
  // transition on opacity + transform so the "tick" looks like the agent stamping the item
  // done rather than instant-replacing it.
  const className = cn(
    "pid-plan-checkbox",
    state === "checked" && "pid-plan-checkbox-checked",
    state === "indeterminate" && "pid-plan-checkbox-indeterminate",
  );

  const Icon = state === "checked" ? SquareCheck : state === "indeterminate" ? SquareMinus : Square;

  return (
    <span className={className} role="img" aria-label={iconLabel(state)}>
      <Icon size={14} aria-hidden />
    </span>
  );
}

/**
 * Wrap a `<li class="task-list-item">` so the label gets a line-through + dimmed appearance
 * when the checkbox is checked. react-markdown gives us the rendered children — including the
 * (already-swapped) `<CheckboxItem>` — and we just need to detect the checked-ness to apply
 * the visual treatment.
 *
 * We detect by walking the children for any `props.checked === true`. That's robust to
 * remark-gfm version drift because we don't rely on its specific DOM shape beyond the fact
 * that it forwards the parsed `checked` value on the input element.
 */
export interface TaskListItemProps {
  children?: ReactNode;
  className?: string;
}

export function TaskListItem({ children, className }: TaskListItemProps) {
  const isChecked = detectChecked(children);
  const style: CSSProperties = {
    // Subtle 300ms ease so the strikethrough draws in when the agent flips a `- [ ]` to
    // `- [x]` mid-execution rather than appearing instantly.
    transition: "opacity 300ms ease, color 300ms ease",
  };

  const childArray = Children.toArray(children);
  const checkboxIdx = childArray.findIndex(isValidElement);
  const leading = checkboxIdx >= 0 ? childArray.slice(0, checkboxIdx + 1) : [];
  const label = checkboxIdx >= 0 ? childArray.slice(checkboxIdx + 1) : childArray;
  return (
    <li
      className={cn(className, "pid-plan-task-item", isChecked && "pid-plan-task-item-checked")}
      style={style}
      data-checked={isChecked || undefined}
    >
      {leading}
      <span className="pid-plan-task-item-label">{label}</span>
    </li>
  );
}

function iconLabel(state: "checked" | "indeterminate" | "unchecked"): string {
  if (state === "checked") return "Completed";
  if (state === "indeterminate") return "In progress";
  return "Not started";
}

interface PossibleNode {
  props?: { checked?: unknown; children?: unknown };
}

function detectChecked(node: unknown): boolean {
  if (!node) return false;
  if (Array.isArray(node)) {
    for (const child of node) {
      if (detectChecked(child)) return true;
    }
    return false;
  }
  if (typeof node !== "object") return false;
  const n = node as PossibleNode;
  if (n.props?.checked === true) return true;
  if (n.props && n.props.children !== undefined) return detectChecked(n.props.children);
  return false;
}
