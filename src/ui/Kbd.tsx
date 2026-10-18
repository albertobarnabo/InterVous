import type { ComponentProps } from "react";
import { cx } from "./cx";

/** Shows a keyboard key, e.g. <Kbd>⌘K</Kbd>. */
export function Kbd({ className, children, ...rest }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cx(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-[7px] bg-white/80 px-1.5 shadow-[0_0_0_0.5px_rgba(15,23,42,0.16),0_1px_0_rgba(15,23,42,0.08)]",
        "text-caption text-ink-2 [font-variant-numeric:tabular-nums]",
        className,
      )}
      {...rest}
    >
      {children}
    </kbd>
  );
}
