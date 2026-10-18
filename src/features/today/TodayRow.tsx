"use client";
// One row of Today's "Needs you" queue (spec 2.1): phase dot, company and role, one plain reason,
// the evidence (a date and an age), one verb button, and a ⋯ menu (Snooze 3 days, Not relevant, Open).
// Every string and number comes from lib/core/today.mjs; this file only renders and wires the verbs.
import { motion, useReducedMotion } from "motion/react";
import {
  AlarmClock,
  ArrowUpRight,
  BellOff,
  Check,
  Clock3,
  EyeOff,
  ListChecks,
  MailQuestion,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { AppRef, TodayItem } from "../../../lib/core";
import { addDays } from "../../../lib/core";
import { Button, ButtonLink, CompanyMark, DateInput, Menu, PhaseDot, Popover, buttonClass, cx, type MenuEntry } from "@/ui";
import { OUTCOMES, type OutcomeKind } from "./actions";

export type RowControls = {
  today: string;
  logos: Map<number, string | null>;
  /** keys whose check is filling right now (just resolved) */
  checking: ReadonlySet<string>;
  expanded: string | null;
  toggleExpand: (key: string) => void;
  snooze: (item: TodayItem) => void;
  notRelevant: (item: TodayItem) => void;
  startConfirm: () => void;
  logOutcome: (item: Extract<TodayItem, { type: "outcome_missing" }>, kind: OutcomeKind, on: string) => void;
  markSent: (item: TodayItem & AppRef, on: string) => void;
  drop: (item: TodayItem & AppRef, note: string) => void;
  doneNextAction: (item: Extract<TodayItem, { type: "next_action_due" }>) => void;
  reschedule: (item: Extract<TodayItem, { type: "next_action_due" }>, due: string) => void;
  copyFollowUp: (item: Extract<TodayItem, { type: "follow_up" }>) => void;
  markFollowedUp: (item: Extract<TodayItem, { type: "follow_up" }>) => void;
};

const GROUP_ICON: Partial<Record<TodayItem["type"], LucideIcon>> = {
  confirm_facts: ListChecks,
  no_reply: MailQuestion,
  fix_base_cv: Wrench,
};

const INSIGHT_FOR: Partial<Record<TodayItem["type"], string>> = {
  confirm_facts: "/insights#i9",
  no_reply: "/insights#i1",
  fix_base_cv: "/insights#i6",
};

export function dossierHref(ref: string, tab?: string) {
  return `/applications/${encodeURIComponent(ref)}${tab ? `?tab=${tab}` : ""}`;
}

/** Render a sentence with any URL in it as a short link (host and a hint of the path). */
export function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!/^https?:\/\//.test(p)) return <span key={i}>{p}</span>;
        let label = p;
        try {
          const u = new URL(p);
          label = `${u.host.replace(/^www\./, "")}${u.pathname.length > 1 ? "/…" : ""}`;
        } catch {
          /* keep the raw text */
        }
        return (
          <a key={i} href={p} target="_blank" rel="noreferrer" className="text-accent underline decoration-1 underline-offset-2 hover:decoration-2">
            {label}
          </a>
        );
      })}
    </>
  );
}

function firstUrl(text: string | null | undefined): string | null {
  return text?.match(/https?:\/\/[^\s)]+/)?.[0] ?? null;
}

function hasApp(item: TodayItem): item is TodayItem & AppRef {
  return "appId" in item && typeof (item as { appId?: unknown }).appId === "number";
}

// ── verbs that need a small form ────────────────────────────────────────────

function LogOutcome({ item, c }: { item: Extract<TodayItem, { type: "outcome_missing" }>; c: RowControls }) {
  return (
    <Popover
      anchor="bottom end"
      title={`What happened with ${item.company}?`}
      trigger={
        <Button variant="primary" size="sm">
          {item.action.label}
        </Button>
      }
    >
      {(close) => (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const kind = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") as OutcomeKind | null;
            const on = String(fd.get("on") || c.today);
            if (!kind) return;
            close();
            c.logOutcome(item, kind, on);
          }}
        >
          <label className="flex flex-col gap-1.5 text-small font-medium text-ink">
            On
            <DateInput name="on" defaultValue={c.today} max={c.today} required />
          </label>
          <div className="flex flex-col gap-1.5">
            {OUTCOMES.map((o, i) => (
              <Button key={o.kind} type="submit" name="kind" value={o.kind} variant={i === 0 ? "primary" : "secondary"} className="justify-start">
                {o.label}
              </Button>
            ))}
          </div>
        </form>
      )}
    </Popover>
  );
}

function SendOrDrop({ item, c }: { item: TodayItem & AppRef; c: RowControls }) {
  return (
    <Popover
      anchor="bottom end"
      title={`${item.company}: send it or drop it`}
      trigger={
        <Button variant="primary" size="sm">
          {item.action.label}
        </Button>
      }
    >
      {(close) => (
        <div className="flex flex-col gap-4">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const on = String(new FormData(e.currentTarget).get("on") || c.today);
              close();
              c.markSent(item, on);
            }}
          >
            <label className="flex flex-col gap-1.5 text-small font-medium text-ink">
              Sent on
              <DateInput name="on" defaultValue={c.today} max={c.today} required />
            </label>
            <Button type="submit" variant="primary">
              Mark as sent
            </Button>
          </form>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <p className="text-caption font-normal text-ink-3">Not applying after all?</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                close();
                c.drop(item, "Decided not to apply");
              }}
            >
              Drop it
            </Button>
          </div>
        </div>
      )}
    </Popover>
  );
}

function Reschedule({ item, c }: { item: Extract<TodayItem, { type: "next_action_due" }>; c: RowControls }) {
  const label = item.secondary?.label ?? "Reschedule";
  return (
    <Popover
      anchor="bottom end"
      title="New due date"
      trigger={
        <Button variant="secondary" size="sm">
          {label}
        </Button>
      }
    >
      {(close) => (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const due = String(new FormData(e.currentTarget).get("due") || "");
            if (!due) return;
            close();
            c.reschedule(item, due);
          }}
        >
          <DateInput name="due" aria-label="Due on" defaultValue={addDays(c.today, 3)} min={addDays(c.today, 1)} required />
          <Button type="submit" variant="primary">
            Save
          </Button>
        </form>
      )}
    </Popover>
  );
}

/** The verb buttons of one item (primary first). */
function Verbs({ item, c }: { item: TodayItem; c: RowControls }) {
  const expanded = c.expanded === item.key;
  switch (item.type) {
    case "interview_soon":
      return (
        <ButtonLink variant="primary" size="sm" href={dossierHref(item.ref)}>
          {item.action.label}
        </ButtonLink>
      );
    case "outcome_missing":
      return <LogOutcome item={item} c={c} />;
    case "next_action_due":
      return (
        <>
          <Button variant="primary" size="sm" onClick={() => c.doneNextAction(item)}>
            {item.action.label}
          </Button>
          <Reschedule item={item} c={c} />
        </>
      );
    case "confirm_facts":
      return (
        <Button variant="primary" size="sm" onClick={c.startConfirm}>
          {item.action.label}
        </Button>
      );
    case "follow_up":
      return (
        <>
          <Button variant="primary" size="sm" onClick={() => c.copyFollowUp(item)}>
            {item.action.label}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => c.markFollowedUp(item)}>
            {item.secondary?.label ?? "Mark followed up"}
          </Button>
        </>
      );
    case "no_reply":
    case "fix_base_cv":
      return (
        <Button variant="primary" size="sm" aria-expanded={expanded} onClick={() => c.toggleExpand(item.key)}>
          {expanded ? "Close" : item.action.label}
        </Button>
      );
    case "closing_soon":
    case "stale_draft":
      return <SendOrDrop item={item} c={c} />;
    case "posting_closed": {
      const url = firstUrl(item.hint);
      const href = url ?? `https://www.google.com/search?q=${encodeURIComponent(`${item.company} ${item.role} job`)}`;
      return (
        <>
          <Button variant="primary" size="sm" onClick={() => c.drop(item, "Posting closed")}>
            {item.action.label}
          </Button>
          <a href={href} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
            <ArrowUpRight aria-hidden size={16} strokeWidth={1.75} />
            <span>{item.secondary?.label ?? "Look for a repost"}</span>
          </a>
        </>
      );
    }
    default:
      return null;
  }
}

function Lead({ item, c, done }: { item: TodayItem; c: RowControls; done: boolean }) {
  const reduce = useReducedMotion();
  const Icon = GROUP_ICON[item.type] ?? (item.type === "interview_soon" ? AlarmClock : Clock3);
  return (
    <span className="relative mt-0.5 flex size-9 shrink-0 items-center justify-center sm:mt-0">
      {hasApp(item) ? (
        <CompanyMark name={item.company} logoUrl={c.logos.get(item.appId) ?? null} size={36} />
      ) : (
        <span aria-hidden className="flex size-9 items-center justify-center rounded-sm bg-surface-2 text-ink-2">
          <Icon size={18} strokeWidth={1.75} />
        </span>
      )}
      {done ? (
        <motion.span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center rounded-full bg-accent text-accent-ink"
          initial={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
          transition={{ duration: reduce ? 0.1 : 0.12, ease: "easeOut" }}
        >
          <Check size={18} strokeWidth={2.25} />
        </motion.span>
      ) : null}
    </span>
  );
}

export function TodayRow({ item, c, children }: { item: TodayItem; c: RowControls; children?: ReactNode }) {
  const done = c.checking.has(item.key);
  const perApp = hasApp(item);
  const menu: MenuEntry[] = [
    { label: "Snooze 3 days", icon: BellOff, onSelect: () => c.snooze(item) },
    { label: "Not relevant", icon: EyeOff, onSelect: () => c.notRelevant(item) },
  ];
  const open = perApp ? dossierHref(item.ref) : INSIGHT_FOR[item.type];
  if (open) menu.push("separator", { label: perApp ? "Open" : "See it in Insights", icon: ArrowUpRight, href: open });

  return (
    <div className={cx("rounded-md bg-surface shadow-1 transition-opacity duration-[120ms]", done && "opacity-80")}>
      <div className="flex min-h-16 items-start gap-3 px-3 py-3 sm:items-center sm:gap-4 sm:px-4">
        <Lead item={item} c={c} done={done} />
        <div className="min-w-0 flex-1">
          {perApp ? (
            <p className="flex min-w-0 items-center gap-2 text-small text-ink-2">
              <PhaseDot phase={item.phase} className="shrink-0" />
              <span className="relative min-w-0 truncate">
                <span className="font-medium text-ink">{item.company}</span>
                <span aria-hidden> · </span>
                <span className="sr-only">, </span>
                {item.role}
              </span>
            </p>
          ) : null}
          <p className={cx("text-body text-ink", perApp ? "mt-0.5" : "font-medium")}>{item.reason}</p>
          {item.evidence ? (
            <p className="mt-0.5 text-caption font-normal break-words text-ink-3">
              <Linkified text={item.evidence} />
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 sm:hidden">
            <Verbs item={item} c={c} />
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <Verbs item={item} c={c} />
        </div>
        <Menu items={menu} label={`More for ${perApp ? item.company : item.reason}`} />
      </div>
      {children}
    </div>
  );
}
