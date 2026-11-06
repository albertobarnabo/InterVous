"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button, ButtonLink, type ButtonVariant } from "./Button";
import { CompanyMark } from "./CompanyMark";
import { cx } from "./cx";
import { glassClass } from "./GlassCard";

const tileLift =
  "group cursor-pointer transition-[translate,box-shadow,background-color] duration-150 ease-out hover:-translate-y-px hover:bg-white/70 " +
  "hover:shadow-[0_0_0_0.5px_rgba(15,23,42,0.1),0_1px_0_rgba(255,255,255,0.9)_inset,0_14px_36px_rgba(15,23,42,0.12)] " +
  "active:translate-y-0 motion-reduce:hover:translate-y-0";

export type StatTileProps = {
  /** The big number. */
  value: number | string;
  /** Plain label under it: "Waiting for a reply", "Interviews", "Not sent yet", "Closed". */
  label: ReactNode;
  /** Where a click goes (the filtered list). Without href or onClick the tile is static. */
  href?: string;
  onClick?: () => void;
  /** A CSS colour for the small dot before the label (e.g. phaseVars("applied").fg). */
  color?: string;
  /** Pressed state, when tiles act as a filter. */
  selected?: boolean;
  className?: string;
};

/** A glass tile with a big number and a plain label, clickable to the list it counts. */
export function StatTile({ value, label, href, onClick, color, selected, className }: StatTileProps) {
  const clickable = Boolean(href || onClick);
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="iv-num block text-figure text-ink">{value}</span>
        {clickable ? (
          <ChevronRight
            aria-hidden
            size={18}
            strokeWidth={2}
            className="mt-1 shrink-0 text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5"
          />
        ) : null}
      </span>
      <span className="mt-1 flex items-baseline gap-2 text-small font-medium text-ink-2">
        {color ? <span aria-hidden className="size-2 shrink-0 translate-y-[-1px] rounded-full" style={{ background: color }} /> : null}
        <span className="min-w-0 break-words">{label}</span>
      </span>
    </>
  );
  const cls = cx(
    glassClass("glass"),
    "block p-4 text-left sm:p-5",
    clickable && tileLift,
    selected && "ring-2 ring-accent",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={selected} className={cx(cls, "w-full")}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

export type ActionCardAction = {
  label: string;
  onClick?: () => void;
  /** Renders the button as a link instead. */
  href?: string;
  icon?: LucideIcon;
  loading?: boolean;
  /** Default primary. */
  variant?: ButtonVariant;
};

export type ActionCardProps = {
  /** One plain sentence: what to do and why. "European Central Bank hasn't replied in 16 days. A short follow-up can help." */
  text: ReactNode;
  /** Optional second line in secondary text (a date, the role). */
  detail?: ReactNode;
  /** Exactly one button. */
  action: ActionCardAction;
  /** Shows the company logo (or initials) on the left. */
  company?: { name: string; logoUrl?: string | null };
  /** An icon on the left when there is no company. */
  icon?: LucideIcon;
  className?: string;
};

/** A "Do this now" card: a logo or icon, one sentence, one button. On phones the button sits under the sentence. */
export function ActionCard({ text, detail, action, company, icon: Icon, className }: ActionCardProps) {
  const variant = action.variant ?? "primary";
  const button = action.href ? (
    <ButtonLink href={action.href} variant={variant} icon={action.icon}>
      {action.label}
    </ButtonLink>
  ) : (
    <Button variant={variant} icon={action.icon} loading={action.loading} onClick={action.onClick}>
      {action.label}
    </Button>
  );
  const lead = company ? (
    <CompanyMark name={company.name} logoUrl={company.logoUrl} size={44} />
  ) : Icon ? (
    <span aria-hidden className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent">
      <Icon size={20} strokeWidth={2} />
    </span>
  ) : null;
  return (
    <div
      className={cx(
        glassClass("glass"),
        "grid items-center gap-x-4 gap-y-3 p-4 sm:p-5",
        lead ? "grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1fr)_auto]" : "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto]",
        className,
      )}
    >
      {lead}
      <div className="min-w-0">
        <p className="text-body font-medium text-ink">{text}</p>
        {detail ? <p className="mt-0.5 text-small text-ink-2">{detail}</p> : null}
      </div>
      <div className={cx("justify-self-start sm:justify-self-end", lead && "col-start-2 sm:col-start-3")}>{button}</div>
    </div>
  );
}
