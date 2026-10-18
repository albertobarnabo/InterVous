"use client";
// Filter chips (docs/SPEC.md 2.2): phase group, role family, "Needs visa", "Has unconfirmed facts".
// Everything lives in the URL query. Under 768px the chips collapse into one "Filter" sheet.
import { SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Chip, Select, Sheet, cx } from "@/ui";
import { LIST_GROUPS } from "../../../lib/core";
import { familyOptions, matches, matchesExceptGroup, type AppItem, type Filters, type ListGroupId } from "./model";
import type { ListState } from "./useListState";

type Props = {
  /** "chips": the row shown from 768px up. "button": the one Filter button and its sheet (mobile). */
  variant: "chips" | "button";
  items: AppItem[];
  state: ListState;
  update: (patch: Partial<ListState>) => void;
  /** Rows shown with the current filters (for the sheet's "Show n" button). */
  shownCount: number;
};

const ALL = "";

function useOptions(items: AppItem[], state: Filters) {
  return useMemo(() => {
    const base = items.filter((it) => matchesExceptGroup(it, state));
    const groups = LIST_GROUPS.map((g) => ({
      id: g.id as ListGroupId,
      label: g.label,
      count: base.filter((it) => it.group === g.id).length,
    }));
    // Every family stays listed; its count follows the other filters, like the group counts.
    const famBase = items.filter((it) => matches(it, { ...state, family: null }));
    const families = familyOptions(items).map((f) => ({ ...f, count: famBase.filter((it) => it.family === f.value).length }));
    return { groups, families };
  }, [items, state]);
}

function toggleGroup(state: Filters, id: ListGroupId): ListGroupId[] {
  return state.groups.includes(id) ? state.groups.filter((g) => g !== id) : [...state.groups, id];
}

function activeCount(f: Filters): number {
  return f.groups.length + (f.family ? 1 : 0) + (f.visa ? 1 : 0) + (f.unconfirmed ? 1 : 0);
}

function Count({ n, on }: { n: number; on?: boolean }) {
  return <span className={cx("iv-num text-caption font-normal", on ? "text-accent" : "text-ink-3")}>{n}</span>;
}

export function FilterBar({ variant, items, state, update, shownCount }: Props) {
  const { groups, families } = useOptions(items, state);
  const [sheet, setSheet] = useState(false);
  const any = activeCount(state) > 0;
  const clear = () => update({ groups: [], family: null, visa: false, unconfirmed: false });

  const familySelect = (
    <div className="w-44 shrink-0">
      <Select<string>
        size="sm"
        aria-label="Role family"
        value={state.family ?? ALL}
        onChange={(v) => update({ family: v || null })}
        options={[{ value: ALL, label: "All roles" }, ...families.map((f) => ({ value: f.value, label: f.label, text: f.label }))]}
        className={cx(state.family && "border-accent bg-accent-soft text-accent")}
      />
    </div>
  );

  if (variant === "chips") {
    return (
      <div role="group" aria-label="Filters" className="hidden flex-wrap items-center gap-2 md:flex">
        {groups.map((g) => {
          const on = state.groups.includes(g.id);
          return (
            <Chip
              key={g.id}
              selected={on}
              onClick={() => update({ groups: toggleGroup(state, g.id) })}
              disabled={!on && g.count === 0}
              className="disabled:opacity-50"
            >
              {g.label}
              <Count n={g.count} on={on} />
            </Chip>
          );
        })}
        <span aria-hidden className="mx-1 h-5 w-px bg-line-strong" />
        {families.length ? familySelect : null}
        <Chip selected={state.visa} onClick={() => update({ visa: !state.visa })}>
          Needs visa
        </Chip>
        <Chip selected={state.unconfirmed} onClick={() => update({ unconfirmed: !state.unconfirmed })}>
          Has unconfirmed facts
        </Chip>
        {any ? (
          <Button variant="quiet" size="sm" icon={X} onClick={clear}>
            Clear
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <Button
        variant="secondary"
        icon={SlidersHorizontal}
        onClick={() => setSheet(true)}
        className={cx("md:hidden", any && "border-accent text-accent")}
        aria-label={any ? `Filter, ${activeCount(state)} on` : "Filter"}
      >
        Filter{any ? ` · ${activeCount(state)}` : ""}
      </Button>
      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filter"
        side="right"
        footer={
          <>
            {any ? (
              <Button variant="quiet" onClick={clear}>
                Clear all
              </Button>
            ) : null}
            <Button variant="primary" onClick={() => setSheet(false)}>
              {shownCount === 1 ? "Show 1 application" : `Show ${shownCount} applications`}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <fieldset>
            <legend className="mb-2 text-small font-medium text-ink">Where it stands</legend>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => {
                const on = state.groups.includes(g.id);
                return (
                  <Chip key={g.id} selected={on} onClick={() => update({ groups: toggleGroup(state, g.id) })} disabled={!on && g.count === 0} className="disabled:opacity-50">
                    {g.label}
                    <Count n={g.count} on={on} />
                  </Chip>
                );
              })}
            </div>
          </fieldset>
          {families.length ? (
            <fieldset>
              <legend className="mb-2 text-small font-medium text-ink">Role</legend>
              <div className="flex flex-wrap gap-2">
                <Chip selected={!state.family} onClick={() => update({ family: null })}>
                  All roles
                </Chip>
                {families.map((f) => (
                  <Chip key={f.value} selected={state.family === f.value} onClick={() => update({ family: state.family === f.value ? null : f.value })}>
                    {f.label}
                    <Count n={f.count} on={state.family === f.value} />
                  </Chip>
                ))}
              </div>
            </fieldset>
          ) : null}
          <fieldset>
            <legend className="mb-2 text-small font-medium text-ink">Only show</legend>
            <div className="flex flex-wrap gap-2">
              <Chip selected={state.visa} onClick={() => update({ visa: !state.visa })}>
                Needs visa
              </Chip>
              <Chip selected={state.unconfirmed} onClick={() => update({ unconfirmed: !state.unconfirmed })}>
                Has unconfirmed facts
              </Chip>
            </div>
          </fieldset>
        </div>
      </Sheet>
    </>
  );
}

