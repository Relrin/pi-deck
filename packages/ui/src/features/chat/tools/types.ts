import type { ComponentType } from "react";
import type { ToolCallEntry } from "../types.js";

export interface ToolRendererProps {
  call: ToolCallEntry;
}

export type ToolRenderer = ComponentType<ToolRendererProps>;

export interface ToolSummary {
  /** One-line label shown next to the tool name in the card header (e.g. file path). */
  text?: string;
  /** Full, un-truncated string for the `title` attribute / hover tooltip. */
  title?: string;
}

export type ToolSummarizer = (input: unknown) => ToolSummary;
