"use client";
// One write for a new application from the web: iv_upsert_application(jsonb), the same function
// the CLI uses, with source 'web'. It matches or creates the company record (so company_id is set),
// writes `phase`, and stores a pasted JD as a jd_snapshot document, all in one transaction.
import { SLUG_MAX, slugify } from "../../../lib/core";
import { FIXTURE_MODE, refetchAll, type JobRow } from "../../../lib/data";
import { db, likeLiteral, must, toError } from "../../../lib/data/client";
import { deriveOverview, fixtureInsertEvent, loadFixture } from "../../../lib/data/fixture";
import { createCompany, getCompanyByName } from "@/app/(app)/companies/_lib/companies";

export type NewApplicationInput = {
  company: string;
  role: string;
  location?: string | null;
  url?: string | null;
  /** 'YYYY-MM-DD' when it was already sent; null keeps it as "Not sent". */
  sentOn?: string | null;
  /** Markdown of the job description (Paste JD). */
  jd?: string | null;
};

export type Created = { id: number; slug: string; company: string; role: string; companyCreated: boolean };

/** A slug no application has: '<company>-<role>', then '-2', '-3', … */
async function freeSlug(base: string, taken: Set<string>): Promise<string> {
  const root = base || "application";
  if (!FIXTURE_MODE) {
    const rows = must(await db.from("jobs").select("slug").like("slug", `${likeLiteral(root.slice(0, 70))}%`)) as { slug: string | null }[] | null;
    for (const r of rows ?? []) if (r.slug) taken.add(r.slug);
  }
  if (!taken.has(root)) return root;
  for (let i = 2; i < 1000; i++) {
    const suffix = `-${i}`;
    const s = `${root.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, "")}${suffix}`;
    if (!taken.has(s)) return s;
  }
  return `${root.slice(0, 60)}-${Date.now().toString(36)}`;
}

function payload(input: NewApplicationInput, slug: string) {
  const p: Record<string, unknown> = {
    slug,
    company: input.company.trim(),
    role: input.role.trim(),
    location: input.location?.trim() || "",
    url: input.url?.trim() || "",
    phase: input.sentOn ? "applied" : "draft",
    source: "web",
  };
  if (input.sentOn) {
    p.applied_on = input.sentOn;
    p.events = [{ kind: "applied", on: input.sentOn }];
  }
  if (input.jd?.trim()) {
    p.documents = [
      {
        kind: "jd_snapshot",
        label: "Pasted on the web",
        content: input.jd.trim(),
        mime_type: "text/markdown",
        source_url: input.url?.trim() || null,
        captured_at: new Date().toISOString(),
      },
    ];
  }
  return p;
}

async function createInFixture(input: NewApplicationInput, slug: string): Promise<Created> {
  const f = await loadFixture();
  const id = f.jobs.reduce((m, j) => Math.max(m, Number(j.id)), 0) + 1;
  const now = new Date().toISOString();
  const company = input.company.trim();
  const existing = await getCompanyByName(company);
  if (!existing) await createCompany({ name: company, website: null, logo_url: null }, []).catch(() => null);
  const job = {
    id,
    user_id: "fixture-user",
    slug,
    company_name: existing?.name ?? company,
    company_id: null,
    role: input.role.trim(),
    location: input.location?.trim() || "",
    url: input.url?.trim() || "",
    phase: "draft",
    applied_on: null,
    uncertain: [],
    source: "web",
    created_at: now,
    updated_at: now,
    last_activity_at: now,
  } as unknown as JobRow;
  f.jobs.push(job);
  deriveOverview(f, id);
  if (input.sentOn) fixtureInsertEvent(f, { job_id: id, kind: "applied", occurred_on: input.sentOn, source: "web" });
  if (input.jd?.trim()) {
    f.documents.push({
      id: `fx-doc-${id}`,
      job_id: id,
      user_id: "fixture-user",
      kind: "jd_snapshot",
      label: "Pasted on the web",
      content: input.jd.trim(),
      storage_path: null,
      mime_type: "text/markdown",
      size_bytes: null,
      sha256: `fx-${id}`,
      source_url: input.url?.trim() || null,
      captured_at: now,
      submitted: null,
      created_at: now,
    } as unknown as (typeof f.documents)[number]);
    deriveOverview(f, id);
  }
  return { id, slug, company: job.company_name ?? company, role: job.role ?? "", companyCreated: !existing };
}

/**
 * Creates the application and refetches what is on screen.
 * `takenSlugs` are the slugs already loaded (the database is asked too, live).
 */
export async function createApplication(input: NewApplicationInput, takenSlugs: Iterable<string>): Promise<Created> {
  if (!input.company.trim()) throw new Error("Add the company.");
  if (!input.role.trim()) throw new Error("Add the role.");
  const slug = await freeSlug(slugify(input.company, input.role), new Set(takenSlugs));
  try {
    if (FIXTURE_MODE) return await createInFixture(input, slug);
    const res = must(await db.rpc("iv_upsert_application", { p: payload(input, slug) })) as {
      id: number;
      slug: string;
      company: string;
      company_created: boolean;
    };
    return { id: res.id, slug: res.slug, company: res.company, role: input.role.trim(), companyCreated: !!res.company_created };
  } catch (e) {
    const err = toError(e, "The application was not saved.");
    if (/not authenticated/i.test(err.message)) throw new Error("You are signed out. Sign in again, then add it.");
    throw err;
  } finally {
    void refetchAll();
  }
}
