"use client";

import { Check, CalendarClock, MessageSquareReply, Trophy, X, Clock3, NotebookPen } from "lucide-react";
import { useState } from "react";
import { Button, DateInput, Field, Popover, useToast } from "@/ui";
import { logEvent, movePhase, updateApplication, type MoveResult } from "../../../lib/data";
import type { Phase } from "../../../lib/types";
import { EventForm, type EventDraft } from "./EventForm";
import type { DossierModel } from "./model";
import { shortDate } from "./format";

type Props = { model: DossierModel };

/** The primary action of the header, which depends on the phase (spec 2.3). */
export function PhaseActions({ model }: Props) {
  const { derived } = model;
  const phase = derived.phase;
  if (phase === "draft") return <DraftActions model={model} />;
  if (phase === "applied" || phase === "screening") return <WaitingActions model={model} />;
  if (phase === "interviewing") return <InterviewActions model={model} />;
  if (phase === "offer") return <OfferActions model={model} />;
  return null;
}

function useMoveWithUndo() {
  const toast = useToast();
  return async (jobId: number, to: Phase, text: string) => {
    let res: MoveResult;
    try {
      res = await movePhase(jobId, to);
    } catch (e) {
      toast.show({ kind: "error", text: e instanceof Error ? e.message : "Could not move it." });
      return;
    }
    toast.show({
      text,
      action: {
        label: "Undo",
        run: async () => {
          try {
            await res.undo();
          } catch (e) {
            toast.show({ kind: "error", text: e instanceof Error ? e.message : "Could not undo." });
          }
        },
      },
    });
  };
}

/** Removes `fields` from `uncertain` (the user just stated them). */
async function confirmFields(model: DossierModel, fields: string[]) {
  const left = model.derived.uncertain.filter((f) => !fields.includes(f));
  if (left.length !== model.derived.uncertain.length) await updateApplication(model.app.id, { uncertain: left });
}

function useLog(model: DossierModel) {
  const toast = useToast();
  return async (draft: EventDraft, done: string, confirms: string[] = []) => {
    await logEvent(model.app.id, {
      kind: draft.kind,
      occurred_on: draft.occurred_on,
      occurred_at: draft.occurred_at,
      title: draft.title,
      body: draft.body,
    });
    await confirmFields(model, confirms);
    toast.show({ text: done });
  };
}

function DraftActions({ model }: Props) {
  const toast = useToast();
  const move = useMoveWithUndo();
  const [date, setDate] = useState(model.today);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Popover
        anchor="bottom start"
        title="When did you send it?"
        trigger={
          <Button variant="primary" icon={Check}>
            Mark as sent
          </Button>
        }
      >
        {(close) => (
          <form
            className="flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await logEvent(model.app.id, { kind: "applied", occurred_on: date });
                await confirmFields(model, ["phase", "applied_on"]);
                toast.show({ text: `Marked as sent on ${shortDate(date, model.today)}.` });
                close();
              } catch (err) {
                toast.show({ kind: "error", text: err instanceof Error ? err.message : "Could not save." });
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Date sent">
              <DateInput value={date} max={model.today} onChange={(e) => setDate(e.target.value)} required />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" loading={busy}>
                Mark as sent
              </Button>
            </div>
          </form>
        )}
      </Popover>
      <Button variant="secondary" icon={X} onClick={() => move(model.app.id, "skipped", "Dropped. It moves to Closed.")}>
        Drop it
      </Button>
    </>
  );
}

function WaitingActions({ model }: Props) {
  const log = useLog(model);
  const move = useMoveWithUndo();
  return (
    <>
      <Popover
        anchor="bottom start"
        title="Log a reply"
        className="w-[min(24rem,calc(100vw-32px))]"
        trigger={
          <Button variant="primary" icon={MessageSquareReply}>
            Log a reply
          </Button>
        }
      >
        {(close) => (
          <EventForm
            kinds={["reply", "interview_scheduled", "assessment", "rejection", "auto_ack"]}
            labels={{ interview_scheduled: "Interview invite", auto_ack: "Auto-reply" }}
            picker="select"
            withTime
            today={model.today}
            submitLabel="Log it"
            onCancel={close}
            onSubmit={async (d) => {
              await log(d, "Logged. The timeline and the stepper are updated.");
              close();
            }}
          />
        )}
      </Popover>
      <Button variant="secondary" icon={Clock3} onClick={() => move(model.app.id, "no_reply", "Marked as no reply.")}>
        Mark no reply
      </Button>
    </>
  );
}

function InterviewActions({ model }: Props) {
  const log = useLog(model);
  return (
    <>
      <Popover
        anchor="bottom start"
        title="Log interview"
        className="w-[min(24rem,calc(100vw-32px))]"
        trigger={
          <Button variant="primary" icon={CalendarClock}>
            Log interview
          </Button>
        }
      >
        {(close) => (
          <EventForm
            kinds={["interview_done", "interview_scheduled"]}
            labels={{ interview_done: "It happened", interview_scheduled: "One is scheduled" }}
            withTitle
            withTime
            today={model.today}
            submitLabel="Log it"
            onCancel={close}
            onSubmit={async (d) => {
              await log(d, "Interview logged.");
              close();
            }}
          />
        )}
      </Popover>
      <OutcomePopover model={model} primary={false} />
    </>
  );
}

function OfferActions({ model }: Props) {
  const log = useLog(model);
  return (
    <Popover
      anchor="bottom start"
      title="Add a note"
      className="w-[min(24rem,calc(100vw-32px))]"
      trigger={
        <Button variant="secondary" icon={NotebookPen}>
          Add a note
        </Button>
      }
    >
      {(close) => (
        <EventForm
          kinds={["note", "withdrawn"]}
          labels={{ withdrawn: "I declined" }}
          withTitle
          today={model.today}
          submitLabel="Save"
          onCancel={close}
          onSubmit={async (d) => {
            await log(d, "Saved.");
            close();
          }}
        />
      )}
    </Popover>
  );
}

function OutcomePopover({ model, primary }: Props & { primary: boolean }) {
  const log = useLog(model);
  return (
    <Popover
      anchor="bottom start"
      title="Record outcome"
      className="w-[min(24rem,calc(100vw-32px))]"
      trigger={
        <Button variant={primary ? "primary" : "secondary"} icon={Trophy}>
          Record outcome
        </Button>
      }
    >
      {(close) => (
        <EventForm
          kinds={["rejection", "offer", "withdrawn"]}
          labels={{ rejection: "Rejected", offer: "Offer", withdrawn: "I withdrew" }}
          today={model.today}
          submitLabel="Record it"
          onCancel={close}
          onSubmit={async (d) => {
            await log(d, "Outcome recorded.", ["phase"]);
            close();
          }}
        />
      )}
    </Popover>
  );
}
