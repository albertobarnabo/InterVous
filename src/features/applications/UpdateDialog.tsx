"use client";
// The two small dialogs behind the list's and Home's buttons:
//   UpdateDialog  "What happened with Apple?": pick what happened, the date, Save.
//   SentDialog    "When did you send it?": the date, Save.
// Both write through useUpdates() (one undoable recordUpdate each).
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Phase } from "../../../lib/core";
import { Button, CompanyMark, DateInput, Dialog, Field, cx } from "@/ui";
import { choicesFor, useUpdates, type UpdateChoice } from "./updates";

export type DialogTarget = {
  id: number;
  company: string;
  role: string;
  phase: Phase;
  logoUrl?: string | null;
};

function Who({ t }: { t: DialogTarget }) {
  return (
    <div className="flex items-center gap-3">
      <CompanyMark name={t.company} logoUrl={t.logoUrl ?? null} size={40} />
      <div className="min-w-0">
        <p className="truncate text-body font-semibold text-ink">{t.company}</p>
        <p className="truncate text-small text-ink-2">{t.role}</p>
      </div>
    </div>
  );
}

function message(e: unknown) {
  return e instanceof Error ? e.message : "It was not saved. Try again.";
}

/** "What happened?" for one application. `title` overrides the heading (Home's interview card). */
export function UpdateDialog({
  target,
  today,
  onClose,
  title,
}: {
  target: DialogTarget | null;
  today: string;
  onClose: () => void;
  title?: string;
}) {
  // Keep the last target and title while the dialog fades out.
  const last = useRef<{ target: DialogTarget; title?: string } | null>(null);
  if (target) last.current = { target, title };
  const t = target ?? last.current?.target ?? null;
  const heading = target ? title : last.current?.title;
  const { record } = useUpdates();
  const [choice, setChoice] = useState<UpdateChoice | null>(null);
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setChoice(null);
    setDate(today);
    setError(null);
    setBusy(false);
  }, [target, today]);

  const choices = t ? choicesFor(t.phase) : [];
  const picked = choices.find((c) => c.id === choice) ?? null;

  const save = async (c: UpdateChoice, on: string) => {
    if (!t) return;
    setBusy(true);
    setError(null);
    try {
      await record({ id: t.id, company: t.company, phase: t.phase }, c, on, today);
      onClose();
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!picked || !date) return;
    void save(picked.id, date);
  };

  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      title={heading ?? (t ? `What happened with ${t.company}?` : "What happened?")}
      description="Pick what happened. InterVous updates the status and keeps the history."
    >
      {t ? (
        <form onSubmit={submit} className="flex flex-col gap-5">
          <Who t={t} />
          <div role="radiogroup" aria-label="What happened" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {choices.map((c) => {
              const on = choice === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={busy}
                  onClick={() => {
                    if (c.immediate) void save(c.id, today);
                    else setChoice(c.id);
                  }}
                  className={cx(
                    "flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-4 text-left text-body font-medium transition-[background-color,box-shadow] duration-150",
                    on
                      ? "bg-accent-soft text-ink shadow-[0_0_0_1.5px_var(--accent)]"
                      : "bg-white/70 text-ink shadow-[0_0_0_0.5px_rgba(15,23,42,0.14)] hover:bg-white",
                  )}
                >
                  <c.icon aria-hidden size={18} strokeWidth={2} className={on ? "text-accent" : "text-ink-2"} />
                  {c.label}
                </button>
              );
            })}
          </div>
          {picked ? (
            <div className="flex flex-wrap items-end gap-3">
              <Field label={picked.when}>
                <DateInput value={date} max={picked.future ? undefined : today} onChange={(e) => setDate(e.target.value)} required autoFocus />
              </Field>
              <Button type="submit" variant="primary" loading={busy} disabled={!date}>
                Save
              </Button>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-small text-danger">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </Dialog>
  );
}

/** "When did you send it?" for a CV that is not marked as sent yet. */
export function SentDialog({ target, today, onClose }: { target: DialogTarget | null; today: string; onClose: () => void }) {
  const last = useRef<DialogTarget | null>(null);
  if (target) last.current = target;
  const t = target ?? last.current;
  const { markSent } = useUpdates();
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setDate(today);
    setError(null);
    setBusy(false);
  }, [target, today]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!t || !date) return;
    setBusy(true);
    setError(null);
    try {
      await markSent({ id: t.id, company: t.company, phase: t.phase }, date, today);
      onClose();
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      title="When did you send it?"
      description="InterVous then counts the days until they reply."
      size="sm"
    >
      {t ? (
        <form onSubmit={submit} className="flex flex-col gap-5">
          <Who t={t} />
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Date sent">
              <DateInput value={date} max={today} onChange={(e) => setDate(e.target.value)} required autoFocus />
            </Field>
            <Button type="submit" variant="primary" loading={busy} disabled={!date}>
              Mark as sent
            </Button>
          </div>
          {error ? (
            <p role="alert" className="text-small text-danger">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </Dialog>
  );
}
