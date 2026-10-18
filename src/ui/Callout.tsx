import { Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

export type CalloutProps = {
  tone?: "caution" | "info" | "danger";
  title?: ReactNode;
  children: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
};

const tones = {
  caution: "bg-caution-soft text-caution",
  info: "bg-accent-soft text-accent",
  danger: "bg-danger-soft text-danger",
};

/** A tinted box, e.g. the amber "Before the interview, check". Body text stays in ink for reading. */
export function Callout({ tone = "caution", title, children, icon, action, className }: CalloutProps) {
  const Icon = icon ?? (tone === "info" ? Info : TriangleAlert);
  return (
    <div role="note" className={cx("flex gap-3 rounded-md p-4", tones[tone], className)}>
      <Icon aria-hidden size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title ? <p className="text-small font-semibold">{title}</p> : null}
        <div className={cx("text-small text-ink", title ? "mt-1" : null)}>{children}</div>
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
