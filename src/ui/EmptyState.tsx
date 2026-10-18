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

/** A quiet, centred message on glass ("Nothing to do today."), with an optional icon and one action. */
export function EmptyState({ icon: Icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div className={cx("iv-glass flex flex-col items-center gap-2 rounded-lg px-6 py-12 text-center", className)}>
      {Icon ? (
        <span aria-hidden className="mb-2 flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon size={22} strokeWidth={2} />
        </span>
      ) : null}
      <p className="text-body font-medium text-ink">{title}</p>
      {body ? <p className="max-w-md text-body text-ink-2">{body}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
