import {
  bouncy,
  bouncyArc,
  chaoticOrbit,
  dotPulse,
  dotStream,
  jelly,
  jellyTriangle,
  leapfrog,
  metronome,
  mirage,
  momentum,
  newtonsCradle,
  quantum,
  spiral,
  square,
  superballs,
  treadmill,
  wobble,
} from "ldrs";
import { createElement, useMemo } from "react";

interface Spec {
  register: (name?: string) => void;
  tag: string;
  size: number;
  speed: number;
}

/**
 * Curated set of `ldrs` web-component spinners we randomize across. Each entry carries
 * the natural visual size + speed for the spinner so they look proportional inline.
 */
const SPINNERS: readonly Spec[] = [
  { register: square.register, tag: "l-square", size: 14, speed: 1.2 },
  { register: bouncy.register, tag: "l-bouncy", size: 18, speed: 1.75 },
  { register: spiral.register, tag: "l-spiral", size: 16, speed: 0.9 },
  { register: treadmill.register, tag: "l-treadmill", size: 22, speed: 1.25 },
  { register: bouncyArc.register, tag: "l-bouncy-arc", size: 18, speed: 1.1 },
  { register: wobble.register, tag: "l-hatch", size: 26, speed: 0.9 },
  { register: quantum.register, tag: "l-quantum", size: 16, speed: 1.75 },
  { register: superballs.register, tag: "l-superballs", size: 18, speed: 1.4 },
  { register: chaoticOrbit.register, tag: "l-chaotic-orbit", size: 18, speed: 1.5 },
  { register: momentum.register, tag: "l-momentum", size: 18, speed: 1.1 },
  { register: leapfrog.register, tag: "l-leapfrog", size: 18, speed: 2.5 },
  { register: newtonsCradle.register, tag: "l-newtons-cradle", size: 24, speed: 1.4 },
  { register: dotStream.register, tag: "l-dot-stream", size: 26, speed: 2.5 },
  { register: dotPulse.register, tag: "l-dot-pulse", size: 26, speed: 1.3 },
  { register: metronome.register, tag: "l-metronome", size: 18, speed: 1.6 },
  { register: jelly.register, tag: "l-jelly", size: 18, speed: 0.9 },
  { register: jellyTriangle.register, tag: "l-jelly-triangle", size: 18, speed: 1.75 },
  { register: mirage.register, tag: "l-mirage", size: 30, speed: 2.5 },
];

let registered = false;
function ensureRegistered(): void {
  if (registered) return;
  if (typeof customElements === "undefined") return;
  for (const s of SPINNERS) {
    // ldrs registers a custom element which can only happen once per tag; calling
    // `register` again is a no-op but still throws under happy-dom, so swallow.
    try {
      s.register();
    } catch {
      /* element already defined */
    }
  }
  registered = true;
}

export interface RandomSpinnerProps {
  /** CSS color string passed to the underlying ldrs element. Defaults to `currentColor`. */
  color?: string;
  /** When provided, the spinner is exposed to assistive tech with this label. */
  "aria-label"?: string;
}

/**
 * Renders one of a curated set of `ldrs` web-component spinners, chosen at random per
 * mount. The choice is stable for the lifetime of the React node so the spinner doesn't
 * thrash between renders.
 */
export function RandomSpinner({
  color = "currentColor",
  "aria-label": ariaLabel,
}: RandomSpinnerProps = {}) {
  ensureRegistered();
  const spec = useMemo(() => SPINNERS[Math.floor(Math.random() * SPINNERS.length)] as Spec, []);
  const labelled = typeof ariaLabel === "string" && ariaLabel.length > 0;
  return createElement(
    "span",
    labelled
      ? {
          role: "status",
          "aria-label": ariaLabel,
          className: "inline-flex items-center",
        }
      : { "aria-hidden": true, className: "inline-flex items-center" },
    createElement(spec.tag, {
      size: spec.size,
      speed: spec.speed,
      color,
    }),
  );
}
