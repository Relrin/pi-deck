import { Glyph } from "../../components/glyph";

export interface MockDataBannerProps {
  message?: string;
}

/** Inline banner used by stub settings sections to make clear they are not yet wired. */
export function MockDataBanner({ message = "Stub — not yet wired" }: MockDataBannerProps) {
  return (
    <div className="pid-banner" data-tone="warn" role="status">
      <span className="pid-banner-icon" aria-hidden>
        <Glyph kind="error" size={12} />
      </span>
      <span className="pid-banner-text">{message}</span>
    </div>
  );
}
