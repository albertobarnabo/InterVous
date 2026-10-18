"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { cx } from "./cx";

export type DotState = "yes" | "waiting" | "no" | "recent" | "unconfirmed";
export type DotItem = { state: DotState; label: string; href?: string };

export type DotStripProps = {
  items: DotItem[];
  /** Show a legend with the count of each state present. */
  legend?: boolean;
  className?: string;
  "aria-label"?: string;
};

export const DOT_STATE_LABEL: Record<DotState, string> = {
  yes: "Replied",
  no: "No reply",
  waiting: "Waiting",
  recent: "Too recent to judge",
  unconfirmed: "Unconfirmed",
};

function dotStyle(state: DotState): string {
  switch (state) {
    case "yes":
      return "bg-accent";
    case "no":
      return "bg-ink-3";
    case "waiting":
      return "bg-transparent ring-[1.5px] ring-inset ring-ink-3";
    case "recent":
      return "bg-transparent border-[1.5px] border-dashed border-ink-3";
    case "unconfirmed":
      return "bg-transparent border-[1.5px] border-dotted border-accent";
  }
}

/**
 * One dot per item, k of n made visible. It deliberately has NO percentage prop:
 * percentages are rendered by InsightSection only when lib/core/stats.mjs allows them.
 * Dots fill one by one (30ms stagger) once, when the strip enters the viewport.
 */
export function DotStrip({ items, legend, className, ...aria }: DotStripProps) {
  const reduce = useReducedMotion();
  const counts = items.reduce<Partial<Record<DotState, number>>>((acc, it) => {
    acc[it.state] = (acc[it.state] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <ul aria-label={aria["aria-label"]} className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => {
          const dot = (
            <motion.span
              aria-hidden
              className={cx("block size-3 rounded-full", dotStyle(it.state))}
              initial={reduce ? false : { opacity: 0, scale: 0.6 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.12, delay: reduce ? 0 : i * 0.03, ease: "easeOut" }}
            />
          );
          const text = `${it.label}: ${DOT_STATE_LABEL[it.state].toLowerCase()}`;
          return (
            <li key={`${it.label}-${i}`} className="flex">
              {it.href ? (
                <Link href={it.href} title={text} aria-label={text} className="-m-1 cursor-pointer rounded-full p-1 hover:bg-ink/[0.06]">
                  {dot}
                </Link>
              ) : (
                <span title={text} role="img" aria-label={text} className="flex">
                  {dot}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {legend ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption font-normal text-ink-2">
          {(Object.keys(DOT_STATE_LABEL) as DotState[])
            .filter((s) => counts[s])
            .map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span aria-hidden className={cx("block size-2.5 rounded-full", dotStyle(s))} />
                {DOT_STATE_LABEL[s]} <span className="iv-num">{counts[s]}</span>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
