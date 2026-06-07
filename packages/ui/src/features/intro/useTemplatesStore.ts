import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IntroTemplate } from "./templates";

/**
 * User-supplied replacement for one of the built-in intro templates. Keyed by the default
 * template's stable `id` in the store. We always store all three editable fields together
 * (the modal edits them as a unit), keeping the default's `id` + `num` untouched.
 */
export interface TemplateOverride {
  title: string;
  blurb: string;
  body: string;
}

interface TemplatesState {
  /** Per-id overrides. Absence of a key means "use the built-in default". */
  overrides: Record<string, TemplateOverride>;
  setOverride: (id: string, value: TemplateOverride) => void;
  /** Drop an override so the slot falls back to its built-in default. */
  resetOverride: (id: string) => void;
}

/**
 * Renderer-only customizations for the intro-screen template cards. These are pure UI presets
 * (no host involvement), so they persist to localStorage like the other renderer prefs
 * (`useIntroComposerStore`, `usePreferencesStore`).
 */
export const useTemplatesStore = create<TemplatesState>()(
  persist(
    (set) => ({
      overrides: {},
      setOverride: (id, value) => set((s) => ({ overrides: { ...s.overrides, [id]: value } })),
      resetOverride: (id) =>
        set((s) => {
          if (!(id in s.overrides)) return s;
          const next = { ...s.overrides };
          delete next[id];
          return { overrides: next };
        }),
    }),
    {
      name: "pi-deck:templates:v1",
      partialize: (state) => ({ overrides: state.overrides }),
    },
  ),
);

/**
 * Merge a built-in template with its override (if any). Returns the base untouched when there
 * is no override, otherwise swaps in the custom title/blurb/body while preserving `id`/`num`.
 * Pure — shared by the intro screen and tests.
 */
export function resolveTemplate(
  base: IntroTemplate,
  override: TemplateOverride | undefined,
): IntroTemplate {
  if (!override) return base;
  return { ...base, title: override.title, blurb: override.blurb, body: override.body };
}
