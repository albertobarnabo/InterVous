"use client";
// Delete now, write in 5 seconds. Rows leave the list at once and ONE toast offers Undo for all of
// them, so clearing a run of rows never loses an Undo to the toast limit: each delete replaces the
// toast and restarts the window, and the whole batch is written when it closes or the page unmounts.
//
// Unlike useDeferred, hiding the tab writes nothing: the delete cannot be taken back, so a quick look
// at another tab should not cost the Undo. Closing or reloading the tab inside the window cancels the
// delete, because the write needs several round trips the browser will not wait for. The browser asks
// first, and a cancelled delete only means the rows are still there next time.
import { useCallback, useEffect, useRef, useState } from "react";
import { deleteApplications } from "../../../lib/data";
import { useToast } from "@/ui";
import { leftoverText } from "./model";
import { UNDO_MS } from "../today/useDeferred";

/** A second click this soon is a double click: the row below has just moved under the pointer. */
const DOUBLE_CLICK_MS = 400;

type Batch = {
  names: Map<number, string>;
  timer: ReturnType<typeof setTimeout>;
  toastId: number;
  onUndo?: (ids: number[]) => void;
};

export function useUndoableDelete() {
  const toast = useToast();
  const batch = useRef<Batch | null>(null);
  const lastAt = useRef(0);
  const [hidden, setHidden] = useState<ReadonlySet<number>>(() => new Set());

  const unhide = useCallback((ids: number[]) => {
    setHidden((s) => {
      const n = new Set(s);
      for (const id of ids) n.delete(id);
      return n;
    });
  }, []);

  const commit = useCallback(async () => {
    const b = batch.current;
    if (!b) return;
    batch.current = null;
    clearTimeout(b.timer);
    toast.dismiss(b.toastId);
    const ids = [...b.names.keys()];
    try {
      // These rows skipped the dialog because they were never sent. One sent since keeps its row.
      const result = await deleteApplications(ids, { onlyUnsent: true });
      const leftover = leftoverText(result);
      if (leftover) toast.show({ kind: "error", text: leftover });
      if (result.deleted < ids.length) {
        toast.show({
          kind: "info",
          text: `${result.deleted ? `${result.deleted} of ${ids.length} deleted.` : "Nothing was deleted."} The rest changed in the meantime or were already gone.`,
        });
      }
    } catch (e) {
      toast.show({ kind: "error", text: `Not deleted: ${e instanceof Error ? e.message : "Something went wrong"}` });
    } finally {
      unhide(ids);
    }
  }, [toast, unhide]);

  const undo = useCallback(() => {
    const b = batch.current;
    if (!b) return;
    batch.current = null;
    clearTimeout(b.timer);
    toast.dismiss(b.toastId);
    const ids = [...b.names.keys()];
    b.onUndo?.(ids);
    unhide(ids);
  }, [toast, unhide]);

  /** True straight after a delete: ignore this click on whatever row moved under the pointer. */
  const tooSoon = useCallback(() => Date.now() - lastAt.current < DOUBLE_CLICK_MS, []);

  /** `onUndo` gets the ids Undo brought back. A keyboard user is told about ⌘Z: the toast is many tabs away. */
  const remove = useCallback(
    (id: number, company: string, opts: { onUndo?: (ids: number[]) => void; byKeyboard?: boolean } = {}) => {
      lastAt.current = Date.now();
      const prev = batch.current;
      if (prev) {
        clearTimeout(prev.timer);
        toast.dismiss(prev.toastId);
      }
      const names = prev?.names ?? new Map<number, string>();
      names.set(id, company);
      setHidden((s) => new Set(s).add(id));

      const text = names.size === 1 ? `Deleted ${company}.` : `${names.size} applications deleted.`;
      const toastId = toast.show({
        text: opts.byKeyboard ? `${text} ⌘Z to undo.` : text,
        duration: UNDO_MS,
        action: { label: "Undo", run: undo },
      });
      batch.current = { names, toastId, onUndo: opts.onUndo, timer: setTimeout(() => void commit(), UNDO_MS) };
    },
    [commit, toast, undo],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!batch.current || e.key.toLowerCase() !== "z" || !(e.metaKey || e.ctrlKey) || e.shiftKey) return;
      // In a text field ⌘Z means the text.
      if ((e.target as Partial<HTMLElement> | null)?.closest?.("input, textarea, [contenteditable='true']")) return;
      e.preventDefault();
      undo();
    };
    const onBeforeUnload = (e: Event) => {
      if (batch.current) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
      void commit();
    };
  }, [commit, undo]);

  return { hidden, remove, tooSoon };
}
