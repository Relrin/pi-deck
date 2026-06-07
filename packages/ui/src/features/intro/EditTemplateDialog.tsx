import * as RadixDialog from "@radix-ui/react-dialog";
import { type FormEvent, useEffect, useState } from "react";
import { PidButton } from "../../components/buttons/PidButton";
import type { IntroTemplate } from "./templates";
import { useTemplatesStore } from "./useTemplatesStore";

interface Props {
  /** The built-in (default) template being edited, or `null` when the dialog is closed. */
  template: IntroTemplate | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

/**
 * Edit one of the intro-screen template cards. Seeds its fields from the *effective* values
 * (default merged with any existing override) and writes a `TemplateOverride` on Apply.
 * "Reset to default" only appears when an override is currently in effect for this slot.
 */
export function EditTemplateDialog({ template, open, onOpenChange }: Props) {
  const overrides = useTemplatesStore((s) => s.overrides);
  const setOverride = useTemplatesStore((s) => s.setOverride);
  const resetOverride = useTemplatesStore((s) => s.resetOverride);

  const override = template ? overrides[template.id] : undefined;
  const hasOverride = Boolean(override);

  const [title, setTitle] = useState("");
  const [blurb, setBlurb] = useState("");
  const [body, setBody] = useState("");

  // Seed the fields from the effective values whenever the dialog opens for a template.
  useEffect(() => {
    if (!open || !template) return;
    setTitle(override?.title ?? template.title);
    setBlurb(override?.blurb ?? template.blurb);
    setBody(override?.body ?? template.body);
  }, [open, template, override]);

  if (!template) return null;

  const canApply = title.trim().length > 0 && body.trim().length > 0;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canApply) return;
    setOverride(template.id, { title: title.trim(), blurb: blurb.trim(), body });
    onOpenChange(false);
  };

  const onReset = () => {
    resetOverride(template.id);
    onOpenChange(false);
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="pid-modal-backdrop" />
        <RadixDialog.Content
          className="pid-modal"
          style={{ width: "min(560px, 92vw)", maxHeight: "min(640px, 90vh)" }}
        >
          <div className="pid-modal-header">
            <RadixDialog.Title className="pid-modal-title">Edit template</RadixDialog.Title>
            <RadixDialog.Description className="pid-modal-description">
              Override this template's title, description, and prompt. Changes are saved locally.
            </RadixDialog.Description>
          </div>
          <form className="pid-form" onSubmit={onSubmit}>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="tpl-title">
                Title
              </label>
              <input
                id="tpl-title"
                className="pid-form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={template.title}
              />
            </div>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="tpl-blurb">
                Short description
              </label>
              <input
                id="tpl-blurb"
                className="pid-form-input"
                value={blurb}
                onChange={(e) => setBlurb(e.target.value)}
                placeholder={template.blurb}
              />
            </div>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="tpl-body">
                Prompt
              </label>
              <textarea
                id="tpl-body"
                className="pid-form-textarea"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={template.body}
                spellCheck={false}
              />
              <span className="pid-form-hint">
                Inserted into the composer when the card is clicked.
              </span>
            </div>
            <div className="pid-form-row">
              {hasOverride && (
                <PidButton
                  variant="ghost"
                  onClick={onReset}
                  longLabel
                  className="pid-form-row-spacer"
                >
                  Reset to default
                </PidButton>
              )}
              <PidButton variant="ghost" onClick={() => onOpenChange(false)} longLabel>
                Cancel
              </PidButton>
              <PidButton variant="primary" type="submit" disabled={!canApply} longLabel>
                Apply
              </PidButton>
            </div>
          </form>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
