"use client";
// /applications: every application, one readable row each, with search and one simple filter
// (All · Waiting · Interviews · Not sent · Closed). The filter and the search live in the URL
// (?show=waiting&q=apple), so Home's tiles link straight to a filter.
import { Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { STATUS_GROUPS } from "../../../lib/core";
import {
  Button,
  Callout,
  ConfirmDialog,
  EmptyState,
  IconButton,
  PageHeader,
  SegmentedControl,
  SkeletonRow,
  controlClass,
  cx,
  openNewApplication,
  useToast,
} from "@/ui";
import { deleteApplication } from "../../../lib/data";
import { ApplicationList } from "./ApplicationList";
import type { RowHandlers } from "./AppRow";
import { deleteWarning, isDisposable, leftoverText, matchesQuery, showCounts, toGroups, type AppItem, type Show } from "./model";
import { SentDialog, UpdateDialog, type DialogTarget } from "./UpdateDialog";
import { useApplicationItems } from "./useApplicationItems";
import { useListState } from "./useListState";
import { useUndoableDelete } from "./useUndoableDelete";

/** The search box: instant locally, written to ?q= after a short pause. */
function useSearch(urlQ: string, update: (patch: { q: string }) => void) {
  const [q, setQ] = useState(urlQ);
  const pushed = useRef(urlQ);

  // The URL changed from outside (back button, a link): follow it.
  useEffect(() => {
    if (urlQ !== pushed.current) {
      pushed.current = urlQ;
      setQ(urlQ);
    }
  }, [urlQ]);

  useEffect(() => {
    if (q.trim() === pushed.current) return;
    const t = setTimeout(() => {
      pushed.current = q.trim();
      update({ q: q.trim() });
    }, 250);
    return () => clearTimeout(t);
  }, [q, update]);

  return [q, setQ] as const;
}

const toTarget = (it: AppItem): DialogTarget => ({ id: it.id, company: it.company, role: it.role, phase: it.phase, logoUrl: it.logoUrl });

/** Where the keyboard goes when a row leaves: the next row, else the previous one, else the search box. */
function neighbourOf(id: number): number | "search" {
  const links = [...document.querySelectorAll<HTMLElement>("[data-item-link]")];
  const i = links.findIndex((l) => l.dataset.itemLink === String(id));
  const next = links[i + 1] ?? links[i - 1];
  return next ? Number(next.dataset.itemLink) : "search";
}

function focusRow(want: number | "search") {
  const el = want === "search" ? document.getElementById("applications-search") : document.querySelector<HTMLElement>(`[data-item-link="${want}"]`);
  el?.focus();
}

/**
 * Runs once the open dialog has really left the page, however long that takes. It hands focus back as
 * it unmounts, in an effect just after the node goes, so this waits a moment longer to have the last word.
 */
function afterDialogGone(run: () => void) {
  const watch = new MutationObserver(() => {
    if (document.querySelector("[role=dialog]")) return;
    watch.disconnect();
    setTimeout(run, 50);
  });
  watch.observe(document.body, { childList: true, subtree: true });
}

/** Focus moves only for the keyboard: a mouse or a finger has no position to lose. */
const usingKeyboard = () => !!document.activeElement?.matches(":focus-visible");

function headline(items: AppItem[]): string {
  if (!items.length) return "Every job you apply to, and where it stands.";
  const n = items.length;
  return `${n} ${n === 1 ? "application" : "applications"}. Open one to see the CV you sent and what happened.`;
}

export function ApplicationsScreen() {
  const { items: allItems, today, loading, error, refetch } = useApplicationItems();
  const toast = useToast();
  const { hidden, remove, tooSoon } = useUndoableDelete();
  // Rows waiting out their Undo window are already gone as far as this page is concerned.
  const items = useMemo(() => allItems?.filter((it) => !hidden.has(it.id)), [allItems, hidden]);
  const [state, update] = useListState();
  const [q, setQ] = useSearch(state.q, update);
  const [sentFor, setSentFor] = useState<DialogTarget | null>(null);
  const [updateFor, setUpdateFor] = useState<DialogTarget | null>(null);
  const [deleteFor, setDeleteFor] = useState<AppItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const focusAfterDialog = useRef<number | "search" | null>(null);
  const focusNext = useRef<number | "search" | null>(null);

  useEffect(() => {
    const want = focusNext.current;
    if (want === null) return;
    focusNext.current = null;
    focusRow(want);
  });

  const searched = useMemo(() => (items ? items.filter((it) => matchesQuery(it, q)) : []), [items, q]);
  const counts = useMemo(() => showCounts(searched), [searched]);
  const shown = useMemo(() => (state.show === "all" ? searched : searched.filter((it) => it.group === state.show)), [searched, state.show]);
  const groups = useMemo(() => toGroups(shown), [shown]);

  const options = useMemo(
    () => [
      { value: "all" as Show, label: "All", count: counts.all },
      ...STATUS_GROUPS.map((g) => ({ value: g.id as Show, label: g.short, count: counts[g.id] })),
    ],
    [counts],
  );

  const handlers: RowHandlers = {
    onMarkSent: (it) => setSentFor(toTarget(it)),
    onUpdate: (it) => setUpdateFor(toTarget(it)),
    onDelete: (it) => {
      if (tooSoon()) return;
      const byKeyboard = usingKeyboard();
      const focus = byKeyboard ? neighbourOf(it.id) : null;
      if (!isDisposable(it)) {
        focusAfterDialog.current = focus;
        setDeleteFor(it);
        return;
      }
      focusNext.current = focus;
      remove(it.id, it.company, {
        byKeyboard,
        onUndo: (ids) => {
          if (usingKeyboard()) focusNext.current = ids[ids.length - 1];
        },
      });
    },
  };

  const confirmDelete = async () => {
    if (!deleteFor) return;
    setDeleting(true);
    try {
      const leftover = leftoverText(await deleteApplication(deleteFor.id));
      toast.show(leftover ? { kind: "error", text: leftover } : { text: "Application deleted." });
      // The row's button is gone, so the dialog hands focus to whatever it saw before: an older
      // control, where the next Enter or keystroke would land. Settle it once the dialog has gone.
      const want = focusAfterDialog.current;
      afterDialogGone(() => {
        if (want === null) (document.activeElement as HTMLElement | null)?.blur();
        else focusRow(want);
      });
    } catch (e) {
      toast.show({ kind: "error", text: e instanceof Error ? e.message : "It was not deleted. Try again." });
    } finally {
      setDeleting(false);
      setDeleteFor(null);
    }
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (q) setQ("");
      else e.currentTarget.blur();
    }
  };

  const showLabel = STATUS_GROUPS.find((g) => g.id === state.show)?.label.toLowerCase();

  return (
    <div className="iv-page pb-10">
      <div className="mx-auto w-full max-w-[960px]">
        {/* "Add a job" lives in the top bar on every page; no second copy here. */}
        <PageHeader title="Applications" description={headline(items ?? [])} />

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-xs">
            <label htmlFor="applications-search" className="sr-only">
              Search applications
            </label>
            <Search aria-hidden size={18} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3" />
            <input
              id="applications-search"
              data-page-search
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="Search company or role"
              autoComplete="off"
              spellCheck={false}
              className={cx(controlClass, "h-11 rounded-full pr-11 pl-11 [&::-webkit-search-cancel-button]:hidden")}
            />
            {q ? (
              <span className="absolute top-1/2 right-1.5 -translate-y-1/2">
                <IconButton size="sm" label="Clear search" icon={X} onClick={() => setQ("")} />
              </span>
            ) : null}
          </div>
          {/* Phones: no counts and tighter segments, so all five fit 343px without scrolling. */}
          <SegmentedControl
            aria-label="Show"
            options={options.map(({ value, label }) => ({ value, label }))}
            value={state.show}
            onChange={(show) => update({ show })}
            fullWidth
            className="sm:hidden [&>button]:px-2"
          />
          <SegmentedControl
            aria-label="Show"
            options={options}
            value={state.show}
            onChange={(show) => update({ show })}
            className="hidden sm:inline-flex"
          />
        </div>

        <div className="mt-8">
          {error && !items ? (
            <Callout
              tone="danger"
              title="Your applications could not load"
              action={
                <Button size="sm" onClick={() => void refetch()}>
                  Try again
                </Button>
              }
            >
              {error.message}
            </Callout>
          ) : loading || !items || !today ? (
            <div aria-busy="true" aria-label="Loading applications" className="flex flex-col gap-2">
              {Array.from({ length: 6 }, (_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No applications yet."
              body="Paste the link of a job you want to apply to. InterVous keeps the CV you send and tracks the reply."
              action={
                <Button variant="primary" icon={Plus} onClick={openNewApplication}>
                  Add a job
                </Button>
              }
            />
          ) : shown.length === 0 ? (
            <EmptyState
              title="Nothing here."
              body={
                q.trim()
                  ? `No application matches “${q.trim()}”${showLabel ? ` in ${showLabel}` : ""}.`
                  : `No application is in ${showLabel ?? "this list"} right now.`
              }
              action={
                <Button
                  onClick={() => {
                    setQ("");
                    update({ q: "", show: "all" });
                  }}
                >
                  Show all applications
                </Button>
              }
            />
          ) : (
            <ApplicationList groups={groups} grouped={state.show === "all"} h={handlers} />
          )}
        </div>
      </div>

      {today ? (
        <>
          <SentDialog target={sentFor} today={today} onClose={() => setSentFor(null)} />
          <UpdateDialog target={updateFor} today={today} onClose={() => setUpdateFor(null)} />
        </>
      ) : null}
      <ConfirmDialog
        open={!!deleteFor}
        onClose={() => setDeleteFor(null)}
        title="Delete this application?"
        body={deleteFor ? deleteWarning(deleteFor) : null}
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
