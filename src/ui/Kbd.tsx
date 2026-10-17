import type { ComponentProps } from "react";
import { cx } from "./cx";

/** Shows a keyboard key, e.g. <Kbd>⌘K</Kbd>. */
export function Kbd({ className, children, ...rest }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cx(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-sm border border-line-strong bg-surface px-1.5",
        "font-mono text-caption text-ink-2 [font-variant-numeric:tabular-nums]",
        className,
      )}
      {...rest}
    >
      {children}
    </kbd>
  );
}
