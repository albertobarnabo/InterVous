"use client";
// I3 How far do they get?  I5 Am I sending what I build?  and the "Older records" block.
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import type { Funnel, I5, InsightsResult } from "../../../lib/core";
import { formatShort } from "../../../lib/core";
import { AgeBar, Tag, WeekBars, cx } from "@/ui";

const href = (ref: string) => `/applications/${encodeURIComponent(ref)}`;

/** Step counts as bars. A step rate is printed only when the sample-size rule allows one. */
export function FunnelBars({ funnel, muted, label }: { funnel: Funnel; muted?: boolean; label: string }) {
  const reduce = useReducedMotion();
  const top = Math.max(1, funnel.steps[0]?.count ?? 0);
  return (
    <figure aria-label={`${label}: ${funnel.line}`}>
      <ol className="flex flex-col gap-2">
        {funnel.steps.map((s, i) => {
          const rate = i > 0 ? funnel.rates[i - 1]?.rate : null;
          return (
            <li key={s.id} className="grid grid-cols-[88px_1fr_auto] items-center gap-3">
              <span className={cx("text-small", muted ? "text-ink-3" : "text-ink-2")}>{s.label}</span>
              <span className="relative h-6 overflow-hidden rounded-sm bg-surface-2">
                <motion.span
                  className={cx("absolute inset-y-0 left-0 rounded-sm", muted ? "bg-line-strong" : "bg-accent")}
                  initial={reduce ? false : { width: 0 }}
                  whileInView={{ width: `${(s.count / top) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : i * 0.06, ease: "easeOut" }}
                  style={reduce ? { width: `${(s.count / top) * 100}%` } : undefined}
                />
              </span>
              <span className={cx("iv-num w-8 text-right text-small", muted ? "text-ink-3" : "text-ink")}>{s.count}</span>
              {rate && rate.display !== "counts" ? (
                <span className="iv-num col-start-2 -mt-1 text-caption font-normal text-ink-3">{rate.text} of the step before</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

export function HowFar({ data }: { data: InsightsResult["i3"] }) {
  return (
    <div className="flex flex-col gap-6">
      <FunnelBars funnel={data} label="This window" />
      {data.older.count ? (
        <div className="rounded-md border border-dashed border-line-strong px-4 py-3">
          <p className="text-small text-ink-2">
            <span className="font-medium text-ink">{data.older.label}</span>, shown separately ({data.older.note}):{" "}
            <span className="iv-num">{data.older.line}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function Sending({ data, today, staleAfter }: { data: I5; today: string; staleAfter: number }) {
  return (
    <div className="flex flex-col gap-6">
      <WeekBars weeks={data.weeks} />
      {data.burst ? (
        <p className="text-small text-ink-2">
          <span className="font-medium text-ink">One-day burst: </span>
          {data.burst.text}.
        </p>
      ) : null}
      {data.drafts.length ? (
        <div>
          <h3 className="text-small font-medium text-ink">
            Waiting to be sent <span className="iv-num font-normal text-ink-3">· {data.draftCount}</span>
          </h3>
          <ul className="mt-2 flex flex-col rounded-md bg-surface shadow-1">
            {data.drafts.map((d) => (
              <li key={d.appId} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-b-0">
                <Link href={href(d.ref)} className="min-w-0 flex-1 basis-56 rounded-sm hover:underline">
                  <span className="block truncate text-small">
                    <span className="font-medium text-ink">{d.company}</span>
                    <span className="text-ink-2"> · {d.role}</span>
                  </span>
                </Link>
                {d.postingGone ? <Tag>Posting gone</Tag> : null}
                <span className="flex w-full items-center gap-3 sm:w-56">
                  <AgeBar days={d.ageDays} max={30} ticks={[staleAfter, 14]} />
                  <span className="iv-num w-24 shrink-0 text-right text-caption text-ink-2">
                    {d.ageDays === null ? "no CV date" : d.ageDays === 0 ? "built today" : `${d.ageDays} days`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-caption font-normal text-ink-3">
            CV age on a 30-day scale; ticks at {staleAfter} and 14 days. {data.builtToday ? `${data.builtToday} built ${formatShort(today)}.` : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function OlderRecords({ older }: { older: InsightsResult["older"] }) {
  if (!older.count) return null;
  return (
    <section id="older" aria-labelledby="older-q" className="scroll-mt-24 border-t border-line pt-10 pb-2">
      <h2 id="older-q" className="text-h3 text-ink">
        {older.label} <span className="font-normal text-ink-3">· {older.note}</span>
      </h2>
      <p className="mt-2 max-w-[62ch] text-small text-ink-2">
        <span className="iv-num">{older.count}</span> {older.count === 1 ? "application is" : "applications are"} dated before the window starts. They
        were not logged the same way, so they never mix with the numbers above.
      </p>
      <div className="mt-5 rounded-md border border-dashed border-line-strong p-4">
        <FunnelBars funnel={older.funnel} muted label={older.label} />
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-small text-ink-2">
          {older.rows.map((r) => (
            <li key={r.appId}>
              <Link href={href(r.ref)} className="hover:underline">
                {r.company}
              </Link>
              {r.appliedOn ? <span className="iv-num text-caption text-ink-3"> · {formatShort(r.appliedOn, { withYear: true })}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
