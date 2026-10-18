"use client";
// I9 Can you trust these numbers?  I10 Pay you've seen.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { AppRef, I10, I9 } from "../../../lib/core";
import { ButtonLink, cx } from "@/ui";

const href = (ref: string) => `/applications/${encodeURIComponent(ref)}`;

function CountRow({
  count,
  label,
  rows,
  detail,
}: {
  count: number;
  label: string;
  rows: AppRef[];
  detail?: (r: AppRef) => string | null;
}) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  return (
    <li className="border-b border-line px-4 py-3 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        disabled={!rows.length}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 rounded-sm text-left disabled:cursor-default"
      >
        <span className="iv-num w-12 shrink-0 text-h2 text-ink">{count}</span>
        <span className="min-w-0 flex-1 text-small text-ink-2">{label}</span>
        {rows.length ? (
          <ChevronRight
            aria-hidden
            size={16}
            strokeWidth={1.75}
            className={cx("shrink-0 text-ink-3 transition-transform duration-[120ms]", open && "rotate-90")}
          />
        ) : null}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.ul
            key="rows"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0.1 : 0.2, ease: "easeOut" }}
            className="flex flex-col gap-1 overflow-hidden pt-2 pl-16"
          >
            {rows.map((r) => (
              <li key={r.appId} className="text-small">
                <Link href={href(r.ref)} className="hover:underline">
                  <span className="font-medium text-ink">{r.company}</span>
                  <span className="text-ink-2"> · {r.role}</span>
                </Link>
                {detail?.(r) ? <span className="block text-caption font-normal text-ink-3">{detail(r)}</span> : null}
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

export function TrustCounts({ data }: { data: I9 }) {
  const unc = new Map(data.unconfirmed.rows.map((r) => [r.appId, r.uncertain]));
  const unsaved = new Map(data.unsavedAnswers.rows.map((r) => [r.appId, r.count]));
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col rounded-md bg-surface shadow-1">
        <CountRow
          count={data.unconfirmed.count}
          label={`applications with unconfirmed facts (${data.unconfirmed.fields} facts in all)`}
          rows={data.unconfirmed.rows}
          detail={(r) => `Unsure: ${(unc.get(r.appId) ?? []).map((f) => f.replace(/_/g, " ")).join(", ")}`}
        />
        <CountRow
          count={data.cvNotMarkedSent.count}
          label="sent applications whose CV on file may not be the version you sent"
          rows={data.cvNotMarkedSent.rows}
        />
        <CountRow count={data.sentWithoutCv.count} label="sent applications with no CV on file" rows={data.sentWithoutCv.rows} />
        <CountRow
          count={data.unsavedAnswers.count}
          label="answers that exist only in chat, never saved"
          rows={data.unsavedAnswers.rows}
          detail={(r) => {
            const n = unsaved.get(r.appId) ?? 0;
            return `${n} ${n === 1 ? "answer" : "answers"}`;
          }}
        />
      </ul>
      {data.unconfirmed.count ? (
        <div>
          <ButtonLink href="/today?confirm=1" variant="primary" icon={ArrowRight}>
            Start confirming
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}

const PERIOD: Record<string, string> = { year: "a year", month: "a month", day: "a day", hour: "an hour" };

export function Pay({ data }: { data: I10 }) {
  if (!data.groups.length && !data.unparsed.length) return null;
  return (
    <div className="flex flex-col gap-5">
      {data.groups.map((g) => (
        <div key={`${g.currency}/${g.period ?? ""}`}>
          <h3 className="text-small font-medium text-ink">
            {g.currency} {g.period ? PERIOD[g.period] ?? g.period : ""}
          </h3>
          <ul className="mt-2 flex flex-col rounded-md bg-surface shadow-1">
            {g.rows.map((r) => (
              <li key={r.appId} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-b-0">
                <Link href={href(r.ref)} className="min-w-0 flex-1 basis-48 truncate text-small hover:underline">
                  <span className="font-medium text-ink">{r.company}</span>
                  <span className="text-ink-2"> · {r.role}</span>
                </Link>
                <span className="iv-num text-small text-ink" title={r.text ?? undefined}>
                  {r.display ?? r.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {data.unparsed.length ? (
        <div>
          <h3 className="text-small font-medium text-ink">As written, no single figure</h3>
          <ul className="mt-2 flex flex-col gap-3">
            {data.unparsed.map((r) => (
              <li key={r.appId} className="text-small">
                <Link href={href(r.ref)} className="font-medium text-ink hover:underline">
                  {r.company}
                </Link>
                {r.text ? <span className="mt-0.5 block max-w-[68ch] font-serif text-body text-ink-2">{r.text}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
