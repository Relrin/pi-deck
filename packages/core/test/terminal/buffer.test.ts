import { describe, expect, test } from "bun:test";
import { OutputRingBuffer } from "../../src/terminal/buffer.js";

describe("OutputRingBuffer", () => {
  test("snapshot returns appended output in order", () => {
    const buf = new OutputRingBuffer(1024);
    buf.append("hello ");
    buf.append("world");
    expect(buf.snapshot()).toBe("hello world");
    expect(buf.byteLength).toBe(11);
  });

  test("evicts oldest chunks once the cap is exceeded", () => {
    const buf = new OutputRingBuffer(10);
    buf.append("abcdefgh"); // 8 bytes
    buf.append("ijkl"); // +4 = 12 > 10 → evict the first chunk
    expect(buf.snapshot()).toBe("ijkl");
    expect(buf.byteLength).toBe(4);
  });

  test("trims a single oversized chunk to the trailing bytes", () => {
    const buf = new OutputRingBuffer(4);
    buf.append("abcdefgh");
    expect(buf.snapshot()).toBe("efgh");
    expect(buf.byteLength).toBe(4);
  });

  test("ignores empty appends", () => {
    const buf = new OutputRingBuffer(16);
    buf.append("");
    expect(buf.snapshot()).toBe("");
    expect(buf.byteLength).toBe(0);
  });
});
