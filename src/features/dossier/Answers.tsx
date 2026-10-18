"use client";

import { Check, Copy, Pencil, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { updateAnswer, type JobAnswer } from "../../../lib/data";
import { Button, Textarea, cx, useToast } from "@/ui";
import { copyText, int } from "./format";
import { Section, solidClass } from "./glass";
import type { DossierModel } from "./model";

function Count({ text, limit }: { text: string | null; limit: number | null }) {
  if (text === null && !limit) return null;
  const n = text?.length ?? 0;
  const over = limit !== null && n > limit;
  return (
    <span className={cx("shrink-0 text-[14px] tabular-nums", over ? "font-medium text-danger" : "text-ink-3")}>
      {int(n)}
      {limit ? ` of ${int(limit)}` : ""} characters
      {over ? " (over the limit)" : ""}
    </span>
  );
}

function Answer({ a }: { a: JobAnswer }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(a.answer ?? "");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const copy = async () => {
    if (a.answer === null) return;
    try {
      await copyText(a.answer);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.show({ kind: "error", text: "The browser blocked copying. Select the text and copy it by hand." });
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await updateAnswer(a.id, { answer: draft.trim() ? draft : null });
      setEditing(false);
      toast.show({ text: "Answer saved." });
    } catch (e) {
      toast.show({ kind: "error", text: e instanceof Error ? e.message : "It was not saved. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-col gap-2">
      <p className="text-[16px] leading-6 font-semibold text-ink">{a.question}</p>
      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea aria-label={`Answer to: ${a.question}`} rows={7} value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} className="text-[16px] leading-7" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Count text={draft} limit={a.char_limit} />
            <div className="flex gap-2">
              <Button variant="quiet" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={busy} onClick={save}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : a.answer === null ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[15px] text-ink-2">The answer was not saved here.</p>
          <Button
            size="sm"
            variant="secondary"
            icon={Plus}
            onClick={() => {
              setDraft("");
              setEditing(true);
            }}
          >
            Add it
          </Button>
        </div>
      ) : (
        <>
          <div className={cx(solidClass, "px-4 py-3 sm:px-5 sm:py-4")}>
            <p className="max-w-[70ch] text-[16px] leading-[1.65] whitespace-pre-wrap text-ink">{a.answer}</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Count text={a.answer} limit={a.char_limit} />
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={copied ? Check : Copy} onClick={() => void copy()} aria-label={`Copy the answer to: ${a.question}`}>
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                size="sm"
                variant="quiet"
                icon={Pencil}
                onClick={() => {
                  setDraft(a.answer ?? "");
                  setEditing(true);
                }}
              >
                Edit
              </Button>
            </div>
          </div>
        </>
      )}
    </li>
  );
}

/** "Your answers": the form questions of this application, each with Copy. Hidden when there are none. */
export function Answers({ model }: { model: DossierModel }) {
  const answers = model.dossier.answers;
  if (!answers.length) return null;
  return (
    <Section id="answers" title="Your answers" description="What you wrote in the application form.">
      <ul className="flex flex-col gap-6">
        {answers.map((a) => (
          <Answer key={a.id} a={a} />
        ))}
      </ul>
    </Section>
  );
}
