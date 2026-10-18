"use client";
// Moving an application to another phase (docs/SPEC.md 2.2, board): a date (default today) and an
// optional note, then a `phase_change` event through movePhase(). The database moves the phase;
// the toast's Undo deletes that event and restores the previous phase.
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { movePhase } from "../../../lib/data";
import { PHASES } from "../../../lib/types";
import { Button, DateInput, Dialog, Field, Input, PhaseDot, cx, phaseLabel, useToast } from "@/ui";
import type { AppItem, Phase } from "./model";

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** movePhase() with the Undo toast. Resolves true when the event was written. */
export function useMover() {
  const toast = useToast();
  return useCallback(
    async (item: AppItem, to: Phase, opts: { on?: string; note?: string | null }) => {
      const name = item.company;
      try {
        const res = await movePhase(item.id, to, { on: opts.on, note: opts.note?.trim() || null });
        const from = res.from ?? item.phase;
        const undo = async () => {
          try {
            await res.undo();
            toast.show({ kind: "info", text: `${name} is back in ${phaseLabel(from)}.` });
          } catch (e) {
            toast.show({ kind: "error", text: `Could not undo: ${message(e)}` });
          }
        };
        if (!res.moved && from !== to) {
          toast.show({
            kind: "info",
            text: `Logged for ${name}, but a newer event keeps it in ${phaseLabel(from)}.`,
            action: { label: "Undo", run: undo },
          });
        } else {
          toast.show({ text: `Moved ${name} to ${phaseLabel(to)}.`, action: { label: "Undo", run: undo } });
        }
        return true;
      } catch (e) {
        toast.show({ kind: "error", text: `Could not move ${name}: ${message(e)}` });
        return false;
      }
    },
    [toast],
  );
}

export const CLOSING_PHASES: Phase[] = ["rejected", "no_reply", "withdrawn", "skipped"];

type MoveFormProps = {
  item: AppItem;
  today: string;
  /** The target phase when it is already known (a drop on a single-phase column). */
  to?: Phase | null;
  /** Phases to choose from when `to` is not given. */
  choices?: Phase[];
  /** Legend above the phase choices. */
  choiceLabel?: string;
  onDone: (to: Phase) => void;
  onCancel: () => void;
  /** Lay the choices out in two columns (dialog) or one (narrow board column). */
  wide?: boolean;
};

/** Phase (when needed), date and optional note. Enter submits, Esc cancels. */
export function MoveForm({ item, today, to, choices, choiceLabel = "Move to", onDone, onCancel, wide }: MoveFormProps) {
  const move = useMover();
  const [phase, setPhase] = useState<Phase | null>(to ?? null);
  const [on, setOn] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const firstRef = useRef<HTMLInputElement | null>(null);
  const legendId = useId();
  const needsChoice = !to && !!choices?.length;

  useEffect(() => {
    // Focus the first control once the panel is on screen.
    const t = setTimeout(() => firstRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!phase || busy) return;
    setBusy(true);
    const ok = await move(item, phase, { on: on || today, note });
    setBusy(false);
    if (ok) onDone(phase);
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
      className="flex flex-col gap-4"
    >
      {needsChoice ? (
        <fieldset aria-labelledby={legendId} className="flex flex-col gap-2">
          <legend id={legendId} className="mb-2 text-small font-medium text-ink">
            {choiceLabel}
          </legend>
          <div role="radiogroup" aria-labelledby={legendId} className={cx("grid gap-1.5", wide ? "grid-cols-2" : "grid-cols-1")}>
            {choices!.map((p, i) => {
              const current = p === item.phase;
              const on = phase === p;
              return (
                <label
                  key={p}
                  className={cx(
                    "flex h-10 cursor-pointer items-center gap-2.5 rounded-sm border px-3 text-small transition-colors duration-[120ms] ease-out pointer-coarse:h-11",
                    on ? "border-accent bg-accent-soft text-ink" : "border-line-strong bg-surface text-ink hover:bg-surface-2",
                    current && "cursor-not-allowed opacity-50",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                  )}
                >
                  <input
                    ref={i === 0 || (choices![0] === item.phase && i === 1) ? firstRef : undefined}
                    type="radio"
                    name={`move-${item.id}`}
                    value={p}
                    checked={on}
                    disabled={current}
                    onChange={() => setPhase(p)}
                    className="sr-only"
                  />
                  <PhaseDot phase={p} label="" />
                  <span className="flex-1">{phaseLabel(p)}</span>
                  {current ? <span className="text-caption font-normal text-ink-3">now</span> : null}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      <div className={cx("grid gap-3", wide ? "sm:grid-cols-[auto_1fr]" : "grid-cols-1")}>
        <Field label="On">
          <DateInput
            ref={needsChoice ? undefined : firstRef}
            value={on}
            onChange={(e) => setOn(e.target.value)}
            required
            className="w-full"
          />
        </Field>
        <Field label="Note" hint="Optional">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Recruiter called" autoComplete="off" />
        </Field>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="quiet" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy} disabled={!phase}>
          {phase && wide ? `Move to ${phaseLabel(phase)}` : "Move"}
        </Button>
      </div>
    </form>
  );
}

/** The `m` key (list and board) and the card's "Move to…" menu. */
export function MoveDialog({
  item,
  today,
  to,
  onClose,
}: {
  item: AppItem | null;
  today: string;
  to?: Phase | null;
  onClose: (moved: Phase | null) => void;
}) {
  // Freeze the item for the life of the dialog: the move patches the row (its phase) before the
  // dialog closes, and the text must not change while it fades out.
  const last = useRef<AppItem | null>(null);
  const wasOpen = useRef(false);
  if (item && !wasOpen.current) last.current = item;
  wasOpen.current = !!item;
  const shown = last.current;
  return (
    <Dialog
      open={!!item}
      onClose={() => onClose(null)}
      title={to ? `Move to ${phaseLabel(to)}` : "Move to…"}
      description={shown ? `${shown.company} · ${shown.role}. Now: ${phaseLabel(shown.phase)}.` : undefined}
    >
      {shown ? (
        <MoveForm
          key={`${shown.id}-${to ?? ""}`}
          item={shown}
          today={today}
          to={to}
          choices={to ? undefined : (PHASES as Phase[])}
          choiceLabel="Where does it stand now?"
          onDone={(p) => onClose(p)}
          onCancel={() => onClose(null)}
          wide
        />
      ) : null}
    </Dialog>
  );
}
