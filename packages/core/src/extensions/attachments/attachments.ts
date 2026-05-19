import type {
  BeforeAgentStartEventResult,
  ExtensionAPI,
  ExtensionFactory,
} from "@earendil-works/pi-coding-agent";
import type { PromptAttachment } from "../../protocol/commands.js";
import { type AttachmentsRenderOptions, renderAttachmentsBlock } from "./render.js";

export interface AttachmentsExtensionOptions extends Omit<AttachmentsRenderOptions, "projectPath"> {
  /** Project root used to resolve relative attachment paths. */
  projectPath: string;
  /** Initial pending list, mostly for tests. Production code sets this via the controller. */
  initialPending?: PromptAttachment[];
}

export interface AttachmentsController {
  /** Pass this to `DefaultResourceLoader({ extensionFactories: [...] })`. */
  readonly factory: ExtensionFactory;
  /**
   * Stage attachments for the next user turn. The plugin consumes the list inside the
   * `before_agent_start` hook and clears it immediately so a second turn without new
   * attachments stays clean.
   */
  setPending(attachments: PromptAttachment[]): void;
  /** Snapshot of the queue — primarily for diagnostics and tests. */
  getPending(): readonly PromptAttachment[];
  /** Update the project root after construction (e.g. when chdir-ing). */
  setProjectPath(path: string): void;
}

/**
 * Built-in pi-deck plugin that materializes user-staged attachments into a custom message
 * prepended to the agent's turn.
 *
 * The plugin is intentionally self-contained:
 * - All ambient state lives on the returned controller, not on module globals.
 * - It does not know about agent mode, approvals, or the websocket — just attachments in,
 *   one custom message out.
 * - An end user can `import { createAttachmentsExtension } from "@pi-deck/core"` and load
 *   it through pi-ai's normal extension API.
 */
export function createAttachmentsExtension(
  options: AttachmentsExtensionOptions,
): AttachmentsController {
  let projectPath = options.projectPath;
  let pending: PromptAttachment[] = options.initialPending ? [...options.initialPending] : [];

  const factory: ExtensionFactory = (pi: ExtensionAPI) => {
    pi.on("before_agent_start", async (): Promise<BeforeAgentStartEventResult | undefined> => {
      if (pending.length === 0) return undefined;
      // Snapshot then clear so a failure later in this turn doesn't double-attach next time.
      const snapshot = pending;
      pending = [];
      const content = await renderAttachmentsBlock(snapshot, {
        projectPath,
        listProjectFiles: options.listProjectFiles,
        maxFileBytes: options.maxFileBytes,
        maxFileLines: options.maxFileLines,
        maxInlineFiles: options.maxInlineFiles,
        maxTurnBytes: options.maxTurnBytes,
        maxFolderEntries: options.maxFolderEntries,
      });
      if (!content) return undefined;
      return {
        message: {
          customType: "pideck.attachments",
          content,
          // false: the agent sees this content but pi-ai shouldn't render the raw XML in the
          // chat — the renderer renders attachment chips on the user message instead.
          display: false,
          details: { attachments: snapshot },
        },
      };
    });
  };

  return {
    factory,
    setPending(attachments) {
      pending = [...attachments];
    },
    getPending() {
      return pending;
    },
    setProjectPath(path) {
      projectPath = path;
    },
  };
}
