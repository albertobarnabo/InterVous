"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteEvent, type JobEvent } from "../../../lib/data";
import { ConfirmDialog, IconButton, cx, useToast } from "@/ui";
import { shortDate } from "./format";
import { Section } from "./glass";
import type { DossierModel } from "./model";
import { eventLine } from "./status";

/** "History": what happened with this application, newest first, one dated line each. */
export function History({ model }: { model: DossierModel }) {
  const { today } = model;
  const toast = useToast();
  const [confirm, setConfirm] = useState<JobEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const events = [...model.dossier.events].reverse();

  return (
    <Section id="history" title="History">
      {events.length === 0 ? (
        <p className="text-[16px] text-ink-2">Nothing yet. Use “What happened?” above when something changes.</p>
      ) : (
        <ol className="flex flex-col">
          {events.map((e, i) => {
            const { label, detail } = eventLine(e);
            const upcoming = e.occurred_on > today;
            return (
              <li
                key={e.id}
                className={cx("group grid grid-cols-[72px_1fr_auto] items-start gap-x-3 py-3", i > 0 && "border-t border-[rgba(15,23,42,0.08)]")}
              >
                <span className="pt-px text-[14px] leading-6 text-ink-2 tabular-nums">{shortDate(e.occurred_on, today)}</span>
                <div className="min-w-0">
                  <p className="text-[16px] leading-6 text-ink">
                    {label}
                    {upcoming ? <span className="ml-2 text-[14px] font-medium text-accent">upcoming</span> : null}
                  </p>
                  {detail ? <p className="mt-0.5 text-[15px] leading-6 text-ink-2">{detail}</p> : null}
                  {e.body ? <p className="mt-0.5 max-w-[68ch] text-[15px] leading-6 whitespace-pre-line text-ink-2">{e.body}</p> : null}
                </div>
                <IconButton
                  label={`Remove “${label}” from the history`}
                  icon={Trash2}
                  size="sm"
                  onClick={() => setConfirm(e)}
                  className="-my-1 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                />
              </li>
            );
          })}
        </ol>
      )}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Remove this from the history?"
        body={confirm ? `${eventLine(confirm).label}, ${shortDate(confirm.occurred_on, today)}. The status stays as it is.` : null}
        confirmLabel="Remove"
        loading={busy}
        onConfirm={async () => {
          if (!confirm) return;
          setBusy(true);
          try {
            await deleteEvent(confirm.id);
            toast.show({ text: "Removed from the history." });
            setConfirm(null);
          } catch (err) {
            toast.show({ kind: "error", text: err instanceof Error ? err.message : "It was not removed. Try again." });
          } finally {
            setBusy(false);
          }
        }}
      />
    </Section>
  );
}
