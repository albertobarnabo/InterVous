"use client";

import type { ReactNode } from "react";
import { Tooltip, cx } from "@/ui";

/**
 * A fact the history is unsure about: dotted underline, and a tooltip with `status_evidence`
 * (where the value came from). Renders the children unchanged when `unsure` is false.
 */
export function Unsure({
  unsure,
  evidence,
  children,
  className,
}: {
  unsure: boolean;
  evidence?: string | null;
  children: ReactNode;
  className?: string;
}) {
  if (!unsure) return <>{children}</>;
  return (
    <Tooltip
      content={
        <>
          <span className="font-medium">Not confirmed.</span> {evidence ? evidence : "No evidence recorded for this value."}
        </>
      }
    >
      <span
        tabIndex={0}
        className={cx(
          "cursor-help rounded-[2px] underline decoration-ink-3 decoration-dotted decoration-[1.5px] underline-offset-[5px]",
          className,
        )}
      >
        {children}
      </span>
    </Tooltip>
  );
}
