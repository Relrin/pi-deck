import { app, session } from "electron";

/**
 * Content-Security-Policy + dev-warning handling. Called once during `app.whenReady`.
 *
 * - **Packaged builds:** attach a strict CSP via response headers so the renderer can't load
 *   remote scripts, eval strings, or open WebSockets to anywhere other than the host backend
 *   on 127.0.0.1. `'unsafe-inline'` stays on for scripts only to allow the pre-mount
 *   hydration block in `index.html`; styles likewise (Shiki/inline `style=` attributes).
 *   We do NOT allow `'unsafe-eval'` in production — that's the warning's main bullet.
 *
 * - **Dev builds:** Vite HMR requires `'unsafe-eval'` (it eval-runs transformed modules);
 *   there's no policy that satisfies both the security checker and Vite's runtime needs.
 *   We acknowledge that by suppressing the Electron security warning. The same warning text
 *   explicitly notes "This warning will not show up once the app is packaged" — we're aligning
 *   dev behaviour with that promise rather than ignoring the underlying concern.
 */
export function installCspHeaders(): void {
  if (!app.isPackaged) {
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
    return;
  }

  const policy = [
    "default-src 'self'",
    // 'unsafe-inline' covers the one fixed inline `<script>` in index.html (theme/density
    // hydration). No `'unsafe-eval'`.
    "script-src 'self' 'unsafe-inline'",
    // Shiki + Radix inject inline style attributes; needed for correct rendering.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    // Only the local backend WS server (auth-token-gated) is reachable from the renderer.
    "connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    // Strip any existing CSP the renderer or upstream set so ours is the single source of
    // truth; multiple CSP headers are intersected, never relaxed, but we want a single
    // predictable policy.
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === "content-security-policy") delete headers[key];
    }
    headers["Content-Security-Policy"] = [policy];
    callback({ responseHeaders: headers });
  });
}
