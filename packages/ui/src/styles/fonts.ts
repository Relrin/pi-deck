// Bundled font CSS, loaded via Vite's JS module resolver instead of postcss-import's
// bare-specifier resolution — the latter silently fails on Windows when walking through
// Bun's NTFS-junctioned `node_modules/.bun/...` layout, leaving every fontsource
// `@font-face` un-registered and the UI falling back to Times/Arial. Imported from this
// package (not from packages/desktop) so resolution starts in `packages/ui/node_modules`
// where the @fontsource junctions actually live.
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";
