"use client";

import { cloneElement, isValidElement, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { cx } from "./cx";

export type TooltipProps = {
  content: ReactNode;
  /** One focusable element (it gets aria-describedby). */
  children: ReactElement<{ "aria-describedby"?: string }>;
  side?: "top" | "bottom";
  className?: string;
};

/**
 * Hover/focus tooltip for supplementary text (never for essential controls).
 * Shows after 300ms on hover and immediately on keyboard focus; Esc hides it.
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setOpen(false);
  };

  const trigger = isValidElement(children)
    ? cloneElement(children, { "aria-describedby": open ? id : children.props["aria-describedby"] })
    : children;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => show(300)}
      onMouseLeave={hide}
      onFocus={() => show(0)}
      onBlur={hide}
      onKeyDown={(e) => e.key === "Escape" && hide()}
    >
      {trigger}
      <span
        role="tooltip"
        id={id}
        hidden={!open}
        className={cx(
          "pointer-events-none absolute left-1/2 z-30 w-max max-w-72 -translate-x-1/2 rounded-sm bg-ink px-2.5 py-1.5",
          "text-caption font-normal text-bg shadow-2",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
