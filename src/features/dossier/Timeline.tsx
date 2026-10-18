"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { daysBetween, eventTitle } from "../../../lib/core";
import { deleteEvent, type JobEvent } from "../../../lib/data";
import { ConfirmDialog, Menu, cx, useToast } from "@/ui";
import { shortDate } from "./format";
import { Unsure } from "./Unsure";

const SILENCE_DAYS = 7;

/** Written in the last 10 seconds: the new event slides in (spec 3.7). */
function fresh(e: JobEvent): boolean {
  const t = Date.parse(e.created_at);
  return Number.isFinite(t) && Date.now() - t < 10_000;
}

type Row = { type: "event"; event: JobEvent } | { type: "silence"; days: number; key: string };

const SOURCE: Record<string, string> = { cli: "via CLI", web: "via web", import: "from the import", auto: "automatic" };

function rowsOf(events: JobEvent[]): Row[] {
  const rows: Row[] = [];
  events.forEach((e, i) => {
    const prev = events[i - 1];
    if (prev) {
      const gap = daysBetween(prev.occurred_on, e.occurred_on);
      if (gap !== null && gap > SILENCE_DAYS) rows.push({ type: "silence", days: gap, key: `gap-${prev.id}-${e.id}` });
    }
    rows.push({ type: "event", event: e });
  });
  return rows;
}

/**
 * The application's story, oldest first (spec 2.3, Overview). ← marks what came in, → what went
 * out. A gap of more than 7 days shows as "— 44 days, nothing —". The line draws down once (400ms);
 * the silence spans fade in after it.
 */
export function Timeline({
  events,
  today,
  emptyText,
  trailing = true,
}: {
  events: JobEvent[];
  today: string;
  emptyText?: string;
  /** Show the silence between the last event and today (open applications only). */
  trailing?: boolean;
}) {
  const reduce = useReducedMotion();
  const toast = useToast();
  const [confirm, setConfirm] = useState<JobEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = rowsOf(events);
  const since = trailing && events.length ? daysBetween(events[events.length - 1].occurred_on, today) : null;
  if (since !== null && since > SILENCE_DAYS) rows.push({ type: "silence", days: since, key: "gap-today" });

  if (!events.length) {
    return <p className="text-small text-ink-3">{emptyText ?? "Nothing logged yet."}</p>;
  }

  return (
    <>
      <ol className="relative">
        <motion.span
          aria-hidden
          className="absolute top-2 bottom-2 left-[75px] w-px origin-top bg-line-strong"
          initial={reduce ? { opacity: 0 } : { scaleY: 0 }}
          animate={reduce ? { opacity: 1 } : { scaleY: 1 }}
          transition={{ duration: reduce ? 0.1 : 0.4, ease: "easeOut" }}
        />
        {rows.map((r) => {
          if (r.type === "silence") {
            const isNow = r.key === "gap-today";
            return (
              <motion.li
                key={r.key}
                className="relative grid grid-cols-[64px_24px_1fr] gap-x-0 py-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.12, delay: reduce ? 0 : 0.4 }}
              >
                <span />
                <span />
                <span className="iv-num text-caption text-ink-3">
                  — {r.days} days, nothing{isNow ? " since" : ""} —
                </span>
              </motion.li>
            );
          }
          const e = r.event;
          const dir = e.direction;
          const auto = e.kind === "phase_change" || e.source === "auto";
          const future = e.occurred_on > today;
          return (
            <motion.li
              key={e.id}
              className="group relative grid grid-cols-[64px_24px_1fr] items-start py-2"
              initial={fresh(e) ? (reduce ? { opacity: 0 } : { opacity: 0, x: -8 }) : false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: reduce ? 0.1 : 0.22, ease: "easeOut" }}
            >
              <span className="iv-num pt-0.5 text-right text-caption text-ink-3">
                <Unsure unsure={!!e.date_uncertain} evidence="This date is approximate.">
                  <span>{shortDate(e.occurred_on, today)}</span>
                </Unsure>
              </span>
              <span aria-hidden className="relative flex justify-center pt-[7px]">
                <span
                  className={cx(
                    "relative z-[1] size-[9px] rounded-full border-2",
                    auto ? "border-line-strong bg-bg" : dir === "in" ? "border-accent bg-accent" : "border-ink-3 bg-bg",
                    future && "border-dashed",
                  )}
                />
              </span>
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0 pb-1">
                  <p className={cx("relative flex items-start gap-1.5 text-small", auto ? "text-ink-2" : "text-ink")}>
                    {dir === "in" ? (
                      <ArrowLeft aria-hidden size={14} strokeWidth={2} className="mt-[3px] shrink-0 text-accent" />
                    ) : dir === "out" ? (
                      <ArrowRight aria-hidden size={14} strokeWidth={2} className="mt-[3px] shrink-0 text-ink-3" />
                    ) : null}
                    <span className="sr-only">{dir === "in" ? "From them: " : dir === "out" ? "From you: " : ""}</span>
                    <span className="min-w-0">
                      {eventTitle(e)}
                      {future ? <span className="ml-2 text-caption text-accent">upcoming</span> : null}
                    </span>
                  </p>
                  {e.body ? <p className="mt-0.5 max-w-[68ch] whitespace-pre-line text-small text-ink-2">{e.body}</p> : null}
                  {e.source === "cli" || e.source === "web" ? (
                    <p className="mt-0.5 text-caption font-normal text-ink-3">{SOURCE[e.source]}</p>
                  ) : null}
                </div>
                <Menu
                  label={`More for ${eventTitle(e)}`}
                  className="min-w-40"
                  trigger={
                    <button
                      type="button"
                      aria-label={`More for ${eventTitle(e)}`}
                      className="-my-1 inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-ink-3 opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 data-open:opacity-100 pointer-coarse:size-11 pointer-coarse:opacity-100"
                    >
                      <MoreHorizontal aria-hidden size={16} strokeWidth={1.75} />
                    </button>
                  }
                  items={[{ label: "Delete event", icon: Trash2, danger: true, onSelect: () => setConfirm(e) }]}
                />
              </div>
            </motion.li>
          );
        })}
      </ol>
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Delete this event?"
        body={
          confirm ? (
            <>
              <span className="text-ink">{eventTitle(confirm)}</span>, {shortDate(confirm.occurred_on, today)}. Where it stands does not change.
            </>
          ) : null
        }
        confirmLabel="Delete event"
        loading={busy}
        onConfirm={async () => {
          if (!confirm) return;
          setBusy(true);
          try {
            await deleteEvent(confirm.id);
            toast.show({ text: "Event deleted." });
            setConfirm(null);
          } catch (err) {
            toast.show({ kind: "error", text: err instanceof Error ? err.message : "Could not delete it." });
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
