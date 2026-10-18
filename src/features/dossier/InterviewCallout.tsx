"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { METRIC_STATUS_LABELS } from "../../../lib/core";
import { Callout, Tag, cx } from "@/ui";
import { shortDate } from "./format";
import type { DossierModel } from "./model";

/**
 * The amber "Before the interview, check" callout (spec 2.3), from beforeInterviewChecks().
 * Shown open when the phase is interviewing or an interview is within 7 days. For an open, sent
 * application with the same checks but no interview yet it stays as one collapsed line, so the
 * claims are not a surprise when the invite comes.
 */
export function InterviewCallout({ model }: { model: DossierModel }) {
  const { checks, checksLater, today } = model;
  const [open, setOpen] = useState(false);
  if (!checks.show && !checksLater) return null;
  const count = checks.cautions.length + checks.proofPoints.length;
  const expanded = checks.show || open;
  const when = checks.interviewOn ? ` (interview ${shortDate(checks.interviewOn, today)})` : "";

  const title = checks.show ? (
    <>Before the interview, check{when}</>
  ) : (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      className="-my-1 flex items-center gap-1.5 rounded-sm py-1 text-left font-semibold"
    >
      Before any interview, check {count} {count === 1 ? "claim" : "claims"}
      <ChevronDown aria-hidden size={16} className={cx("transition-transform duration-[120ms]", open && "rotate-180")} />
    </button>
  );

  return (
    <Callout tone="caution" title={title}>
      {expanded ? (
        <ul className="mt-1 flex flex-col gap-3">
          {checks.cautions.map((c, i) => (
            <li key={`c${i}`} className="max-w-[68ch]">
              <p className="text-small text-ink">{c.evidence ?? c.requirement}</p>
              {c.evidence ? <p className="mt-0.5 text-caption font-normal text-ink-2">{c.requirement}</p> : null}
            </li>
          ))}
          {checks.proofPoints.map((p) => (
            <li key={p.key} className="max-w-[68ch]">
              <p className="flex flex-wrap items-center gap-2 text-small text-ink">
                <Link href={`/proof-points#${encodeURIComponent(p.key)}`} className="font-medium underline-offset-2 hover:underline">
                  {p.name}
                </Link>
                <Tag tone="caution">{METRIC_STATUS_LABELS[p.metricStatus] ?? p.metricStatus}</Tag>
              </p>
              {p.detail ? (
                <p className="mt-0.5 text-small text-ink-2">
                  This application says: <q className="text-ink">{p.detail}</q>
                </p>
              ) : null}
              {p.caveat ? <p className="mt-0.5 text-small text-ink-2">{p.caveat}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-small text-ink-2">
          {[...checks.cautions.map((c) => c.requirement), ...checks.proofPoints.map((p) => p.name)].join(" · ")}
        </p>
      )}
    </Callout>
  );
}
