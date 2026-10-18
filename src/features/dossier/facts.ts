// Plain-language facts of one application, for the header fact line and the facts grid.
import { CHANNEL_LABELS, formatAgo, formatSalary, roleFamilyLabel, type JobOverviewRow } from "../../../lib/core";
import type { JobRow } from "../../../lib/data";
import { shortDate } from "./format";

export type Fact = {
  /** Field name in `jobs` (used to mark it unconfirmed when it is listed in `uncertain`). */
  field: string;
  text: string;
};

const WORK_MODE: Record<string, string> = { onsite: "on-site", hybrid: "hybrid", remote: "remote" };

/** "via Ashby", "via the ECB portal", "via a referral". */
export function channelText(app: Pick<JobOverviewRow, "channel" | "channel_detail">): string | null {
  if (app.channel_detail) return `via ${app.channel_detail}`;
  if (!app.channel) return null;
  if (app.channel === "referral") return "via a referral";
  if (app.channel === "recruiter") return "via a recruiter";
  if (app.channel === "other") return null;
  return `via ${CHANNEL_LABELS[app.channel] ?? app.channel}`;
}

/** The salary as a short figure ('$230K–385K a year'), else the text as written when it is short. */
export function salaryShort(app: JobOverviewRow): string | null {
  const parsed = formatSalary(app);
  if (parsed) return parsed;
  const t = app.salary_text?.trim();
  return t && t.length <= 40 ? t : null;
}

/** "London, UK · hybrid · via Ashby · visa needed · $230K–385K" as separate parts. */
export function factLine(app: JobOverviewRow): Fact[] {
  const out: Fact[] = [];
  if (app.location) out.push({ field: "location", text: app.location });
  if (app.work_mode) out.push({ field: "work_mode", text: WORK_MODE[app.work_mode] ?? app.work_mode });
  const via = channelText(app);
  if (via) out.push({ field: "channel", text: via });
  if (app.visa_needed === true) out.push({ field: "visa_needed", text: "visa needed" });
  const salary = salaryShort(app);
  if (salary) out.push({ field: "salary_text", text: salary });
  return out;
}

export type GridFact = { field: string; label: string; value: string; quiet?: boolean };

const SOURCE: Record<string, string> = { cli: "CLI", web: "web", import: "import" };

/** The Overview facts grid (spec 2.3): only the facts that are known, in a fixed order. */
export function gridFacts(app: JobOverviewRow, job: JobRow, today: string): GridFact[] {
  const rows: GridFact[] = [];
  const add = (field: string, label: string, value: string | null | undefined, quiet?: boolean) => {
    if (value) rows.push({ field, label, value, quiet });
  };
  add("salary_text", "Salary", app.salary_text ?? salaryShort(app));
  add(
    "visa_needed",
    "Visa",
    app.visa_needed === true ? "Needed" : app.visa_needed === false ? "Not needed" : null,
  );
  const via = app.channel ? CHANNEL_LABELS[app.channel] ?? app.channel : null;
  add("channel", "Channel", [via, app.channel_detail].filter(Boolean).join(" · ") || null);
  add("role_family", "Role family", app.role_family ? roleFamilyLabel(app.role_family) : null);
  add("seniority", "Seniority asked", job.seniority);
  add(
    "years_required",
    "Years required",
    typeof app.years_required === "number" ? `${app.years_required}+ ${app.years_required === 1 ? "year" : "years"}` : null,
  );
  add("cv_variant", "CV variant", job.cv_variant);
  const checked = job.posting_checked_at ? ` (checked ${shortDate(job.posting_checked_at.slice(0, 10), today)})` : "";
  add(
    "posting_live",
    "Posting",
    app.posting_live === true ? `Live${checked}` : app.posting_live === false ? `Closed${checked}` : null,
  );
  add("closes_on", app.closes_on && app.closes_on < today ? "Closed on" : "Closes on", app.closes_on ? shortDate(app.closes_on, today) : null);
  if (job.team) add("team", "Team", job.team);
  const updated = app.updated_at ?? job.updated_at;
  if (updated) {
    const via = app.source ? ` via ${SOURCE[app.source] ?? app.source}` : "";
    add("updated_at", "Last updated", `${formatAgo(updated)}${via}`, true);
  }
  return rows;
}
