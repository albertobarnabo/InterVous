import type { Phase } from "../../lib/types";
import { cx } from "./cx";
import { phaseLabel, phaseVars } from "./phase";

export type PhasePillProps = { phase: Phase | null | undefined; size?: "sm" | "md"; className?: string };

/** Always a word, never colour alone: an 8px dot plus the label on the phase tint. */
export function PhasePill({ phase, size = "md", className }: PhasePillProps) {
  const p = phase ?? "draft";
  const v = phaseVars(p);
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full whitespace-nowrap",
        size === "md" ? "h-6 px-2.5 text-caption" : "h-5 px-2 text-caption",
        className,
      )}
      style={{ color: v.fg, background: v.bg }}
    >
      <span aria-hidden className="size-2 rounded-full" style={{ background: v.fg }} />
      {phaseLabel(p)}
    </span>
  );
}

export type PhaseDotProps = {
  phase: Phase | null | undefined;
  /** Hollow ring, used for rows with unconfirmed facts. */
  hollow?: boolean;
  size?: number;
  className?: string;
  /** Screen-reader label; defaults to the phase label. Pass "" when a visible label sits next to the dot. */
  label?: string;
};

export function PhaseDot({ phase, hollow, size = 8, className, label }: PhaseDotProps) {
  const p = phase ?? "draft";
  const v = phaseVars(p);
  const name = label ?? phaseLabel(p);
  return (
    <span
      role={name ? "img" : undefined}
      aria-label={name || undefined}
      aria-hidden={name ? undefined : true}
      className={cx("inline-block shrink-0 rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: hollow ? "transparent" : v.fg,
        boxShadow: hollow ? `inset 0 0 0 1.5px ${v.fg}` : undefined,
      }}
    />
  );
}
