import { type BoundFunctions, type queries, within } from "@testing-library/dom";

export type Screen = BoundFunctions<typeof queries>;

/**
 * Lazy `screen` proxy.
 *
 * The standard `screen` from `@testing-library/dom` binds to `document.body`
 * at module-load time. Under Bun's `preload`, that evaluation may happen
 * before `happy-dom` has registered the global `document`, leaving `screen`
 * permanently broken. This proxy re-resolves `within(document.body)` per
 * access, so it always sees the current document.
 */
export const screen: Screen = new Proxy({} as Screen, {
  get(_target, prop: string) {
    const queries = within(document.body) as unknown as Record<string, unknown>;
    return queries[prop];
  },
});

import userEventDefault from "@testing-library/user-event";

export * from "@testing-library/react";
export { fireEvent } from "@testing-library/react";
export const userEvent = userEventDefault;
