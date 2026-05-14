import type { ToolRenderer, ToolSummarizer } from "./types.js";

const renderers = new Map<string, ToolRenderer>();
const summarizers = new Map<string, ToolSummarizer>();

export function registerToolRenderer(
  name: string,
  renderer: ToolRenderer,
  summarizer?: ToolSummarizer,
): void {
  renderers.set(name, renderer);
  if (summarizer) summarizers.set(name, summarizer);
}

export function getRenderer(name: string): ToolRenderer | undefined {
  return renderers.get(name);
}

export function getSummarizer(name: string): ToolSummarizer | undefined {
  return summarizers.get(name);
}
