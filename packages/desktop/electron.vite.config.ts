import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

const coreSrc = resolve(__dirname, "../core/src");
const uiSrc = resolve(__dirname, "../ui/src");

// `@earendil-works/pi-coding-agent` is ESM-only and consumed via static `import`
// in the worker, so main + worker are emitted as ESM (`.mjs`). Electron 28+
// supports ESM main entries; we're on Electron 42. Preload stays CJS (sandboxed
// preload requires CJS in Electron).
export default defineConfig({
  main: {
    resolve: {
      alias: {
        "@pi-deck/core": coreSrc,
        "@pi-deck/ui": uiSrc,
      },
    },
    build: {
      outDir: "dist/main",
      emptyOutDir: true,
      sourcemap: "inline",
      minify: false,
      externalizeDeps: { exclude: ["@pi-deck/core", "@pi-deck/ui"] },
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/index.ts"),
          worker: resolve(__dirname, "src/worker/entry.ts"),
        },
        external: ["electron", "@earendil-works/pi-coding-agent"],
        output: {
          format: "es",
          entryFileNames: "[name].mjs",
          chunkFileNames: "[name]-[hash].mjs",
        },
      },
    },
  },
  preload: {
    build: {
      outDir: "dist/preload",
      emptyOutDir: true,
      sourcemap: "inline",
      minify: false,
      rollupOptions: {
        input: resolve(__dirname, "src/preload/index.ts"),
        external: ["electron"],
        output: {
          format: "cjs",
          entryFileNames: "index.js",
        },
      },
    },
  },
  renderer: {
    root: __dirname,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@pi-deck/ui": uiSrc,
        "@pi-deck/core": coreSrc,
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      fs: {
        allow: [resolve(__dirname, ".."), resolve(__dirname, "../..")],
      },
    },
    build: {
      outDir: "dist/renderer",
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(__dirname, "index.html"),
      },
    },
    base: "./",
  },
});
