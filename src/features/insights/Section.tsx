"use client";
// One insight section (spec 2.4): the question as h2, a one-sentence answer, one visual,
// a "What to do" line and a "How this is counted" disclosure with the formula and n.
// Everything textual comes from lib/core/insights.mjs; this only lays it out.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import type { Display, Rate } from "../../../lib/core";
import { RangeBar, cx } from "@/ui";

type SectionData = { id: string; question: string; answer: string; n: number; display: Display; todo: string; howCounted: string };

/** "n = 6" is part of the core text for most sections; add it where the core sentence leaves it out. */
function withN(text: string, n: number) {
  return /\bn = \d+/.test(text) ? text : `${text} n = ${n}.`;
}

export function HowCounted({ text, n, display, rateBased }: { text: string; n: number; display: Display; rateBased?: boolean }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const id = useId();
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-sm px-1 text-small font-medium text-ink-2 hover:text-ink sm:min-h-8"
      >
        <ChevronRight
          aria-hidden
          size={16}
          strokeWidth={1.75}
          className={cx("transition-transform duration-[120ms] ease-out", open && "rotate-90")}
        />
        How this is counted
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={id}
            key="how"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0.1 : 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-1 max-w-[68ch] rounded-sm bg-surface-2 px-4 py-3 text-small text-ink-2">
              <p>{withN(text, n)}</p>
              {rateBased ? (
                <p className="mt-2">
                  {display === "counts"
                    ? "Under 20, the page shows counts and dots, never a percentage: one reply more or less would swing it by 5 points or more."
                    : display === "range"
                      ? "From 20 to 29, a percentage is shown with its likely range (80% interval)."
                      : "From 30, the percentage leads, always with the count and its likely range."}
                </p>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function InsightSection({
  data,
  children,
  rateBased,
  aside,
}: {
  data: SectionData;
  children?: ReactNode;
  /** The section's main number follows the sample-size rule (adds the rule to the disclosure). */
  rateBased?: boolean;
  /** Extra line under the answer, e.g. a badge. */
  aside?: ReactNode;
}) {
  return (
    <section id={data.id} aria-labelledby={`${data.id}-q`} className="scroll-mt-24 border-t border-line pt-10 pb-2">
      <h2 id={`${data.id}-q`} className="text-h2 text-ink">
        {data.question}
      </h2>
      <p className="mt-3 max-w-[62ch] text-body text-ink">{data.answer}</p>
      {aside ? <div className="mt-2">{aside}</div> : null}
      {children ? <div className="mt-6">{children}</div> : null}
      <p className="mt-6 max-w-[68ch] text-small">
        <span className="font-medium text-ink">What to do: </span>
        <span className="text-ink-2">{data.todo}</span>
      </p>
      <HowCounted text={data.howCounted} n={data.n} display={data.display} rateBased={rateBased} />
    </section>
  );
}

/**
 * The headline number of a rate, exactly as the sample-size rule allows (lib/core/stats.mjs):
 * under 20 "k of n" only; 20–29 "k of n (p%)" plus the likely range; 30+ the percentage leads.
 * Below 20 a Rate carries no percentage at all, so nothing here can show one by accident.
 */
export function RateFigure({ rate, caption }: { rate: Rate; caption?: ReactNode }) {
  if (rate.display === "counts") {
    return (
      <div>
        <p className="text-figure text-ink" aria-label={rate.countText}>
          <span className="iv-num">{rate.k}</span>
          <span className="text-h3 font-normal text-ink-3"> of </span>
          <span className="iv-num">{rate.n}</span>
        </p>
        {caption ? <p className="mt-1 text-small text-ink-2">{caption}</p> : null}
      </div>
    );
  }
  return (
    <div className="max-w-md">
      <p className="iv-num text-figure text-ink">{rate.display === "percent" ? rate.percentText : rate.countText}</p>
      <p className="mt-1 text-small text-ink-2">
        <span className="iv-num">{rate.display === "percent" ? rate.countText : `(${rate.percentText})`}</span>
        {caption ? <> · {caption}</> : null}
      </p>
      <RangeBar className="mt-3" low={rate.low} high={rate.high} point={rate.p} />
      <p className="mt-1 text-caption font-normal text-ink-3">{rate.rangeText[0].toUpperCase() + rate.rangeText.slice(1)}</p>
    </div>
  );
}
