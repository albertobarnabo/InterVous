"use client";

import { Linkedin, Mail, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { isOpen, type EventKind } from "../../../lib/core";
import { deleteApplication, logEvent } from "../../../lib/data";
import { Button, ConfirmDialog, cx, useToast } from "@/ui";
import { EventForm } from "./EventForm";
import { gridFacts } from "./facts";
import type { DossierModel } from "./model";
import { Notes } from "./Notes";
import { Timeline } from "./Timeline";
import { Unsure } from "./Unsure";

const ADD_KINDS: EventKind[] = [
  "reply",
  "interview_scheduled",
  "interview_done",
  "assessment",
  "follow_up_sent",
  "auto_ack",
  "rejection",
  "offer",
  "withdrawn",
  "posting_closed",
  "note",
];

function Block({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-h3 text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The facts grid: salary as written, visa, channel, role family, ... (spec 2.3, Overview). */
export function FactsGrid({ model, className }: { model: DossierModel; className?: string }) {
  const facts = gridFacts(model.app, model.job, model.today);
  if (!facts.length) return null;
  return (
    <dl className={cx("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-1", className)}>
      {facts.map((f) => (
        <div key={f.field} className="min-w-0">
          <dt className="text-caption text-ink-3">{f.label}</dt>
          <dd className={cx("mt-0.5 text-small break-words", f.quiet ? "text-ink-2" : "text-ink")}>
            <Unsure unsure={model.uncertain.has(f.field)} evidence={model.job.status_evidence}>
              <span>{f.value}</span>
            </Unsure>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Contacts({ model }: { model: DossierModel }) {
  const contacts = model.dossier.contacts;
  if (!contacts.length) return null;
  return (
    <ul className="flex flex-col gap-3">
      {contacts.map((c) => (
        <li key={c.id} className="min-w-0">
          <p className="text-small text-ink">{c.name}</p>
          {c.role && c.role !== c.name ? <p className="text-caption font-normal text-ink-3">{c.role}</p> : null}
          {c.email || c.linkedin_url ? (
            <p className="mt-1 flex flex-wrap gap-3 text-caption">
              {c.email ? (
                <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-accent underline-offset-2 hover:underline">
                  <Mail aria-hidden size={13} /> {c.email}
                </a>
              ) : null}
              {c.linkedin_url ? (
                <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent underline-offset-2 hover:underline">
                  <Linkedin aria-hidden size={13} /> LinkedIn
                </a>
              ) : null}
            </p>
          ) : null}
          {c.notes ? <p className="mt-1 text-caption font-normal text-ink-2">{c.notes}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function DeleteApplication({ model }: { model: DossierModel }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const name = model.app.company_name;
  return (
    <>
      <Button variant="quiet" icon={Trash2} onClick={() => setOpen(true)} className="self-start text-ink-3 hover:text-danger">
        Delete application
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this application?"
        body={
          <>
            {model.app.role} at {name}, with its timeline, documents, answers and fit notes. This cannot be undone.
          </>
        }
        typeToConfirm={name}
        confirmLabel="Delete for good"
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await deleteApplication(model.app.id);
            setOpen(false);
            toast.show({ text: `Deleted ${model.app.role} at ${name}.` });
            // replace, so Back does not return to the deleted dossier
            router.replace("/applications");
          } catch (e) {
            toast.show({ kind: "error", text: e instanceof Error ? e.message : "Could not delete it." });
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

/**
 * The Overview tab (spec 2.3): timeline (oldest first), Add event, facts (under lg; the side
 * column holds them on desktop), contacts, notes, and the quiet delete at the very bottom.
 */
export function OverviewTab({ model }: { model: DossierModel }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const contacts = model.dossier.contacts.length > 0;

  return (
    <div className="flex flex-col gap-10">
      {gridFacts(model.app, model.job, model.today).length ? (
        <div className="rounded-md bg-surface p-4 shadow-1 lg:hidden">
          <FactsGrid model={model} />
        </div>
      ) : null}

      <Block
        title="Timeline"
        action={
          adding ? null : (
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setAdding(true)}>
              Add event
            </Button>
          )
        }
      >
        {adding ? (
          <div className="rounded-md bg-surface p-4 shadow-1">
            <EventForm
              kinds={ADD_KINDS}
              labels={{ auto_ack: "Automatic acknowledgement", interview_scheduled: "Interview invite" }}
              picker="select"
              withTitle
              withTime
              today={model.today}
              submitLabel="Add to the timeline"
              onCancel={() => setAdding(false)}
              onSubmit={async (d) => {
                await logEvent(model.app.id, {
                  kind: d.kind,
                  occurred_on: d.occurred_on,
                  occurred_at: d.occurred_at,
                  title: d.title,
                  body: d.body,
                });
                setAdding(false);
                toast.show({ text: "Added to the timeline." });
              }}
            />
          </div>
        ) : null}
        <Timeline events={model.dossier.events} today={model.today} trailing={isOpen(model.derived.phase)} />
      </Block>

      {contacts ? (
        <div className="lg:hidden">
          <Block title="Contacts">
            <Contacts model={model} />
          </Block>
        </div>
      ) : null}

      <Block title="Notes">
        <Notes jobId={model.app.id} notes={model.job.notes} />
      </Block>

      <div className="border-t border-line pt-6">
        <DeleteApplication model={model} />
      </div>
    </div>
  );
}
