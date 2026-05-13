import type { Readable } from "node:stream";

const LF = 0x0a;

export function createJsonlReader(stream: Readable, onLine: (line: string) => void): void {
  let buffer: Buffer = Buffer.alloc(0);

  stream.on("data", (chunk: Buffer | string) => {
    const next: Buffer = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
    buffer = (buffer.length === 0 ? next : Buffer.concat([buffer, next])) as Buffer;

    let start = 0;
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] !== LF) continue;
      const line = buffer.subarray(start, i).toString("utf8");
      start = i + 1;
      if (line.length > 0) onLine(line);
    }
    buffer = start === 0 ? buffer : buffer.subarray(start);
  });

  stream.on("end", () => {
    if (buffer.length > 0) {
      const tail = buffer.toString("utf8");
      if (tail.length > 0) onLine(tail);
      buffer = Buffer.alloc(0);
    }
  });
}

export function encodeJsonl(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}
