/**
 * Shared *vocabulary*, and nothing else: buttons reused across features, and the error text the
 * whole app funnels through `lib/format/humanize-error.ts`.
 *
 * Deliberately not a catch-all. A string belongs in the namespace named after the directory its
 * file lives in — `features/diff/` in `diff`, `features/files/` in `files`, and so on — which is
 * what keeps parallel sweep sessions from all editing this one file. The `diff` and `files` keys
 * that used to live here moved out for exactly that reason.
 */
const common = {
  cancel: "Cancel",
  close: "Close",
  save: "Save",
  remove: "Remove",
  retry: "Retry",
  dismiss: "Dismiss",

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

    /**
     * Last-resort text for the broadcast `host.error` event and for pi's own prompt errors.
     *
     * Neither can be localized by code. `HostErrorPayload` (protocol `host.error`) carries only a
     * `message`, with no `code` field — unlike a rejected *command*, which travels as a `HostError`
     * and is translated by `host-errors.ts`. Adding a code to the event payload is a protocol
     * change, so for now the host's own English message wins whenever it sent one and these are
     * only reached when it did not. `prompt_error` messages come from pi and are always English.
     */
    hostEvent: "Host error",
    promptError: "pi reported a prompt error",

    /** Transport-level failures raised by `lib/transport/ws-client.ts` before a code exists. */
    transport: {
      authFailed: "Could not authenticate with the backend.",
      disconnected: "Lost the connection to the backend.",
      timedOut: "The backend did not respond in time.",
    },
  },
} as const;

export default common;
