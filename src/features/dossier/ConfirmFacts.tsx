"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleHelp } from "lucide-react";
import { useState } from "react";
import { PHASES, type ConfirmOption, type ConfirmQuestion } from "../../../lib/core";
import { logEvent, movePhase, updateApplication, type JobUpdate } from "../../../lib/data";
import type { Phase } from "../../../lib/types";
import { Button, DateInput, Input, Select, phaseLabel, useToast } from "@/ui";
import { fieldLabel, shortDate } from "./format";
import type { DossierModel } from "./model";

const LABELS: Record<ConfirmOption, string> = {
  yes: "Yes",
  different_date: "Different date",
  not_sent: "No",
  yes_on_date: "Yes, on…",
  not_yet: "Not yet",
  dropped: "I dropped it",
  date: "Set the date",
  rejected: "Rejected",
  offer: "Offer",
  withdrawn: "I withdrew",
  sent_on_date: "Sent on…",
  change: "Change",
};

/** Options that need a date (or a value) before they can be saved. */
const NEEDS_DATE: ConfirmOption[] = ["different_date", "yes_on_date", "date", "sent_on_date", "rejected", "offer", "withdrawn"];

/** The question text in the dossier's own voice: "Did you send this on 30 Aug?". */
function localText(q: ConfirmQuestion): string {
  return q.text.split(`${q.company} · ${q.role}`).join("this");
}

/**
 * One question at a time about a fact the history is unsure about (spec 2.3, same questions as
 * the Today confirm flow). Each answer writes the field, removes it from `uncertain` and logs an event.
 */
export function ConfirmFacts({ model }: { model: DossierModel }) {
  const { questions } = model;
  const reduce = useReducedMotion();
  const toast = useToast();
  const [pending, setPending] = useState<ConfirmOption | null>(null);
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>("applied");
  const [busy, setBusy] = useState(false);
  const q = questions[0];
  if (!q) return null;

  const id = model.app.id;
  const left = model.derived.uncertain.filter((f) => !q.fields.includes(f));
  const isDraft = model.derived.phase === "draft";
  const dateField = q.fields.includes("cv_built_on") ? "cv_built_on" : "applied_on";
  const otherField = q.kind === "other" ? q.fields[0] : null;

  const note = (title: string) => logEvent(id, { kind: "note", title });

  const answer = async (opt: ConfirmOption, input?: string) => {
    setBusy(true);
    try {
      const patch: JobUpdate = { uncertain: left };
      switch (opt) {
        case "yes":
        case "not_yet":
          await note(`Confirmed ${q.fields.map(fieldLabel).join(" and ")}`);
          break;
        case "not_sent":
          if (isDraft) {
            await note("Confirmed: not sent");
          } else {
            patch.phase = "draft";
            patch.applied_on = null;
          }
          break;
        case "dropped":
          await logEvent(id, { kind: "skipped" });
          break;
        case "rejected":
        case "offer":
        case "withdrawn":
          await logEvent(id, { kind: opt === "rejected" ? "rejection" : opt, occurred_on: input });
          break;
        case "different_date":
        case "yes_on_date":
        case "date":
        case "sent_on_date":
          if (dateField === "applied_on" && (isDraft || opt === "sent_on_date")) {
            await logEvent(id, { kind: "applied", occurred_on: input });
          } else {
            await note(`${dateField === "cv_built_on" ? "CV date" : "Sent date"} set to ${shortDate(input, model.today)}`);
          }
          patch[dateField] = input;
          break;
        case "change":
          if (q.fields.includes("phase")) {
            await movePhase(id, phase);
          } else if (otherField) {
            (patch as Record<string, unknown>)[otherField] = input ?? null;
            await note(`Corrected ${fieldLabel(otherField)}`);
          }
          break;
      }
      await updateApplication(id, patch);
      setPending(null);
      setValue("");
      toast.show({ text: questions.length > 1 ? "Saved. One more question." : "Saved. Everything here is confirmed." });
    } catch (e) {
      toast.show({ kind: "error", text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  };

  const choose = (opt: ConfirmOption) => {
    if (NEEDS_DATE.includes(opt)) {
      setPending(opt);
      setValue(opt === "different_date" ? "" : model.today);
    } else if (opt === "change") {
      setPending(opt);
      setValue("");
    } else void answer(opt);
  };

  return (
    <div className="rounded-md border border-dashed border-line-strong bg-surface px-4 py-3" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={q.key}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-start gap-2 text-small text-ink">
            <CircleHelp aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-3" />
            <span>
              {localText(q)}
              {questions.length > 1 ? <span className="iv-num ml-2 text-caption text-ink-3">1 of {questions.length}</span> : null}
            </span>
          </p>
          {pending === null ? (
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt, i) => (
                <Button key={opt} size="sm" variant={i === 0 ? "primary" : "secondary"} disabled={busy} onClick={() => choose(opt)}>
                  {opt === "not_sent" && q.kind === "phase" ? "Still not sent" : LABELS[opt]}
                </Button>
              ))}
            </div>
          ) : (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (pending === "change" && q.fields.includes("phase")) void answer("change");
                else if (value) void answer(pending, value);
              }}
            >
              {pending === "change" && q.fields.includes("phase") ? (
                <Select<Phase>
                  aria-label="Where it stands"
                  size="sm"
                  value={phase}
                  onChange={setPhase}
                  options={PHASES.map((p) => ({ value: p, label: phaseLabel(p) }))}
                  className="w-44"
                />
              ) : pending === "change" ? (
                <Input aria-label={fieldLabel(otherField ?? "")} value={value} onChange={(e) => setValue(e.target.value)} className="h-8 w-48" autoFocus />
              ) : (
                <DateInput aria-label="Date" value={value} max={model.today} onChange={(e) => setValue(e.target.value)} className="h-8" autoFocus />
              )}
              <Button type="submit" size="sm" variant="primary" loading={busy}>
                Save
              </Button>
              <Button size="sm" variant="quiet" onClick={() => setPending(null)}>
                Back
              </Button>
            </form>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
