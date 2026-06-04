/**
 * A tiny pub/sub for live terminal output, keyed by host `terminalId`. PTY output is
 * high-frequency and must bypass React state — `TerminalView` subscribes here and writes bytes
 * straight into the terminal emulator, while the event-router fans incoming `terminal.output`
 * events in. Base64 (de)coding lives here too so both the bus and the input path agree on it.
 */

export type TerminalOutputListener = (data: string, throttled: boolean) => void;

const listeners = new Map<string, Set<TerminalOutputListener>>();

export function subscribeTerminalOutput(
  terminalId: string,
  listener: TerminalOutputListener,
): () => void {
  let set = listeners.get(terminalId);
  if (!set) {
    set = new Set();
    listeners.set(terminalId, set);
  }
  set.add(listener);
  return () => {
    const current = listeners.get(terminalId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listeners.delete(terminalId);
  };
}

export function dispatchTerminalOutput(
  terminalId: string,
  dataB64: string,
  throttled: boolean,
): void {
  const set = listeners.get(terminalId);
  if (!set || set.size === 0) return;
  const data = decodeBase64Utf8(dataB64);
  for (const listener of set) listener(data, throttled);
}

/** Decode a base64 PTY chunk into a UTF-8 string for the terminal emulator's `write`. */
export function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Encode keystroke/paste text to base64 for the `terminal.write` command. */
export function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
