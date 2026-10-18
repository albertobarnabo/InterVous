"use client";

import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

export type ChipProps = {
  /** When set, the chip is a toggle (aria-pressed). */
  selected?: boolean;
  tone?: "neutral" | "accent" | "caution" | "danger";
  icon?: ReactNode;
} & ComponentProps<"button">;

const tones = {
  neutral: "bg-white/70 text-ink-2 shadow-[0_0_0_0.5px_rgba(15,23,42,0.12)]",
  accent: "bg-accent-soft text-accent",
  caution: "bg-caution-soft text-caution",
  danger: "bg-danger-soft text-danger",
};

/** A capsule toggle (filter, tag picker). For a static label use <Tag>. */
export function Chip({ selected, tone = "neutral", icon, className, children, type = "button", ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(
        "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-small font-medium",
        "transition-[background-color,box-shadow,color] duration-150 ease-out pointer-coarse:min-h-10",
        selected
          ? "bg-accent text-accent-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
          : cx("hover:bg-white hover:text-ink", tones[tone]),
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/** A static capsule label. Pass a title for the explanation. */
export function Tag({
  tone = "neutral",
  className,
  children,
  ...rest
}: { tone?: ChipProps["tone"] } & ComponentProps<"span">) {
  return (
    <span
      className={cx("inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-caption whitespace-nowrap", tones[tone], className)}
      {...rest}
    >
      {children}
    </span>
  );
}
