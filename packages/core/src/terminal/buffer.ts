/**
 * A byte-capped ring of recent PTY output. Used to repaint scrollback into a freshly
 * (re)mounted `TerminalView` — e.g. after the bottom panel is reopened or the renderer
 * reloads — without re-running the shell. Bounds memory so a runaway process (`yes`,
 * `cat /dev/urandom`) can't grow the buffer unboundedly.
 *
 * Stores chunks as-is and evicts from the front once the total exceeds the cap; an oversized
 * single chunk is trimmed to its last `maxBytes`. UTF-8 byte length is measured so multi-byte
 * sequences are accounted for correctly (we may split one mid-sequence on eviction, which the
 * terminal emulator tolerates at the very top of the scrollback).
 */
export const DEFAULT_TERMINAL_BUFFER_BYTES = 256 * 1024;

export class OutputRingBuffer {
  private chunks: string[] = [];
  private totalBytes = 0;

  constructor(private readonly maxBytes: number = DEFAULT_TERMINAL_BUFFER_BYTES) {}

  append(data: string): void {
    if (!data) return;
    let chunk = data;
    let bytes = Buffer.byteLength(chunk, "utf8");
    if (bytes > this.maxBytes) {
      chunk = trimToLastBytes(chunk, this.maxBytes);
      bytes = Buffer.byteLength(chunk, "utf8");
      this.chunks = [chunk];
      this.totalBytes = bytes;
      return;
    }
    this.chunks.push(chunk);
    this.totalBytes += bytes;
    while (this.totalBytes > this.maxBytes && this.chunks.length > 1) {
      const removed = this.chunks.shift();
      if (removed) this.totalBytes -= Buffer.byteLength(removed, "utf8");
    }
  }

  snapshot(): string {
    return this.chunks.join("");
  }

  get byteLength(): number {
    return this.totalBytes;
  }
}

/** Keep the trailing `maxBytes` of `data`, cutting on a character boundary. */
function trimToLastBytes(data: string, maxBytes: number): string {
  const kept: string[] = [];
  let bytes = 0;
  for (let i = data.length - 1; i >= 0; i -= 1) {
    const ch = data[i] ?? "";
    const chBytes = Buffer.byteLength(ch, "utf8");
    if (bytes + chBytes > maxBytes) break;
    kept.push(ch);
    bytes += chBytes;
  }
  return kept.reverse().join("");
}
