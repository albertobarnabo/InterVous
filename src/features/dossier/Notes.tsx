"use client";

import { Check, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { updateApplication } from "../../../lib/data";
import { Button, Textarea, cx } from "@/ui";
import { Section, solidClass } from "./glass";
import { Markdown } from "./Markdown";

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * "Notes": written in place and saved 800ms after typing stops. Leaving the field saves at once;
 * the last error stays visible until the next save works.
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

  // A newer value from the server (command line, another tab) replaces the text while not editing.
  useEffect(() => {
    if (editingRef.current) return;
    setText(notes ?? "");
    saved.current = notes ?? "";
  }, [notes]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

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
      setError(e instanceof Error ? e.message : "It was not saved. Try again.");
    }
  };

  const onChange = (value: string) => {
    setText(value);
    setState("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(value), 800);
  };

  const done = () => {
    void save(text);
    setEditing(false);
  };

  let body;
  if (editing) {
    body = (
      <div className="flex flex-col gap-2">
        <Textarea
          aria-label="Notes"
          rows={6}
          value={text}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => void save(text)}
          onKeyDown={(e) => {
            if (e.key === "Escape") done();
          }}
          placeholder="Names, salary talk, how the interview went: anything worth remembering."
          className="text-[16px] leading-7"
        />
        <div className="flex items-center justify-between gap-3">
          <p aria-live="polite" className={cx("text-[14px]", state === "error" ? "text-danger" : "text-ink-3")}>
            {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? error : "Saves as you type"}
          </p>
          <Button size="sm" variant="primary" icon={Check} onClick={done}>
            Done
          </Button>
        </div>
      </div>
    );
  } else if (!text.trim()) {
    body = (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full cursor-pointer rounded-[16px] border border-dashed border-[rgba(15,23,42,0.18)] px-4 py-4 text-left text-[16px] text-ink-2 transition-colors hover:border-[rgba(15,23,42,0.32)] hover:bg-white/40 hover:text-ink"
      >
        No notes yet. Tap to write one.
      </button>
    );
  } else {
    body = (
      <div className={cx(solidClass, "px-4 py-3 sm:px-5 sm:py-4")}>
        <Markdown text={text} className="max-w-[70ch] text-[16px] leading-[1.65] text-ink" />
        {state === "error" ? <p className="mt-2 text-[14px] text-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <Section
      id="notes"
      title="Notes"
      action={
        !editing && text.trim() ? (
          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : null
      }
    >
      {body}
    </Section>
  );
}
