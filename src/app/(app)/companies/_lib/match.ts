// Which applications belong to a company: jobs.company_id first, the company name as a fallback
// (legacy rows and CLI rows written with company_create:false have no company_id).
import { appPath as coreAppPath, nowSentence, type JobEvent as CoreEvent, type JobOverviewRow } from "../../../../../lib/core";
import type { Application } from "../../../../../lib/data";

const norm = (s: string | null | undefined) => String(s ?? "").trim().toLowerCase();

export function belongsTo(app: Pick<Application, "company_id" | "company_name">, company: { id: string; name: string }): boolean {
  if (app.company_id) return app.company_id === company.id;
  return norm(app.company_name) === norm(company.name);
}

/** The company's applications, newest activity first. */
export function appsForCompany(apps: Application[] | undefined, company: { id: string; name: string } | null): Application[] {
  if (!apps || !company) return [];
  return apps
    .filter((a) => belongsTo(a, company))
    .sort((a, b) => {
      const da = a.applied_on ?? a.cv_built_on ?? a.created_at ?? "";
      const db = b.applied_on ?? b.cv_built_on ?? b.created_at ?? "";
      return da < db ? 1 : da > db ? -1 : 0;
    });
}

/** The date shown next to an application in a company list: the CV date for a draft, else the sent date (or none). */
export function appDate(app: Pick<Application, "phase" | "applied_on" | "cv_built_on">): string | null {
  return app.phase === "draft" ? (app.cv_built_on ?? null) : (app.applied_on ?? null);
}

/** True when the date appDate() shows is the sent date and the history is unsure about it. */
export function appDateUnsure(app: Pick<Application, "phase" | "applied_on" | "uncertain">): boolean {
  return app.phase !== "draft" && !!app.applied_on && ((app.uncertain ?? []) as string[]).includes("applied_on");
}

const GROUPS: Array<{ label: string; phases: string[] }> = [
  { label: "in interviews", phases: ["interviewing", "offer"] },
  { label: "waiting", phases: ["applied", "screening"] },
  { label: "not sent", phases: ["draft"] },
];

/** "3 applications · 1 in interviews", or "No applications yet". */
export function summaryLine(apps: Pick<Application, "phase">[]): string {
  if (!apps.length) return "No applications yet";
  const head = `${apps.length} application${apps.length === 1 ? "" : "s"}`;
  for (const g of GROUPS) {
    const n = apps.filter((a) => g.phases.includes(String(a.phase))).length;
    if (n) return `${head} · ${n} ${g.label}`;
  }
  return `${head} · all closed`;
}

/** The view row typed for lib/core (job_overview columns are nullable in the generated types). */
export const coreRow = (a: Application) => a as unknown as JobOverviewRow;

/** '/applications/<slug or id>'. */
export const dossierPath = (a: Application) => coreAppPath(coreRow(a));

/** The plain "now" sentence of the list (lib/core/now.mjs). */
export const nowOf = (a: Application, today: string) =>
  nowSentence(coreRow(a), { today, events: a.events as unknown as CoreEvent[] });
