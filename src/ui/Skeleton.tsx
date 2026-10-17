import { cx } from "./cx";

/** A static placeholder block (no shimmer: nothing loops or pulses). */
export function Skeleton({ className, lines }: { className?: string; lines?: number }) {
  if (lines && lines > 1) {
    return (
      <div aria-hidden className={cx("flex flex-col gap-2", className)}>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={cx("h-4 rounded-sm bg-surface-2", i === lines - 1 && "w-2/3")} />
        ))}
      </div>
    );
  }
  return <div aria-hidden className={cx("h-4 rounded-sm bg-surface-2", className)} />;
}

/** A list-row-shaped placeholder (64px). */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cx("flex h-16 items-center gap-3 rounded-md bg-surface px-4 shadow-1", className)}>
      <div className="size-8 shrink-0 rounded-sm bg-surface-2" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-3.5 w-1/3 rounded-sm bg-surface-2" />
        <div className="h-3 w-1/4 rounded-sm bg-surface-2" />
      </div>
    </div>
  );
}
