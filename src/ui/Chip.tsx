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
  neutral: "bg-surface-2 text-ink-2",
  accent: "bg-accent-soft text-accent",
  caution: "bg-caution-soft text-caution",
  danger: "bg-danger-soft text-danger",
};

/** Filter chip (a toggle button) or a static label chip via <Tag>. */
export function Chip({ selected, tone = "neutral", icon, className, children, type = "button", ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm border px-2.5 text-small font-medium",
        "transition-[background-color,border-color,color] duration-[120ms] ease-out pointer-coarse:min-h-11",
        selected ? "border-accent bg-accent-soft text-accent" : cx("border-transparent hover:border-line-strong", tones[tone]),
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/** A static chip ("Unconfirmed", "Visa"). Pass a title for the explanation. */
export function Tag({
  tone = "neutral",
  className,
  children,
  ...rest
}: { tone?: ChipProps["tone"] } & ComponentProps<"span">) {
  return (
    <span
      className={cx("inline-flex h-6 shrink-0 items-center gap-1 rounded-sm px-2 text-caption whitespace-nowrap", tones[tone], className)}
      {...rest}
    >
      {children}
    </span>
  );
}
