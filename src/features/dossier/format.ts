import { daysBetween, formatShort, pluralDays } from "../../../lib/core";

/** '30 Aug' (with the year when it is not this year). */
export function shortDate(date: string | null | undefined, today: string): string {
  return formatShort(date ?? null, { today });
}

/** '44 days' between two dates, or '' when either is missing. */
export function daysLabel(from: string | null | undefined, to: string | null | undefined): string {
  const n = from && to ? daysBetween(from, to) : null;
  return n === null ? "" : pluralDays(n);
}

/** '1,184' */
export function int(n: number): string {
  return n.toLocaleString("en-US");
}

/** 'cv.pdf, 84 KB' */
export function fileSize(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Readable name of a `jobs` field listed in `uncertain`. */
export const FIELD_LABELS: Record<string, string> = {
  phase: "where it stands",
  applied_on: "the date you sent it",
  cv_built_on: "the date the CV was built",
  closes_on: "the closing date",
  posting_live: "whether the posting is live",
  channel: "the channel",
  salary_text: "the salary",
  visa_needed: "whether a visa is needed",
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}
