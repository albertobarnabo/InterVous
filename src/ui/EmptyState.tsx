import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** A quiet, centred message ("Nothing needs you. Last sent 6 days ago."). No illustration. */
export function EmptyState({ icon: Icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div className={cx("flex flex-col items-center gap-2 rounded-md border border-dashed border-line-strong px-6 py-12 text-center", className)}>
      {Icon ? <Icon aria-hidden size={24} strokeWidth={1.5} className="mb-1 text-ink-3" /> : null}
      <p className="text-body font-medium text-ink">{title}</p>
      {body ? <p className="max-w-md text-small text-ink-2">{body}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
