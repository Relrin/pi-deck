/**
 * Shared vocabulary and anything that has no better home: buttons reused across features, and the
 * error text the whole app funnels through `lib/format/humanize-error.ts`.
 */
const common = {
  cancel: "Cancel",
  close: "Close",
  save: "Save",
  remove: "Remove",
  retry: "Retry",

  error: {
    /** Last-resort text when an error carries nothing usable. Matches the old hardcoded default. */
    generic: "Something went wrong",

    /**
     * Keyed by `RouterError.code` (see `packages/core/src/host/router.ts`). The host keeps its
     * messages in English as a fallback; these are what the user actually reads. `host-errors.ts`
     * maps codes to these keys, and anything unmapped falls through to the English message.
     */
    host: {
      notFound: "That item no longer exists.",
      invalidRequest: "The app sent a request the backend could not accept.",
      unknownCommand: "The app asked for something this backend version does not support.",
      registryFailed: "Could not reach the provider registry.",
      pathEscape: "That path is outside the project folder.",
      notARepo: "This folder is not a git repository.",
      lspFailed: "The language server could not complete the request.",
      lspUnknownKey: "That language server is not configured.",
      lspMethodNotAllowed: "The language server does not allow that request.",
      illegalName: "That name is not allowed.",
      gitNotFound: "Git is not installed, or is not on your PATH.",
      gitFailed: "The git command failed.",
      fsFailed: "The file operation failed.",
      fsExists: "Something with that name already exists.",
      forbidden: "That action is not allowed.",
    },

    /** Transport-level failures raised by `lib/transport/ws-client.ts` before a code exists. */
    transport: {
      authFailed: "Could not authenticate with the backend.",
      disconnected: "Lost the connection to the backend.",
      timedOut: "The backend did not respond in time.",
    },
  },
} as const;

export default common;
