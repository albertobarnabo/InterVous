"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

/**
 * primary   solid teal capsule, white text: the one main action on a card or page
 * secondary glass capsule, dark text: every other button
 * quiet     text button (a soft tint on hover): Cancel, Change, Show more
 * danger    solid red capsule: only for real deletes
 */
export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium select-none " +
  "transition-[background-color,border-color,color,box-shadow,translate,scale,filter] duration-150 ease-out " +
  "hover:-translate-y-px active:translate-y-0 active:scale-[0.98] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 " +
  "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-small pointer-coarse:min-h-11",
  md: "h-10 px-[18px] text-[15px] pointer-coarse:min-h-11",
  lg: "h-12 px-6 text-body",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(15,23,42,0.12),0_6px_16px_-6px_rgba(26,107,107,0.55)] " +
    "hover:bg-accent-hover hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_2px_4px_rgba(15,23,42,0.12),0_10px_22px_-8px_rgba(26,107,107,0.6)]",
  secondary:
    "bg-white/70 text-ink shadow-[0_0_0_0.5px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.95),0_1px_2px_rgba(15,23,42,0.06),0_4px_12px_-6px_rgba(15,23,42,0.14)] " +
    "hover:bg-white/95",
  quiet: "text-ink-2 hover:bg-ink/[0.06] hover:text-ink",
  danger:
    "bg-danger text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(15,23,42,0.12)] hover:brightness-110",
};

/** Class string for anything that should look like a button (links, Headless UI `as` targets). */
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cx(base, sizes[size], variants[variant], className);
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A lucide-react icon, drawn before the label. */
  icon?: LucideIcon;
  /** Disables the button and marks it busy. The label stays so the layout does not jump. */
  loading?: boolean;
};

export type ButtonProps = CommonProps & ComponentProps<"button">;

const iconSize = (size: ButtonSize) => (size === "lg" ? 18 : 16);

/** A capsule button. `<Button variant="primary">Mark as sent</Button>` */
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
      {Icon ? <Icon aria-hidden size={iconSize(size)} strokeWidth={2} className={cx(loading && "opacity-40")} /> : null}
      <span className={cx(loading && "opacity-70")}>{children}</span>
    </button>
  );
}

export type ButtonLinkProps = CommonProps & Omit<ComponentProps<typeof Link>, "children"> & { children?: ReactNode };

/** A Next `Link` styled as a button, for navigation actions ("Open", "Update"). */
export function ButtonLink({ variant = "secondary", size = "md", icon: Icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {Icon ? <Icon aria-hidden size={iconSize(size)} strokeWidth={2} /> : null}
      <span>{children}</span>
    </Link>
  );
}

export type IconButtonProps = {
  /** Required: becomes the accessible name (aria-label) and the hover title. */
  label: string;
  icon: LucideIcon;
  variant?: "quiet" | "secondary" | "primary";
  size?: ButtonSize;
} & Omit<ComponentProps<"button">, "children" | "aria-label">;

/** A round icon-only button. */
export function IconButton({ label, icon: Icon, variant = "quiet", size = "md", className, type = "button", title, ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={title ?? label}
      className={cx(
        base,
        variants[variant],
        size === "lg" ? "size-12" : size === "md" ? "size-10" : "size-8",
        "px-0 pointer-coarse:size-11",
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden size={size === "sm" ? 16 : 18} strokeWidth={2} />
    </button>
  );
}
