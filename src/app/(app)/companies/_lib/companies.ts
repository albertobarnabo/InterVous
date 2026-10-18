"use client";
// Company data for /companies, the palette, the link-company dialogs and the application page.
// Live: lib/backend/companies + company_info (RLS as the signed-in user).
// Dev fixture mode: the fixture's company list (lib/data/fixture.ts adds one per company name its
// applications use), with tags and About kept in memory. A reload resets it.
import { apiJson } from "../../../../../lib/api";
import {
  createCompany as beCreateCompany,
  createCompanyTag as beCreateTag,
  deleteCompanyTag as beDeleteTag,
  getCompanies as beGetCompanies,
  getCompanyByName as beGetCompanyByName,
  getCompanyTags as beGetTags,
  updateCompany as beUpdateCompany,
  updateCompanyTag as beUpdateTag,
} from "../../../../../lib/backend/companies";
import { getCompanyInfo as beGetInfo, upsertCompanyInfo as beUpsertInfo } from "../../../../../lib/backend/companyInfo";
import { slugify } from "../../../../../lib/core";
import { refetchAll, removeCompanyLogo, setCompanyLogo } from "../../../../../lib/data";
import { FIXTURE_MODE } from "../../../../../lib/data/env";
import { loadFixture, type FixtureCompany } from "../../../../../lib/data/fixture";
import { getKeysStatus as beKeysStatus, type KeysStatus } from "../../../../../lib/keyService";
import { supabase } from "../../../../../lib/supbaseClient";
import type { CompanyInfo, CompanyTag, CompanyWithTags, SortOption } from "../../../../../lib/types";

export type { CompanyInfo, CompanyTag, CompanyWithTags, SortOption, KeysStatus };

export type CompanyDraft = { name: string; website: string | null; logo_url: string | null };

const listeners = new Set<() => void>();

/** Called after every write so open lists refetch. */
export function onCompaniesChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function changed() {
  for (const l of listeners) l();
}

const norm = (s: string | null | undefined) => String(s ?? "").trim().toLowerCase();

// ── fixture store ───────────────────────────────────────────────────────────

type Extra = { tags: string[]; created_at: string };
type Store = { companies: FixtureCompany[]; extra: Map<string, Extra>; tags: CompanyTag[]; info: Map<string, CompanyInfo> };
let store: Promise<Store> | null = null;

function fixtureStore(): Promise<Store> {
  if (!store) {
    store = loadFixture().then((f) => ({ companies: f.companies, extra: new Map(), tags: [], info: new Map() }));
  }
  return store;
}

function withTags(s: Store, c: FixtureCompany): CompanyWithTags & { created_at: string } {
  const x = s.extra.get(c.id);
  return {
    ...c,
    created_by: "fixture-user",
    created_at: x?.created_at ?? "2026-08-01T00:00:00Z",
    tags: s.tags.filter((t) => x?.tags.includes(t.id)),
  };
}

function sortCompanies<T extends CompanyWithTags & { created_at: string }>(list: T[], sort: SortOption) {
  const out = [...list];
  if (sort === "recent") out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  else if (sort === "shuffle") out.sort((a, b) => (a.id < b.id ? -1 : 1));
  else out.sort((a, b) => a.name.localeCompare(b.name) * (sort === "name_desc" ? -1 : 1));
  return out;
}

// ── reads ───────────────────────────────────────────────────────────────────

/** One page of companies, filtered by name search, tag and first letter. */
export async function listCompanies(opts: {
  page: number;
  pageSize: number;
  query?: string;
  tagId?: string | null;
  sort?: SortOption;
  letter?: string | null;
}): Promise<{ data: CompanyWithTags[]; count: number }> {
  const { page, pageSize, query = "", tagId = null, sort = "name_asc", letter = null } = opts;
  // lib/backend/companies escapes % _ \ in the ilike pattern itself: pass the raw text.
  if (!FIXTURE_MODE) return beGetCompanies(page, pageSize, query.trim(), tagId, sort, letter);
  const s = await fixtureStore();
  const q = norm(query);
  const rows = sortCompanies(
    s.companies
      .map((c) => withTags(s, c))
      .filter(
        (c) =>
          (!q || norm(c.name).includes(q)) &&
          (!letter || c.name.toUpperCase().startsWith(letter)) &&
          (!tagId || c.tags.some((t) => t.id === tagId)),
      ),
    sort,
  );
  const from = (page - 1) * pageSize;
  return { data: rows.slice(from, from + pageSize), count: rows.length };
}

/**
 * The companies of these applications (by company_id, and by name for applications without one),
 * with their tags, A to Z.
 */
export async function listCompaniesOf(apps: Array<{ company_id: string | null; company_name: string | null }>): Promise<CompanyWithTags[]> {
  const ids = [...new Set(apps.map((a) => a.company_id).filter((x): x is string => !!x))];
  const names = [...new Set(apps.filter((a) => !a.company_id && a.company_name?.trim()).map((a) => String(a.company_name).trim()))];
  if (FIXTURE_MODE) {
    const s = await fixtureStore();
    const nameSet = new Set(names.map(norm));
    return s.companies
      .filter((c) => ids.includes(c.id) || nameSet.has(norm(c.name)))
      .map((c) => withTags(s, c))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const rows = new Map<string, CompanyWithTags>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from("companies").select("*").in("id", ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const c of data ?? []) rows.set(c.id, { ...c, tags: [] });
  }
  for (let i = 0; i < names.length; i += 100) {
    const { data, error } = await supabase.from("companies").select("*").in("name", names.slice(i, i + 100));
    if (error) throw new Error(error.message);
    for (const c of data ?? []) rows.set(c.id, { ...c, tags: [] });
  }
  const all = [...rows.values()];
  const companyIds = all.map((c) => c.id);
  for (let i = 0; i < companyIds.length; i += 200) {
    const { data, error } = await supabase
      .from("company_tag_map")
      .select("company_id, company_tags(id, name, description)")
      .in("company_id", companyIds.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const m of (data ?? []) as unknown as Array<{ company_id: string; company_tags: CompanyTag | null }>) {
      const c = rows.get(m.company_id);
      if (c && m.company_tags && !c.tags.some((t) => t.id === m.company_tags?.id)) c.tags.push(m.company_tags);
    }
  }
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCompanyByName(name: string): Promise<CompanyWithTags | null> {
  if (!FIXTURE_MODE) return beGetCompanyByName(name);
  const s = await fixtureStore();
  const c = s.companies.find((x) => norm(x.name) === norm(name));
  return c ? withTags(s, c) : null;
}

/** Which of these names have a company record (case-insensitive). Used to find unlinked applications. */
export async function knownCompanyNames(names: string[]): Promise<Set<string>> {
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const out = new Set<string>();
  if (!wanted.length) return out;
  if (FIXTURE_MODE) {
    const s = await fixtureStore();
    const have = new Set(s.companies.map((c) => norm(c.name)));
    for (const n of wanted) if (have.has(norm(n))) out.add(norm(n));
    return out;
  }
  for (let i = 0; i < wanted.length; i += 100) {
    const { data, error } = await supabase.from("companies").select("name").in("name", wanted.slice(i, i + 100));
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as { name: string }[]) out.add(norm(r.name));
  }
  return out;
}

export async function listTags(): Promise<CompanyTag[]> {
  if (!FIXTURE_MODE) return beGetTags();
  const s = await fixtureStore();
  return [...s.tags].sort((a, b) => a.name.localeCompare(b.name));
}

// ── writes ──────────────────────────────────────────────────────────────────

async function currentUid(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error("You are signed out. Sign in again to save.");
  return uid;
}

export async function createCompany(draft: CompanyDraft, tagIds: string[]): Promise<CompanyWithTags> {
  const name = draft.name.trim();
  if (!name) throw new Error("A company needs a name.");
  try {
    if (!FIXTURE_MODE) return await beCreateCompany({ ...draft, name }, tagIds, await currentUid());
    const s = await fixtureStore();
    if (s.companies.some((c) => norm(c.name) === norm(name))) throw new Error(`${name} is already in your companies.`);
    const c: FixtureCompany = { id: `fx-${slugify(name)}-${Date.now().toString(36)}`, name, website: draft.website, logo_url: draft.logo_url };
    s.companies.push(c);
    s.extra.set(c.id, { tags: [...tagIds], created_at: new Date().toISOString() });
    return withTags(s, c);
  } finally {
    changed();
  }
}

export async function updateCompany(id: string, draft: CompanyDraft, tagIds: string[]): Promise<void> {
  const name = draft.name.trim();
  if (!name) throw new Error("A company needs a name.");
  try {
    if (!FIXTURE_MODE) return await beUpdateCompany(id, { ...draft, name }, tagIds);
    const s = await fixtureStore();
    const c = s.companies.find((x) => x.id === id);
    if (!c) throw new Error("That company no longer exists.");
    Object.assign(c, draft, { name });
    s.extra.set(id, { created_at: s.extra.get(id)?.created_at ?? "2026-08-01T00:00:00Z", tags: [...tagIds] });
  } finally {
    changed();
    void refetchAll();
  }
}

/**
 * Delete a company record. Its applications stay: they lose the link (jobs.company_id is set to
 * NULL by the database) and keep the company name as written.
 */
export async function deleteCompany(id: string): Promise<void> {
  try {
    if (FIXTURE_MODE) {
      const f = await loadFixture();
      const s = await fixtureStore();
      const i = s.companies.findIndex((c) => c.id === id);
      if (i < 0) throw new Error("That company is already gone.");
      s.companies.splice(i, 1);
      s.extra.delete(id);
      s.info.delete(id);
      for (const j of f.jobs) if (j.company_id === id) j.company_id = null;
      for (const a of f.apps) if (a.company_id === id) a.company_id = null;
      return;
    }
    const maps = await supabase.from("company_tag_map").delete().eq("company_id", id);
    if (maps.error) throw new Error(maps.error.message);
    const { data, error } = await supabase.from("companies").delete().eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("The company was not deleted. It may already be gone, or you may not have access to it.");
  } finally {
    changed();
    void refetchAll();
  }
}

/** Upload a logo file or save a pasted image link (lib/data setCompanyLogo), then refresh the lists. */
export async function saveLogo(companyId: string, source: File | string): Promise<string> {
  try {
    return await setCompanyLogo(companyId, source);
  } finally {
    changed();
  }
}

export async function clearLogo(companyId: string): Promise<void> {
  try {
    await removeCompanyLogo(companyId);
  } finally {
    changed();
  }
}

export async function createTag(name: string): Promise<CompanyTag> {
  const n = name.trim();
  try {
    if (!FIXTURE_MODE) return await beCreateTag(n, null);
    const s = await fixtureStore();
    const t = { id: `tag-${Date.now().toString(36)}`, name: n, description: null };
    s.tags.push(t);
    return t;
  } finally {
    changed();
  }
}

export async function renameTag(id: string, name: string): Promise<CompanyTag> {
  try {
    if (!FIXTURE_MODE) return await beUpdateTag(id, name.trim());
    const s = await fixtureStore();
    const t = s.tags.find((x) => x.id === id);
    if (!t) throw new Error("That tag no longer exists.");
    t.name = name.trim();
    return { ...t };
  } finally {
    changed();
  }
}

export async function deleteTag(id: string): Promise<void> {
  try {
    if (!FIXTURE_MODE) return await beDeleteTag(id);
    const s = await fixtureStore();
    s.tags = s.tags.filter((t) => t.id !== id);
    for (const x of s.extra.values()) x.tags = x.tags.filter((t) => t !== id);
  } finally {
    changed();
  }
}

export async function getCompanyInfo(companyId: string): Promise<CompanyInfo | null> {
  if (!FIXTURE_MODE) return beGetInfo(companyId);
  return (await fixtureStore()).info.get(companyId) ?? null;
}

export async function saveCompanyInfo(info: Omit<CompanyInfo, "updated_at" | "updated_by">): Promise<CompanyInfo> {
  if (!FIXTURE_MODE) return beUpsertInfo(info, await currentUid());
  const saved = { ...info, updated_at: new Date().toISOString(), updated_by: "fixture-user" };
  (await fixtureStore()).info.set(info.company_id, saved);
  return saved;
}

export type ResearchResult = Pick<CompanyInfo, "description" | "industry" | "headquarters" | "founded" | "employee_count">;

/** Tavily web search through /intervous/api/company-research. Errors carry the server's {error} text. */
export async function researchCompany(company: Pick<CompanyWithTags, "name" | "website">): Promise<ResearchResult> {
  if (FIXTURE_MODE) throw new Error("Auto-fill searches the web with your Tavily key, so it is off in preview mode.");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("You are signed out. Sign in again to use Auto-fill.");
  return apiJson<ResearchResult>("company-research", {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ companyName: company.name, website: company.website }),
  });
}

/** Which API keys are saved (booleans only). Fixture mode pretends OpenAI and Tavily are set. */
export async function keysStatus(): Promise<KeysStatus | null> {
  if (FIXTURE_MODE) return { open_ai: true, deep_seek: false, mistral: false, tavily: true };
  return beKeysStatus();
}

/** "acme.com" from "https://www.acme.com/about". */
export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Adds https:// when a website was typed without a scheme. */
export function normalizeWebsite(url: string): string | null {
  const t = url.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}
