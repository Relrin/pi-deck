import type { TranslationFunctions } from "./i18n-types";
import { ll } from "./t";

/**
 * Localizing errors raised by the host.
 *
 * `RouterError` (`packages/core/src/host/router.ts`) already carries a stable `code` alongside its
 * message, and the message reaches the renderer intact. Core keeps those messages in English on
 * purpose: they are a fallback and a log line, not UI copy. The renderer translates by `code`.
 *
 * Anything unmapped falls through to the host's English message, which is strictly better than a
 * generic "something went wrong" — an unrecognised code is usually a newer host talking to an older
 * renderer, and the raw message still tells the user what happened.
 */
const HOST_ERROR_MESSAGES: Record<string, (t: TranslationFunctions) => string> = {
  not_found: (t) => t.common.error.host.notFound(),
  invalid_request: (t) => t.common.error.host.invalidRequest(),
  unknown_command: (t) => t.common.error.host.unknownCommand(),
  registry_failed: (t) => t.common.error.host.registryFailed(),
  path_escape: (t) => t.common.error.host.pathEscape(),
  not_a_repo: (t) => t.common.error.host.notARepo(),
  lsp_failed: (t) => t.common.error.host.lspFailed(),
  lsp_unknown_key: (t) => t.common.error.host.lspUnknownKey(),
  lsp_method_not_allowed: (t) => t.common.error.host.lspMethodNotAllowed(),
  illegal_name: (t) => t.common.error.host.illegalName(),
  git_not_found: (t) => t.common.error.host.gitNotFound(),
  git_failed: (t) => t.common.error.host.gitFailed(),
  fs_failed: (t) => t.common.error.host.fsFailed(),
  fs_exists: (t) => t.common.error.host.fsExists(),
  forbidden: (t) => t.common.error.host.forbidden(),
};

/**
 * Translate a host error code, or return `undefined` when we have no mapping and the caller should
 * keep whatever English message the host sent.
 */
export function localizeHostErrorCode(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const resolve = HOST_ERROR_MESSAGES[code];
  return resolve ? resolve(ll()) : undefined;
}

/** Codes we know how to translate. Exported for the test that keeps this in sync with the host. */
export const MAPPED_HOST_ERROR_CODES = Object.keys(HOST_ERROR_MESSAGES);
