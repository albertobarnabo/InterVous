import { cx } from "./cx";

/**
 * The InterVous mark: two circles, you and the company, with the space you share filled in.
 * Teal by default (the accent); pass className="text-…" to recolour. Decorative: the
 * wordmark or an aria-label next to it carries the name.
 */
export function BrandMark({ size = 32, className, strokeWidth = 7 }: { size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cx("shrink-0 text-accent", className)}
      fill="none"
    >
      <circle cx="38" cy="50" r="26" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="62" cy="50" r="26" stroke="currentColor" strokeWidth={strokeWidth} />
      <path d="M50 26.93 A26 26 0 0 1 50 73.07 A26 26 0 0 1 50 26.93 Z" fill="currentColor" />
    </svg>
  );
}
