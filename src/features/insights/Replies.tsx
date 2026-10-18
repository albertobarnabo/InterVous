"use client";
// I1 Who owes you a reply?  I2 Do applications get answers?  I4 How long until they reply?
// I8 Where are you aiming?  Visuals only: every number is a field of computeInsights().
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { I1, I1Row, I2, I4, I8, UserSettings } from "../../../lib/core";
import { AgeBar, Button, Callout, RangeBar, SegmentedControl, Tag, cx } from "@/ui";
import { OutcomeDots, DotLegend, dotHref, type OutcomeDot } from "./OutcomeDots";
import { RateFigure } from "./Section";

const href = (ref: string) => `/applications/${encodeURIComponent(ref)}`;

// ── I1 ─────────────────────────────────────────────────────────────────────

export function OwedList({
  data,
  hidden,
  onFollowedUp,
  onNoReply,
}: {
  data: I1;
  hidden: ReadonlySet<string>;
  onFollowedUp: (r: I1Row) => void;
  onNoReply: (r: I1Row) => void;
}) {
  const reduce = useReducedMotion();
  const buckets = data.buckets.filter((b) => b.rows.length);
  if (!buckets.length && !data.undated.length) return null;
  return (
    <div className="flex flex-col gap-6">
      {buckets.map((b) => (
        <div key={b.id}>
          <h3 className="flex items-baseline gap-2 text-small font-medium text-ink">
            {b.label}
            <span className="iv-num text-caption font-normal text-ink-3">
              {b.range} · {b.rows.length}
            </span>
          </h3>
          <ul className="mt-2 flex flex-col rounded-md bg-surface shadow-1">
            {b.rows.map((r) => {
              const gone = hidden.has(`i1:${r.appId}`);
              return (
                <motion.li
                  key={r.appId}
                  initial={false}
                  animate={gone ? { opacity: 0.4 } : { opacity: 1 }}
                  transition={{ duration: reduce ? 0.1 : 0.12 }}
                  className="grid gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_auto]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Link href={href(r.ref)} className="relative min-w-0 flex-1 truncate rounded-sm text-small hover:underline">
                      <span className="font-medium text-ink">{r.company}</span>
                      <span className="text-ink-2"> · {r.role}</span>
                    </Link>
                    {r.unconfirmed ? (
                      <Tag tone={r.statusUnconfirmed ? "caution" : "neutral"} title="Some facts of this application are not confirmed">
                        {r.statusUnconfirmed ? "Sent? unconfirmed" : "Unconfirmed"}
                      </Tag>
                    ) : null}
                  </span>
                  <span className="row-start-2 flex min-w-0 items-center gap-3 sm:col-start-1">
                    <AgeBar days={r.days} className="max-w-64" />
                    <span className="iv-num w-16 shrink-0 text-caption text-ink-2">{r.days} days</span>
                  </span>
                  <span className="flex flex-wrap gap-2 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:items-center">
                    {gone ? (
                      <span className="text-caption font-normal text-ink-3">Marked</span>
                    ) : (
                      r.actions.map((a) => (
                        <Button
                          key={a.id}
                          size="sm"
                          variant="secondary"
                          onClick={() => (a.id === "mark_no_reply" ? onNoReply(r) : onFollowedUp(r))}
                        >
                          {a.label}
                        </Button>
                      ))
                    )}
                  </span>
                </motion.li>
              );
            })}
          </ul>
        </div>
      ))}
      {data.undated.length ? (
        <div>
          <h3 className="text-small font-medium text-ink">No sent date</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {data.undated.map((r) => (
              <li key={r.appId} className="flex flex-wrap items-center gap-2 text-small">
                <Link href={href(r.ref)} className="min-w-0 truncate hover:underline">
                  <span className="font-medium text-ink">{r.company}</span>
                  <span className="text-ink-2"> · {r.role}</span>
                </Link>
                {r.unconfirmed ? <Tag tone="caution">Unconfirmed</Tag> : null}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-caption font-normal text-ink-3">Listed by name, never counted in a rate.</p>
        </div>
      ) : null}
    </div>
  );
}

// ── I2 ─────────────────────────────────────────────────────────────────────

export function AnswersFigure({ data }: { data: I2 }) {
  const dots: OutcomeDot[] = data.dots.map((d) => ({ state: d.state === "yes" ? "yes" : "no", unconfirmed: d.unconfirmed, label: d.label, slug: d.slug, ref: d.ref ?? null }));
  const recent: OutcomeDot[] = data.recent.map((d) => ({ state: "recent", label: d.company, ref: d.ref, slug: d.slug }));
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <RateFigure rate={data.rate} caption="old enough to judge got a reply" />
        {dots.length ? <OutcomeDots dots={dots} size={16} label="Old enough to judge" className="pb-2" /> : null}
      </div>
      {recent.length ? (
        <div className="flex flex-wrap items-center gap-3 text-small text-ink-2">
          <OutcomeDots dots={recent} size={12} label="Too recent to judge" />
          <span>
            <span className="iv-num">{data.tooRecent}</span> too recent to judge
          </span>
        </div>
      ) : null}
      <DotLegend dots={[...dots, ...recent]} />
      {data.undated.length ? (
        <p className="text-caption font-normal text-ink-3">
          Left out, no sent date: {data.undated.map((u) => u.company).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}

// ── I4 ─────────────────────────────────────────────────────────────────────

export function ReplyAxis({
  data,
  settings,
  onApply,
}: {
  data: I4;
  settings: Pick<UserSettings, "follow_up_after_days" | "mature_after_days" | "no_reply_after_days">;
  onApply: (s: NonNullable<I4["suggestion"]>) => void;
}) {
  const max = data.axisMax;
  const reduce = useReducedMotion();
  const pos = (d: number) => `${(Math.min(d, max) / max) * 100}%`;
  const ticks = [
    { d: settings.follow_up_after_days, label: "follow up" },
    { d: settings.mature_after_days, label: "judge" },
    { d: settings.no_reply_after_days, label: "no reply" },
  ];
  // stack labels that would collide (within ~7 days of each other)
  const sorted = [...data.dots].filter((d) => d.days !== null).sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
  const rows: number[] = [];
  const lastInRow: number[] = [];
  for (const d of sorted) {
    let row = 0;
    while (lastInRow[row] !== undefined && (d.days ?? 0) - lastInRow[row] < 7) row++;
    lastInRow[row] = d.days ?? 0;
    rows.push(Math.min(row, 2));
  }
  const axisY = 30 + 20 * Math.max(0, ...rows);
  const height = axisY + 14;
  return (
    <div className="flex flex-col gap-5">
      <figure className="w-full">
        <div className="relative mx-2" style={{ height }}>
          {/* axis */}
          <div aria-hidden className="absolute inset-x-0 h-px bg-line-strong" style={{ top: axisY }} />
          {ticks.map((t) => (
            <div key={t.label} aria-hidden className="absolute h-3 w-px -translate-y-1/2 bg-line-strong" style={{ left: pos(t.d), top: axisY }} />
          ))}
          {data.median.allowed && data.median.value !== undefined ? (
            <div aria-hidden className="absolute h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-accent" style={{ left: pos(data.median.value), top: axisY }} />
          ) : null}
          {sorted.map((d, i) => {
            const x = Math.min(d.days ?? 0, max) / max;
            const align = x < 0.15 ? "left-0" : x > 0.85 ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <motion.div
                key={d.appId}
                className="absolute"
                style={{ left: pos(d.days ?? 0), top: axisY }}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: reduce ? 0.1 : 0.16, delay: reduce ? 0 : i * 0.03 }}
              >
                <Link
                  href={dotHref(d) ?? "#"}
                  aria-label={`${d.company}: replied after ${d.days} days${d.unconfirmed ? " (unconfirmed)" : ""}`}
                  className="group"
                >
                  <span
                    className={cx(
                      "absolute block size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
                      d.unconfirmed ? "border-2 border-accent bg-surface" : "bg-accent",
                    )}
                  />
                  <span
                    className={cx("iv-num absolute text-caption whitespace-nowrap text-ink-2 group-hover:text-ink group-hover:underline", align)}
                    style={{ bottom: 12 + rows[i] * 20 }}
                  >
                    {d.company} · {d.days} d
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
        <div aria-hidden className="relative mx-2 h-[18px] text-caption font-normal text-ink-3">
          <span className="iv-num absolute left-0 -translate-x-1/2">0</span>
          {ticks.map((t) => (
            <span key={t.label} className="iv-num absolute -translate-x-1/2" style={{ left: pos(t.d) }}>
              {t.d}
            </span>
          ))}
          <span className="iv-num absolute right-0 translate-x-1/2">{max}</span>
        </div>
        <figcaption className="mt-2 text-caption font-normal text-ink-3">
          Days from sending to the first reply. Lines at {settings.follow_up_after_days} (follow up), {settings.mature_after_days} (old enough to
          judge) and {settings.no_reply_after_days} (likely closed).
          {data.median.allowed && data.median.value !== undefined ? ` The teal bar is the median.` : ""}
        </figcaption>
      </figure>
      {data.unknownDates ? (
        <p className="text-caption font-normal text-ink-3">
          <span className="iv-num">{data.unknownDates}</span> more replied, date unknown.
        </p>
      ) : null}
      {data.suggestion ? (
        <Callout
          tone="info"
          title="Your thresholds can learn from these replies"
          action={
            <Button size="sm" variant="primary" onClick={() => onApply(data.suggestion!)}>
              Use {data.suggestion.no_reply_after_days} and {data.suggestion.follow_up_after_days} days
            </Button>
          }
        >
          No-reply line at <span className="iv-num">{data.suggestion.no_reply_after_days}</span> days (twice the median), follow up after about{" "}
          <span className="iv-num">{data.suggestion.follow_up_after_days}</span> (three quarters of replies came by then).
        </Callout>
      ) : null}
    </div>
  );
}

// ── I8 ─────────────────────────────────────────────────────────────────────

export function AimingGroups({ data }: { data: I8 }) {
  const [dim, setDim] = useState<I8["dimensions"][number]["id"]>(data.dimensions[0]?.id ?? "visa_needed");
  const current = data.dimensions.find((d) => d.id === dim) ?? data.dimensions[0];
  if (!current) return null;
  const intervals = new Map(current.comparison.groups.map((g) => [g.key, g.interval]));
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        aria-label="Split by"
        value={current.id}
        onChange={setDim}
        options={data.dimensions.map((d) => ({ value: d.id, label: d.label }))}
      />
      {current.groups.length ? (
        <ul className="flex flex-col rounded-md bg-surface shadow-1">
          {current.groups.map((g) => {
            const iv = intervals.get(g.key);
            return (
              <li key={g.key} className="grid gap-2 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[180px_1fr_auto] sm:items-center sm:gap-4">
                <span className="text-small font-medium text-ink">{g.label}</span>
                <span className="min-w-0">
                  <OutcomeDots
                    size={14}
                    label={`${g.label}: ${g.rate.text}`}
                    dots={g.dots.map((d) => ({ state: d.state === "yes" ? "yes" : "no", unconfirmed: d.unconfirmed, label: d.label, slug: d.slug, ref: d.ref ?? null }))}
                  />
                  {iv ? <RangeBar className="mt-2 max-w-xs" low={iv.low} high={iv.high} point={iv.k / iv.n} showLabels={false} /> : null}
                </span>
                <span className="iv-num text-small text-ink-2 sm:text-right">{g.rate.text}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-small text-ink-2">Nothing old enough to judge yet.</p>
      )}
      <p className="text-small text-ink-2">{current.comparison.line}</p>
      <p className="flex items-center gap-1 text-small text-ink-2">
        <ArrowRight aria-hidden size={14} className="text-ink-3" />
        {data.visa.line}
      </p>
    </div>
  );
}
