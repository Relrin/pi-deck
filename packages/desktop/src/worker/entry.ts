// Thin shim so electron-vite has a stable in-package input path for the worker
// bundle. The actual worker code lives in @pi-deck/core and is imported here
// for its side effects (stdin reader, lifecycle handlers, etc.).
import "@pi-deck/core/worker/entry.js";
