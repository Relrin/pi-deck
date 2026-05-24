import { create } from "zustand";
import { persist } from "zustand/middleware";

export type GroupMode = "file" | "hunk" | "change" | "folder";

const VALID_MODES: ReadonlySet<GroupMode> = new Set(["file", "hunk", "change", "folder"]);

export interface GroupModeState {
  mode: GroupMode;
  setMode: (mode: GroupMode) => void;
}

export const useGroupModeStore = create<GroupModeState>()(
  persist(
    (set) => ({
      mode: "file",
      setMode: (mode) => {
        if (!VALID_MODES.has(mode)) return;
        set({ mode });
      },
    }),
    { name: "pi-deck:git.groupMode" },
  ),
);
