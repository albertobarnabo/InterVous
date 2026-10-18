// Which applications belong to a company: jobs.company_id first, the company name as a fallback
// (legacy rows and command-line rows written without a company record have no company_id).
import { appPath as coreAppPath } from "../../../../../lib/core";
import type { Application } from "../../../../../lib/data";

const norm = (s: string | null | undefined) => String(s ?? "").trim().toLowerCase();

export function belongsTo(app: Pick<Application, "company_id" | "company_name">, company: { id: string; name: string }): boolean {
  if (app.company_id) return app.company_id === company.id;
  return norm(app.company_name) === norm(company.name);
}

/** The company's applications, newest first. */
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

const GROUPS: Array<{ label: string; phases: string[] }> = [
  { label: "at interview stage", phases: ["interviewing", "offer"] },
  { label: "waiting for a reply", phases: ["applied", "screening"] },
  { label: "not sent yet", phases: ["draft"] },
];

/** "3 applications · 1 waiting for a reply", or "No applications yet". */
export function summaryLine(apps: Pick<Application, "phase">[]): string {
  if (!apps.length) return "No applications yet";
  const head = `${apps.length} application${apps.length === 1 ? "" : "s"}`;
  for (const g of GROUPS) {
    const n = apps.filter((a) => g.phases.includes(String(a.phase))).length;
    if (n) return `${head} · ${n} ${g.label}`;
  }
  return `${head} · all closed`;
}

/** '/applications/<slug or id>'. */
export const dossierPath = (a: Pick<Application, "id" | "slug">) => coreAppPath({ id: Number(a.id), slug: a.slug });
