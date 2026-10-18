"use client";
// /today (spec 2.1): what needs you now. Every number and sentence comes from lib/core/today.mjs
// (buildToday), the same function behind `intervous today`. This file renders, and wires the verbs
// to lib/data writes with a 5-second Undo (useDeferred). Snooze / Not relevant live in localStorage.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CheckCircle2, RotateCw } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppRef, NoReplyEntry, TodayItem, TodayResult } from "../../../lib/core";
import { addDays, buildToday, formatAgo, formatDay, formatShort } from "../../../lib/core";
import { Button, Callout, Skeleton, SkeletonRow, cx, useToast } from "@/ui";
import { OUTCOMES, copyText, dropDraft, finishNextAction, followUpLine, logOutcome, markFollowedUp, markNoReply, markSent, rescheduleNextAction } from "./actions";
import { AnimatedCount } from "./AnimatedCount";
import { ConfirmFlow } from "./ConfirmFlow";
import { CvThumb } from "./CvThumb";
import { FOREVER, SNOOZE_DAYS, snoozeUntil, useDismissed } from "./dismissed";
import { Expand, FixChecklist, NoReplyReview, entryId, topicKey } from "./Expansions";
import { TodayRow, dossierHref, type RowControls } from "./TodayRow";
import { useCoreInput } from "./useCoreInput";
import { useDeferred } from "./useDeferred";
import { useLogos } from "./useLogos";
import { OutcomeDots } from "../insights/OutcomeDots";

type AppItem = TodayItem & AppRef;

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="iv-page">
      <div className="mx-auto w-full max-w-[760px] pt-8 pb-8 sm:pt-12">{children}</div>
    </div>
  );
}

function LoadingToday() {
  return (
    <Shell>
      <div aria-busy="true" aria-label="Loading Today">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-3 h-5 w-80 max-w-full" />
        <Skeleton className="mt-12 h-6 w-36" />
        <div className="mt-4 flex flex-col gap-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    </Shell>
  );
}

/** Label + content, stacked on mobile, two columns from 640px (the wireframe's lower block). */
function Strip({ label, children, id }: { label: string; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="grid gap-2 border-b border-line px-4 py-4 last:border-b-0 sm:grid-cols-[140px_1fr] sm:gap-4">
      <h2 id={id} className="text-small font-medium text-ink">
        {label}
      </h2>
      <div className="min-w-0 text-small text-ink-2">{children}</div>
    </section>
  );
}

function ComingUp({ t }: { t: TodayResult }) {
  const { interviews, closing } = t.comingUp;
  if (!interviews.length && !closing.length) {
    return <p>No interviews in the next 7 days. No drafts closing within 14 days.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {interviews.map((x) => (
        <li key={`i-${x.appId}-${x.on}`}>
          <Link href={dossierHref(x.ref)} className="group flex min-w-0 flex-wrap items-baseline gap-x-2 hover:text-ink">
            <span className="iv-num text-ink">{x.on ? formatDay(x.on) : "Date unknown"}</span>
            <span className="min-w-0 truncate">
              Interview · <span className="font-medium text-ink group-hover:underline">{x.company}</span> · {x.role}
            </span>
          </Link>
        </li>
      ))}
      {closing.map((x) => (
        <li key={`c-${x.appId}`}>
          <Link href={dossierHref(x.ref)} className="group flex min-w-0 flex-wrap items-baseline gap-x-2 hover:text-ink">
            <span className="iv-num text-ink">{x.on ? formatDay(x.on) : ""}</span>
            <span className="min-w-0 truncate">
              Closes, not sent · <span className="font-medium text-ink group-hover:underline">{x.company}</span> · {x.role}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RecentlyAdded({ t }: { t: TodayResult }) {
  if (!t.recentlyAdded.length) {
    return (
      <p>
        Nothing from the agent yet. When a CV is built from a link, <code className="iv-num text-caption text-ink">intervous add</code> puts it here.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {t.recentlyAdded.map((x) => (
        <li key={x.appId}>
          <Link href={dossierHref(x.ref, x.hasCv ? "cv" : undefined)} className="group flex items-start gap-3 rounded-sm">
            <CvThumb jobId={x.appId} hasCv={x.hasCv} width={44} />
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink group-hover:underline">{x.company}</span>
              <span className="line-clamp-2 block text-ink-2">{x.role}</span>
              <span className="block text-caption font-normal text-ink-3">added by the agent {formatAgo(x.createdAt ?? x.updatedAt)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RepliesSoFar({ t }: { t: TodayResult }) {
  const r = t.replies;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {r.dots.length ? (
        <OutcomeDots
          size={12}
          label={`Replies: ${r.line}`}
          dots={r.dots.map((d) => ({ state: d.state === "yes" ? "yes" : "no", unconfirmed: d.unconfirmed, label: d.label, slug: d.slug, ref: d.ref ?? null }))}
        />
      ) : null}
      <span className="text-ink">{r.line}</span>
      <Link href="/insights#i2" className="ml-auto inline-flex min-h-11 items-center gap-1 font-medium text-accent hover:underline sm:min-h-0">
        Insights <ArrowRight aria-hidden size={14} />
      </Link>
    </div>
  );
}

export function TodayView() {
  const core = useCoreInput();
  const logos = useLogos();
  const today = core.raw?.today ?? null;
  const { dismissed, set } = useDismissed(today);
  const deferred = useDeferred();
  const toast = useToast();
  const reduce = useReducedMotion();
  const router = useRouter();
  const params = useSearchParams();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [checking, setChecking] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const ts = timers.current;
    return () => {
      for (const t of ts) clearTimeout(t);
    };
  }, []);

  // `full` ignores snoozes (the confirm flow and "bring back" need every item); `t` is what is shown
  const full = useMemo(() => (core.input ? buildToday(core.input) : null), [core.input]);
  const t = useMemo(() => (core.input ? buildToday(core.input, { dismissed }) : null), [core.input, dismissed]);

  const confirmItem = full?.items.find((i) => i.type === "confirm_facts");
  const questions = useMemo(() => (confirmItem && confirmItem.type === "confirm_facts" ? confirmItem.questions : []), [confirmItem]);

  // ?confirm=1 (from Insights I9) opens the flow once the data is in
  const wantsConfirm = params.get("confirm") === "1";
  useEffect(() => {
    if (wantsConfirm && questions.length) setConfirmOpen(true);
  }, [wantsConfirm, questions.length]);

  const closeConfirm = () => {
    setConfirmOpen(false);
    if (wantsConfirm) router.replace("/today", { scroll: false });
  };

  /** Fill the check, then hide the row and write after the Undo window. */
  const resolve = useCallback(
    (id: string, text: ReactNode, commit: () => Promise<unknown>, onUndo?: () => void) => {
      setChecking((s) => new Set(s).add(id));
      const timer = setTimeout(
        () => {
          timers.current.delete(timer);
          deferred.defer({ id, text, commit, onUndo });
          setChecking((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
        },
        reduce ? 0 : 200,
      );
      timers.current.add(timer);
    },
    [deferred, reduce],
  );

  /** Same motion for a local-only resolve (snooze, not relevant, checklist done). */
  const resolveLocal = useCallback(
    (id: string, apply: () => void) => {
      setChecking((s) => new Set(s).add(id));
      const timer = setTimeout(
        () => {
          timers.current.delete(timer);
          apply();
          setChecking((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
        },
        reduce ? 0 : 160,
      );
      timers.current.add(timer);
    },
    [reduce],
  );

  if (core.error && !core.input) {
    return (
      <Shell>
        <h1 className="text-h1-sm sm:text-h1">Today</h1>
        <Callout
          tone="danger"
          title="Today could not load"
          className="mt-6"
          action={
            <Button size="sm" icon={RotateCw} onClick={() => void core.refetch()}>
              Try again
            </Button>
          }
        >
          {core.error.message}
        </Callout>
      </Shell>
    );
  }
  if (!t || !full || !today || !core.input) return <LoadingToday />;

  const contacts = core.input.contacts ?? [];
  const apps = core.raw?.apps ?? [];

  const isHidden = (it: TodayItem) => {
    if (deferred.hidden.has(it.key)) return true;
    if (it.type === "no_reply") return it.entries.every((e) => deferred.hidden.has(entryId(e)));
    if (it.type === "confirm_facts") return it.questions.length > 0 && it.questions.every((q) => deferred.hidden.has(q.key));
    return false;
  };
  const items = t.items.filter((it) => !isHidden(it));
  const snoozedKeys = full.items.filter((it) => it.key in dismissed).map((it) => it.key);

  const name = (it: AppItem) => it.company;

  const c: RowControls = {
    today,
    logos,
    checking,
    expanded,
    toggleExpand: (key) => setExpanded((k) => (k === key ? null : key)),
    snooze: (it) => {
      resolveLocal(it.key, () => set(it.key, snoozeUntil(today)));
      toast.show({
        kind: "info",
        text: `Snoozed. Back on ${formatDay(addDays(today, SNOOZE_DAYS))}.`,
        action: { label: "Undo", run: () => set(it.key, null) },
      });
    },
    notRelevant: (it) => {
      resolveLocal(it.key, () => set(it.key, FOREVER));
      toast.show({
        kind: "info",
        text: "Hidden. It comes back only if something about it changes.",
        action: { label: "Undo", run: () => set(it.key, null) },
      });
    },
    startConfirm: () => setConfirmOpen(true),
    logOutcome: (it, kind, on) => {
      const label = OUTCOMES.find((o) => o.kind === kind)?.label ?? kind;
      resolve(it.key, `${name(it)}: ${label.toLowerCase()}, ${formatShort(on, { today })}`, () => logOutcome(it.appId, kind, on));
    },
    markSent: (it, on) => resolve(it.key, `Marked ${it.company} as sent on ${formatShort(on, { today })}`, () => markSent(it.appId, on)),
    drop: (it, note) => resolve(it.key, `Dropped ${it.company}`, () => dropDraft(it.appId, note)),
    doneNextAction: (it) => resolve(it.key, `Done: ${it.reason}`, () => finishNextAction(it.appId)),
    reschedule: (it, due) => resolve(it.key, `Moved to ${formatShort(due, { today })}`, () => rescheduleNextAction(it.appId, due)),
    copyFollowUp: (it) => {
      const app = apps.find((a) => Number(a.id) === it.appId);
      const contact = contacts.find((x) => Number(x.job_id) === it.appId);
      const line = followUpLine({ contactName: contact?.name ?? null, role: it.role, appliedOn: app?.applied_on ?? null, today });
      void copyText(line).then((ok) =>
        toast.show(
          ok
            ? { kind: "success", text: `Copied: “${line}”`, duration: 7000 }
            : { kind: "error", text: `Could not copy. The line: “${line}”`, duration: 12000 },
        ),
      );
    },
    markFollowedUp: (it) => resolve(it.key, `Followed up with ${it.company}`, () => markFollowedUp(it.appId, today)),
  };

  const markEntry = (e: NoReplyEntry) =>
    deferred.defer({ id: entryId(e), text: `Marked ${e.company} as no reply`, commit: () => markNoReply(e.appId, today) });
  const markAll = (it: TodayItem, entries: NoReplyEntry[]) => {
    setExpanded(null);
    resolve(it.key, `Marked ${entries.length} as no reply`, async () => {
      for (const e of entries) await markNoReply(e.appId, today);
    });
  };

  const tickTopic = (it: TodayItem, topic: string, on: boolean) => {
    set(topicKey(topic), on ? FOREVER : null);
    if (!on || it.type !== "fix_base_cv") return;
    const allDone = it.topics.every((x) => x.topic === topic || dismissed[topicKey(x.topic)]);
    if (!allDone) return;
    setExpanded(null);
    resolveLocal(it.key, () => set(it.key, FOREVER));
    toast.show({
      kind: "success",
      text: "Base CV checklist done.",
      action: {
        label: "Undo",
        run: () => {
          set(it.key, null);
          set(topicKey(topic), null);
        },
      },
    });
  };

  return (
    <Shell>
      <header>
        <h1 className="text-h1-sm text-ink sm:text-h1">{t.heading}</h1>
        <p className="mt-2 text-small text-ink-2">{t.summary.line}</p>
      </header>

      <section aria-labelledby="needs-you" className="mt-10">
        <h2 id="needs-you" className="flex items-baseline gap-1.5 text-h3 text-ink">
          Needs you
          <span className="text-ink-3">
            (<AnimatedCount value={items.length} />)
          </span>
        </h2>

        {items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.12 }}
            className="mt-4 flex items-center gap-3 rounded-md bg-surface px-4 py-5 shadow-1"
          >
            <CheckCircle2 aria-hidden size={22} strokeWidth={1.75} className="shrink-0 text-accent" />
            <p className="text-body text-ink">{t.emptyLine}</p>
          </motion.div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {items.map((it) => (
                <motion.li
                  key={it.key}
                  layout={!reduce}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: -8 }}
                  transition={{ duration: reduce ? 0.1 : 0.22, ease: "easeOut", layout: { type: "spring", stiffness: 500, damping: 40 } }}
                  className="overflow-visible"
                >
                  <TodayRow item={it} c={c}>
                    {it.type === "no_reply" ? (
                      <Expand open={expanded === it.key}>
                        <NoReplyReview item={it} hidden={deferred.hidden} onMark={markEntry} onMarkAll={(es) => markAll(it, es)} />
                      </Expand>
                    ) : it.type === "fix_base_cv" ? (
                      <Expand open={expanded === it.key}>
                        <FixChecklist item={it} ticked={(topic) => Boolean(dismissed[topicKey(topic)])} onToggle={(topic, on) => tickTopic(it, topic, on)} />
                      </Expand>
                    ) : null}
                  </TodayRow>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}

        {snoozedKeys.length ? (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 text-caption font-normal text-ink-3">
            <span>
              <span className="iv-num">{snoozedKeys.length}</span> snoozed or marked not relevant.
            </span>
            <button
              type="button"
              className="min-h-11 font-medium text-accent hover:underline sm:min-h-0"
              onClick={() => {
                for (const k of snoozedKeys) set(k, null);
              }}
            >
              Show {snoozedKeys.length === 1 ? "it" : "them"} again
            </button>
          </p>
        ) : null}
      </section>

      <div className={cx("mt-10 rounded-md bg-surface shadow-1")}>
        <Strip label="Coming up" id="coming-up">
          <ComingUp t={t} />
        </Strip>
        <Strip label="Recently added" id="recently-added">
          <RecentlyAdded t={t} />
        </Strip>
        <Strip label="Replies so far" id="replies-so-far">
          <RepliesSoFar t={t} />
        </Strip>
      </div>

      <ConfirmFlow
        open={confirmOpen}
        onClose={closeConfirm}
        questions={questions}
        apps={apps}
        logos={logos}
        today={today}
        deferred={deferred}
      />
    </Shell>
  );
}
