"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "./cx";
import { glassClass } from "./GlassCard";

export type TimeSeries = { id: string; label: string; color: string };
export type TimeBucket = {
  key: string;
  /** Axis label: "24 Aug". */
  tick: string;
  /** Tooltip and table heading: "Week of 24 Aug". */
  title: string;
  values: Record<string, number>;
};

export type TimeChartProps = {
  data: TimeBucket[];
  series: TimeSeries[];
  /**
   * columns: one plot, the series side by side, with a y-axis and a legend.
   * rows: one small plot per series on a shared scale, each named on its left. Use it when several
   * series would be hard to tell apart by colour alone.
   */
  layout?: "columns" | "rows";
  /** Height of the plot (columns) or of each row (rows), in px. */
  height?: number;
  /** A reference line, for example a weekly target. */
  target?: { value: number; label: string };
  /** Heading of the first table column ("Week"). */
  bucketLabel?: string;
  "aria-label": string;
  className?: string;
};

/** Whole-number axis ticks: 0 and a round step up to the first tick at or above max. */
function axisFor(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const rough = max / 3;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(rough, 1)));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return { top, ticks };
}

/** Room one axis label needs, in px ("Oct ’25" at 13px, plus a gap; the first one sits left-aligned). */
const TICK_WIDTH = 66;

function pct(value: number, top: number): string {
  return `${(value / top) * 100}%`;
}

/** One bar: square at the baseline, 4px rounded at the data end, never under 3px when it holds a value. */
function Bar({ value, top, color }: { value: number; top: number; color: string }) {
  if (value <= 0) return null;
  return (
    <span
      aria-hidden
      className="block w-full max-w-3 min-w-0 rounded-t-[4px] transition-[height] duration-200 ease-out"
      style={{ height: `max(${pct(value, top)}, 3px)`, background: color }}
    />
  );
}

/**
 * Counts over time, drawn with HTML at container width so labels stay at 13px.
 * Hover, tap or arrow keys read a week: one tooltip lists every series. "See the numbers" opens the
 * same values as a table, so nothing depends on the tooltip.
 */
export function TimeChart({ data, series, layout = "columns", height, target, bucketLabel = "Period", className, ...aria }: TimeChartProps) {
  const [activeIndex, setActive] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(0);
  useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const measure = () => setPlotWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const n = data.length;
  // The data can shrink under an open reading (the window toggle, a refetch).
  const active = activeIndex !== null && activeIndex < n ? activeIndex : null;
  const reading = active !== null;
  // A reading left by a pointer goes away on the next press elsewhere or when the page scrolls. One
  // opened by the keyboard stays: focusing the chart can itself scroll the page.
  const byPointer = useRef(false);
  useEffect(() => {
    if (!reading) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!plotRef.current?.contains(e.target as Node)) setActive(null);
    };
    const onScroll = () => {
      if (byPointer.current) setActive(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [reading]);
  const rows = layout === "rows";
  const plotHeight = height ?? (rows ? 36 : 140);
  const peak = Math.max(0, target?.value ?? 0, ...data.flatMap((d) => series.map((s) => d.values[s.id] ?? 0)));
  const { top, ticks } = axisFor(peak);
  const labelEvery = plotWidth && n ? Math.max(1, Math.ceil(TICK_WIDTH / (plotWidth / n))) : 3;
  const totals = series.map((s) => data.reduce((sum, d) => sum + (d.values[s.id] ?? 0), 0));
  const current = active === null ? null : data[active];
  const describe = (d: TimeBucket) => `${d.title}: ${series.map((s) => `${s.label} ${d.values[s.id] ?? 0}`).join(", ")}`;

  const onKey = (e: KeyboardEvent) => {
    byPointer.current = false;
    const last = n - 1;
    const from = active ?? last;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = Math.min(from + 1, last);
    else if (e.key === "ArrowLeft") next = Math.max(from - 1, 0);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else if (e.key === "Escape") {
      setActive(null);
      return;
    } else return;
    e.preventDefault();
    setActive(next);
  };

  const columns = (s: TimeSeries[]) => (
    <div aria-hidden className="absolute inset-0 flex items-end">
      {data.map((d) => (
        <div key={d.key} className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5 px-px sm:px-0.5">
          {s.map((x) => (
            <Bar key={x.id} value={d.values[x.id] ?? 0} top={top} color={x.color} />
          ))}
        </div>
      ))}
    </div>
  );

  const frac = active === null || n === 0 ? 0 : (active + 0.5) / n;

  return (
    <figure className={cx("w-full", className)}>
      <div className="flex">
        {/* Left gutter: y-axis labels, or the name and total of each row */}
        {rows ? (
          <ul aria-hidden className="w-28 shrink-0 pr-3 sm:w-32">
            {series.map((s, i) => (
              <li key={s.id} className="flex items-end justify-between gap-2 text-caption font-normal text-ink-2" style={{ height: plotHeight }}>
                <span className="flex min-w-0 items-center gap-1.5 pb-0.5">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="iv-num pb-0.5 font-medium text-ink">{totals[i]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div aria-hidden className="relative w-7 shrink-0" style={{ height: plotHeight }}>
            {ticks.map((t) => (
              <span key={t} className="iv-num absolute right-2 translate-y-1/2 text-caption font-normal text-ink-3" style={{ bottom: pct(t, top) }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {/* The plot */}
        <div ref={plotRef} className="relative min-w-0 flex-1">
          {rows ? (
            series.map((s) => (
              <div key={s.id} className="relative border-b border-line-strong" style={{ height: plotHeight }}>
                {columns([s])}
              </div>
            ))
          ) : (
            <div className="relative" style={{ height: plotHeight }}>
              {ticks.map((t) => (
                <span
                  key={t}
                  aria-hidden
                  className={cx("absolute inset-x-0 border-t", t === 0 ? "border-line-strong" : "border-ink/[0.07]")}
                  style={{ bottom: pct(t, top) }}
                />
              ))}
              {columns(series)}
              {target ? <span aria-hidden className="absolute inset-x-0 border-t border-ink-2" style={{ bottom: pct(target.value, top) }} /> : null}
            </div>
          )}

          {/* Hit layer: each slot is the whole column, so nobody has to land on a thin bar */}
          <div
            role="group"
            tabIndex={0}
            aria-label={`${aria["aria-label"]}. Use the left and right arrow keys to read each period.`}
            onKeyDown={onKey}
            onFocus={(e) => {
              if (e.target.matches(":focus-visible")) {
                byPointer.current = false;
                setActive((a) => a ?? n - 1);
              }
            }}
            onBlur={() => setActive(null)}
            // A finger lifting also "leaves": on touch the reading stays until the next tap elsewhere.
            onPointerLeave={(e) => {
              if (e.pointerType !== "touch") setActive(null);
            }}
            onPointerCancel={() => setActive(null)}
            className="absolute inset-0 flex rounded-sm"
          >
            {data.map((d, i) => (
              <div
                key={d.key}
                onPointerMove={() => {
                  byPointer.current = true;
                  setActive(i);
                }}
                onPointerDown={() => {
                  byPointer.current = true;
                  setActive(i);
                }}
                className={cx("h-full min-w-0 flex-1 rounded-[6px]", active === i && "bg-ink/[0.06]")}
              />
            ))}
          </div>

          {current ? (
            <div
              aria-hidden
              className={cx(
                glassClass("thick"),
                "pointer-events-none absolute bottom-full z-30 mb-2 w-max max-w-full px-3 py-2 text-caption font-normal shadow-2",
              )}
              // Sliding by its own width in step with its position keeps it inside the plot.
              style={{ left: `${frac * 100}%`, transform: `translateX(-${frac * 100}%)` }}
            >
              <p className="mb-1 text-ink-2">{current.title}</p>
              <ul className="flex flex-col gap-0.5">
                {series.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="iv-num font-semibold text-ink">{current.values[s.id] ?? 0}</span>
                    <span className="text-ink-2">{s.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <span className="sr-only" aria-live="polite">
            {current ? describe(current) : ""}
          </span>
        </div>
      </div>

      {/* X-axis */}
      <div aria-hidden className={cx("mt-1 flex", rows ? "pl-28 sm:pl-32" : "pl-7")}>
        {data.map((d, i) => (
          <span
            key={d.key}
            className={cx(
              "iv-num flex min-w-0 flex-1 text-caption font-normal whitespace-nowrap text-ink-3",
              // keep the first and last labels inside the chart so nothing overflows at 375px
              i === 0 ? "justify-start" : i === n - 1 ? "justify-end" : "justify-center",
            )}
          >
            {i === n - 1 || (i % labelEvery === 0 && n - 1 - i >= labelEvery) ? d.tick : ""}
          </span>
        ))}
      </div>

      {!rows && (series.length > 1 || target) ? (
        <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption font-normal text-ink-2">
          {series.length > 1
            ? series.map((s) => (
                <span key={s.id} className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: s.color }} /> {s.label}
                </span>
              ))
            : null}
          {target ? (
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-px w-3.5 bg-ink-2" /> {target.label}
            </span>
          ) : null}
        </figcaption>
      ) : null}

      <details className="mt-3 text-caption font-normal">
        <summary className="w-fit cursor-pointer rounded-sm font-medium text-ink-2 hover:text-ink pointer-coarse:py-3">See the numbers</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">{aria["aria-label"]}</caption>
            <thead className="text-ink-2">
              <tr className="border-b border-ink/[0.08]">
                <th scope="col" className="py-1 pr-3 font-medium">
                  {bucketLabel}
                </th>
                {series.map((s) => (
                  <th key={s.id} scope="col" className="py-1 pl-3 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-ink">
              {data.map((d) => (
                <tr key={d.key} className="border-b border-ink/[0.05] last:border-b-0">
                  <th scope="row" className="py-1 pr-3 font-normal whitespace-nowrap">
                    {d.title}
                  </th>
                  {series.map((s) => (
                    <td key={s.id} className="iv-num py-1 pl-3 text-right">
                      {d.values[s.id] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
