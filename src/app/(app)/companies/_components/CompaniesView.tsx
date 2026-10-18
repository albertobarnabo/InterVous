"use client";

import { Building2, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApplications, useToday } from "../../../../../lib/data";
import { Button, SegmentedControl, Select, cx } from "@/ui";
import { controlClass } from "@/ui/Field";
import { glassClass } from "@/features/dossier/glass";
import {
  getCompanyByName,
  keysStatus,
  listCompanies,
  listCompaniesOf,
  listTags,
  onCompaniesChanged,
  type CompanyTag,
  type CompanyWithTags,
} from "../_lib/companies";
import { appsForCompany } from "../_lib/match";
import { AppPicker } from "./AppPicker";
import { CompanyEditor } from "./CompanyEditor";
import { CompanyPanel } from "./CompanyPanel";
import { CompanyCard } from "./CompanyTile";
import { LogoDialog } from "./LogoDialog";
import { UnlinkedApps } from "./UnlinkedApps";

const PAGE_SIZE = 24;
type Scope = "mine" | "all";

export default function CompaniesView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const today = useToday();
  const apps = useApplications();

  // filters
  const [scope, setScope] = useState<Scope>("mine");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tagId, setTagId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // data
  const [rows, setRows] = useState<CompanyWithTags[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<CompanyTag[]>([]);
  const [tavily, setTavily] = useState(false);
  const [version, setVersion] = useState(0);

  // overlays
  const [selected, setSelected] = useState<CompanyWithTags | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; company: CompanyWithTags | null }>({ open: false, company: null });
  const [logoFor, setLogoFor] = useState<CompanyWithTags | null>(null);
  const [linkFor, setLinkFor] = useState<CompanyWithTags | null>(null);
  const openEditor = (company: CompanyWithTags | null) => setEditor({ open: true, company });
  const closeEditor = () => setEditor((e) => ({ ...e, open: false }));

  useEffect(() => onCompaniesChanged(() => setVersion((v) => v + 1)), []);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => setPage(1), [debounced, tagId, scope]);

  // "Applied to": the companies of his applications, filtered here. "All companies": a server page.
  const appKey = useMemo(
    () => (apps.data ?? []).map((a) => `${a.id}:${a.company_id ?? ""}:${a.company_name ?? ""}`).join("|"),
    [apps.data],
  );
  useEffect(() => {
    if (scope === "mine" && !apps.data) {
      if (apps.error) {
        setError(apps.error.message);
        setLoading(false);
      }
      return;
    }
    let live = true;
    setLoading(true);
    setError(null);
    const load =
      scope === "mine"
        ? listCompaniesOf(apps.data ?? []).then((list) => {
            const q = debounced.trim().toLowerCase();
            const data = list.filter((c) => (!q || c.name.toLowerCase().includes(q)) && (!tagId || c.tags.some((t) => t.id === tagId)));
            return { data: data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), count: data.length };
          })
        : listCompanies({ page, pageSize: PAGE_SIZE, query: debounced, tagId, sort: "name_asc" });
    load
      .then((r) => {
        if (!live) return;
        setRows(r.data);
        setCount(r.count);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : "The companies did not load."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- appKey stands for apps.data
  }, [scope, page, debounced, tagId, version, appKey, apps.error]);

  useEffect(() => {
    listTags()
      .then(setTags)
      .catch(() => {});
  }, [version]);
  useEffect(() => {
    keysStatus()
      .then((k) => setTavily(Boolean(k?.tavily)))
      .catch(() => {});
  }, []);

  // ?company=<name> deep link (kept in the URL while the panel is open), ?add=1 opens the editor
  const companyParam = params.get("company");
  const addParam = params.get("add");
  const setParam = useCallback(
    (name: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (name) next.set("company", name);
      else next.delete("company");
      next.delete("add");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    if (!companyParam) {
      setSelected(null);
      return;
    }
    if (selected && selected.name.toLowerCase() === companyParam.toLowerCase()) return;
    let live = true;
    getCompanyByName(companyParam)
      .then((c) => {
        if (!live) return;
        if (c) setSelected(c);
        else setParam(null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the URL drives this
  }, [companyParam]);

  // Keep the open panel in step with edits (logo, name, tags).
  useEffect(() => {
    if (!selected || version === 0) return;
    let live = true;
    const fresh = rows.find((r) => r.id === selected.id);
    if (fresh) setSelected(fresh);
    else
      getCompanyByName(selected.name)
        .then((c) => live && c && setSelected(c))
        .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when the list reloads
  }, [rows]);

  useEffect(() => {
    if (addParam) {
      openEditor(null);
      setParam(companyParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addParam]);

  const open = (c: CompanyWithTags) => {
    setSelected(c);
    setParam(c.name);
  };

  const appsByCompany = useMemo(() => {
    const m = new Map<string, ReturnType<typeof appsForCompany>>();
    for (const c of rows) m.set(c.id, appsForCompany(apps.data, c));
    return m;
  }, [rows, apps.data]);

  const selectedApps = useMemo(() => appsForCompany(apps.data, selected), [apps.data, selected]);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const filtered = Boolean(debounced.trim() || tagId);
  const missingLogos = rows.filter((c) => !c.logo_url).length;

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pt-8 pb-24 sm:px-6 md:pt-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.01em] text-ink sm:text-[34px]">Companies</h1>
          <p className="mt-2 max-w-[60ch] text-[16px] leading-6 text-ink-2">
            Every company you&apos;ve applied to. Open one to see its applications, add its logo or link an application to it.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => openEditor(null)}>
          Add company
        </Button>
      </header>

      <div className="mt-7 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            data-page-search
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") (e.target as HTMLInputElement).blur();
            }}
            placeholder="Search companies"
            aria-label="Search companies"
            className={cx(controlClass, "h-11 rounded-full pl-10 text-[16px]")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
          <SegmentedControl<Scope>
            aria-label="Which companies"
            value={scope}
            onChange={setScope}
            options={[
              { value: "mine", label: "Applied to" },
              { value: "all", label: "All companies" },
            ]}
          />
          {tags.length ? (
            <div className="w-40 max-sm:flex-1">
              <Select<string>
                aria-label="Filter by tag"
                value={tagId ?? ""}
                onChange={(v) => setTagId(v || null)}
                options={[{ value: "", label: "All tags" }, ...tags.map((t) => ({ value: t.id, label: t.name }))]}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <UnlinkedApps apps={apps.data} />

        <p className="text-[15px] text-ink-2" aria-live="polite">
          {loading
            ? "Loading…"
            : count === 0
              ? null
              : `${count} ${count === 1 ? "company" : "companies"}${missingLogos ? ` · ${missingLogos} without a logo${pages > 1 ? " on this page" : ""}` : ""}`}
        </p>

        {error ? (
          <div className={cx(glassClass, "flex flex-wrap items-center justify-between gap-3 p-5")}>
            <div>
              <p className="text-[16px] font-semibold text-ink">The companies did not load</p>
              <p className="text-[15px] text-ink-2">{error}</p>
            </div>
            <Button onClick={() => setVersion((v) => v + 1)}>Try again</Button>
          </div>
        ) : loading && !rows.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} aria-hidden className={cx(glassClass, "h-36")} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className={cx(glassClass, "flex flex-col items-center gap-2 px-6 py-12 text-center")}>
            <Building2 aria-hidden size={28} strokeWidth={1.5} className="text-ink-3" />
            <p className="text-[18px] font-semibold text-ink">
              {filtered ? "No company matches" : scope === "mine" ? "No companies yet" : "No companies saved"}
            </p>
            <p className="max-w-md text-[15px] text-ink-2">
              {filtered
                ? "Try another name or tag."
                : "A company is added when you add a job. You can also add one here."}
            </p>
            <div className="mt-3">
              {filtered ? (
                <Button
                  onClick={() => {
                    setQuery("");
                    setTagId(null);
                  }}
                >
                  Clear search
                </Button>
              ) : (
                <Button variant="primary" icon={Plus} onClick={() => openEditor(null)}>
                  Add company
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className={cx("grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3", loading && "opacity-60")}>
            {rows.map((c) => (
              <CompanyCard key={c.id} company={c} apps={appsByCompany.get(c.id) ?? []} onOpen={open} onAddLogo={setLogoFor} />
            ))}
          </div>
        )}

        {pages > 1 ? (
          <nav aria-label="Pages" className="mt-2 flex items-center justify-center gap-3">
            <Button icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-[15px] text-ink-2 tabular-nums">
              Page {page} of {pages}
            </span>
            <Button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
              <ChevronRight aria-hidden size={16} className="-mr-1 inline" />
            </Button>
          </nav>
        ) : null}
      </div>

      <CompanyPanel
        company={selected}
        apps={selectedApps}
        appsLoading={apps.loading}
        today={today}
        tavily={tavily}
        onClose={() => {
          setSelected(null);
          setParam(null);
        }}
        onEdit={(c) => openEditor(c)}
        onLogo={setLogoFor}
        onLinkApp={setLinkFor}
      />

      <CompanyEditor
        open={editor.open}
        company={editor.company}
        onClose={closeEditor}
        onSaved={async (saved) => {
          const wasOpen = selected?.id === saved.id;
          closeEditor();
          if (wasOpen) {
            const fresh = await getCompanyByName(saved.name).catch(() => null);
            if (fresh) {
              setSelected(fresh);
              setParam(fresh.name);
            }
          }
        }}
      />

      <LogoDialog open={!!logoFor} onClose={() => setLogoFor(null)} company={logoFor} />
      <AppPicker open={!!linkFor} onClose={() => setLinkFor(null)} company={linkFor} apps={apps.data} />
    </div>
  );
}
