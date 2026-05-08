const POLL_INTERVAL_MS = 100;
const DEFAULT_TIMEOUT_MS = 30_000;

export async function waitForViteServer(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return;
    } catch {
      // Server not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Vite dev server did not respond at ${url} within ${timeoutMs}ms`);
}
