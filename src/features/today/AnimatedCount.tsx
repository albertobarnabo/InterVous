"use client";
// A number that tweens when it changes (Today's "Needs you (n)" counter, spec 3.7).
import { animate, useMotionValue, useReducedMotion, useTransform, motion } from "motion/react";
import { useEffect } from "react";
import { cx } from "@/ui";

export function AnimatedCount({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => String(Math.round(v)));

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.22, ease: "easeOut" });
    return () => controls.stop();
  }, [value, reduce, mv]);

  return (
    <>
      <motion.span aria-hidden className={cx("iv-num", className)}>
        {text}
      </motion.span>
      <span className="sr-only">{value}</span>
    </>
  );
}
