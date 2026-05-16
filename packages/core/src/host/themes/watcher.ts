import chokidar, { type FSWatcher } from "chokidar";

export interface ThemeWatcherOptions {
  themesDir: string;
  /** Called after a quiet period following any add/change/unlink. */
  onChange: () => void;
  /** Debounce window in ms. Defaults to 250. */
  debounceMs?: number;
}

/** Wraps chokidar with a single debounced callback. */
export class ThemeWatcher {
  private watcher: FSWatcher | undefined;
  private timer: NodeJS.Timeout | undefined;
  private readonly debounceMs: number;
  private readonly onChange: () => void;

  constructor(private readonly opts: ThemeWatcherOptions) {
    this.debounceMs = opts.debounceMs ?? 250;
    this.onChange = opts.onChange;
  }

  start(): void {
    if (this.watcher) return;
    this.watcher = chokidar.watch(this.opts.themesDir, {
      ignoreInitial: true,
      depth: 0,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });
    const trigger = () => {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = undefined;
        try {
          this.onChange();
        } catch (err) {
          console.error("[themes] watcher onChange threw", err);
        }
      }, this.debounceMs);
    };
    this.watcher.on("add", trigger);
    this.watcher.on("change", trigger);
    this.watcher.on("unlink", trigger);
    this.watcher.on("error", (err) => {
      console.warn("[themes] watcher error", err);
    });
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    await this.watcher?.close();
    this.watcher = undefined;
  }
}
