import type { ReactNode } from "react";
import { cx } from "./cx";

export type BarListRow = {
  key: string;
  label: ReactNode;
  value: number;
  /** Quiet text beside the value ("1 of 11"). */
  detail?: ReactNode;
  /** A CSS colour for this row's bar; the list's `color` otherwise. */
  color?: string;
  /** A dot before the label, when the colour names a status. */
  dot?: boolean;
};

export type BarListProps = {
  rows: BarListRow[];
  /** A CSS colour for the bars (default the accent). */
  color?: string;
  /** Bar lengths are relative to this (default the largest value). */
  max?: number;
  "aria-label"?: string;
  className?: string;
};

/**
 * Horizontal bars with every value written out: the value is text, so it needs no tooltip and reads
 * the same without colour. It holds counts only; a rate belongs in `detail`, from lib/core/stats.mjs.
 */
export function BarList({ rows, color = "var(--accent)", max, className, ...aria }: BarListProps) {
  const top = Math.max(1, max ?? 0, ...rows.map((r) => r.value));
  return (
    <ul aria-label={aria["aria-label"]} className={cx("flex flex-col gap-3", className)}>
      {rows.map((r) => {
        const fill = r.color ?? color;
        return (
          <li key={r.key} className="min-w-0">
            <div className="flex items-baseline gap-3 text-small">
              <span className="flex min-w-0 flex-1 items-baseline gap-2 text-ink">
                {r.dot ? <span aria-hidden className="size-2 shrink-0 translate-y-[-1px] rounded-full" style={{ background: fill }} /> : null}
                <span className="min-w-0 break-words">{r.label}</span>
              </span>
              {r.detail ? <span className="iv-num shrink-0 text-caption font-normal text-ink-2">{r.detail}</span> : null}
              <span className="iv-num shrink-0 font-semibold text-ink">{r.value}</span>
            </div>
            <div aria-hidden className="mt-1 h-2 overflow-hidden rounded-r-[4px] bg-ink/[0.05]">
              {r.value > 0 ? (
                <div
                  className="h-full rounded-r-[4px] transition-[width] duration-200 ease-out"
                  style={{ width: `max(${(r.value / top) * 100}%, 4px)`, background: fill }}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
