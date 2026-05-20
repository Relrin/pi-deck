import { describe, expect, test } from "bun:test";
import { stripAttachmentsBlock } from "../../src/worker/agent-bridge.js";

describe("stripAttachmentsBlock", () => {
  test("strips a leading attachments block followed by a blank line", () => {
    const text = '<attachments>\n<file path="hello.ts">x</file>\n</attachments>\n\nwhat is this?';
    expect(stripAttachmentsBlock(text)).toBe("what is this?");
  });

  test("strips a leading attachments block followed by a single newline", () => {
    const text = '<attachments>\n<ref path="x" />\n</attachments>\nhi';
    expect(stripAttachmentsBlock(text)).toBe("hi");
  });

  test("returns the input unchanged when no block is present", () => {
    expect(stripAttachmentsBlock("just a question")).toBe("just a question");
  });

  test("leaves an attachments tag later in the string intact", () => {
    const text = "tell me about <attachments> tags";
    expect(stripAttachmentsBlock(text)).toBe(text);
  });

  test("returns the input unchanged when the closing tag is missing", () => {
    const text = '<attachments>\n<file path="x">truncated';
    expect(stripAttachmentsBlock(text)).toBe(text);
  });

  test("collapses the block even when the user typed nothing after it", () => {
    const text = '<attachments>\n<ref path="x" />\n</attachments>';
    expect(stripAttachmentsBlock(text)).toBe("");
  });
});
