// View model for /applications: one readable row per application. Status groups, labels and
// day counts come from lib/core (STATUS_GROUPS, buildContext); this file only shapes, sorts and
// filters the rows.
import {
  STATUS_GROUPS,
  appPath,
  appRef,
  buildContext,
  daysBetween,
  formatDay,
  formatShort,
  phaseChangedOn,
  INTERVIEW_TYPES,
  lowerFirst,
  stageReached,
  statusGroupOf,
  toDateOnly,
  type Derived,
  type JobEvent as CoreEvent,
  type JobOverviewRow,
  type Phase,
  type StatusGroupId,
  type UserSettings as CoreSettings,
} from "../../../lib/core";
import type { Application, DeleteResult, UserSettings } from "../../../lib/data";

export type { Phase, StatusGroupId };

/** The one button of a row. */
export type RowAction = "mark_sent" | "update" | "open";

export type AppItem = {
  id: number;
  ref: string;
  /** App-relative application page path ('/applications/<slug>'). */
  href: string;
  app: Application;
  d: Derived;
  phase: Phase;
  group: StatusGroupId;
  company: string;
  role: string;
  location: string | null;
  logoUrl: string | null;
  /** A short plain fact next to the status: "Waiting 17 days", "Interview tomorrow", "Technical interview". */
  detail: string | null;
  /** The interview has happened and nothing is booked after it: shown as waiting for the result. */
  awaiting: boolean;
  /** Why a closed application closed, as a filter of the Closed group; null for the other groups. */
  closedReason: ClosedReason | null;
  action: RowAction;
  /** Sort key inside the group (bigger first). */
  sortOn: string | number | null;
  haystack: string;
};

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

function detailFor(d: Derived, today: string): string | null {
  const fmt = (x: string | null) => formatShort(x, { today });
  switch (d.phase) {
    case "applied":
    case "screening":
      return d.silenceDays !== null && d.silenceDays > 0 ? `Waiting ${days(d.silenceDays)}` : d.appliedOn ? `Sent ${fmt(d.appliedOn)}` : null;
    case "interviewing": {
      if (d.awaitingResult) return `Interview ${fmt(d.lastInterviewOn)}`;
      if (!d.nextInterviewOn) return null;
      const ahead = daysBetween(today, d.nextInterviewOn) ?? 0;
      return ahead === 0 ? "Interview today" : ahead === 1 ? "Interview tomorrow" : `Interview ${formatDay(d.nextInterviewOn)}`;
    }
    case "draft": {
      if (d.app.posting_live === false) return "Job post is gone";
      const closes = toDateOnly(d.app.closes_on);
      if (closes && closes >= today) {
        const ahead = daysBetween(today, closes) ?? 0;
        if (ahead <= 14) return ahead === 0 ? "Closes today" : `Closes in ${days(ahead)}`;
      }
      return d.cvBuiltOn ? `CV made ${fmt(d.cvBuiltOn)}` : null;
    }
    case "rejected":
      // Where it stopped: "Screening", "Technical interview", "2nd interview".
      return stageReached(d, today).label;
    default:
      return null;
  }
}

function actionFor(phase: Phase): RowAction {
  if (phase === "draft") return "mark_sent";
  if (phase === "applied" || phase === "screening" || phase === "interviewing") return "update";
  return "open";
}

function sortKey(d: Derived, group: StatusGroupId, today: string): string | number | null {
  switch (group) {
    case "interviews":
      return d.nextInterviewOn ?? d.lastEventOn ?? d.appliedOn;
    case "waiting":
      // Longest wait first; undated rows last. A result is awaited since the interview, not since sending.
      return d.awaitingResult && d.lastInterviewOn ? daysBetween(d.lastInterviewOn, today) : d.silenceDays;
    case "not_sent":
      return d.cvBuiltOn ?? d.windowDate;
    case "closed":
      return phaseChangedOn(d.phase, d.events) ?? d.lastEventOn ?? d.appliedOn ?? d.windowDate;
  }
}

export function buildItems(apps: Application[], settings: UserSettings | undefined, today: string): AppItem[] {
  const events = apps.flatMap((a) => a.events) as unknown as CoreEvent[];
  const ctx = buildContext({
    apps: apps as unknown as JobOverviewRow[],
    events,
    settings: (settings ?? null) as Partial<CoreSettings> | null,
    today,
  });
  return ctx.all.map((d, i) => {
    const app = apps[i];
    const company = d.company || "Unknown company";
    const role = d.role || "Untitled role";
    const location = app.location?.trim() || null;
    const group = statusGroupOf(d) as StatusGroupId;
    return {
      id: d.id,
      ref: appRef({ id: d.id, slug: d.slug }),
      href: appPath({ id: d.id, slug: d.slug }),
      app,
      d,
      phase: d.phase as Phase,
      group,
      company,
      role,
      location,
      logoUrl: app.company_logo_url,
      detail: detailFor(d, today),
      awaiting: d.awaitingResult,
      closedReason: group === "closed" ? closedReasonOf(d, today) : null,
      action: actionFor(d.phase as Phase),
      sortOn: sortKey(d, group, today),
      haystack: [company, role, d.slug, location].filter(Boolean).join(" ").toLowerCase(),
    };
  });
}

const desc = (a: string | number | null, b: string | number | null) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? 1 : a > b ? -1 : 0;
};

// ── closed ──────────────────────────────────────────────────────────────────

/** Closed rows shown at a time. */
export const CLOSED_PAGE_SIZE = 10;

export type ClosedReason = { id: string; label: string; order: number };

/**
 * Why a closed application closed: the outcome, and for a rejection the stage it stopped at, so
 * "Rejected at screening" and "Rejected after technical interview" can be told apart. Ordered from the
 * earliest stage to the latest, then the other outcomes.
 */
export function closedReasonOf(d: Derived, today: string): ClosedReason | null {
  switch (d.phase) {
    case "rejected": {
      const stage = stageReached(d, today);
      const kind = INTERVIEW_TYPES.findIndex((t) => t.id === stage.type);
      // Screening, a test, an interview of unknown kind (by round), then the kinds in picker order.
      const order =
        stage.label === "Screening" ? 0 : stage.label === "Assessment" ? 1 : kind >= 0 ? 50 + kind : stage.rounds ? 2 + stage.rounds : 2;
      const label =
        stage.label === "Screening"
          ? "Rejected at screening"
          : `Rejected after ${stage.label === "Interview" ? "an interview" : lowerFirst(stage.label)}`;
      return { id: `rejected-${stage.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, label, order };
    }
    case "no_reply":
      return { id: "no_reply", label: "No reply", order: 100 };
    case "withdrawn":
      return { id: "withdrawn", label: "Withdrawn", order: 101 };
    case "skipped":
      return { id: "skipped", label: "Not applying", order: 102 };
    default:
      return null;
  }
}

/** The reasons present among some closed rows, with how many each, in stage order. */
export function closedReasons(items: AppItem[]): Array<ClosedReason & { count: number }> {
  const byId = new Map<string, ClosedReason & { count: number }>();
  for (const it of items) {
    const r = it.closedReason;
    if (!r) continue;
    const e = byId.get(r.id) ?? { ...r, count: 0 };
    e.count += 1;
    byId.set(r.id, e);
  }
  return [...byId.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

/**
 * What the Closed group shows: the reasons as chips, the rows of the chosen one, and the page. A reason
 * no row has any more (after a search, or a delete) shows them all.
 */
export function closedView(items: AppItem[], why: string, page: number) {
  const reasons = closedReasons(items);
  const active = reasons.some((r) => r.id === why) ? why : "";
  const filtered = active ? items.filter((it) => it.closedReason?.id === active) : items;
  return { reasons, active, filtered, page: paginate(filtered, page) };
}

export type Page<T> = { items: T[]; page: number; pages: number; from: number; to: number; total: number };

/** One page of rows. A page past the end shows the last one, so a stale ?page= never shows nothing. */
export function paginate<T>(items: T[], page: number, size = CLOSED_PAGE_SIZE): Page<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const start = (p - 1) * size;
  const slice = items.slice(start, start + size);
  return { items: slice, page: p, pages, from: total ? start + 1 : 0, to: start + slice.length, total };
}

// ── delete ──────────────────────────────────────────────────────────────────

/** A note or a status change is no history worth asking about: an agent's found job has just a note. */
const QUIET_EVENTS = new Set(["note", "phase_change", "skipped"]);

/**
 * Never sent, not in doubt, no CV, no answers and no real history: the jobs an agent found look like
 * this, so the row can leave at once with an Undo. Anything else asks first. A stored cover letter on
 * a row like this goes unnoticed, because job_overview does not expose it; the Undo still covers it.
 */
export function isDisposable(it: Pick<AppItem, "app" | "d">): boolean {
  return (
    !it.d.sent &&
    !it.d.statusUnconfirmed &&
    !it.app.has_cv &&
    !it.d.cvBuiltOn &&
    !it.app.answer_count &&
    it.d.events.every((e) => QUIET_EVENTS.has(e.kind))
  );
}

export function deleteWarning(it: Pick<AppItem, "company" | "role" | "d">): string {
  const numbers = it.d.sent || it.d.cvBuiltOn ? " It also stops counting in your numbers." : "";
  return `${it.company} · ${it.role}. Its history, CV and notes are deleted too.${numbers} This cannot be undone.`;
}

/** The application is gone but some of its files may not be: they are private and worth knowing about. */
export function leftoverText({ filesLeft: n, filesUnchecked }: Pick<DeleteResult, "filesLeft" | "filesUnchecked">): string | null {
  if (n) return `Deleted, but ${n} stored ${n === 1 ? "file" : "files"} could not be removed. "intervous doctor --orphans" lists them.`;
  if (filesUnchecked) return `Deleted, but its stored files could not be checked. "intervous doctor --orphans" lists any left behind.`;
  return null;
}

// ── filter ──────────────────────────────────────────────────────────────────

export type Show = "all" | StatusGroupId;

export const SHOW_VALUES: Show[] = ["all", ...STATUS_GROUPS.map((g) => g.id)];

export function matchesQuery(it: AppItem, q: string): boolean {
  const s = q.trim().toLowerCase();
  return !s || s.split(/\s+/).every((w) => it.haystack.includes(w));
}

// ── groups ──────────────────────────────────────────────────────────────────

/** Reading order of the groups in "All": what needs you most first. */
const GROUP_ORDER: StatusGroupId[] = ["interviews", "waiting", "not_sent", "closed"];

export type Group = { id: StatusGroupId; label: string; items: AppItem[] };

export function toGroups(items: AppItem[]): Group[] {
  return GROUP_ORDER.map((id) => {
    const g = STATUS_GROUPS.find((x) => x.id === id)!;
    return { id, label: g.label, items: items.filter((it) => it.group === id).sort((a, b) => desc(a.sortOn, b.sortOn) || b.id - a.id) };
  });
}

/** Rows per filter value, for the segmented control. */
export function showCounts(items: AppItem[]): Record<Show, number> {
  const out = { all: items.length } as Record<Show, number>;
  for (const g of STATUS_GROUPS) out[g.id] = items.filter((it) => it.group === g.id).length;
  return out;
}
