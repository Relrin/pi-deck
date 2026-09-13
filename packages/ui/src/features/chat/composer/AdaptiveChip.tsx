import { Sparkles } from "../../../components/icons/index.js";
import { useI18nContext } from "../../../i18n/i18n-react.js";

/**
 * For the model which have an adaptive thinking mode. We should a chip around
 * the name in the model selection dropdown.
 */
export function AdaptiveChip() {
  const { LL } = useI18nContext();
  return (
    <span className="pid-chip" data-variant="accent" title={LL.chat.effortPicker.adaptiveTooltip()}>
      <Sparkles size={10} aria-hidden />
      {LL.chat.effortPicker.adaptiveChip()}
    </span>
  );
}
