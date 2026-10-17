"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";

export type SegmentedOption<V extends string = string> = { value: V; label: ReactNode };

export type SegmentedControlProps<V extends string = string> = {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  "aria-label": string;
  size?: "sm" | "md";
  className?: string;
};

/** A radio group drawn as joined buttons (List | Board, Since 1 Aug | All). */
export function SegmentedControl<V extends string = string>({
  options,
  value,
  onChange,
  size = "md",
  className,
  ...aria
}: SegmentedControlProps<V>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: KeyboardEvent) => {
    const i = options.findIndex((o) => o.value === value);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % options.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + options.length) % options.length;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={aria["aria-label"]}
      onKeyDown={onKey}
      className={cx("inline-flex max-w-full overflow-x-auto rounded-sm bg-surface-2 p-0.5", className)}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cx(
              "shrink-0 rounded-sm px-3 text-small font-medium transition-[background-color,color,box-shadow] duration-[120ms] ease-out",
              size === "md" ? "h-8" : "h-7",
              "pointer-coarse:min-h-11",
              on ? "bg-surface text-ink shadow-1" : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
