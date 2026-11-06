"use client";
// "From application to offer" on /home: how many applications it takes to get an interview, and the
// pass rate at each stage after that. Every number and sentence comes from lib/core/analytics.mjs
// (computeAnalytics); this file only lays them out.
import { ArrowDown, Info } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { computeAnalytics, type AnalyticsOptions, type AnalyticsResult, type CoreInput } from "../../../lib/core";
import { GlassCard, Section, SegmentedControl, Tooltip, cx } from "@/ui";

type Scope = NonNullable<AnalyticsOptions["window"]>;
type Step = AnalyticsResult["steps"][number];
type Answer = AnalyticsResult["perInterview"];

const SCOPE_KEY = "iv.homeWindow";
/** Up to this many answers a step draws one dot each; past it the sentence is enough. */
const MAX_DOTS = 40;

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

function HowCounted({ title, text }: { title: string; text: string }) {
  return (
    <Tooltip content={text} className="right-0 left-auto translate-x-0">
      <button
        type="button"
        aria-label={`How "${title}" is counted`}
        className="-m-1 flex size-7 shrink-0 cursor-help items-center justify-center rounded-full text-ink-3 hover:bg-ink/[0.06] hover:text-ink pointer-coarse:-m-2.5 pointer-coarse:size-11"
      >
        <Info size={15} strokeWidth={2} aria-hidden />
      </button>
    </Tooltip>
  );
}

function Card({ title, how, children, className }: { title: string; how?: string; children: ReactNode; className?: string }) {
  return (
    <GlassCard padding="md" className={cx("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-body font-semibold text-ink">{title}</h3>
        {how ? <HowCounted title={title} text={how} /> : null}
      </div>
      {children}
    </GlassCard>
  );
}

/** One of the two answers: a big percentage, what it counts, and the counts behind it. */
function AnswerCard({ title, answer, how }: { title: string; answer: Answer; how: string }) {
  return (
    <Card title={title} how={how}>
      <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="iv-num text-[40px] leading-none font-semibold tracking-tight text-ink">{answer.value}</span>
        {answer.unit ? <span className="text-body font-medium text-ink-2">{answer.unit}</span> : null}
      </p>
      <p className="text-small break-words text-ink-2">{answer.answer}</p>
      {answer.aside ? <p className="mt-auto text-caption text-ink-3">{answer.aside}</p> : null}
    </Card>
  );
}

/** Passed answers filled, stopped ones hollow: the outcomes behind a percentage, countable. */
function Dots({ passed, stopped }: { passed: number; stopped: number }) {
  if (passed + stopped > MAX_DOTS || passed + stopped === 0) return null;
  return (
    <span aria-hidden className="flex flex-wrap items-center gap-1">
      {Array.from({ length: passed }, (_, i) => (
        <span key={`p${i}`} className="block size-2 rounded-full bg-accent" />
      ))}
      {Array.from({ length: stopped }, (_, i) => (
        <span key={`s${i}`} className="block size-2 rounded-full border-[1.5px] border-ink-3" />
      ))}
    </span>
  );
}

function verbFor(step: Step): string {
  // Past the first interview, going further can mean another round or an offer straight away.
  return step.to === "round1" ? "got an interview" : step.to === "offer" ? "got an offer" : "went further";
}

function StepRow({ step }: { step: Step }) {
  const extra = [step.waiting ? `${step.waiting} waiting` : null, step.withdrew ? `${step.withdrew} withdrawn` : null].filter(Boolean).join(" · ");
  return (
    <div className="flex gap-2.5 py-1.5 pl-1">
      <ArrowDown aria-hidden size={14} strokeWidth={2} className="mt-[3px] shrink-0 text-ink-3" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-small text-ink">
          {step.percent ? (
            <>
              <span className="iv-num font-semibold">{step.percent}</span> {verbFor(step)}{" "}
              <span className="iv-num text-ink-2">{`(${step.passed} of ${step.decided})`}</span>
            </>
          ) : (
            <span className="text-ink-2">No outcome yet</span>
          )}
          {extra ? <span className="text-ink-3">{` · ${extra}`}</span> : null}
        </p>
        <Dots passed={step.passed} stopped={step.stopped} />
      </div>
    </div>
  );
}

function StageRow({ label, count, of }: { label: string; count: number; of: number }) {
  const width = of ? Math.max(count ? 2 : 0, (count / of) * 100) : 0;
  return (
    <div className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_auto] items-center gap-3 py-1.5 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]">
      <span className="text-small font-semibold break-words text-ink">{label}</span>
      <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-ink/[0.06]">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
      </span>
      <span className="iv-num text-body font-semibold text-ink">{count}</span>
    </div>
  );
}

export function Analytics({ input }: { input: CoreInput }) {
  const [scope, setScope] = useState<Scope>(readScope);
  const a = useMemo(() => computeAnalytics(input, { window: scope }), [input, scope]);
  const sent = a.stages[0]?.count ?? 0;

  return (
    <Section id="numbers" title="From application to offer" description={a.hasData ? (a.intro ?? undefined) : undefined}>
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <AnswerCard title="Getting an interview" answer={a.perInterview} how={a.howCounted} />
            <AnswerCard title="Getting an offer" answer={a.perOffer} how={a.howCounted} />
          </div>

          <Card title="Pass rate at each stage" how={a.howCounted}>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-2">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="block size-2 rounded-full bg-accent" /> went further
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="block size-2 rounded-full border-[1.5px] border-ink-3" /> stopped there: rejected, or no reply
              </span>
            </p>
            <ol aria-label="Applications at each stage, and how many went on">
              {a.stages.map((s, i) => (
                <li key={s.id}>
                  <StageRow label={s.label} count={s.count} of={sent} />
                  {a.steps[i] ? <StepRow step={a.steps[i]} /> : null}
                </li>
              ))}
            </ol>
            {a.smallNote || a.unloggedNote ? (
              <p className="text-caption text-ink-3">{[a.smallNote, a.unloggedNote].filter(Boolean).join(" ")}</p>
            ) : null}
          </Card>
        </>
      )}
    </Section>
  );
}
