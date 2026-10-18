"use client";

import { ArrowRight, Pencil } from "lucide-react";
import { useState, type FormEvent } from "react";
import { daysBetween, isOpen } from "../../../lib/core";
import { updateApplication } from "../../../lib/data";
import { Button, DateInput, Input, cx, useToast } from "@/ui";
import { shortDate } from "./format";
import type { DossierModel } from "./model";

/** Closed applications show the line only when a next action is still set. */
export function showNextAction(model: DossierModel): boolean {
  return isOpen(model.derived.phase) || !!model.app.next_action;
}

/** "Next: Record the interview outcome · due 20 Oct", edited in place (spec 2.3 header). */
export function NextAction({ model, className }: { model: DossierModel; className?: string }) {
  const { app, today } = model;
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(app.next_action ?? "");
  const [due, setDue] = useState(app.next_action_due ?? "");
  const [busy, setBusy] = useState(false);

  const open = () => {
    setText(app.next_action ?? "");
    setDue(app.next_action_due ?? "");
    setEditing(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const next = text.trim() || null;
      await updateApplication(app.id, { next_action: next, next_action_due: next ? due || null : null });
      setEditing(false);
      toast.show({ text: next ? "Next action saved." : "Next action cleared." });
    } catch (err) {
      toast.show({ kind: "error", text: err instanceof Error ? err.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <form onSubmit={save} className={cx("flex flex-wrap items-center gap-2", className)}>
        <Input
          aria-label="Next action"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What is the next step?"
          className="min-w-0 flex-1 basis-56"
          autoFocus
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        />
        <DateInput aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} />
        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="sm" loading={busy}>
            Save
          </Button>
          <Button size="sm" variant="quiet" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  const left = app.next_action_due ? daysBetween(today, app.next_action_due) : null;
  const dueText =
    left === null ? null : left < 0 ? `overdue since ${shortDate(app.next_action_due, today)}` : left === 0 ? "due today" : `due ${shortDate(app.next_action_due, today)}`;

  return (
    <div className={cx("flex min-w-0 items-start gap-2 text-small", className)}>
      <ArrowRight aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-3" />
      {app.next_action ? (
        <button
          type="button"
          onClick={open}
          className="group relative -mx-1 -my-0.5 flex min-w-0 flex-wrap items-baseline gap-x-2 rounded-sm px-1 py-0.5 text-left hover:bg-surface-2"
        >
          <span className="text-ink-2">Next:</span>
          <span className="text-ink">{app.next_action}</span>
          {dueText ? (
            <span className={cx("iv-num text-caption", left !== null && left < 0 ? "text-caution" : "text-ink-3")}>{dueText}</span>
          ) : null}
          <Pencil aria-hidden size={13} className="self-center text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          <span className="sr-only">Edit the next action</span>
        </button>
      ) : (
        <button type="button" onClick={open} className="-mx-1 -my-0.5 rounded-sm px-1 py-0.5 text-ink-3 hover:bg-surface-2 hover:text-ink">
          No next action. Add one
        </button>
      )}
    </div>
  );
}
