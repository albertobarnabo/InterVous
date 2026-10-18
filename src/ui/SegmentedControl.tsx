"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";

export type SegmentedOption<V extends string = string> = {
  value: V;
  label: ReactNode;
  /** A count shown after the label ("Waiting 10"). */
  count?: number;
};

export type SegmentedControlProps<V extends string = string> = {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  "aria-label": string;
  size?: "sm" | "md";
  /** Stretch to the container width, segments sharing it equally. */
  fullWidth?: boolean;
  className?: string;
};

type Thumb = { x: number; y: number; w: number; h: number };

/**
 * Apple-style segmented control: a pale capsule track with a white thumb that slides to the
 * chosen segment. A radio group (arrow keys move). Scrolls sideways if it does not fit.
 *   <SegmentedControl aria-label="Show" value={f} onChange={setF}
 *     options={[{ value: "all", label: "All", count: 23 }, { value: "waiting", label: "Waiting", count: 10 }]} />
 * The thumb is measured inside the track, so it never flies around when the page above it shifts.
 */
export function SegmentedControl<V extends string = string>({
  options,
  value,
  onChange,
  size = "md",
  fullWidth,
  className,
  ...aria
}: SegmentedControlProps<V>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const [thumb, setThumb] = useState<Thumb | null>(null);
  const [animate, setAnimate] = useState(false);
  const index = options.findIndex((o) => o.value === value);
  const shape = options.map((o) => o.value).join("\u0000");

  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current[index];
      setThumb(el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    refs.current.forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, [index, shape]);

  // Slide only after the first placement (no animation on load).
  useEffect(() => {
    if (!thumb || animate) return;
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [thumb, animate]);

  const onKey = (e: KeyboardEvent) => {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % options.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
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
      className={cx(
        "relative max-w-full overflow-x-auto rounded-full bg-[rgba(15,23,42,0.06)] p-1 shadow-[inset_0_0.5px_1px_rgba(15,23,42,0.08)]",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        fullWidth ? "flex w-full" : "inline-flex",
        className,
      )}
    >
      {thumb ? (
        <span
          aria-hidden
          className={cx(
            "pointer-events-none absolute top-0 left-0 rounded-full bg-white shadow-[0_0_0_0.5px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.12)]",
            animate && "transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          )}
          style={{ width: thumb.w, height: thumb.h, transform: `translate(${thumb.x}px, ${thumb.y}px)` }}
        />
      ) : null}
      {options.map((o, i) => {
        const on = i === index;
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
              "relative flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 font-medium whitespace-nowrap",
              "transition-colors duration-150 ease-out focus-visible:outline-offset-0",
              size === "md" ? "h-9 text-small" : "h-8 px-3 text-small",
              "pointer-coarse:min-h-10",
              fullWidth && "flex-1",
              on ? "text-ink" : "text-ink-2 hover:text-ink",
              // Before the thumb is measured (server render), the chosen segment paints its own white.
              on && !thumb && "bg-white shadow-[0_0_0_0.5px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.12)]",
            )}
          >
            <span>{o.label}</span>
            {typeof o.count === "number" ? (
              <span className={cx("iv-num text-caption", on ? "text-ink-2" : "text-ink-3")}>{o.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
