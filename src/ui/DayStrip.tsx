"use client";

import Link from "next/link";
import { useState } from "react";
import { cx } from "./cx";
import { glassClass } from "./GlassCard";

export type DayStripDot = {
  key: string;
  /** "Apple". */
  name: string;
  /** Tells apart two dots at one company: the role. */
  detail?: string;
  days: number;
  href?: string;
  /** Drawn hollow: the facts behind this dot are not confirmed yet. */
  hollow?: boolean;
};

export type DayStripProps = {
  dots: DayStripDot[];
  /** Right end of the axis, in days; a later dot sits at the end (default 60). */
  axisMax?: number;
  /** A marker on the axis, for example the median. */
  marker?: { days: number; label: string };
  /** Legend text for hollow dots, when there are any. */
  hollowLabel?: string;
  "aria-label": string;
  className?: string;
};

/** Rows sit far enough apart that a dot's hit area never reaches the visible dot above it. */
const ROW = 18;
/** The hit area around a dot, in px. */
const HIT = 24;
/** Dots on one row keep this share of the axis apart, so no hit area covers a neighbour at phone width. */
const MIN_GAP_PERCENT = 8;

function dayWord(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

/**
 * One dot per item on a days axis. Dots too close together stack upward, so each stays pressable and
 * opens its own application. One tooltip, drawn above every dot and kept inside the strip, names the
 * dot under the pointer or focus. "See the numbers" lists them all without hovering.
 */
export function DayStrip({ dots, axisMax = 60, marker, hollowLabel, className, ...aria }: DayStripProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(axisMax * f));
  const place = (days: number) => (Math.max(0, Math.min(days, axisMax)) / axisMax) * 100;

  const rowEnds: number[] = [];
  const placed = [...dots]
    .sort((a, b) => a.days - b.days)
    .map((d) => {
      const x = place(d.days);
      let level = rowEnds.findIndex((end) => x - end >= MIN_GAP_PERCENT);
      if (level < 0) level = rowEnds.length;
      rowEnds[level] = x;
      return { ...d, x, level };
    });
  const levels = Math.max(1, rowEnds.length);
  const plot = levels * ROW + 18 + (marker ? 22 : 0);
  const active = placed.find((d) => d.key === activeKey) ?? null;
  // Sliding by its own width in step with its position keeps a label inside the strip at any length.
  const inside = (x: number) => `translateX(-${x}%)`;
  const hasHollow = Boolean(hollowLabel) && dots.some((d) => d.hollow);

  return (
    <figure aria-label={aria["aria-label"]} className={cx("w-full", className)}>
      <div className="px-1">
        <div className="relative" style={{ height: plot }}>
          {marker ? (
            <>
              <span aria-hidden className="absolute bottom-0 w-px bg-ink-2" style={{ left: `${place(marker.days)}%`, height: plot - 20 }} />
              <span
                className="absolute top-0 text-caption font-medium whitespace-nowrap text-ink-2"
                style={{ left: `${place(marker.days)}%`, transform: inside(place(marker.days)) }}
              >
                {marker.label}
              </span>
            </>
          ) : null}
          <span aria-hidden className="absolute inset-x-0 bottom-0 border-t border-line-strong" />
          {placed.map((d) => {
            const label = `${d.name}${d.detail ? `, ${d.detail}` : ""}: ${dayWord(d.days)}${d.hollow ? " (not confirmed)" : ""}`;
            const dot = (
              <span
                aria-hidden
                className={cx("block size-2.5 rounded-full ring-2 ring-white", d.hollow ? "border-[1.5px] border-accent bg-white" : "bg-accent")}
              />
            );
            const hit = cx(
              "pointer-events-auto flex items-center justify-center rounded-full",
              activeKey === d.key && "bg-ink/[0.08]",
            );
            const handlers = {
              onPointerEnter: () => setActiveKey(d.key),
              onPointerLeave: () => setActiveKey(null),
              onFocus: () => setActiveKey(d.key),
              onBlur: () => setActiveKey(null),
            };
            return (
              <span
                key={d.key}
                className="pointer-events-none absolute -translate-x-1/2"
                style={{ left: `${d.x}%`, bottom: d.level * ROW - (HIT - ROW) / 2 + 3, width: HIT, height: HIT }}
              >
                {d.href ? (
                  <Link href={d.href} aria-label={label} className={cx(hit, "size-6 cursor-pointer")} {...handlers}>
                    {dot}
                  </Link>
                ) : (
                  <span role="img" tabIndex={0} aria-label={label} className={cx(hit, "size-6")} {...handlers}>
                    {dot}
                  </span>
                )}
              </span>
            );
          })}
          {active ? (
            <div
              aria-hidden
              className={cx(glassClass("thick"), "pointer-events-none absolute z-30 w-max max-w-full px-3 py-1.5 text-caption font-normal text-ink shadow-2")}
              style={{ left: `${active.x}%`, bottom: (active.level + 1) * ROW + 10, transform: inside(active.x) }}
            >
              <span className="iv-num font-semibold">{dayWord(active.days)}</span>{" "}
              <span className="text-ink-2">
                {active.name}
                {active.detail ? `, ${active.detail}` : ""}
              </span>
            </div>
          ) : null}
        </div>
        <div aria-hidden className="relative mt-1 h-[18px] text-caption font-normal text-ink-3">
          {ticks.map((t, i) => (
            <span
              key={t}
              className="iv-num absolute whitespace-nowrap"
              style={{ left: `${(t / axisMax) * 100}%`, transform: `translateX(${i === 0 ? "0" : i === ticks.length - 1 ? "-100%" : "-50%"})` }}
            >
              {i === 0 ? `${t} days` : i === ticks.length - 1 ? `${t}+` : t}
            </span>
          ))}
        </div>
      </div>

      {hasHollow ? (
        <figcaption className="mt-2 flex items-center gap-1.5 text-caption font-normal text-ink-2">
          <span aria-hidden className="block size-2.5 rounded-full border-[1.5px] border-accent bg-white" /> {hollowLabel}
        </figcaption>
      ) : null}

      <details className="mt-3 text-caption font-normal">
        <summary className="w-fit cursor-pointer rounded-sm font-medium text-ink-2 hover:text-ink pointer-coarse:py-3">See the numbers</summary>
        <ul className="mt-2 max-h-64 overflow-auto text-ink">
          {placed.map((d) => (
            <li key={d.key} className="flex items-baseline justify-between gap-3 border-b border-ink/[0.05] py-1 last:border-b-0">
              <span className="min-w-0 break-words">
                {d.name}
                {d.detail ? <span className="text-ink-2">, {d.detail}</span> : null}
                {d.hollow ? <span className="text-ink-2"> (not confirmed)</span> : null}
              </span>
              <span className="iv-num shrink-0">{dayWord(d.days)}</span>
            </li>
          ))}
        </ul>
      </details>
    </figure>
  );
}
