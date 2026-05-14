import { registerToolRenderer } from "../ToolRendererRegistry.js";
import { BashRenderer, bashSummary } from "./BashRenderer.js";
import { EditRenderer, editSummary } from "./EditRenderer.js";
import { FindRenderer, findSummary } from "./FindRenderer.js";
import { GrepRenderer, grepSummary } from "./GrepRenderer.js";
import { LsRenderer, lsSummary } from "./LsRenderer.js";
import { ReadRenderer, readSummary } from "./ReadRenderer.js";
import { WriteRenderer, writeSummary } from "./WriteRenderer.js";

let registered = false;

export function registerBuiltInRenderers(): void {
  if (registered) return;
  registered = true;
  registerToolRenderer("read", ReadRenderer, readSummary);
  registerToolRenderer("write", WriteRenderer, writeSummary);
  registerToolRenderer("edit", EditRenderer, editSummary);
  registerToolRenderer("bash", BashRenderer, bashSummary);
  registerToolRenderer("grep", GrepRenderer, grepSummary);
  registerToolRenderer("find", FindRenderer, findSummary);
  registerToolRenderer("ls", LsRenderer, lsSummary);
}
