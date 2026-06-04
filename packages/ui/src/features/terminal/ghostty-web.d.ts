// Asset/side-effect imports used by the terminal renderer adapter. Declared specifically (not
// via a `*?url` wildcard) so they coexist with any `vite/client` ambient types without conflict.

declare module "ghostty-web/ghostty-vt.wasm?url" {
  const src: string;
  export default src;
}

declare module "@xterm/xterm/css/xterm.css";
