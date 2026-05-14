import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Permission posture for the agent loop. Mirrors the three permission modes pi exposes
 * conceptually; the renderer doesn't yet forward this to the worker (no SDK setter), so
 * for now this is presentation-only.
 */
export type ExecutionMode = "ask" | "accept-edits" | "plan";

export type ThinkingEffort = "off" | "low" | "medium" | "high";

export interface ModelOption {
  /** Stable id used in requests once wiring is added. */
  id: string;
  /** Display label in the menu. */
  label: string;
  /** Whether the model exposes a "thinking effort" knob. */
  supportsThinking: boolean;
}

export const MODEL_OPTIONS: readonly ModelOption[] = [
  { id: "claude-opus-4-7", label: "Claude Opus 4.7", supportsThinking: true },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", supportsThinking: true },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", supportsThinking: false },
  { id: "gpt-5", label: "GPT-5", supportsThinking: false },
];

interface ComposerStoreState {
  executionMode: ExecutionMode;
  model: string;
  thinkingEffort: ThinkingEffort;
  setMode: (mode: ExecutionMode) => void;
  setModel: (model: string) => void;
  setEffort: (effort: ThinkingEffort) => void;
}

/**
 * Local composer state for the prompt input bottom toolbar. Persisted to localStorage so
 * a user's mode / model / effort survives reloads.
 *
 * TODO(protocol): once pi exposes setters for permission mode / model / effort on
 * `AgentSession`, forward these to the worker on change.
 */
export const useComposerStore = create<ComposerStoreState>()(
  persist(
    (set) => ({
      executionMode: "ask",
      model: "claude-sonnet-4-6",
      thinkingEffort: "off",
      setMode: (executionMode) => set({ executionMode }),
      setModel: (model) => set({ model }),
      setEffort: (thinkingEffort) => set({ thinkingEffort }),
    }),
    { name: "pi-deck:composer" },
  ),
);

export function modelSupportsThinking(modelId: string): boolean {
  return MODEL_OPTIONS.find((m) => m.id === modelId)?.supportsThinking ?? false;
}

export function findModel(modelId: string): ModelOption | undefined {
  return MODEL_OPTIONS.find((m) => m.id === modelId);
}
