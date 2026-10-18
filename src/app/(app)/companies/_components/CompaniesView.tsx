"use client";

import { Building2, ChevronLeft, ChevronRight, LayoutGrid, List, Plus, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApplications } from "../../../../../lib/data";
import { Button, Callout, EmptyState, Kbd, SegmentedControl, Select, cx } from "@/ui";
import { controlClass } from "@/ui/Field";
import { useToday } from "@/features/palette/useToday";
import {
  getCompanyByName,
  keysStatus,
  listCompanies,
  listTags,
  onCompaniesChanged,
  type CompanyTag,
  type CompanyWithTags,
  type SortOption,
} from "../_lib/companies";
import { appsForCompany } from "../_lib/match";
import { CompanyEditor } from "./CompanyEditor";
import { CompanyPanel } from "./CompanyPanel";
import { CompanyCard, CompanyRow } from "./CompanyTile";
import { UnlinkedApps } from "./UnlinkedApps";

const PAGE_SIZE = 24;
const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const VIEW_KEY = "iv.companies.view";
type View = "grid" | "list";

const SORTS: Array<{ value: SortOption; label: string }> = [
  { value: "name_asc", label: "A → Z" },
  { value: "name_desc", label: "Z → A" },
  { value: "recent", label: "Newest first" },
  { value: "shuffle", label: "Shuffled" },
];

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

export default function CompaniesView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const today = useToday();
  const apps = useApplications();

  // filters
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tagId, setTagId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>("name_asc");
  const [letter, setLetter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>("grid");

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
  const openEditor = (company: CompanyWithTags | null) => setEditor({ open: true, company });
  const closeEditor = () => setEditor((e) => ({ ...e, open: false }));

  useEffect(() => setView(readView()), []);
  useEffect(() => onCompaniesChanged(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => setPage(1), [debounced, tagId, sort, letter]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    listCompanies({ page, pageSize: PAGE_SIZE, query: debounced, tagId, sort, letter })
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
  }, [page, debounced, tagId, sort, letter, version]);

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

  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  const appsByCompany = useMemo(() => {
    const m = new Map<string, ReturnType<typeof appsForCompany>>();
    for (const c of rows) m.set(c.id, appsForCompany(apps.data, c));
    return m;
  }, [rows, apps.data]);

  const selectedApps = useMemo(() => appsForCompany(apps.data, selected), [apps.data, selected]);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const filtered = Boolean(debounced.trim() || tagId || letter);
  const from = count ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, count);

  return (
    <div className="iv-page pb-8 pt-8 md:pt-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1-sm text-ink sm:text-h1">Companies</h1>
          <p className="mt-1 text-body text-ink-2">Companies you&apos;ve applied to or are watching</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => openEditor(null)}>
          Add company
        </Button>
      </header>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
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
            className={cx(controlClass, "h-9 pl-9 pr-10 pointer-coarse:h-11")}
          />
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-2 hidden items-center md:flex">
            <Kbd>/</Kbd>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
          <div className="w-40 max-sm:flex-1">
            <Select<string>
              aria-label="Filter by tag"
              value={tagId ?? ""}
              onChange={(v) => setTagId(v || null)}
              options={[{ value: "", label: "All tags" }, ...tags.map((t) => ({ value: t.id, label: t.name }))]}
            />
          </div>
          <div className="w-36 max-sm:flex-1">
            <Select<SortOption> aria-label="Sort" value={sort} onChange={setSort} options={SORTS} />
          </div>
          <SegmentedControl<View>
            aria-label="Layout"
            value={view}
            onChange={changeView}
            options={[
              {
                value: "grid",
                label: (
                  <span className="flex items-center gap-1.5">
                    <LayoutGrid aria-hidden size={15} /> Grid
                  </span>
                ),
              },
              {
                value: "list",
                label: (
                  <span className="flex items-center gap-1.5">
                    <List aria-hidden size={15} /> List
                  </span>
                ),
              },
            ]}
          />
        </div>
      </div>

      <nav aria-label="First letter" className="-mx-4 mt-3 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
        <ul className="flex w-max gap-0.5">
          <li>
            <LetterButton on={letter === null} onClick={() => setLetter(null)} wide>
              All
            </LetterButton>
          </li>
          {LETTERS.map((l) => (
            <li key={l}>
              <LetterButton on={letter === l} onClick={() => setLetter(letter === l ? null : l)}>
                {l}
              </LetterButton>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 flex flex-col gap-4">
        <UnlinkedApps apps={apps.data} />

        <p className="text-small text-ink-3" aria-live="polite">
          {loading ? "Loading…" : count === 0 ? null : count <= PAGE_SIZE ? `${count} ${count === 1 ? "company" : "companies"}` : `${from}–${to} of ${count} companies`}
        </p>

        {error ? (
          <Callout
            tone="danger"
            title="The companies did not load"
            action={
              <Button size="sm" onClick={() => setVersion((v) => v + 1)}>
                Try again
              </Button>
            }
          >
            {error}
          </Callout>
        ) : loading && !rows.length ? (
          <div className={view === "grid" ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-2"}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} aria-hidden className={cx("rounded-md bg-surface shadow-1", view === "grid" ? "h-40" : "h-16")} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={filtered ? "No company matches" : "No companies yet"}
            body={
              filtered
                ? "Try another name, tag or letter."
                : "Companies are added when you add an application, or here by hand."
            }
            action={
              filtered ? (
                <Button
                  onClick={() => {
                    setQuery("");
                    setTagId(null);
                    setLetter(null);
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button variant="primary" icon={Plus} onClick={() => openEditor(null)}>
                  Add company
                </Button>
              )
            }
          />
        ) : view === "grid" ? (
          <div className={cx("grid grid-cols-1 gap-3 transition-opacity duration-[120ms] sm:grid-cols-2 lg:grid-cols-3", loading && "opacity-60")}>
            {rows.map((c) => (
              <CompanyCard key={c.id} company={c} apps={appsByCompany.get(c.id) ?? []} onOpen={open} onEdit={(x) => openEditor(x)} />
            ))}
          </div>
        ) : (
          <ul className={cx("flex flex-col gap-2 transition-opacity duration-[120ms]", loading && "opacity-60")}>
            {rows.map((c) => (
              <CompanyRow key={c.id} company={c} apps={appsByCompany.get(c.id) ?? []} onOpen={open} onEdit={(x) => openEditor(x)} />
            ))}
          </ul>
        )}

        {pages > 1 ? (
          <nav aria-label="Pages" className="mt-2 flex items-center justify-center gap-3">
            <Button icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="iv-num text-small text-ink-2">
              {page} of {pages}
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
    </div>
  );
}

function LetterButton({ on, onClick, wide, children }: { on: boolean; onClick: () => void; wide?: boolean; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "flex h-8 items-center justify-center rounded-sm text-small font-medium transition-colors duration-[120ms] pointer-coarse:h-11",
        wide ? "px-2.5" : "w-8 pointer-coarse:w-10",
        on ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
