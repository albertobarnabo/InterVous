"use client";
// I6 What do JDs keep asking that you lack?  I7 What did you tell each company?
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { ExtractedNumber, GapState, I6, I6Topic, I7, I7ProofPoint, MetricStatus } from "../../../lib/core";
import { GAP_STATE_LABELS, METRIC_STATUS_LABELS } from "../../../lib/core";
import { Button, Tag, cx } from "@/ui";

const href = (ref: string) => `/applications/${encodeURIComponent(ref)}`;

function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="r"
          initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: reduce ? 0.1 : 0.2, ease: "easeOut" }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function RowToggle({ open, onClick, children, controls }: { open: boolean; onClick: () => void; children: ReactNode; controls: string }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onClick}
      className="flex w-full min-w-0 items-start gap-2 rounded-sm text-left"
    >
      <ChevronRight
        aria-hidden
        size={16}
        strokeWidth={1.75}
        className={cx("mt-1 shrink-0 text-ink-3 transition-transform duration-[120ms] ease-out", open && "rotate-90")}
      />
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

// ── I6 ─────────────────────────────────────────────────────────────────────

const GAP_ORDER: GapState[] = ["open", "worded_around", "not_claimed"];
const GAP_FILL: Record<string, string> = {
  open: "bg-caution",
  worded_around: "bg-accent",
  not_claimed: "bg-ink-3",
};
const GAP_TONE: Record<string, "caution" | "accent" | "neutral"> = { open: "caution", worded_around: "accent", not_claimed: "neutral" };
const OUTCOME_DOT: Record<string, string> = { yes: "bg-accent", no: "bg-ink-3", waiting: "border-[1.5px] border-ink-3" };
const OUTCOME_TEXT: Record<string, string> = { yes: "replied", no: "no reply", waiting: "waiting" };

function GapTopic({ t, max }: { t: I6Topic; max: number }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const apps = [...t.apps].sort((a, b) => GAP_ORDER.indexOf(a.gapState) - GAP_ORDER.indexOf(b.gapState) || a.company.localeCompare(b.company));
  const id = `gap-${t.topic}`;
  return (
    <li className="border-b border-line px-4 py-3 last:border-b-0">
      <RowToggle open={open} onClick={() => setOpen((o) => !o)} controls={id}>
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-small font-medium text-ink">{t.label}</span>
          <span className="iv-num text-small text-ink-2">
            {t.count} {t.count === 1 ? "posting" : "postings"}
          </span>
        </span>
        <span aria-hidden className="mt-2 flex h-3 gap-0.5" style={{ width: `${(t.count / max) * 100}%` }}>
          {apps.map((a, i) => (
            <motion.span
              key={a.appId}
              className={cx("h-full flex-1 rounded-full", GAP_FILL[a.gapState] ?? "bg-line-strong")}
              initial={reduce ? false : { opacity: 0, scaleY: 0.3 }}
              whileInView={{ opacity: 1, scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: reduce ? 0 : 0.12, delay: reduce ? 0 : i * 0.03 }}
            />
          ))}
        </span>
      </RowToggle>
      <Reveal open={open}>
        <ul id={id} className="mt-3 flex flex-col gap-2 pl-6">
          {apps.map((a) => (
            <li key={a.appId} className="text-small">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link href={href(a.ref)} className="font-medium text-ink hover:underline">
                  {a.company}
                </Link>
                <Tag tone={GAP_TONE[a.gapState] ?? "neutral"}>{GAP_STATE_LABELS[a.gapState] ?? a.gapState}</Tag>
                {a.outcome ? (
                  <span className="inline-flex items-center gap-1.5 text-caption font-normal text-ink-3">
                    <span aria-hidden className={cx("block size-2.5 rounded-full", OUTCOME_DOT[a.outcome])} />
                    sent, {OUTCOME_TEXT[a.outcome]}
                  </span>
                ) : (
                  <span className="text-caption font-normal text-ink-3">not sent</span>
                )}
              </span>
              <span className="mt-0.5 block text-caption font-normal text-ink-2">{a.items.join(" · ")}</span>
            </li>
          ))}
        </ul>
      </Reveal>
    </li>
  );
}

export function Gaps({ data }: { data: I6 }) {
  const [showSingles, setShowSingles] = useState(false);
  const max = Math.max(1, ...data.topics.map((t) => t.count));
  const present = GAP_ORDER.filter((g) => data.topics.some((t) => (t.byGapState[g] ?? 0) > 0));
  return (
    <div className="flex flex-col gap-5">
      {data.topics.length ? (
        <>
          <ul className="flex flex-col rounded-md bg-surface shadow-1">
            {data.topics.map((t) => (
              <GapTopic key={t.topic} t={t} max={max} />
            ))}
          </ul>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption font-normal text-ink-2">
            {present.map((g) => (
              <li key={g} className="flex items-center gap-1.5">
                <span aria-hidden className={cx("block size-2.5 rounded-full", GAP_FILL[g])} />
                {GAP_STATE_LABELS[g]}
              </li>
            ))}
            <li className="text-ink-3">One block per posting. Open a topic to see which.</li>
          </ul>
        </>
      ) : null}
      {data.noLongerGaps.length ? (
        <div>
          <h3 className="text-small font-medium text-ink">No longer a gap: update the base CV</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {data.noLongerGaps.map((g) => (
              <li key={g.topic} className="text-small text-ink-2">
                <span className="text-ink-3 line-through decoration-ink-3">{g.label}</span>
                <span className="text-caption font-normal text-ink-3"> · {g.apps.map((a) => a.company).join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {data.singleTopics.length || data.otherItems ? (
        <div className="text-small text-ink-2">
          <button
            type="button"
            aria-expanded={showSingles}
            onClick={() => setShowSingles((s) => !s)}
            className="inline-flex min-h-11 items-center gap-1 rounded-sm font-medium text-ink-2 hover:text-ink sm:min-h-8"
          >
            <ChevronRight aria-hidden size={16} strokeWidth={1.75} className={cx("transition-transform duration-[120ms]", showSingles && "rotate-90")} />
            Asked by one posting only ({data.singleTopics.length}){data.otherItems ? `, plus ${data.otherItems} items with no topic` : ""}
          </button>
          <Reveal open={showSingles}>
            <p className="mt-1 pl-5">{data.singleTopics.map((t) => t.label).join(", ") || "None"}</p>
          </Reveal>
        </div>
      ) : null}
    </div>
  );
}

// ── I7 ─────────────────────────────────────────────────────────────────────

const STATUS_TONE: Record<MetricStatus, "accent" | "caution" | "danger"> = { verified: "accent", needs_care: "caution", unverified: "danger" };

/** Mark the numbers the core extracted from a wording. */
function Highlighted({ text, numbers, isFlagged }: { text: string; numbers: ExtractedNumber[]; isFlagged?: (n: ExtractedNumber) => boolean }) {
  if (!numbers.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let at = 0;
  for (const n of numbers) {
    const i = text.indexOf(n.raw, at);
    if (i < 0) continue;
    if (i > at) out.push(text.slice(at, i));
    const flagged = isFlagged?.(n) ?? false;
    out.push(
      <mark
        key={`${i}-${n.raw}`}
        className={cx("iv-num rounded-sm px-0.5 text-ink", flagged ? "bg-caution-soft text-caution" : "bg-surface-2")}
        title={n.metric.replace(/_/g, " ")}
      >
        {n.raw}
      </mark>,
    );
    at = i + n.raw.length;
  }
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}

function Wordings({ pp, isFlagged }: { pp: I7ProofPoint; isFlagged?: (n: ExtractedNumber) => boolean }) {
  return (
    <ul className="flex flex-col gap-3">
      {pp.wordings.map((w) => (
        <li key={`${w.appId}`} className="text-small">
          <span className="flex flex-wrap items-center gap-2">
            <Link href={href(w.ref)} className="font-medium text-ink hover:underline">
              {w.company}
            </Link>
            <span className="truncate text-ink-3">{w.role}</span>
            {!w.sent ? <Tag>Not sent</Tag> : null}
          </span>
          {w.detail ? (
            <span className="mt-1 block max-w-[68ch] font-serif text-body text-ink">
              <Highlighted text={w.detail} numbers={w.numbers} isFlagged={isFlagged} />
            </span>
          ) : (
            <span className="mt-1 block text-caption font-normal text-ink-3">Used, but the exact wording was not saved.</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function ProofPointRow({ pp, max }: { pp: I7ProofPoint; max: number }) {
  const [open, setOpen] = useState(false);
  const id = `pp-${pp.key}`;
  return (
    <li className="border-b border-line px-4 py-3 last:border-b-0">
      <RowToggle open={open} onClick={() => setOpen((o) => !o)} controls={id}>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="min-w-0 flex-1 text-small font-medium text-ink">{pp.name}</span>
          {pp.metricStatus !== "verified" ? <Tag tone={STATUS_TONE[pp.metricStatus]}>{METRIC_STATUS_LABELS[pp.metricStatus]}</Tag> : null}
          {pp.flagged ? (
            <Tag tone="caution">
              <TriangleAlert aria-hidden size={12} /> Numbers differ
            </Tag>
          ) : null}
          <span className="iv-num text-caption text-ink-2">
            {pp.uses} used · {pp.sentUses} sent
          </span>
        </span>
        <span aria-hidden className="relative mt-2 block h-1.5 rounded-full bg-surface-2" style={{ width: `${(pp.uses / max) * 100}%` }}>
          <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${pp.uses ? (pp.sentUses / pp.uses) * 100 : 0}%` }} />
        </span>
      </RowToggle>
      <Reveal open={open}>
        <div id={id} className="mt-3 pl-6">
          <p className="mb-3 text-caption font-normal text-ink-3">What you told each company</p>
          <Wordings pp={pp} />
          {pp.caveat ? <p className="mt-3 text-caption font-normal text-ink-2">Caveat: {pp.caveat}</p> : null}
        </div>
      </Reveal>
    </li>
  );
}

export function Told({ data }: { data: I7 }) {
  const [all, setAll] = useState(false);
  const LIMIT = 6;
  const max = Math.max(1, ...data.proofPoints.map((p) => p.uses));
  const shown = all ? data.proofPoints : data.proofPoints.slice(0, LIMIT);
  const byKey = new Map(data.proofPoints.map((p) => [p.key, p]));
  return (
    <div className="flex flex-col gap-6">
      {data.flagged.map((f) => {
        const pp = byKey.get(f.key);
        // a number is marked when a flag names it: a value that differs from the facts, or one side of an inconsistency
        const isFlagged = (n: ExtractedNumber) =>
          f.flags.some((x) =>
            x.type === "inconsistent"
              ? x.metric === n.metric && (x.values ?? []).some((v) => Math.abs(v.value - n.value) < 0.05)
              : x.value === n.raw && x.metric === n.metric,
          );
        return (
          <div key={f.key} className="rounded-md bg-caution-soft p-4">
            <p className="flex items-center gap-2 text-small font-semibold text-caution">
              <TriangleAlert aria-hidden size={16} strokeWidth={1.75} />
              {f.name}: the numbers do not match
            </p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-small text-ink">
              {f.flags.map((x, i) => (
                <li key={i}>{x.text}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-sm bg-surface p-3">
              <Wordings pp={{ ...(pp as I7ProofPoint), wordings: f.wordings }} isFlagged={isFlagged} />
            </div>
          </div>
        );
      })}
      {data.proofPoints.length ? (
        <div>
          <h3 className="text-small font-medium text-ink">Most used</h3>
          <ul className="mt-2 flex flex-col rounded-md bg-surface shadow-1">
            {shown.map((pp) => (
              <ProofPointRow key={pp.key} pp={pp} max={max} />
            ))}
          </ul>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-caption font-normal text-ink-3">
            <span>Bar: applications using it; teal part: sent.</span>
            {data.proofPoints.length > LIMIT ? (
              <Button size="sm" variant="quiet" onClick={() => setAll((a) => !a)}>
                {all ? "Show the top 6" : `Show all ${data.proofPoints.length}`}
              </Button>
            ) : null}
          </p>
        </div>
      ) : null}
      {data.unverifiedInUse.length ? (
        <div>
          <h3 className="text-small font-medium text-ink">Not verified, and still in open applications</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {data.unverifiedInUse.map((p) => (
              <li key={p.key} className="text-small">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{p.name}</span>
                  <Tag tone={STATUS_TONE[p.metricStatus]}>{METRIC_STATUS_LABELS[p.metricStatus]}</Tag>
                </span>
                {p.caveat ? <span className="mt-0.5 block text-ink-2">{p.caveat}</span> : null}
                <span className="mt-0.5 block text-caption font-normal text-ink-3">In {p.apps.map((a) => a.company).join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
