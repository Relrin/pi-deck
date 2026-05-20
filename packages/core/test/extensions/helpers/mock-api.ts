import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

/**
 * Minimal in-memory stand-in for `ExtensionAPI` used by plugin unit tests.
 *
 * The real pi-ai runtime constructs an `ExtensionContext` per fire; for our hooks we only
 * use `event`, so we pass a deliberately empty `ctx`. Anything beyond `on(...)` and the small
 * surface the plugins use will throw — that's the point: tests fail loudly if a plugin starts
 * relying on TUI or session-manager helpers that the worker context can't provide.
 */
export interface MockExtensionApi extends ExtensionAPI {
  /** Invoke every handler registered for `event` in order; returns the last non-void result. */
  fire<R>(event: string, payload: unknown): Promise<R | undefined>;
  /** Names of events that have at least one registered handler. */
  handlers(): string[];
  /** Custom entries appended via `pi.appendEntry()` — captured for assertions. */
  appendedEntries(): { customType: string; data: unknown }[];
}

export function createMockExtensionApi(): MockExtensionApi {
  const handlers = new Map<string, Array<(event: unknown, ctx: ExtensionContext) => unknown>>();
  const entries: { customType: string; data: unknown }[] = [];

  const proxy = new Proxy({} as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      // Surface unsupported access as a clear test failure rather than `undefined`.
      return (...args: unknown[]) => {
        throw new Error(
          `MockExtensionApi: ExtensionAPI.${prop}(${args.length} args) not implemented in tests`,
        );
      };
    },
  }) as unknown as MockExtensionApi;

  proxy.on = ((event: string, handler: (e: unknown, ctx: ExtensionContext) => unknown) => {
    const list = handlers.get(event) ?? [];
    list.push(handler);
    handlers.set(event, list);
  }) as ExtensionAPI["on"];

  proxy.appendEntry = ((customType: string, data?: unknown) => {
    entries.push({ customType, data });
  }) as ExtensionAPI["appendEntry"];

  proxy.fire = async <R>(event: string, payload: unknown): Promise<R | undefined> => {
    const list = handlers.get(event) ?? [];
    let last: unknown;
    for (const h of list) {
      const ret = await h(payload, {} as ExtensionContext);
      if (ret !== undefined) last = ret;
    }
    return last as R | undefined;
  };

  proxy.handlers = () => [...handlers.keys()];
  proxy.appendedEntries = () => [...entries];

  return proxy;
}
