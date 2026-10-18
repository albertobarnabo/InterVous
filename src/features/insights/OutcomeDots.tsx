"use client";
// One dot per application, k of n made visible (spec 5.1/5.2). Like the DotStrip primitive, but each
// dot keeps its outcome AND whether its facts are unconfirmed: unconfirmed rows are counted and drawn
// hollow in their outcome's colour. There is no percentage prop on purpose.
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { cx } from "@/ui";

export type OutcomeDot = {
  state: "yes" | "no" | "waiting" | "recent";
  unconfirmed?: boolean;
  label: string;
  /** Dossier ref (slug or id). */
  ref?: string | null;
  slug?: string | null;
};

const STATE_TEXT: Record<OutcomeDot["state"], string> = {
  yes: "replied",
  no: "no reply",
  waiting: "waiting",
  recent: "too recent to judge",
};

function dotClass(d: OutcomeDot): string {
  if (d.state === "recent") return "border-[1.5px] border-dashed border-ink-3";
  if (d.state === "waiting") return "bg-line-strong";
  if (d.state === "yes") return d.unconfirmed ? "border-2 border-accent" : "bg-accent";
  return d.unconfirmed ? "border-2 border-ink-3" : "bg-ink-3";
}

const ORDER: Record<OutcomeDot["state"], number> = { yes: 0, no: 1, waiting: 2, recent: 3 };

/** Display order only (counts are untouched): replies first, then confirmed before unconfirmed. */
export function sortDots<T extends OutcomeDot>(dots: T[]): T[] {
  return [...dots].sort((a, b) => ORDER[a.state] - ORDER[b.state] || Number(Boolean(a.unconfirmed)) - Number(Boolean(b.unconfirmed)));
}

export function dotHref(d: { ref?: string | null; slug?: string | null }): string | undefined {
  const r = d.ref ?? d.slug;
  return r ? `/applications/${encodeURIComponent(r)}` : undefined;
}

export function OutcomeDots({
  dots,
  size = 14,
  className,
  label,
}: {
  dots: OutcomeDot[];
  size?: number;
  className?: string;
  label?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <ul aria-label={label} className={cx("flex flex-wrap items-center gap-1.5", className)}>
      {sortDots(dots).map((d, i) => {
        const text = `${d.label}: ${STATE_TEXT[d.state]}${d.unconfirmed ? " (unconfirmed)" : ""}`;
        const href = dotHref(d);
        const dot = (
          <motion.span
            aria-hidden
            className={cx("block rounded-full", dotClass(d))}
            style={{ width: size, height: size }}
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.12, delay: reduce ? 0 : i * 0.03, ease: "easeOut" }}
          />
        );
        return (
          <li key={`${d.label}-${i}`} className="flex">
            {href ? (
              <Link href={href} title={text} aria-label={text} className="-m-1 rounded-full p-1 hover:bg-surface-2">
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
  );
}

/** Legend for the states present, plus the hollow-dot rule when any dot is unconfirmed. */
export function DotLegend({ dots, className }: { dots: OutcomeDot[]; className?: string }) {
  const has = (s: OutcomeDot["state"]) => dots.some((d) => d.state === s);
  const anyHollow = dots.some((d) => d.unconfirmed && (d.state === "yes" || d.state === "no"));
  const item = (cls: string, text: string) => (
    <li className="flex items-center gap-1.5">
      <span aria-hidden className={cx("block size-2.5 rounded-full", cls)} />
      {text}
    </li>
  );
  return (
    <ul className={cx("flex flex-wrap gap-x-4 gap-y-1 text-caption font-normal text-ink-2", className)}>
      {has("yes") ? item("bg-accent", "Replied") : null}
      {has("no") ? item("bg-ink-3", "No reply") : null}
      {has("waiting") ? item("bg-line-strong", "Waiting") : null}
      {has("recent") ? item("border-[1.5px] border-dashed border-ink-3", "Too recent") : null}
      {anyHollow ? item("border-2 border-ink-3", "Hollow: facts unconfirmed") : null}
    </ul>
  );
}
