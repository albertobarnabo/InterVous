// View model for /applications (docs/SPEC.md 2.2). All phase, window and sentence logic comes
// from lib/core; this file only shapes rows for the list and the board, sorts and filters them.
import {
  BOARD_COLUMNS,
  LIST_GROUPS,
  appPath,
  appRef,
  boardColumnOf,
  buildContext,
  formatShort,
  listGroupOf,
  nowSentence,
  phaseChangedOn,
  roleFamilyLabel,
  waitingDays,
  type BoardColumnId,
  type Derived,
  type JobEvent as CoreEvent,
  type JobOverviewRow,
  type ListGroupId,
  type Phase,
  type UserSettings as CoreSettings,
} from "../../../lib/core";
import type { Application, UserSettings } from "../../../lib/data";

export type { BoardColumnId, ListGroupId, Phase };

/** Plain words for the fields an import could not confirm. */
const UNCERTAIN_WORDS: Record<string, string> = {
  phase: "its status",
  applied_on: "the date it was sent",
  cv_built_on: "the date the CV was built",
};

export type AppItem = {
  id: number;
  ref: string;
  /** App-relative dossier path ('/applications/<slug>'). */
  href: string;
  app: Application;
  d: Derived;
  phase: Phase;
  group: ListGroupId;
  column: BoardColumnId;
  company: string;
  role: string;
  location: string | null;
  logoUrl: string | null;
  /** The deterministic now sentence from lib/core/now.mjs. */
  now: string;
  /** Days waiting (applied/screening only), for the age bar. */
  waiting: number | null;
  /** The row's date: sent date for sent rows, CV date for drafts. */
  date: { on: string | null; text: string; label: string };
  /** Plain-language list of unconfirmed facts; empty when everything is confirmed. */
  unconfirmed: string[];
  visa: boolean;
  family: string | null;
  inWindow: boolean;
  /** Sort key used inside a group or column (bigger first unless noted by the comparator). */
  activityOn: string | null;
  closedOn: string | null;
  haystack: string;
};

export function buildItems(apps: Application[], settings: UserSettings | undefined, today: string): AppItem[] {
  const events = apps.flatMap((a) => a.events) as unknown as CoreEvent[];
  const ctx = buildContext({
    apps: apps as unknown as JobOverviewRow[],
    events,
    settings: (settings ?? null) as Partial<CoreSettings> | null,
    today,
  });
  const nowCtx = { today, settings: ctx.settings };
  return ctx.all.map((d, i) => {
    const app = apps[i];
    const company = d.company || "Unknown company";
    const role = d.role || "Untitled role";
    const draftLike = d.phase === "draft" || d.phase === "skipped";
    const dateOn = draftLike ? d.cvBuiltOn : d.appliedOn;
    const dateText = dateOn ? formatShort(dateOn, { today }) : "";
    const dateLabel = draftLike
      ? dateOn
        ? `CV built ${dateText}`
        : "CV date unknown"
      : dateOn
        ? `Sent ${dateText}`
        : "Sent, date unknown";
    const closedOn = phaseChangedOn(d.phase, d.events) ?? d.lastEventOn ?? d.appliedOn ?? d.windowDate;
    const location = app.location?.trim() || null;
    return {
      id: d.id,
      ref: appRef({ id: d.id, slug: d.slug }),
      href: appPath({ id: d.id, slug: d.slug }),
      app,
      d,
      phase: d.phase,
      group: listGroupOf(d),
      column: boardColumnOf(d.phase),
      company,
      role,
      location,
      logoUrl: app.company_logo_url,
      now: nowSentence(d, nowCtx),
      waiting: waitingDays(d, nowCtx),
      date: { on: dateOn, text: dateText, label: dateLabel },
      unconfirmed: d.uncertain.map((f) => UNCERTAIN_WORDS[f] ?? f.replace(/_/g, " ")),
      visa: app.visa_needed === true,
      family: app.role_family ?? null,
      inWindow: d.inWindow,
      activityOn: d.lastEventOn ?? (app.last_activity_at ? app.last_activity_at.slice(0, 10) : null) ?? d.appliedOn,
      closedOn,
      haystack: [company, role, d.slug, location, app.role_family ? roleFamilyLabel(app.role_family) : null]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });
}

// ── sorting ─────────────────────────────────────────────────────────────────

const desc = (a: string | number | null | undefined, b: string | number | null | undefined) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? 1 : a > b ? -1 : 0;
};

/** Reading order inside a group (the sort named in LIST_GROUPS). */
export function compareIn(group: ListGroupId) {
  return (a: AppItem, b: AppItem): number => {
    let r = 0;
    switch (group) {
      case "interviews":
        r = desc(a.activityOn, b.activityOn);
        break;
      case "waiting":
        // Longest wait first; undated rows last.
        r = desc(a.waiting, b.waiting);
        break;
      case "not_sent":
        r = desc(a.d.cvBuiltOn ?? a.d.windowDate, b.d.cvBuiltOn ?? b.d.windowDate);
        break;
      case "closed":
        r = desc(a.closedOn, b.closedOn);
        break;
      case "older":
        r = desc(a.d.windowDate, b.d.windowDate);
        break;
    }
    return r || b.id - a.id;
  };
}

const COLUMN_SORT: Record<BoardColumnId, ListGroupId> = {
  draft: "not_sent",
  applied: "waiting",
  screening: "waiting",
  interviewing: "interviews",
  offer: "interviews",
  closed: "closed",
};

export function compareInColumn(column: BoardColumnId) {
  return compareIn(COLUMN_SORT[column]);
}

// ── filters ─────────────────────────────────────────────────────────────────

export type Filters = {
  groups: ListGroupId[];
  family: string | null;
  visa: boolean;
  unconfirmed: boolean;
  q: string;
};

export const GROUP_IDS = LIST_GROUPS.map((g) => g.id) as ListGroupId[];

export function hasFilters(f: Filters): boolean {
  return f.groups.length > 0 || !!f.family || f.visa || f.unconfirmed || f.q.trim() !== "";
}

/** Everything except the phase-group filter (used for the group chip counts). */
export function matchesExceptGroup(it: AppItem, f: Filters): boolean {
  if (f.family && it.family !== f.family) return false;
  if (f.visa && !it.visa) return false;
  if (f.unconfirmed && it.unconfirmed.length === 0) return false;
  const q = f.q.trim().toLowerCase();
  if (q && !q.split(/\s+/).every((w) => it.haystack.includes(w))) return false;
  return true;
}

export function matches(it: AppItem, f: Filters): boolean {
  if (f.groups.length && !f.groups.includes(it.group)) return false;
  return matchesExceptGroup(it, f);
}

// ── groups and columns ──────────────────────────────────────────────────────

export type Group = {
  id: ListGroupId;
  label: string;
  note?: string;
  collapsedByDefault: boolean;
  items: AppItem[];
};

export function toGroups(items: AppItem[]): Group[] {
  return LIST_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    note: g.note,
    collapsedByDefault: g.collapsed,
    items: items.filter((it) => it.group === g.id).sort(compareIn(g.id)),
  }));
}

export type Column = {
  id: BoardColumnId;
  label: string;
  phases: Phase[];
  /** The phase a dropped card moves to; null for Closed (the drop asks which). */
  dropPhase: Phase | null;
  collapsedByDefault: boolean;
  items: AppItem[];
};

export function toColumns(items: AppItem[]): Column[] {
  return BOARD_COLUMNS.map((c) => ({
    id: c.id,
    label: c.label,
    phases: [...c.phases],
    dropPhase: c.dropPhase,
    collapsedByDefault: c.collapsed,
    items: items.filter((it) => it.column === c.id).sort(compareInColumn(c.id)),
  }));
}

/** "18 tracked · 11 sent · 1 in interviews", counted on rows inside the campaign window. */
export function sampleLine(items: AppItem[]): string {
  const inWindow = items.filter((it) => it.inWindow);
  const sent = inWindow.filter((it) => it.d.sent).length;
  const interviews = inWindow.filter((it) => it.group === "interviews").length;
  return `${inWindow.length} tracked · ${sent} sent · ${interviews} in interviews`;
}

/** Role families present in the data, most common first. */
export function familyOptions(items: AppItem[]): Array<{ value: string; label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const it of items) if (it.family) counts.set(it.family, (counts.get(it.family) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, label: roleFamilyLabel(value), count }));
}

export { roleFamilyLabel };
