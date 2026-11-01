"use client";
// "Your search in numbers" on /home. Every number and sentence comes from lib/core/analytics.mjs
// (computeAnalytics); this file only lays them out. Compact rows show "k of n"; the one percentage
// on the page is the reply rate, with its range, as lib/core/stats.mjs allows it.
import { Info } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { appPath, computeAnalytics, pluralDays, type AnalyticsOptions, type CoreInput } from "../../../lib/core";
import {
  BarList,
  DayStrip,
  DotStrip,
  GlassCard,
  RangeBar,
  Section,
  SegmentedControl,
  StatTile,
  TimeChart,
  Tooltip,
  cx,
  phaseVars,
  statusLabel,
  type DotItem,
  type TimeSeries,
} from "@/ui";

type Scope = NonNullable<AnalyticsOptions["window"]>;

const SCOPE_KEY = "iv.homeWindow";

function readScope(): Scope {
  try {
    return localStorage.getItem(SCOPE_KEY) === "all" ? "all" : "campaign";
  } catch {
    return "campaign";
  }
}

function saveScope(scope: Scope) {
  try {
    localStorage.setItem(SCOPE_KEY, scope);
  } catch {
    // private mode: the choice lasts until the page is left
  }
}

const SENT_SERIES: TimeSeries[] = [
  { id: "built", label: "CVs built", color: "var(--chart-muted)" },
  { id: "sent", label: "Sent", color: "var(--accent)" },
];

// One row each, named on the left, so the status colours never have to be told apart.
const BACK_SERIES: TimeSeries[] = [
  { id: "replies", label: "Replies", color: phaseVars("screening").fg },
  { id: "interviews", label: "Interviews", color: phaseVars("interviewing").fg },
  { id: "rejections", label: "Rejections", color: phaseVars("rejected").fg },
  { id: "offers", label: "Offers", color: phaseVars("offer").fg },
];

function pathOf(x: { ref?: string; slug?: string | null }): string | undefined {
  const ref = x.ref ?? x.slug;
  return ref ? appPath({ id: ref, slug: x.slug }) : undefined;
}

function Card({
  title,
  answer,
  how,
  footer,
  className,
  children,
}: {
  title: string;
  /** The plain sentence that answers the card's question. */
  answer?: ReactNode;
  /** How it is counted, behind the info icon. */
  how?: string;
  /** What to do about it. */
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <GlassCard padding="md" className={cx("flex min-w-0 flex-col gap-4", className)}>
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-body font-semibold text-ink">{title}</h3>
          {how ? (
            <Tooltip content={how} className="right-0 left-auto translate-x-0">
              <button
                type="button"
                aria-label={`How "${title}" is counted`}
                className="-m-1 flex size-7 shrink-0 cursor-help items-center justify-center rounded-full text-ink-3 hover:bg-ink/[0.06] hover:text-ink pointer-coarse:-m-2.5 pointer-coarse:size-11"
              >
                <Info size={15} strokeWidth={2} aria-hidden />
              </button>
            </Tooltip>
          ) : null}
        </div>
        {answer ? <p className="mt-1 text-small break-words text-ink-2">{answer}</p> : null}
      </div>
      {children}
      {footer ? <p className="mt-auto text-small break-words text-ink-2">{footer}</p> : null}
    </GlassCard>
  );
}

export function Analytics({ input }: { input: CoreInput }) {
  const [scope, setScope] = useState<Scope>(readScope);
  const a = useMemo(() => computeAnalytics(input, { window: scope }), [input, scope]);
  const t = a.timeline;
  const buckets = t.buckets.map((b) => ({ key: b.start, tick: b.tick, title: b.title, values: b.values }));
  const bucketLabel = t.unit === "week" ? "Week" : "Month";
  const per = t.unit === "week" ? "week by week" : "month by month";

  const rateDots: DotItem[] = [
    ...a.i2.dots.map((d) => ({ state: d.state, label: d.label, href: pathOf(d), hollow: d.unconfirmed }) as DotItem),
    ...a.i2.recent.map((r) => ({ state: "recent", label: r.company, href: pathOf(r) }) as DotItem),
  ];
  const replyDots = a.i4.dots.flatMap((d) =>
    d.days === null ? [] : [{ key: String(d.appId), name: d.company, detail: d.role, days: d.days, href: pathOf(d), hollow: d.unconfirmed }],
  );
  const replyMedian = a.i4.median.allowed ? (a.i4.median.value as number) : null;

  return (
    <Section id="numbers" title="Your search in numbers" description={a.hasData ? a.intro : undefined}>
      {a.scope.older > 0 ? (
        <SegmentedControl
          aria-label="Which applications to count"
          size="sm"
          className="self-start"
          value={scope}
          onChange={(next) => {
            setScope(next);
            saveScope(next);
          }}
          options={[
            { value: "campaign", label: `Since ${a.scope.since}`, count: a.scope.campaign },
            { value: "all", label: "All time", count: a.scope.all },
          ]}
        />
      ) : null}

      {a.scope.note || a.scope.unconfirmedNote ? (
        <p className="text-small text-ink-2">{[a.scope.note, a.scope.unconfirmedNote].filter(Boolean).join(" ")}</p>
      ) : null}

      {!a.hasData ? (
        <GlassCard padding="md">
          <p className="text-body text-ink-2">
            {a.scope.all > 0 ? `No applications since ${a.scope.since} yet.` : "Your numbers show up here once you add a job."}
          </p>
        </GlassCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {a.totals.map((x) => (
              <StatTile key={x.id} value={x.count} label={x.label} detail={x.detail} color={phaseVars(x.phase).fg} />
            ))}
          </div>

          <Card
            title="Applications over time"
            answer={t.paceLine}
            how="Applications by the date they were sent, CVs by the date they were built."
            footer={
              <>
                {a.i5.answer}
                {a.i5.burst ? ` ${a.i5.burst.text}.` : ""}
              </>
            }
          >
            {buckets.length ? (
              <TimeChart
                aria-label={`CVs built and applications sent, ${per}`}
                data={buckets}
                series={SENT_SERIES}
                bucketLabel={bucketLabel}
                target={t.target ? { value: t.target, label: `Target: ${t.target} a week` } : undefined}
              />
            ) : null}
          </Card>

          <Card
            title="What came back"
            answer={t.cameBackLine}
            how="Replies count once per application; each interview round counts. An interview, rejection or offer also counts as a reply in the tile above, and here only under its own name. A change of status counts on the day it was made. Automatic acknowledgements are left out."
          >
            {t.hasCameBack ? (
              <TimeChart aria-label={`What came back, ${per}`} layout="rows" data={buckets} series={BACK_SERIES} bucketLabel={bucketLabel} />
            ) : null}
          </Card>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card title="How far they get" answer={a.i3.answer} how={a.i3.howCounted} footer={a.i3.todo}>
              <BarList
                aria-label="Applications at each step"
                rows={a.i3.steps.map((s, i) => {
                  const rate = i > 0 ? a.i3.rates[i - 1].rate : null;
                  // Beside the count only when it speaks about the same applications.
                  return { key: s.id, label: s.label, value: s.count, detail: rate && rate.n > 0 && rate.k === s.count ? rate.countText : undefined };
                })}
              />
            </Card>

            <Card title="Where they stand now" how="Every application in this view, by its current status.">
              <BarList
                aria-label="Applications by status"
                rows={a.status.map((s) => ({ key: s.phase, label: statusLabel(s.phase), value: s.count, color: phaseVars(s.phase).fg, dot: true }))}
              />
            </Card>

            <Card title="Do applications get answers?" answer={a.i2.answer} how={a.i2.howCounted} footer={a.i2.todo}>
              {a.i2.rate.display !== "counts" && a.i2.rate.p !== undefined ? (
                <RangeBar low={a.i2.rate.low as number} high={a.i2.rate.high as number} point={a.i2.rate.p} />
              ) : rateDots.length ? (
                <DotStrip aria-label="Sent applications and whether they got a reply" items={rateDots} legend />
              ) : null}
            </Card>

            <Card title="How long until they reply" answer={a.replyTimeLine} how={a.i4.howCounted} footer={a.i4.todo}>
              {replyDots.length ? (
                <DayStrip
                  aria-label="Days from sending to the first reply"
                  dots={replyDots}
                  axisMax={a.i4.axisMax}
                  hollowLabel="Hollow: details not confirmed"
                  marker={replyMedian !== null ? { days: replyMedian, label: `Median ${pluralDays(replyMedian)}` } : undefined}
                />
              ) : null}
            </Card>

            <Card title="Still waiting on" answer={a.i1.answer} how={a.i1.howCounted} footer={a.i1.n ? a.i1.todo : undefined}>
              {a.i1.n ? (
                <BarList
                  aria-label="Applications with no reply, by days of silence"
                  rows={a.i1.buckets.map((b) => ({ key: b.id, label: `${b.label} (${b.range})`, value: b.rows.length }))}
                />
              ) : null}
            </Card>

            <Card title="Rejections" answer={a.rejections.answer} how="Applications whose status is Rejected. Before or after depends on whether an interview was recorded.">
              {a.rejections.count ? (
                <BarList
                  aria-label="Rejections before and after an interview"
                  color={phaseVars("rejected").fg}
                  rows={[
                    { key: "before", label: "Before an interview", value: a.rejections.beforeInterview },
                    { key: "after", label: "After an interview", value: a.rejections.afterInterview },
                  ]}
                />
              ) : null}
            </Card>
          </div>

          {a.where.length ? (
            <Card
              title="Where you're applying"
              answer={a.whereLine}
              how={a.i8.howCounted}
              footer="Bars count sent applications. Replies count only those old enough to judge."
            >
              <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
                {a.where.map((w) => (
                  <div key={w.id} className="min-w-0">
                    <h4 className="mb-2 text-small font-semibold text-ink">{w.label}</h4>
                    <BarList
                      aria-label={`Sent applications by ${w.label.toLowerCase()}`}
                      rows={w.rows.map((r) => ({
                        key: r.key,
                        label: r.label,
                        value: r.sent,
                        detail: r.replied ? `${r.replied.countText} replied` : undefined,
                      }))}
                    />
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      )}
    </Section>
  );
}
