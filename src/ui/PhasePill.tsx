import type { Phase } from "../../lib/types";
import { cx } from "./cx";
import { phaseVars, statusLabel } from "./phase";

export type StatusPillProps = {
  /** The status id (lib/core phase). Shown as plain words: "Sent · waiting", "Interview", ... */
  status: Phase | null | undefined;
  size?: "sm" | "md";
  className?: string;
};

/** Always a word, never colour alone: a small dot plus the plain label on the status tint. */
export function StatusPill({ status, size = "md", className }: StatusPillProps) {
  const p = status ?? "draft";
  const v = phaseVars(p);
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "md" ? "h-7 px-3 text-small" : "h-6 px-2.5 text-caption",
        className,
      )}
      style={{ color: v.fg, background: v.bg }}
    >
      <span aria-hidden className="size-2 rounded-full" style={{ background: v.fg }} />
      {statusLabel(p)}
    </span>
  );
}

export type PhasePillProps = { phase: Phase | null | undefined; size?: "sm" | "md"; className?: string };

/** Older name for StatusPill (takes `phase` instead of `status`). Same plain labels. */
export function PhasePill({ phase, ...rest }: PhasePillProps) {
  return <StatusPill status={phase} {...rest} />;
}

export type PhaseDotProps = {
  phase: Phase | null | undefined;
  /** Hollow ring. */
  hollow?: boolean;
  size?: number;
  className?: string;
  /** Screen-reader label; defaults to the status label. Pass "" when a visible label sits next to the dot. */
  label?: string;
};

/** A coloured dot for a status (with an accessible label). */
export function PhaseDot({ phase, hollow, size = 8, className, label }: PhaseDotProps) {
  const p = phase ?? "draft";
  const v = phaseVars(p);
  const name = label ?? statusLabel(p);
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
