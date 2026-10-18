import { cx } from "./cx";

export type RangeBarProps = {
  /** Interval bounds and point estimate as fractions 0–1 (e.g. an 80% Wilson interval). */
  low: number;
  high: number;
  point: number;
  className?: string;
  /** Show "a%–b%" under the bar. */
  showLabels?: boolean;
};

const pct = (x: number) => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;

/** "Likely between a% and b%": a band on a 0–100% track with a marker at the point estimate. */
export function RangeBar({ low, high, point, className, showLabels = true }: RangeBarProps) {
  const lo = Math.max(0, Math.min(1, low));
  const hi = Math.max(lo, Math.min(1, high));
  const pt = Math.max(0, Math.min(1, point));
  return (
    <div className={cx("w-full", className)}>
      <div
        role="img"
        aria-label={`Likely between ${pct(lo)} and ${pct(hi)}, best estimate ${pct(pt)}`}
        className="relative h-3 w-full rounded-full bg-surface-2"
      >
        <span
          className="absolute inset-y-0 rounded-full border border-accent bg-accent-soft"
          style={{ left: `${lo * 100}%`, width: `max(${(hi - lo) * 100}%, 4px)` }}
        />
        <span
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent"
          style={{ left: `${pt * 100}%` }}
        />
      </div>
      {showLabels ? (
        <div className="relative mt-1 h-[18px] text-caption font-normal text-ink-3">
          <span className="iv-num absolute left-0">0%</span>
          <span className="iv-num absolute -translate-x-1/2 text-ink-2" style={{ left: `${((lo + hi) / 2) * 100}%` }}>
            {pct(lo)}–{pct(hi)}
          </span>
          <span className="iv-num absolute right-0">100%</span>
        </div>
      ) : null}
    </div>
  );
}
