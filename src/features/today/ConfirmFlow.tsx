"use client";
// "Quick check": one question at a time ("Did you send OpenAI · Applied AI Engineer?"), in
// lib/core's order. Home opens it with one batch of questions (e.g. the CVs made in October).
// Each answer writes the field and logs a note, after a 5-second Undo window (see useDeferred).
// Closing the flow writes what is pending.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ConfirmOption, ConfirmQuestion } from "../../../lib/core";
import { formatShort } from "../../../lib/core";
import type { JobOverview } from "../../../lib/data";
import { Button, ButtonLink, CompanyMark, DateInput, Dialog, StatusPill } from "@/ui";
import { NEEDS_DATE, answerSummary, dateLabel, dateTarget, optionLabel, saveAnswer } from "./actions";
import type { useDeferred } from "./useDeferred";

type Deferred = ReturnType<typeof useDeferred>;

export type ConfirmFlowProps = {
  open: boolean;
  onClose: () => void;
  questions: ConfirmQuestion[];
  apps: JobOverview[];
  logos: Map<number, string | null>;
  today: string;
  deferred: Deferred;
};

const PRIMARY: ReadonlySet<ConfirmOption> = new Set<ConfirmOption>(["yes", "yes_on_date", "not_sent", "date"]);

export function ConfirmFlow({ open, onClose, questions, apps, logos, today, deferred }: ConfirmFlowProps) {
  const reduce = useReducedMotion();
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [answered, setAnswered] = useState(0);
  const [picking, setPicking] = useState<ConfirmOption | null>(null);
  const [date, setDate] = useState("");
  const startTotal = useRef(0);

  // fields already answered in this visit, per application: a later answer for the same row
  // must not put them back into `uncertain` while the first write is still pending
  const removed = useRef(new Map<number, Set<string>>());
  const latest = useRef(new Map<number, JobOverview>());
  latest.current = useMemo(() => new Map(apps.map((a) => [Number(a.id), a])), [apps]);

  const remaining = questions.filter((q) => !deferred.hidden.has(q.key) && !skipped.has(q.key));
  const current = remaining[0] ?? null;

  useEffect(() => {
    if (!open) return;
    startTotal.current = questions.length;
    setAnswered(0);
    setSkipped(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the flow opens
  }, [open]);

  useEffect(() => {
    setPicking(null);
  }, [current?.key]);

  const close = () => {
    deferred.flush();
    onClose();
  };

  const answer = (q: ConfirmQuestion, o: ConfirmOption, d: string | null) => {
    const set = removed.current.get(q.appId) ?? new Set<string>();
    for (const f of q.fields) set.add(f);
    removed.current.set(q.appId, set);
    setAnswered((n) => n + 1);
    deferred.defer({
      id: q.key,
      text: (
        <>
          Saved: {q.company}, {answerSummary(q, o, d, today)}
        </>
      ),
      commit: () => {
        // what is still uncertain on the row, minus every field answered so far (this one included)
        const row = latest.current.get(q.appId);
        const gone = removed.current.get(q.appId) ?? new Set<string>();
        const left = (row?.uncertain ?? []).filter((f) => !gone.has(f) || q.fields.includes(f));
        return saveAnswer(q, o, d, left, today);
      },
      onUndo: () => {
        const s = removed.current.get(q.appId);
        if (s) for (const f of q.fields) s.delete(f);
        setAnswered((n) => Math.max(0, n - 1));
      },
    });
  };

  const choose = (q: ConfirmQuestion, o: ConfirmOption) => {
    if (o === "change") return;
    if (NEEDS_DATE.has(o)) {
      const row = latest.current.get(q.appId);
      const field = dateTarget(q);
      const start = o === "different_date" ? (row?.[field] as string | null) ?? today : today;
      setDate(start);
      setPicking(o);
      return;
    }
    answer(q, o, null);
  };

  const total = Math.max(startTotal.current, answered + remaining.length + skipped.size);
  const doneCount = Math.min(total, answered + skipped.size);
  const position = Math.min(total, doneCount + 1);
  const row = current ? latest.current.get(current.appId) : null;

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Quick check"
      description={
        current ? (
          <span className="iv-num">
            Question {position} of {total}
          </span>
        ) : undefined
      }
      size="md"
    >
      <div
        aria-hidden
        className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.08]"
      >
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={false}
          animate={{ width: `${total ? (doneCount / total) * 100 : 100}%` }}
          transition={{ duration: reduce ? 0.1 : 0.22, ease: "easeOut" }}
        />
      </div>

      <div className="relative min-h-[220px]">
        <AnimatePresence mode="wait" initial={false}>
          {current ? (
            <motion.div
              key={current.key}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 16 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }}
              transition={{ duration: reduce ? 0.1 : 0.16, ease: "easeOut" }}
              className="flex flex-col gap-5"
            >
              <div className="flex items-center gap-3">
                <CompanyMark name={current.company} logoUrl={logos.get(current.appId) ?? null} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-medium text-ink">{current.company}</p>
                  <p className="truncate text-small text-ink-2">{current.role}</p>
                </div>
                <StatusPill status={current.phase} size="sm" />
              </div>

              <p className="text-h3 font-medium text-ink">{current.text}</p>

              {picking ? (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (date) answer(current, picking, date);
                  }}
                >
                  <label className="flex flex-col gap-1.5 text-small font-medium text-ink">
                    {dateLabel(current, picking)}
                    <DateInput value={date} max={today} onChange={(e) => setDate(e.target.value)} required autoFocus />
                  </label>
                  <Button type="submit" variant="primary" disabled={!date}>
                    Save
                  </Button>
                  <Button variant="quiet" onClick={() => setPicking(null)}>
                    Back
                  </Button>
                </form>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {current.options.map((o, i) =>
                    o === "change" ? (
                      <ButtonLink
                        key={o}
                        href={`/applications/${encodeURIComponent(current.ref)}`}
                        onClick={close}
                        icon={ArrowRight}
                      >
                        Open it to change it
                      </ButtonLink>
                    ) : (
                      <Button
                        key={o}
                        variant={i === 0 && PRIMARY.has(o) ? "primary" : "secondary"}
                        onClick={() => choose(current, o)}
                      >
                        {optionLabel(current, o)}
                      </Button>
                    ),
                  )}
                </div>
              )}

              {row ? (
                <p className="text-small text-ink-2">
                  What we have: {row.applied_on ? `sent ${formatShort(row.applied_on, { today })}` : "no date sent"}
                  {row.cv_built_on ? ` · CV made ${formatShort(row.cv_built_on, { today })}` : ""}
                </p>
              ) : null}
            </motion.div>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-start gap-3"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Check aria-hidden size={20} />
              </span>
              <p className="text-h3 text-ink">{skipped.size ? "That's all for now." : "All done. Thank you."}</p>
              <p className="text-small text-ink-2">
                <span className="iv-num">{answered}</span> answered
                {skipped.size ? (
                  <>
                    , <span className="iv-num">{skipped.size}</span> skipped. Skipped questions come back on Home.
                  </>
                ) : (
                  "."
                )}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-ink/[0.06] pt-4">
        {current ? (
          <Button variant="quiet" onClick={() => setSkipped((s) => new Set(s).add(current.key))}>
            Skip this one
          </Button>
        ) : (
          <span />
        )}
        <Button variant={current ? "secondary" : "primary"} onClick={close}>
          {current ? "Stop for now" : "Done"}
        </Button>
      </div>
    </Dialog>
  );
}
