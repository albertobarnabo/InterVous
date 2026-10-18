"use client";

import { CloseButton, Popover as HPopover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { Fragment, type ReactElement, type ReactNode } from "react";
import { cx } from "./cx";

export type PopoverProps = {
  /** The trigger element. It must accept a ref and props (Button, IconButton, a plain <button>). */
  trigger: ReactElement;
  /** Panel content, or a render function receiving close(). */
  children: ReactNode | ((close: () => void) => ReactNode);
  anchor?: "bottom start" | "bottom end" | "bottom" | "top start" | "top end" | "top";
  className?: string;
  /** Accessible heading for the panel (rendered visually as the panel title). */
  title?: ReactNode;
};

/** Headless UI Popover, anchored to its trigger. Esc and outside click close it. */
export function Popover({ trigger, children, anchor = "bottom start", className, title }: PopoverProps) {
  return (
    <HPopover>
      <PopoverButton as={Fragment}>{trigger}</PopoverButton>
      <PopoverPanel
        anchor={{ to: anchor, gap: 6, padding: 8 }}
        transition
        focus
        className={cx(
          "z-30 w-[min(20rem,calc(100vw-32px))] rounded-md bg-surface p-4 shadow-2 ring-1 ring-line focus:outline-none",
          "transition duration-[120ms] ease-out data-closed:scale-[0.98] data-closed:opacity-0 motion-reduce:data-closed:scale-100",
          className,
        )}
      >
        {({ close }) => (
          <>
            {title ? <p className="mb-3 text-small font-medium text-ink">{title}</p> : null}
            {typeof children === "function" ? children(close) : children}
          </>
        )}
      </PopoverPanel>
    </HPopover>
  );
}

/** A button inside a Popover/Dialog that closes it. */
export const PopoverClose = CloseButton;
