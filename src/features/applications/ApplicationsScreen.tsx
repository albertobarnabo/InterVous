"use client";
// /applications: where everything stands (docs/SPEC.md 2.2).
// Header (title, sample line, search, New, List | Board), filter chips, then the grouped list or
// the board. View, filters and search live in the URL query; keys: / search, j k move, m move menu.
import { Columns3, List as ListIcon, Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  Button,
  Callout,
  EmptyState,
  IconButton,
  Kbd,
  SegmentedControl,
  Skeleton,
  SkeletonRow,
  controlClass,
  cx,
  openNewApplication,
} from "@/ui";
import { ApplicationList } from "./ApplicationList";
import { Board } from "./Board";
import { FilterBar } from "./FilterBar";
import { focusItem, useListKeys } from "./keys";
import { hasFilters, matches, sampleLine, toGroups, type ListGroupId, type Phase } from "./model";
import { MoveDialog } from "./move";
import { useApplicationItems } from "./useApplicationItems";
import { EMPTY_FILTERS, useListState, type View } from "./useListState";

const VIEW_OPTIONS = [
  {
    value: "list" as View,
    label: (
      <span className="inline-flex items-center gap-1.5">
        <ListIcon aria-hidden size={16} strokeWidth={1.75} />
        List
      </span>
    ),
  },
  {
    value: "board" as View,
    label: (
      <span className="inline-flex items-center gap-1.5">
        <Columns3 aria-hidden size={16} strokeWidth={1.75} />
        Board
      </span>
    ),
  },
];

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

export function ApplicationsScreen() {
  const { items, today, loading, error, refetch } = useApplicationItems();
  const [state, update] = useListState();
  const [q, setQ] = useSearch(state.q, update);
  const [moveTarget, setMoveTarget] = useState<{ id: number; to: Phase | null } | null>(null);
  const [openGroups, setOpenGroups] = useState<Partial<Record<ListGroupId, boolean>>>({});
  const [focusReq, setFocusReq] = useState<{ id: number; n: number } | null>(null);

  const filters = useMemo(() => ({ ...state, q }), [state, q]);
  const filtered = useMemo(() => (items ? items.filter((it) => matches(it, filters)) : []), [items, filters]);
  const groups = useMemo(() => toGroups(filtered), [filtered]);
  const filtering = hasFilters(filters);
  const expandAll = q.trim() !== "" || state.groups.length > 0;

  const moveItem = moveTarget && items ? items.find((it) => it.id === moveTarget.id) ?? null : null;

  useListKeys({ onMove: (id) => setMoveTarget({ id, to: null }), enabled: !!items?.length && !moveTarget });

  // After a move the row lives in another group (or column): open that group and keep focus on it.
  useEffect(() => {
    if (!focusReq || !items) return;
    const it = items.find((i) => i.id === focusReq.id);
    if (it && state.view === "list") setOpenGroups((o) => (o[it.group] ? o : { ...o, [it.group]: true }));
    focusItem(focusReq.id);
    // Only once per request, not on every later refetch.
    setFocusReq(null);
  }, [focusReq, items, state.view]);

  const onMoveClose = useCallback(
    (moved: Phase | null) => {
      if (moved && moveTarget) setFocusReq({ id: moveTarget.id, n: Date.now() });
      setMoveTarget(null);
    },
    [moveTarget],
  );

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (q) setQ("");
      else e.currentTarget.blur();
    } else if (e.key === "ArrowDown") {
      // From the search box straight into the results.
      const first = document.querySelector<HTMLElement>("[data-item-link]");
      if (first) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const clearAll = () => {
    setQ("");
    update({ ...EMPTY_FILTERS });
  };

  return (
    <div className="iv-page pt-6 pb-8 md:pt-10">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1-sm text-ink sm:text-h1">Applications</h1>
          {items ? (
            <p className="mt-1 text-small text-ink-2 [font-variant-numeric:tabular-nums]">{sampleLine(items)}</p>
          ) : (
            <Skeleton className="mt-2 h-4 w-64" />
          )}
        </div>
        <Button variant="primary" icon={Plus} onClick={openNewApplication} className="mt-1">
          New
        </Button>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2 md:mt-8">
        <div className="relative w-full min-w-0 md:w-auto md:max-w-sm md:flex-1">
          <label htmlFor="applications-search" className="sr-only">
            Search applications
          </label>
          <Search aria-hidden size={16} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <input
            id="applications-search"
            data-page-search
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder="Search company, role or place"
            autoComplete="off"
            spellCheck={false}
            className={cx(controlClass, "h-9 pr-10 pl-9 pointer-coarse:h-11 [&::-webkit-search-cancel-button]:hidden")}
          />
          {q ? (
            <span className="absolute top-1/2 right-0.5 -translate-y-1/2">
              <IconButton size="sm" label="Clear search" icon={X} onClick={() => setQ("")} />
            </span>
          ) : (
            <span aria-hidden className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 md:block">
              <Kbd>/</Kbd>
            </span>
          )}
        </div>
        {items ? <FilterBar variant="button" items={items} state={filters} update={update} shownCount={filtered.length} /> : null}
        <SegmentedControl
          aria-label="View"
          options={VIEW_OPTIONS}
          value={state.view}
          onChange={(view) => update({ view })}
          className="ml-auto"
        />
      </div>

      {items ? (
        <div className="mt-3">
          <FilterBar variant="chips" items={items} state={filters} update={update} shownCount={filtered.length} />
        </div>
      ) : null}

      <div className="mt-8">
        {error && !items ? (
          <Callout
            tone="danger"
            title="Could not load your applications"
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
            <Skeleton className="mb-2 h-6 w-40" />
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No applications yet."
            body="Add one from a job link, or let the agent add it with intervous add."
            action={
              <Button variant="primary" icon={Plus} onClick={openNewApplication}>
                New application
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nothing matches."
            body={q.trim() ? `No application matches “${q.trim()}” with these filters.` : "No application has all of these at once."}
            action={<Button onClick={clearAll}>Clear search and filters</Button>}
          />
        ) : (
          <>
            {filtering ? (
              <p role="status" className="mb-4 text-small text-ink-2 [font-variant-numeric:tabular-nums]">
                Showing {filtered.length} of {items.length}.{" "}
                <button type="button" onClick={clearAll} className="font-medium text-accent underline-offset-4 hover:underline">
                  Show all
                </button>
              </p>
            ) : null}
            {state.view === "board" ? (
              <Board items={filtered} today={today} onMenuMove={(it, to) => setMoveTarget({ id: it.id, to })} />
            ) : (
              <ApplicationList
                groups={groups}
                open={openGroups}
                onToggle={(id) => setOpenGroups((o) => ({ ...o, [id]: !o[id] }))}
                expandAll={expandAll}
              />
            )}
            <KeyHint view={state.view} />
          </>
        )}
      </div>

      {today ? <MoveDialog item={moveItem} today={today} to={moveTarget?.to ?? null} onClose={onMoveClose} /> : null}
    </div>
  );
}

function KeyHint({ view }: { view: View }) {
  return (
    <p className="mt-10 hidden flex-wrap items-center gap-x-1.5 gap-y-2 text-caption font-normal text-ink-3 md:flex">
      {view === "list" ? (
        <>
          <Kbd>j</Kbd>
          <Kbd>k</Kbd>
          <span className="mr-3">move between rows</span>
          <Kbd>Enter</Kbd>
          <span className="mr-3">opens it</span>
          <Kbd>m</Kbd>
          <span>moves it to another phase</span>
        </>
      ) : (
        <>
          <span className="mr-1">Drag a card to another column, or focus its handle and press</span>
          <Kbd>Space</Kbd>
          <span className="mr-3">then the arrow keys.</span>
          <Kbd>m</Kbd>
          <span>moves the focused card</span>
        </>
      )}
    </p>
  );
}
