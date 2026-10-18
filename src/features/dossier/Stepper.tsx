"use client";

import { motion, useReducedMotion } from "motion/react";
import { cx } from "@/ui";
import { shortDate } from "./format";
import type { DossierModel } from "./model";
import { Unsure } from "./Unsure";

/**
 * CV built → Sent → First reply → Interviews → Outcome. Each step shows its date, the space
 * between two dated steps shows the day count, and the line fills to the current step in 300ms.
 */
export function Stepper({ model }: { model: DossierModel }) {
  const { stepper, today, uncertain } = model;
  const reduce = useReducedMotion();
  const n = stepper.steps.length;
  const fill = n > 1 ? stepper.currentIndex / (n - 1) : 0;
  const gapAfter = new Map(stepper.gaps.map((g) => [g.from, g.days]));
  const unsureOf: Record<string, boolean> = {
    cv_built: uncertain.has("cv_built_on"),
    sent: uncertain.has("applied_on") || (uncertain.has("phase") && model.derived.sent),
    outcome: uncertain.has("phase"),
  };

  return (
    <div className="relative">
      {/* track and fill, from the centre of the first dot to the centre of the last */}
      <div aria-hidden className="pointer-events-none absolute top-[28px] h-0.5 rounded-full bg-line" style={{ left: `${50 / n}%`, right: `${50 / n}%` }}>
        <motion.div
          className="h-full origin-left rounded-full bg-accent"
          initial={reduce ? { scaleX: fill, opacity: 0 } : { scaleX: 0 }}
          animate={{ scaleX: fill, opacity: 1 }}
          transition={{ duration: reduce ? 0.1 : 0.3, ease: "easeOut" }}
        />
      </div>
    <ol aria-label="Progress" className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {stepper.steps.map((s, i) => {
        const days = gapAfter.get(s.id);
        return (
          <li key={s.id} className="relative flex min-w-0 flex-col items-center text-center" aria-current={s.current ? "step" : undefined}>
            {/* day count between this step and the next */}
            <span className="h-5 w-full" aria-hidden />
            {typeof days === "number" && i < n - 1 ? (
              <span
                className="iv-num absolute top-0 z-[1] whitespace-nowrap text-caption text-ink-3"
                style={{ left: "100%", transform: "translateX(-50%)" }}
              >
                {days === 0 ? "same day" : `${days} ${days === 1 ? "day" : "days"}`}
              </span>
            ) : null}
            <motion.span
              aria-hidden
              className={cx(
                "relative z-[1] mt-0.5 block size-3.5 rounded-full border-2",
                s.reached ? "border-accent bg-accent" : "border-line-strong bg-bg",
                s.current && "ring-4 ring-accent-soft",
              )}
              initial={reduce || !s.reached ? false : { scale: 0.6, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.12, delay: reduce ? 0 : (i / Math.max(1, n - 1)) * 0.3 * (s.reached ? 1 : 0) }}
            />
            <span className={cx("mt-2 px-1 text-caption", s.reached ? "text-ink" : "text-ink-3")}>
              <span className="sr-only">{s.reached ? "Done: " : "Not yet: "}</span>
              {s.label}
            </span>
            <span className="iv-num mt-0.5 min-h-[18px] text-caption text-ink-3">
              {s.date ? (
                <Unsure unsure={!!unsureOf[s.id]} evidence={model.job.status_evidence}>
                  {shortDate(s.date, today)}
                </Unsure>
              ) : s.reached && s.id === "sent" ? (
                "date unknown"
              ) : s.note ? (
                s.note
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
    </div>
  );
}
