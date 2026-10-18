"use client";
// The light glass surfaces of the application page, /companies and /settings.
//   glass  translucent white over the page backdrop (cards, the summary)
//   solid  near-opaque white for long text (job description, notes, answers)
// Both fall back to opaque white without backdrop-filter or with reduced transparency.
import type { ComponentProps, ElementType, ReactNode } from "react";
import { cx, phaseVars } from "@/ui";
import type { Phase } from "../../../lib/types";
import { statusLabel } from "./status";

// The material itself (.iv-glass, .iv-glass-solid in src/app/globals.css) carries the blur, the
// border, the edge highlight and the opaque fallbacks; these add the radius.
export const glassClass = "iv-glass rounded-[20px]";
export const solidClass = "iv-glass-solid rounded-[16px]";

type CardProps<T extends ElementType> = { as?: T; tone?: "glass" | "solid"; className?: string; children?: ReactNode } & Omit<
  ComponentProps<T>,
  "as" | "className" | "children"
>;

/** A glass (or solid) card. Padding is the caller's. */
export function Card<T extends ElementType = "div">({ as, tone = "glass", className, children, ...rest }: CardProps<T>) {
  const El = (as ?? "div") as ElementType;
  return (
    <El className={cx(tone === "glass" ? glassClass : solidClass, className)} {...rest}>
      {children}
    </El>
  );
}

/** A titled glass section: 20px title, optional plain one-line description and a right-hand action. */
export function Section({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const titleId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={titleId} className={cx(glassClass, "scroll-mt-24 p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={titleId} className="text-[20px] leading-7 font-semibold text-ink">
            {title}
          </h2>
          {description ? <p className="mt-1 text-[15px] leading-6 text-ink-2">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

/** Where an application stands, in plain words, on the status tint. Never colour alone. */
export function StatusPill({ phase, className }: { phase: Phase | string | null | undefined; className?: string }) {
  const v = phaseVars(phase ?? "draft");
  return (
    <span
      className={cx("inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[14px] leading-none font-medium whitespace-nowrap", className)}
      style={{ color: v.fg, background: v.bg }}
    >
      <span aria-hidden className="size-2 rounded-full" style={{ background: v.fg }} />
      {statusLabel(phase)}
    </span>
  );
}
