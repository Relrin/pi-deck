import { type BoundFunctions, type queries, within } from "@testing-library/dom";
import {
  render as baseRender,
  renderHook as baseRenderHook,
  type RenderHookOptions,
  type RenderHookResult,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { TooltipProvider } from "../src/components/ui/Tooltip";
import TypesafeI18n from "../src/i18n/i18n-react";

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

/**
 * Provider tree mirroring `App.tsx` for tests. Components that use Radix Tooltip/Dropdown
 * require their providers to be present in scope; rendering them naked crashes. The same is true
 * of `useI18nContext()`, which is why `TypesafeI18n` is here.
 *
 * The locale is pinned to `en` rather than read from `useLocaleStore` so a test that switches
 * locale has to do it deliberately (via `setState` plus its own re-render) instead of leaking into
 * unrelated files. `test/setup.ts` has already sync-loaded the English catalog by the time this
 * runs, so translations resolve immediately and no test needs to await anything.
 */
function AllProviders({ children }: { children: ReactNode }) {
  return (
    <TypesafeI18n locale="en">
      <TooltipProvider>{children}</TooltipProvider>
    </TypesafeI18n>
  );
}

export function render(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">): RenderResult {
  return baseRender(ui, { wrapper: AllProviders, ...options });
}

/**
 * `renderHook` with the same provider tree. Re-exported explicitly because the blanket
 * `export * from "@testing-library/react"` below would otherwise hand out the unwrapped version,
 * and the first hook that reaches for i18n or a tooltip would fail in a way that points nowhere
 * near the real cause.
 */
export function renderHook<Result, Props>(
  hook: (initialProps: Props) => Result,
  options?: Omit<RenderHookOptions<Props>, "wrapper">,
): RenderHookResult<Result, Props> {
  return baseRenderHook(hook, { wrapper: AllProviders, ...options });
}

export * from "@testing-library/react";
export { act, fireEvent } from "@testing-library/react";
export const userEvent = userEventDefault;
