import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@pi-deck/ui": resolve(__dirname, "../ui/src"),
      "@pi-deck/core": resolve(__dirname, "../core/src"),
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
  },
  base: "./",
});
