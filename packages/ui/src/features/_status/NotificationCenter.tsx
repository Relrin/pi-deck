import { useEffect } from "react";
import { Check, Info, X } from "../../components/icons/index.js";
import { type Notification, useNotificationStore } from "./useNotificationStore.js";

/**
 * Stacked rich notifications anchored to the bottom-right. The single notification
 * surface — used both for plain-text error nudges (via the `error/info/success`
 * shortcuts on `useNotificationStore`) and for structured cards with tags, actions,
 * and a countdown bar (via `push`).
 */
export function NotificationCenter() {
  const notifications = useNotificationStore((s) => s.notifications);
  const dismiss = useNotificationStore((s) => s.dismiss);

  if (notifications.length === 0) return null;

  return (
    <div className="pid-notifications" aria-live="polite">
      {notifications.map((n) => (
        <NotificationCard key={n.id} notification={n} onDismiss={() => dismiss(n.id)} />
      ))}
    </div>
  );
}

interface CardProps {
  notification: Notification;
  onDismiss: () => void;
}

function NotificationCard({ notification, onDismiss }: CardProps) {
  const { kind, title, tag, body, meta, actions, footnote, durationMs, createdAt } = notification;

  useEffect(() => {
    if (durationMs <= 0) return;
    const elapsed = Date.now() - createdAt;
    const remaining = durationMs - elapsed;
    if (remaining <= 0) {
      onDismiss();
      return;
    }
    const timer = setTimeout(onDismiss, remaining);
    return () => clearTimeout(timer);
  }, [durationMs, createdAt, onDismiss]);

  return (
    <div className="pid-notification" data-kind={kind} role={kind === "error" ? "alert" : "status"}>
      <span className="pid-notification-icon" aria-hidden data-kind={kind}>
        {kind === "success" ? (
          <Check size={12} />
        ) : kind === "info" ? (
          <Info size={12} />
        ) : (
          <X size={12} />
        )}
      </span>
      <div className="pid-notification-content">
        <div className="pid-notification-head">
          <span className="pid-notification-title">{title}</span>
          {tag ? (
            <span className="pid-notification-tag" data-kind={kind}>
              {tag}
            </span>
          ) : null}
        </div>
        {body ? <p className="pid-notification-body">{body}</p> : null}
        {meta ? <p className="pid-notification-meta">{meta}</p> : null}
        {actions && actions.length > 0 ? (
          <div className="pid-notification-actions">
            {actions.map((a) => (
              <button
                key={a.id}
                type="button"
                className="pid-notification-action"
                data-variant={a.variant ?? "secondary"}
                onClick={() => {
                  void a.onSelect();
                  if (a.dismissAfter !== false) onDismiss();
                }}
              >
                {a.leadingIcon ? (
                  <span className="pid-notification-action-icon" aria-hidden>
                    {a.leadingIcon}
                  </span>
                ) : null}
                {a.label}
              </button>
            ))}
          </div>
        ) : null}
        {footnote ? (
          <button
            type="button"
            className="pid-notification-footnote"
            onClick={() => {
              footnote.onSelect();
              onDismiss();
            }}
          >
            {footnote.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="pid-notification-close"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        <X size={12} />
      </button>
      {durationMs > 0 ? (
        <div
          className="pid-notification-bar"
          data-kind={kind}
          style={{ animationDuration: `${durationMs}ms` }}
        />
      ) : null}
    </div>
  );
}
