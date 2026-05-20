import type {
  ExtensionAPI,
  ExtensionFactory,
  InputEventResult,
} from "@earendil-works/pi-coding-agent";
import type { PromptAttachment } from "../../protocol/commands.js";
import { type AttachmentsRenderOptions, renderAttachmentsBlock } from "./render.js";

/** customType used for the session-history entry that records what was attached this turn. */
export const ATTACHMENTS_ENTRY_TYPE = "pideck.attachments";

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
 * Built-in pi-deck plugin that materializes user-staged attachments by prepending them
 * to the user's prompt text via pi's `input` event.
 *
 * Why `input` and not `before_agent_start`: a custom message returned from
 * `before_agent_start` is delivered to the LLM as a SECOND consecutive user-role message
 * after the user's typed prompt, and most chat-tuned models ignore or misinterpret the
 * trailing message (Kimi K2.5 reliably reports "no files attached"). `input.transform`
 * lets us fold the attachment block into the same user turn, so the LLM sees one message
 * containing both the question and the attached content.
 *
 * The plugin is intentionally self-contained:
 * - All ambient state lives on the returned controller, not on module globals.
 * - It does not know about agent mode, approvals, or the websocket — just attachments in,
 *   one transformed prompt out.
 * - An end user can `import { createAttachmentsExtension } from "@pi-deck/core"` and load
 *   it through pi-ai's normal extension API.
 */
export function createAttachmentsExtension(
  options: AttachmentsExtensionOptions,
): AttachmentsController {
  let projectPath = options.projectPath;
  let pending: PromptAttachment[] = options.initialPending ? [...options.initialPending] : [];

  const factory: ExtensionFactory = (pi: ExtensionAPI) => {
    pi.on("input", async (event): Promise<InputEventResult> => {
      if (pending.length === 0) return { action: "continue" };
      // Snapshot then clear so a failure later in this turn doesn't double-attach next time.
      const snapshot = pending;
      pending = [];
      const block = await renderAttachmentsBlock(snapshot, {
        projectPath,
        listProjectFiles: options.listProjectFiles,
        maxFileBytes: options.maxFileBytes,
        maxFileLines: options.maxFileLines,
        maxInlineFiles: options.maxInlineFiles,
        maxTurnBytes: options.maxTurnBytes,
        maxFolderEntries: options.maxFolderEntries,
      });
      if (!block) return { action: "continue" };
      // Record what was attached on the session timeline so replay/audit can show the chips
      // without re-deriving them from text. Not sent to the LLM.
      pi.appendEntry(ATTACHMENTS_ENTRY_TYPE, { attachments: snapshot });
      // Prepend the rendered block so the LLM sees attachments BEFORE the user's question
      // — keeping it all inside a single user-role message.
      const combined = `${block}\n\n${event.text}`;
      return event.images
        ? { action: "transform", text: combined, images: event.images }
        : { action: "transform", text: combined };
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
