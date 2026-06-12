import { create } from "zustand";

export type SettingsSectionId =
  | "appearance"
  | "agent-models"
  | "tools"
  | "skills"
  | "git-github"
  | "mcp-servers"
  | "editor"
  | "terminal"
  | "keybinds"
  | "privacy"
  | "advanced";

export interface SettingsState {
  open: boolean;
  section: SettingsSectionId;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setSection: (id: SettingsSectionId) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  open: false,
  section: "appearance",
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  setSection: (section) => set({ section }),
}));
