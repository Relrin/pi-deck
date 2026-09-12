/** Strings for `features/plan-panel/` and the plan card. */
const plan = {
  /**
   * Sent as a real user turn when the user clicks "Approve & execute". The host has an identical
   * English string as its fallback, so an older renderer that sends nothing still works — this is
   * simply the localized version the renderer passes explicitly.
   *
   * The checkbox markers are quoted literally and must stay that way in every translation:
   * `parsePlan.ts` keys off them.
   */
  continuation:
    "The plan above is approved - proceed with execution. As you work, edit the plan file to update each step's checkbox (`[ ]`→`[~]`→`[x]`) to show the progress.",

  /**
   * "Request changes" composes one plan-mode reply out of the user's inline comments. The user is
   * the one speaking here, so it follows the *interface* language, not the agent's.
   */
  comments: {
    leadIn: "I have some feedback on the plan before approving:",
    closing: "Please revise the plan accordingly and keep it in plan mode.",
  },

  panel: {
    /** Shown when a step is running but the model gave it no label. */
    inProgressFallback: "in progress",
  },
} as const;

export default plan;
