"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "sm" | "md";

const base =
  "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium select-none " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-[120ms] ease-out " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const sizes: Record<ButtonSize, string> = {
  md: "h-9 px-3.5 text-small pointer-coarse:min-h-11",
  sm: "h-8 px-2.5 text-small pointer-coarse:min-h-11",
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-[color-mix(in_srgb,var(--accent)_86%,var(--ink))]",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
  quiet: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger text-bg hover:bg-[color-mix(in_srgb,var(--danger)_86%,var(--ink))]",
};

/** Class string for anything that should look like a button (links, Headless UI `as` targets). */
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cx(base, sizes[size], variants[variant], className);
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A lucide-react icon, drawn before the label at 16px. */
  icon?: LucideIcon;
  /** Disables the button and marks it busy. The label stays so the layout does not jump. */
  loading?: boolean;
};

export type ButtonProps = CommonProps & ComponentProps<"button">;

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, cx(loading && "cursor-wait", className))}
      {...rest}
    >
      {Icon ? <Icon aria-hidden size={16} strokeWidth={1.75} className={cx(loading && "opacity-40")} /> : null}
      <span className={cx(loading && "opacity-70")}>{children}</span>
    </button>
  );
}

export type ButtonLinkProps = CommonProps & Omit<ComponentProps<typeof Link>, "children"> & { children?: ReactNode };

/** A Next `Link` styled as a button, for navigation actions ("Open", "Review"). */
export function ButtonLink({ variant = "secondary", size = "md", icon: Icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {Icon ? <Icon aria-hidden size={16} strokeWidth={1.75} /> : null}
      <span>{children}</span>
    </Link>
  );
}

export type IconButtonProps = {
  /** Required: becomes the accessible name (aria-label). */
  label: string;
  icon: LucideIcon;
  variant?: "quiet" | "secondary";
  size?: ButtonSize;
} & Omit<ComponentProps<"button">, "children" | "aria-label">;

export function IconButton({ label, icon: Icon, variant = "quiet", size = "md", className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cx(
        base,
        variants[variant],
        size === "md" ? "size-9" : "size-8",
        "pointer-coarse:size-11",
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden size={size === "md" ? 18 : 16} strokeWidth={1.75} />
    </button>
  );
}
