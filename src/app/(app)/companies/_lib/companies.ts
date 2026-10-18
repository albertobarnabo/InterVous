"use client";
// Company data for /companies, the palette and the link-company dialog.
// Live: lib/backend/companies + company_info (RLS as the signed-in user).
// Dev fixture mode: an in-memory copy built from the fixture's companies, or from the
// company names of its applications when the fixture has none. A reload resets it.
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
import { FIXTURE_MODE } from "../../../../../lib/data/env";
import { loadFixture } from "../../../../../lib/data/fixture";
import { getKeysStatus as beKeysStatus, type KeysStatus } from "../../../../../lib/keyService";
import { supabase } from "../../../../../lib/supbaseClient";
import type { CompanyInfo, CompanyTag, CompanyWithTags, SortOption } from "../../../../../lib/types";

export type { CompanyInfo, CompanyTag, CompanyWithTags, SortOption, KeysStatus };

export type CompanyDraft = { name: string; website: string | null; logo_url: string | null };

type FixtureCompany = CompanyWithTags & { created_at: string };
type Store = { companies: FixtureCompany[]; tags: CompanyTag[]; info: Map<string, CompanyInfo> };

let store: Promise<Store> | null = null;
const listeners = new Set<() => void>();

/** Called after every write so open lists refetch. */
export function onCompaniesChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function changed() {
  for (const l of listeners) l();
}

function fixtureStore(): Promise<Store> {
  if (!store) {
    store = loadFixture().then((f) => {
      const byName = new Map<string, FixtureCompany>();
      for (const c of f.companies) {
        byName.set(c.name.trim().toLowerCase(), { ...c, created_by: "fixture-user", tags: [], created_at: "2026-08-01T00:00:00Z" });
      }
      for (const a of f.apps) {
        const name = String(a.company_name ?? "").trim();
        const k = name.toLowerCase();
        if (!name || byName.has(k)) continue;
        byName.set(k, {
          id: a.company_id ?? `fx-${slugify(name) || "company"}`,
          name,
          website: null,
          logo_url: null,
          created_by: "fixture-user",
          tags: [],
          created_at: a.created_at ?? "2026-08-01T00:00:00Z",
        });
      }
      return { companies: [...byName.values()], tags: [], info: new Map() };
    });
  }
  return store;
}

function sortCompanies(list: FixtureCompany[], sort: SortOption) {
  const out = [...list];
  if (sort === "recent") out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  else if (sort === "shuffle") out.sort((a, b) => (a.id < b.id ? -1 : 1));
  else out.sort((a, b) => a.name.localeCompare(b.name) * (sort === "name_desc" ? -1 : 1));
  return out;
}

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
  const q = query.trim().toLowerCase();
  const rows = sortCompanies(
    s.companies.filter(
      (c) =>
        (!q || c.name.toLowerCase().includes(q)) &&
        (!letter || c.name.toUpperCase().startsWith(letter)) &&
        (!tagId || c.tags.some((t) => t.id === tagId)),
    ),
    sort,
  );
  const from = (page - 1) * pageSize;
  return { data: rows.slice(from, from + pageSize).map((c) => ({ ...c, tags: [...c.tags] })), count: rows.length };
}

export async function getCompanyByName(name: string): Promise<CompanyWithTags | null> {
  if (!FIXTURE_MODE) return beGetCompanyByName(name);
  const s = await fixtureStore();
  const c = s.companies.find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase());
  return c ? { ...c, tags: [...c.tags] } : null;
}

/** Which of these names have a company record (case-insensitive). Used to find unlinked applications. */
export async function knownCompanyNames(names: string[]): Promise<Set<string>> {
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const out = new Set<string>();
  if (!wanted.length) return out;
  if (FIXTURE_MODE) {
    const s = await fixtureStore();
    const have = new Set(s.companies.map((c) => c.name.trim().toLowerCase()));
    for (const n of wanted) if (have.has(n.toLowerCase())) out.add(n.toLowerCase());
    return out;
  }
  for (let i = 0; i < wanted.length; i += 100) {
    const { data, error } = await supabase.from("companies").select("name").in("name", wanted.slice(i, i + 100));
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as { name: string }[]) out.add(r.name.trim().toLowerCase());
  }
  return out;
}

export async function listTags(): Promise<CompanyTag[]> {
  if (!FIXTURE_MODE) return beGetTags();
  const s = await fixtureStore();
  return [...s.tags].sort((a, b) => a.name.localeCompare(b.name));
}

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
    if (s.companies.some((c) => c.name.toLowerCase() === name.toLowerCase())) throw new Error(`${name} is already in your companies.`);
    const c: FixtureCompany = {
      ...draft,
      name,
      id: `fx-${slugify(name)}-${Date.now().toString(36)}`,
      created_by: "fixture-user",
      created_at: new Date().toISOString(),
      tags: s.tags.filter((t) => tagIds.includes(t.id)),
    };
    s.companies.push(c);
    return { ...c };
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
    Object.assign(c, draft, { name, tags: s.tags.filter((t) => tagIds.includes(t.id)) });
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
    for (const c of s.companies) c.tags = c.tags.map((x) => (x.id === id ? { ...t } : x));
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
    for (const c of s.companies) c.tags = c.tags.filter((t) => t.id !== id);
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
  if (FIXTURE_MODE) throw new Error("Auto-fill searches the web with your Tavily key, so it is off in fixture mode.");
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
