/**
 * Parse a plan-mode markdown file into structured steps.
 *
 * The agent writes (and live-updates) a single markdown plan at
 * `.pi-deck/plans/<sessionId>.md`. Its `Plan` section is a GitHub-flavoured-markdown
 * checklist; during execution the agent flips each item's marker `- [ ]` → `- [~]` →
 * `- [x]`. We turn those lines into `PlanStep`s so the UI can render glanceable progress
 * (status dots, operation labels, per-step timing) without the agent emitting any
 * structured protocol — the plan file stays the single source of truth.
 *
 * Pure + dependency-free so it's trivially unit-testable and safe to call on every
 * `plan.file.changed` event.
 */

export type PlanStepStatus = "pending" | "in-progress" | "done";

export interface PlanStep {
  /**
   * Stable identity derived from the normalised description (with an occurrence suffix to
   * disambiguate duplicate lines). Stays constant across the agent's in-place rewrites of
   * the file as long as the wording doesn't change, so the store can match a step to its
   * previous status and detect transitions.
   */
  id: string;
  /** Short operation tag from a leading `**LABEL** —` prefix (e.g. `WRITE`), if present. */
  label?: string;
  /** Step text with the label prefix removed and inline markdown emphasis stripped. */
  description: string;
  status: PlanStepStatus;
  /** 0-based position among the parsed steps. */
  index: number;
}

// GFM task-list line: optional indent, `-`/`*` bullet, `[ |x|X|~]`, then the item text.
const CHECKBOX_RE = /^\s*[-*]\s+\[([ xX~])\]\s+(.+?)\s*$/;

// Leading `**LABEL** —` (or `:`/`-`) prefix that carries the operation tag for a step.
const LABEL_RE = /^\*\*\s*([^*\n]+?)\s*\*\*\s*[—–:-]\s*(.+)$/;

function markerToStatus(marker: string): PlanStepStatus {
  if (marker === "x" || marker === "X") return "done";
  if (marker === "~") return "in-progress";
  return "pending";
}

/** Strip the inline emphasis markers GFM uses so labels/descriptions read as plain text. */
function stripEmphasis(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

// djb2 — small, fast, stable across runs. Good enough to key a handful of plan steps.
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// Leading ATX heading (`# Title` / `## Title`) the agent puts at the top of the plan.
const TITLE_RE = /^#{1,2}\s+(.+?)\s*$/;

/**
 * Extract the plan's title — the first ATX heading line. The agent is asked to open the plan
 * with `# <imperative title>`; returns `undefined` when there's no heading (e.g. a plan that
 * jumps straight into a bold `**Context**` line).
 */
export function parsePlanTitle(md: string | null | undefined): string | undefined {
  if (!md) return undefined;
  for (const line of md.split("\n")) {
    const m = TITLE_RE.exec(line);
    if (m) return stripEmphasis(m[1] ?? "") || undefined;
  }
  return undefined;
}

/**
 * Parse all GFM task-list items in `md` into ordered `PlanStep`s. Non-checkbox bullets
 * (e.g. the `Files to touch` paths) are ignored, so we don't need to scope to the `Plan`
 * heading. Returns `[]` for empty / non-plan content.
 */
export function parsePlanSteps(md: string | null | undefined): PlanStep[] {
  if (!md) return [];
  const steps: PlanStep[] = [];
  const seen = new Map<string, number>();
  const lines = md.split("\n");
  for (const line of lines) {
    const m = CHECKBOX_RE.exec(line);
    if (!m) continue;
    const status = markerToStatus(m[1] ?? " ");
    const raw = (m[2] ?? "").trim();

    let label: string | undefined;
    let body = raw;
    const labelMatch = LABEL_RE.exec(raw);
    if (labelMatch) {
      label = stripEmphasis(labelMatch[1] ?? "");
      body = labelMatch[2] ?? "";
    }
    const description = stripEmphasis(body);
    if (!description) continue;

    const key = normalize(description);
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    const id = occurrence === 0 ? hashString(key) : `${hashString(key)}-${occurrence}`;

    steps.push({
      id,
      ...(label ? { label } : {}),
      description,
      status,
      index: steps.length,
    });
  }
  return steps;
}
