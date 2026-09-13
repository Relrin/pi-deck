/** Strings for `features/settings/`. Phase 05 fills in the rest of the sections. */
const settings = {
  appearance: {
    language: {
      label: "Language",
      desc: "Interface language.",
      hint: "Agent replies follow this too. Override per session from the composer, or globally under Agents & Models.",
    },
  },
  agents: {
    responseLanguage: {
      label: "Agent response language",
      desc: "The language the agent writes in — its replies, its plans, and the plan file. Starter prompts are sent as written, so a template in another language stays in that language.",
      matchUi: "Match interface",
    },
  },

  skills: {
    scanFoundToast: "found {count:number} SKILL.md {{manifest|manifests}}",
    installedTitle: "Installed {count:number} {{skill|skills}}",
    scanFoundLabel: "{count:number} {{skill|skills}} found",
  },
} as const;

export default settings;
