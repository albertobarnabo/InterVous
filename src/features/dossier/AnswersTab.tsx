"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, ClipboardPaste, Copy, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { updateAnswer, type JobAnswer } from "../../../lib/data";
import { Button, Kbd, Textarea, cx, isTypingTarget, useToast } from "@/ui";
import { int, shortDate } from "./format";
import type { DossierModel } from "./model";

function Count({ text, limit }: { text: string | null; limit: number | null }) {
  if (text === null && !limit) return null;
  const n = text?.length ?? 0;
  const over = limit !== null && n > limit;
  return (
    <span className={cx("iv-num shrink-0 text-caption", over ? "text-danger" : "text-ink-3")}>
      {text === null ? "—" : int(n)}
      {limit ? ` / ${int(limit)}` : ""}
      {over ? <span className="sr-only"> (over the limit)</span> : null}
    </span>
  );
}

/** Clipboard API first; the old execCommand path when it is missing or refused (unfocused page). */
async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    /* fall through to the old path */
  }
  const active = document.activeElement as HTMLElement | null;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  active?.focus({ preventScroll: true });
  if (!ok) throw new Error("copy refused");
}

function AnswerRow({
  a,
  model,
  open,
  onToggle,
  onFocusRow,
  copied,
  onCopy,
}: {
  a: JobAnswer;
  model: DossierModel;
  open: boolean;
  onToggle: () => void;
  onFocusRow: () => void;
  copied: boolean;
  onCopy: () => void;
}) {
  const reduce = useReducedMotion();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(a.answer ?? "");
  const [busy, setBusy] = useState(false);
  const given = model.app.applied_on ?? a.created_at?.slice(0, 10) ?? null;
  const unsaved = a.answer === null;

  const save = async () => {
    setBusy(true);
    try {
      await updateAnswer(a.id, { answer: draft.trim() ? draft : null });
      setEditing(false);
      toast.show({ text: "Answer saved." });
    } catch (e) {
      toast.show({ kind: "error", text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-md bg-surface shadow-1" onFocusCapture={onFocusRow}>
      <div className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="-mx-2 -my-1 flex min-w-0 flex-1 items-start gap-2 rounded-sm px-2 py-1 text-left"
        >
          <ChevronDown
            aria-hidden
            size={16}
            strokeWidth={1.75}
            className={cx("mt-0.5 shrink-0 text-ink-3 transition-transform duration-[120ms]", open && "rotate-180")}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-small font-medium text-ink">{a.question}</span>
            {unsaved ? (
              <span className="mt-0.5 block text-caption font-normal text-ink-3">
                Given in chat{given ? ` on ${shortDate(given, model.today)}` : ""}, not saved
              </span>
            ) : null}
          </span>
        </button>
        <div className="flex shrink-0 items-center justify-between gap-2 pl-6 sm:justify-start sm:pl-0 sm:pt-0.5">
          <Count text={a.answer} limit={a.char_limit} />
          {unsaved ? (
            editing ? null : (
              <Button
                size="sm"
                variant="secondary"
                icon={ClipboardPaste}
                aria-label={`Paste the answer to: ${a.question}`}
                onClick={() => {
                  setDraft("");
                  setEditing(true);
                  if (!open) onToggle();
                }}
              >
                Paste it
              </Button>
            )
          ) : (
            <Button size="sm" variant={copied ? "secondary" : "quiet"} icon={copied ? Check : Copy} onClick={onCopy} aria-label={`Copy the answer to: ${a.question}`}>
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-line px-4 pt-3 pb-4 sm:pl-10">
              {editing ? (
                <div className="flex flex-col gap-2">
                  <Textarea
                    aria-label={`Answer to: ${a.question}`}
                    rows={8}
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    className="font-serif text-body leading-7"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Count text={draft} limit={a.char_limit} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="quiet" onClick={() => setEditing(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" variant="primary" loading={busy} onClick={save}>
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              ) : unsaved ? (
                <p className="text-small text-ink-2">The text was never saved here. Use Paste it to keep a copy from the chat or the portal.</p>
              ) : (
                <>
                  <p className="iv-reading whitespace-pre-wrap">{a.answer}</p>
                  <Button
                    size="sm"
                    variant="quiet"
                    icon={Pencil}
                    className="mt-2 -ml-2.5"
                    onClick={() => {
                      setDraft(a.answer ?? "");
                      setEditing(true);
                    }}
                  >
                    Edit
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

/** The Answers tab (spec 2.3): one row per question, count against the limit, Copy (key c). */
export function AnswersTab({ model }: { model: DossierModel }) {
  const answers = model.dossier.answers;
  const toast = useToast();
  const [open, setOpen] = useState<Set<string>>(() => new Set(answers.length === 1 ? [answers[0].id] : []));
  const [current, setCurrent] = useState<string | null>(answers[0]?.id ?? null);
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsaved = answers.filter((a) => a.answer === null).length;

  const copy = async (a: JobAnswer) => {
    if (a.answer === null) return;
    try {
      await copyText(a.answer);
      setCopied(a.id);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), 1500);
      toast.show({ text: `Copied, ${int(a.answer.length)} characters.`, duration: 2500 });
    } catch {
      toast.show({ kind: "error", text: "The browser blocked the clipboard. Select the text and copy it by hand." });
    }
  };

  const latest = useRef({ answers, current, copy });
  latest.current = { answers, current, copy };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const { answers: list, current: id, copy: run } = latest.current;
      const a = list.find((x) => x.id === id) ?? list.find((x) => x.answer !== null);
      if (!a || a.answer === null) return;
      e.preventDefault();
      void run(a);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!answers.length) {
    return (
      <div className="rounded-md border border-dashed border-line-strong px-5 py-8 text-small text-ink-2">
        No form answers for this application.
        {model.app.answer_count ? <span className="text-ink-3"> The fixture carries no answer rows.</span> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-ink-2">
        <span className="iv-num">{answers.length}</span> {answers.length === 1 ? "answer" : "answers"}
        {unsaved ? (
          <>
            {" "}
            · <span className="iv-num">{unsaved}</span> not saved
          </>
        ) : null}
        <span className="hidden text-ink-3 sm:inline">
          {" "}
          · <Kbd>c</Kbd> copies the one you are on
        </span>
      </p>
      <ul className="flex flex-col gap-2">
        {answers.map((a) => (
          <AnswerRow
            key={a.id}
            a={a}
            model={model}
            open={open.has(a.id)}
            copied={copied === a.id}
            onCopy={() => void copy(a)}
            onFocusRow={() => setCurrent(a.id)}
            onToggle={() => {
              setCurrent(a.id);
              setOpen((s) => {
                const n = new Set(s);
                if (n.has(a.id)) n.delete(a.id);
                else n.add(a.id);
                return n;
              });
            }}
          />
        ))}
      </ul>
    </div>
  );
}
