declare module "*.css";

// Vite emits an imported SVG as a URL string (asset). Used by the terminal shell-type icons.
declare module "*.svg" {
  const src: string;
  export default src;
}

declare module "*?worker" {
  const workerConstructor: new (options?: { name?: string }) => Worker;
  export default workerConstructor;
}
