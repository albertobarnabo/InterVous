"use client";

import { useState, type FormEvent } from "react";
import { EVENT_KIND_LABELS, type EventKind } from "../../../lib/core";
import { Button, DateInput, Field, Input, SegmentedControl, Select, Textarea } from "@/ui";

export type EventDraft = {
  kind: EventKind;
  occurred_on: string;
  occurred_at: string | null;
  title: string | null;
  body: string | null;
};

export type EventFormProps = {
  /** Kinds offered, first one selected. One kind hides the picker. */
  kinds: EventKind[];
  /** Override the picker labels ("Interview invite" instead of "Interview scheduled"). */
  labels?: Partial<Record<EventKind, string>>;
  today: string;
  submitLabel: string;
  /** Shows a free title line (e.g. "Round 2, technical"). */
  withTitle?: boolean;
  /** Shows an optional time when the kind is interview_scheduled. */
  withTime?: boolean;
  onSubmit: (draft: EventDraft) => Promise<void>;
  onCancel?: () => void;
  /** "segmented" for 2-4 short choices, "select" for the full list. */
  picker?: "segmented" | "select";
};

/** Kind + date + optional title, time and note. Used by the header actions and by "Add event". */
export function EventForm({
  kinds,
  labels,
  today,
  submitLabel,
  withTitle,
  withTime,
  onSubmit,
  onCancel,
  picker = "segmented",
}: EventFormProps) {
  const [kind, setKind] = useState<EventKind>(kinds[0]);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = (k: EventKind) => labels?.[k] ?? EVENT_KIND_LABELS[k] ?? k;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date) {
      setError("Pick a date.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let occurred_at: string | null = null;
      if (withTime && kind === "interview_scheduled" && time) {
        const t = new Date(`${date}T${time}`);
        occurred_at = Number.isNaN(t.getTime()) ? null : t.toISOString();
      }
      await onSubmit({ kind, occurred_on: date, occurred_at, title: title.trim() || null, body: body.trim() || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Try again.");
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {kinds.length > 1 ? (
        picker === "segmented" ? (
          <SegmentedControl
            aria-label="What happened"
            size="sm"
            value={kind}
            onChange={(v) => setKind(v as EventKind)}
            options={kinds.map((k) => ({ value: k, label: label(k) }))}
            className="self-start"
          />
        ) : (
          <Field label="What happened">
            <Select<EventKind> value={kind} onChange={setKind} options={kinds.map((k) => ({ value: k, label: label(k) }))} />
          </Field>
        )
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Field label="Date">
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        {withTime && kind === "interview_scheduled" ? (
          <Field label="Time" hint="Optional">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="iv-num w-32" />
          </Field>
        ) : null}
      </div>
      {withTitle ? (
        <Field label="Title" hint="Optional. Shown in the timeline.">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={label(kind)} />
        </Field>
      ) : null}
      <Field label="Note" hint="Optional">
        <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="quiet" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="primary" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
