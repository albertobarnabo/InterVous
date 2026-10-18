import { cx } from "./cx";

export type AgeBarProps = {
  days: number | null | undefined;
  /** End of the scale in days (default 60). */
  max?: number;
  /** Tick marks: 21 "old enough to judge", 45 "likely closed". */
  ticks?: number[];
  className?: string;
  /** Show "{n} d" after the bar. */
  showLabel?: boolean;
};

const TICK_TITLE: Record<number, string> = { 21: "21 days: old enough to judge", 45: "45 days: likely closed" };

/** A thin bar on a 0–max day scale. Past the last tick it turns amber. */
export function AgeBar({ days, max = 60, ticks = [21, 45], className, showLabel }: AgeBarProps) {
  const d = typeof days === "number" && Number.isFinite(days) ? Math.max(0, days) : null;
  const pct = d === null ? 0 : Math.min(100, (d / max) * 100);
  const late = d !== null && ticks.length > 0 && d >= ticks[ticks.length - 1];
  return (
    <span className={cx("inline-flex w-full items-center gap-2", className)}>
      <span
        role="img"
        aria-label={d === null ? "Date unknown" : `${d} days on a ${max}-day scale`}
        className="relative block h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-ink/[0.08]"
      >
        <span
          className={cx("absolute inset-y-0 left-0 rounded-full", late ? "bg-caution" : "bg-ink-3")}
          style={{ width: `${pct}%` }}
        />
        {ticks.map((t) => (
          <span
            key={t}
            title={TICK_TITLE[t] ?? `${t} days`}
            className="absolute inset-y-0 w-px bg-white"
            style={{ left: `${(t / max) * 100}%` }}
          />
        ))}
      </span>
      {showLabel ? <span className="iv-num w-10 shrink-0 text-right text-caption text-ink-3">{d === null ? "—" : `${d} d`}</span> : null}
    </span>
  );
}
