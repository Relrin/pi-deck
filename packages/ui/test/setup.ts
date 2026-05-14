import "./happy-dom-setup";
import { afterEach, expect } from "bun:test";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";

// biome-ignore lint/suspicious/noExplicitAny: bun's expect.extend signature is jest-compatible but typed differently
expect.extend(matchers as any);

afterEach(() => {
  cleanup();
});
