import type { ReactNode } from "react";
import { cx } from "./cx";

export type PageHeaderProps = {
  /** The page title (h1). */
  title: ReactNode;
  /** One plain sentence under the title. */
  description?: ReactNode;
  /** Buttons on the right (wrap under the title on phones). */
  actions?: ReactNode;
  className?: string;
};

/** The top of a page: h1, one plain sentence, and the page's buttons. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cx("flex flex-col gap-4 pt-8 pb-6 sm:flex-row sm:items-end sm:justify-between sm:pt-10", className)}>
      <div className="min-w-0">
        <h1 className="text-h1-sm text-ink sm:text-h1">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-body text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export type SectionProps = {
  /** Section heading, e.g. "Do this now". */
  title: ReactNode;
  /** One plain sentence under the heading. */
  description?: ReactNode;
  /** One button or link on the right of the heading. */
  action?: ReactNode;
  /** Heading level: 2 (default) or 3. */
  level?: 2 | 3;
  id?: string;
  className?: string;
  children?: ReactNode;
};

/** A titled block of a page. The heading names the section in plain words. */
export function Section({ title, description, action, level = 2, id, className, children }: SectionProps) {
  const headingId = id ? `${id}-title` : undefined;
  const H = level === 2 ? "h2" : "h3";
  return (
    <section id={id} aria-labelledby={headingId} className={cx("flex flex-col gap-4", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <H id={headingId} className={cx("text-ink", level === 2 ? "text-h3" : "text-body font-semibold")}>
            {title}
          </H>
          {description ? <p className="mt-1 text-small text-ink-2">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export type StepsProps = {
  /** The steps in order, each a short phrase ("Add a job", "Mark it as sent"). */
  items: ReactNode[];
  className?: string;
  "aria-label"?: string;
};

/** Numbered steps in a row (stacked on phones): 1 Add a job · 2 Mark it as sent · 3 Tell InterVous what happened. */
export function Steps({ items, className, ...aria }: StepsProps) {
  return (
    <ol aria-label={aria["aria-label"]} className={cx("flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6", className)}>
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-3 text-body text-ink">
          <span
            aria-hidden
            className="iv-num flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-small font-semibold text-accent"
          >
            {i + 1}
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ol>
  );
}
