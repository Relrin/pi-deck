import { Sparkles } from "../../../components/icons/index.js";

/**
 * For the model which have an adaptive thinking mode. We should a chip around
 * the name in the model selection dropdown.
 */
export function AdaptiveChip() {
  return (
    <span className="pid-chip" data-variant="accent" title="Adaptive thinking">
      <Sparkles size={10} aria-hidden />
      adaptive
    </span>
  );
}
