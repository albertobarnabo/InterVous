"use client";

import { Check, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { updateApplication } from "../../../lib/data";
import { Button, Textarea, cx } from "@/ui";
import { Markdown } from "./Markdown";

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Notes, markdown, edited in place and saved 800ms after typing stops (spec 2.3).
 * Leaving the field saves at once; the last error stays visible until the next save works.
 */
export function Notes({ jobId, notes }: { jobId: number; notes: string | null }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(notes ?? "");
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const saved = useRef(notes ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editingRef = useRef(false);
  editingRef.current = editing;

  // A newer value from the server (CLI write, other tab) replaces the text while not editing.
  useEffect(() => {
    if (editingRef.current) return;
    setText(notes ?? "");
    saved.current = notes ?? "";
  }, [notes]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const save = async (value: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (value === saved.current) return;
    setState("saving");
    try {
      await updateApplication(jobId, { notes: value.trim() ? value : null });
      saved.current = value;
      setState("saved");
      setError(null);
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Could not save.");
    }
  };

  const onChange = (value: string) => {
    setText(value);
    setState("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(value), 800);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <Textarea
          aria-label="Notes"
          rows={6}
          value={text}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => void save(text)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              void save(text);
              setEditing(false);
            }
          }}
          placeholder="Anything worth remembering. Markdown works."
          className="font-serif text-body leading-7"
        />
        <div className="flex items-center justify-between gap-3">
          <p aria-live="polite" className={cx("text-caption font-normal", state === "error" ? "text-danger" : "text-ink-3")}>
            {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? error : "Saves as you type"}
          </p>
          <Button
            size="sm"
            variant="secondary"
            icon={Check}
            onClick={() => {
              void save(text);
              setEditing(false);
            }}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (!text.trim()) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full rounded-md border border-dashed border-line-strong px-4 py-4 text-left text-small text-ink-3 hover:border-ink-3 hover:text-ink"
      >
        No notes yet. Write one
      </button>
    );
  }

  return (
    <div className="group relative">
      <div className="font-serif text-body leading-7 text-ink">
        <Markdown text={text} />
      </div>
      <Button size="sm" variant="quiet" icon={Pencil} onClick={() => setEditing(true)} className="mt-2 -ml-2.5">
        Edit notes
      </Button>
      {state === "error" ? <p className="mt-1 text-caption text-danger">{error}</p> : null}
    </div>
  );
}
