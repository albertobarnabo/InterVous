"use client";
// "What happened?": one tap per real-world event (Sent it · Got a reply · Interview · Rejected ·
// Offer · No reply). Each logs the event, the database moves the status, and the toast offers Undo.
import { CalendarClock, CircleX, Hourglass, MessageSquareReply, Send, Trophy, type LucideIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { recordUpdate, type NewEvent } from "../../../lib/data";
import type { JobUpdate } from "../../../lib/data";
import type { Phase } from "../../../lib/types";
import { Button, DateInput, Field, Input, Popover, Textarea, cx, useToast } from "@/ui";
import { shortDate } from "./format";
import type { DossierModel } from "./model";

type Action = "sent" | "reply" | "interview" | "rejected" | "offer" | "no_reply" | "skip";

const NOT_SENT: Phase[] = ["draft", "skipped"];
/** Phases a reply or an interview should move forward from (the database only moves "Sent" by itself). */
const BEFORE_REPLY: Phase[] = ["draft", "skipped", "applied", "no_reply"];
const BEFORE_INTERVIEW: Phase[] = ["draft", "skipped", "applied", "screening", "no_reply", "rejected", "withdrawn"];

type Plan = { events: NewEvent[]; patch?: Pick<JobUpdate, "applied_on">; confirm: string[]; done: string };

function plan(model: DossierModel, action: Action, date: string, time: string, note: string | null): Plan {
  const { derived: d, today } = model;
  const phase = d.phase;
  const notSent = NOT_SENT.includes(phase);
  const sentFirst: NewEvent[] = notSent ? [{ kind: "applied", occurred_on: date }] : [];
  const fmt = (x: string) => shortDate(x, today);
  switch (action) {
    case "sent": {
      const events: NewEvent[] = notSent ? [{ kind: "applied", occurred_on: date, body: note }] : note ? [{ kind: "note", occurred_on: date, body: note }] : [];
      return { events, patch: { applied_on: date }, confirm: ["phase", "applied_on"], done: `Marked as sent on ${fmt(date)}.` };
    }
    case "reply":
      return {
        events: [...sentFirst, { kind: "reply", occurred_on: date, body: note, to_phase: BEFORE_REPLY.includes(phase) ? "screening" : null }],
        confirm: ["phase"],
        done: "Saved: they replied.",
      };
    case "interview": {
      const happened = date <= today && phase === "interviewing";
      let occurred_at: string | null = null;
      if (time) {
        const t = new Date(`${date}T${time}`);
        occurred_at = Number.isNaN(t.getTime()) ? null : t.toISOString();
      }
      return {
        events: [
          ...sentFirst,
          {
            kind: happened ? "interview_done" : "interview_scheduled",
            occurred_on: date,
            occurred_at,
            body: note,
            to_phase: BEFORE_INTERVIEW.includes(phase) ? "interviewing" : null,
          },
        ],
        confirm: ["phase"],
        done: date > today ? `Interview on ${fmt(date)} saved.` : "Interview saved.",
      };
    }
    case "rejected":
      return { events: [{ kind: "rejection", occurred_on: date, body: note }], confirm: ["phase"], done: "Saved as rejected." };
    case "offer":
      return { events: [{ kind: "offer", occurred_on: date, body: note }], confirm: ["phase"], done: "Saved: you have an offer." };
    case "no_reply":
      return { events: [{ kind: "phase_change", to_phase: "no_reply", occurred_on: today }], confirm: ["phase"], done: "Closed as no reply." };
    case "skip":
      return { events: [{ kind: "skipped", occurred_on: today }], confirm: ["phase"], done: "Marked as not applying." };
  }
}

function useRecord(model: DossierModel) {
  const toast = useToast();
  return async (action: Action, date = model.today, time = "", note: string | null = null) => {
    const p = plan(model, action, date, time, note);
    const res = await recordUpdate(model.app.id, { events: p.events, patch: p.patch, confirm: p.confirm });
    toast.show({
      text: p.done,
      action: {
        label: "Undo",
        run: async () => {
          try {
            await res.undo();
            toast.show({ kind: "info", text: "Undone." });
          } catch (e) {
            toast.show({ kind: "error", text: e instanceof Error ? e.message : "Could not undo it." });
          }
        },
      },
    });
  };
}

/** Date (+ optional time) + optional note, then Save. */
function WhenForm({
  dateLabel,
  max,
  withTime,
  today,
  onSubmit,
}: {
  dateLabel: string;
  max?: string;
  withTime?: boolean;
  today: string;
  onSubmit: (date: string, time: string, note: string | null) => Promise<void>;
}) {
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date) return setError("Pick a date.");
    setBusy(true);
    setError(null);
    try {
      await onSubmit(date, time, note.trim() || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "It was not saved. Try again.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Field label={dateLabel}>
          <DateInput value={date} max={max} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        {withTime ? (
          <Field label="Time" hint="Optional">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-32" />
          </Field>
        ) : null}
      </div>
      <Field label="Note" hint="Optional">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error ? (
        <p role="alert" className="text-[14px] text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" loading={busy} className="self-end">
        Save
      </Button>
    </form>
  );
}

function AskButton({
  label,
  icon,
  title,
  dateLabel,
  pastOnly,
  withTime,
  primary,
  model,
  action,
}: {
  label: string;
  icon: LucideIcon;
  title: string;
  dateLabel: string;
  pastOnly?: boolean;
  withTime?: boolean;
  primary?: boolean;
  model: DossierModel;
  action: Action;
}) {
  const record = useRecord(model);
  return (
    <Popover
      anchor="bottom start"
      title={title}
      className="w-[min(22rem,calc(100vw-32px))]"
      trigger={
        <Button variant={primary ? "primary" : "secondary"} icon={icon}>
          {label}
        </Button>
      }
    >
      {(close) => (
        <WhenForm
          dateLabel={dateLabel}
          max={pastOnly ? model.today : undefined}
          withTime={withTime}
          today={model.today}
          onSubmit={async (date, time, note) => {
            await record(action, date, time, note);
            close();
          }}
        />
      )}
    </Popover>
  );
}

function NowButton({ label, icon, model, action, className }: { label: string; icon?: LucideIcon; model: DossierModel; action: Action; className?: string }) {
  const toast = useToast();
  const record = useRecord(model);
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={icon ? "secondary" : "quiet"}
      icon={icon}
      loading={busy}
      className={className}
      onClick={async () => {
        setBusy(true);
        try {
          await record(action);
        } catch (e) {
          toast.show({ kind: "error", text: e instanceof Error ? e.message : "It was not saved. Try again." });
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}

/** The "What happened?" button group of the application page. */
export function WhatHappened({ model, className }: { model: DossierModel; className?: string }) {
  const { derived: d } = model;
  const phase = d.phase;
  const unsure = d.uncertain.includes("phase") || d.uncertain.includes("applied_on");
  const showSent = NOT_SENT.includes(phase) || ((phase === "applied" || phase === "screening") && (!d.appliedOn || unsure));

  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <p className="text-[15px] font-semibold text-ink">What happened?</p>
      <div className="flex flex-wrap gap-2">
        {showSent ? (
          <AskButton
            model={model}
            action="sent"
            label="Sent it"
            icon={Send}
            title="When did you send it?"
            dateLabel="Date sent"
            pastOnly
            primary={phase === "draft"}
          />
        ) : null}
        {phase !== "offer" ? (
          <AskButton model={model} action="reply" label="Got a reply" icon={MessageSquareReply} title="When did they reply?" dateLabel="Date" pastOnly />
        ) : null}
        <AskButton model={model} action="interview" label="Interview" icon={CalendarClock} title="When is the interview?" dateLabel="Date" withTime />
        {phase !== "rejected" ? (
          <AskButton model={model} action="rejected" label="Rejected" icon={CircleX} title="When did they say no?" dateLabel="Date" pastOnly />
        ) : null}
        {phase !== "offer" ? (
          <AskButton model={model} action="offer" label="Offer" icon={Trophy} title="When did the offer come?" dateLabel="Date" pastOnly />
        ) : null}
        {phase !== "no_reply" && !NOT_SENT.includes(phase) ? <NowButton model={model} action="no_reply" label="No reply" icon={Hourglass} /> : null}
        {phase === "draft" ? <NowButton model={model} action="skip" label="Not applying" /> : null}
      </div>
    </div>
  );
}
