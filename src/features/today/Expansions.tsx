"use client";
// Inline panels under a grouped Today row: the no-reply review list (item 6) and the base-CV
// checklist (item 10). They open in place, so the queue stays one screen.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { FixBaseCvItem, NoReplyItem, NoReplyEntry } from "../../../lib/core";
import { Button, Tag, cx } from "@/ui";
import { dossierHref } from "./TodayRow";

export function Expand({ open, children }: { open: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="panel"
          initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: reduce ? 0.1 : 0.22, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div className="border-t border-line px-3 pt-3 pb-4 sm:px-4 sm:pl-[68px]">{children}</div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function NoReplyReview({
  item,
  hidden,
  onMark,
  onMarkAll,
}: {
  item: NoReplyItem;
  /** entry ids already marked (pending their Undo window) */
  hidden: ReadonlySet<string>;
  onMark: (e: NoReplyEntry) => void;
  onMarkAll: (entries: NoReplyEntry[]) => void;
}) {
  const reduce = useReducedMotion();
  const left = item.entries.filter((e) => !hidden.has(entryId(e)));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-ink-2">
        Marking one as no reply closes it and takes it out of the waiting count. It stays in your history.
      </p>
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {left.map((e) => (
            <motion.li
              key={e.appId}
              layout={!reduce}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: reduce ? 0.1 : 0.22, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2 last:border-b-0">
                <Link href={dossierHref(e.ref)} className="min-w-0 flex-1 rounded-sm hover:underline">
                  <span className="block truncate text-small">
                    <span className="font-medium text-ink">{e.company}</span>
                    <span className="text-ink-2"> · {e.role}</span>
                  </span>
                </Link>
                {e.statusUnconfirmed ? (
                  <Tag tone="caution" title="The history is not sure this was sent">
                    Sent? unconfirmed
                  </Tag>
                ) : null}
                {e.postingGone ? <Tag>Posting gone</Tag> : null}
                <span className="iv-num w-16 text-right text-caption text-ink-3">{e.days} days</span>
                <Button size="sm" variant="secondary" onClick={() => onMark(e)}>
                  Mark no reply
                </Button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {left.length > 1 ? (
        <div>
          <Button variant="primary" onClick={() => onMarkAll(left)}>
            Mark all {left.length} as no reply
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export const entryId = (e: { appId: number }) => `no_reply_entry:${e.appId}`;
export const topicKey = (topic: string) => `fix_base_cv_topic:${topic}`;

export function FixChecklist({
  item,
  ticked,
  onToggle,
}: {
  item: FixBaseCvItem;
  ticked: (topic: string) => boolean;
  onToggle: (topic: string, on: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-ink-2">
        These were marked &ldquo;no longer a gap&rdquo; on postings, so the base CV should say them. Tick each once the base CV has it.
      </p>
      <ul className="flex flex-col gap-1">
        {item.topics.map((t) => {
          const on = ticked(t.topic);
          return (
            <li key={t.topic}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-sm px-2 py-2 hover:bg-surface-2">
                <input type="checkbox" className="peer sr-only" checked={on} onChange={(e) => onToggle(t.topic, e.target.checked)} />
                <span
                  aria-hidden
                  className={cx(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border transition-colors duration-[120ms]",
                    "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                    on ? "border-accent bg-accent text-accent-ink" : "border-line-strong bg-surface",
                  )}
                >
                  {on ? <Check size={14} strokeWidth={2.5} /> : null}
                </span>
                <span className="min-w-0">
                  <span className={cx("block text-small font-medium", on ? "text-ink-3 line-through" : "text-ink")}>{t.task}</span>
                  <span className="block text-caption font-normal text-ink-3">Asked by {t.apps.map((a) => a.company).join(", ")}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
