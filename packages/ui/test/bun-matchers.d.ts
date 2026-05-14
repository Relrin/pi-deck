import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

/**
 * Merge `@testing-library/jest-dom` matcher types into Bun's `expect`.
 * Without this, `toBeInTheDocument` etc. are runtime-valid (registered via `expect.extend` in
 * `setup.ts`) but TypeScript doesn't know about them.
 */
declare module "bun:test" {
  interface Matchers<T> extends TestingLibraryMatchers<typeof expect.stringContaining, T> {}
  interface AsymmetricMatchers
    extends TestingLibraryMatchers<typeof expect.stringContaining, unknown> {}
}
