"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import TopBar from "@/components/TopBar";
import { useAuth } from "../../../contexts/AuthContext";
import { getCompanies, getCompanyTags, getJobCountsByCompanyNames, getCompanyByName } from "../../../lib/backend/companies";
import { getKeysStatus, KeysStatus } from "../../../lib/keyService";
import { CompanyWithTags, CompanyTag, SortOption } from "../../../lib/types";
import CompanyCard from "./components/CompanyCard";
import CompanyListRow from "./components/CompanyListRow";
import CompanyDetailPanel from "./components/CompanyDetailPanel";
import AddCompanyModal from "./components/AddCompanyModal";
import { PENDING_ACTION_KEY, EVENT_ADD_COMPANY } from "@/components/CommandPalette";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";

export default function CompaniesPage() {
  const { user } = useAuth();
  const ITEMS_PER_PAGE = 15;

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Data State
  const [currentPage, setCurrentPage] = useState(1);
  const [companiesCache, setCompaniesCache] = useState<Record<number, CompanyWithTags[]>>({});
  const [totalCount, setTotalCount] = useState(0);

  const [allTags, setAllTags] = useState<CompanyTag[]>([]);
  const [keysStatus, setKeysStatus] = useState<KeysStatus | null>(null);

  // Loading State
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');
  const [letterFilter, setLetterFilter] = useState<string | null>(null);

  // View
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Job counts
  const [jobCounts, setJobCounts] = useState<Record<string, number>>({});

  // Selected company (detail panel)
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithTags | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyWithTags | null>(null);

  // Debounce Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset Cache on Filter Change
  useEffect(() => {
    setCurrentPage(1);
    setCompaniesCache({});
  }, [debouncedSearchQuery, selectedTagId, sortBy, letterFilter]);

  // Keyboard shortcut: press '/' to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Deep link: /companies?company=<name> opens that company's panel
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const name = params.get("company");
    if (!name) return;
    window.history.replaceState({}, "", window.location.pathname);
    getCompanyByName(name)
      .then((company) => {
        if (company) setSelectedCompany(company);
      })
      .catch((error) => console.error("Error opening company from link:", error));
  }, []);

  // Command palette: open Add Company modal when requested
  useEffect(() => {
    const openAdd = () => {
      sessionStorage.removeItem(PENDING_ACTION_KEY);
      setEditingCompany(null);
      setShowAddModal(true);
    };
    if (sessionStorage.getItem(PENDING_ACTION_KEY) === EVENT_ADD_COMPANY) {
      openAdd();
    }
    window.addEventListener(EVENT_ADD_COMPANY, openAdd);
    return () => window.removeEventListener(EVENT_ADD_COMPANY, openAdd);
  }, []);

  // Initial Data Fetch (Tags & Keys)
  useEffect(() => {
    if (!user) return;
    const initData = async () => {
      try {
        const [tagsData, statusData] = await Promise.all([
          getCompanyTags(),
          getKeysStatus(),
        ]);
        setAllTags(tagsData);
        setKeysStatus(statusData);
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };
    initData();
  }, [user]);

  // Fetch Companies
  const fetchCompanies = useCallback(async () => {
    if (!user) return;

    if (companiesCache[currentPage]) {
      setLoadingCompanies(false);
      return;
    }

    setLoadingCompanies(true);
    try {
      const { data, count } = await getCompanies(
        currentPage,
        ITEMS_PER_PAGE,
        debouncedSearchQuery,
        selectedTagId,
        sortBy,
        letterFilter,
      );

      setCompaniesCache((prev) => ({
        ...prev,
        [currentPage]: data,
      }));
      setTotalCount(count);

      const names = data.map((c) => c.name);
      const counts = await getJobCountsByCompanyNames(names, user.id);
      setJobCounts((prev) => ({ ...prev, ...counts }));
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setLoadingCompanies(false);
    }
  }, [user, currentPage, debouncedSearchQuery, selectedTagId, sortBy, letterFilter, companiesCache]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleAddSuccess = () => {
    setShowAddModal(false);
    setEditingCompany(null);
    setCompaniesCache({});
    setCurrentPage(1);
  };

  const handleEdit = (company: CompanyWithTags) => {
    setEditingCompany(company);
    setShowAddModal(true);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= Math.ceil(totalCount / ITEMS_PER_PAGE)) {
      if (!companiesCache[newPage]) {
        setLoadingCompanies(true);
      }
      setCurrentPage(newPage);
    }
  };

  if (!user) return null;

  const currentCompanies = companiesCache[currentPage] || [];
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const hasCompanies = currentCompanies.length > 0;

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Animated background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] bg-blue-400/22 rounded-full blur-[130px] animate-pulse" />
        <div className="absolute top-[15%] right-[-12%] w-[45%] h-[45%] bg-purple-400/18 rounded-full blur-[130px] animate-pulse delay-1000" />
        <div className="absolute bottom-[-12%] left-[15%] w-[45%] h-[55%] bg-cyan-400/18 rounded-full blur-[130px] animate-pulse delay-2000" />
        <div className="absolute bottom-[25%] right-[8%] w-[35%] h-[35%] bg-indigo-400/14 rounded-full blur-[110px] animate-pulse delay-500" />
      </div>

      <TopBar keysStatus={keysStatus} onKeysSaved={() => getKeysStatus().then(setKeysStatus)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 md:pt-32 pb-12 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-12 gap-4 md:gap-6">
          <div>
            {/* Eyebrow label */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 glass-panel rounded-full mb-4 text-blue-600">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs font-bold tracking-widest uppercase">Company Database</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-none mb-3 md:mb-4">
              Global{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
                Companies
              </span>
            </h1>
            <p className="text-slate-500 text-base sm:text-lg max-w-2xl font-medium leading-relaxed">
              Explore and manage your organisation&apos;s global company database.
            </p>
          </div>

          <button
            onClick={() => {
              setEditingCompany(null);
              setShowAddModal(true);
            }}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-6 py-3 md:px-8 md:py-4 rounded-2xl cursor-pointer shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 md:gap-3 text-sm md:text-base whitespace-nowrap"
          >
            <div className="w-5 h-5 md:w-6 md:h-6 bg-white/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-3 h-3 md:w-4 md:h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            Add Company
          </button>
        </div>

        {/* Filters & Controls Area */}
        <div className="glass-panel rounded-[2rem] p-3 mb-12 sticky top-28 z-40">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
            {/* Search Filter */}
            <div className="flex-1 relative group">
              <div className="absolute inset-y-0 left-0 flex items-center ps-5 pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors duration-200">
                <svg
                  className="w-5 h-5"
                  aria-hidden="true"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full p-4 ps-14 text-base text-slate-800 border-none bg-transparent focus:ring-0 placeholder:text-slate-400 font-semibold"
                placeholder="Search companies... (press / to focus)"
              />
            </div>

            {/* Divider - Desktop only */}
            <div className="hidden lg:block w-px h-10 bg-slate-200/60 mx-2" />

            {/* Tag Filter */}
            <div className="flex items-center min-w-[240px]">
              <Listbox value={selectedTagId} onChange={setSelectedTagId}>
                <div className="relative w-full">
                  <ListboxButton
                    className="cursor-pointer text-sm font-bold text-slate-700
                                        px-6 py-4 w-full rounded-2xl hover:bg-white/50
                                        flex items-center justify-between gap-3
                                        transition-all duration-200"
                  >
                    <span className="truncate">
                      {selectedTagId
                        ? allTags.find((t) => t.id === selectedTagId)?.name
                        : "Filter by Tag"}
                    </span>
                    <svg
                      className="w-4 h-4 text-slate-400 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </ListboxButton>

                  <ListboxOptions className="absolute right-0 z-50 mt-3 w-full bg-white/95 backdrop-blur-xl rounded-2xl py-2 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 max-h-60 overflow-y-auto focus:outline-none shadow-[0_8px_32px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.06)] border border-white/60">
                    <ListboxOption
                      value={null}
                      className={({ active }) =>
                        `cursor-pointer px-6 py-3 flex items-center gap-4 text-sm font-bold transition-all ${active ? "bg-blue-50 text-blue-700" : "text-slate-600"}`
                      }
                    >
                      All Tags
                    </ListboxOption>
                    {allTags.map((tag) => (
                      <ListboxOption
                        key={tag.id}
                        value={tag.id}
                        className={({ active }) =>
                          `cursor-pointer px-6 py-3 flex items-center gap-4 text-sm font-bold transition-all ${active ? "bg-blue-50 text-blue-700" : "text-slate-600"}`
                        }
                      >
                        {tag.name}
                      </ListboxOption>
                    ))}
                  </ListboxOptions>
                </div>
              </Listbox>
            </div>

            {/* Results count badge */}
            {!loadingCompanies && (
              <div className="hidden lg:flex items-center shrink-0 px-4 py-2 glass-deep rounded-xl">
                <span className="text-xs font-bold text-slate-500 tabular-nums">
                  {totalCount} {totalCount === 1 ? "result" : "results"}
                </span>
              </div>
            )}

            {/* Sort dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="hidden lg:block text-xs font-bold text-slate-600 bg-transparent border-none focus:ring-0 cursor-pointer pr-1 py-2"
            >
              <option value="name_asc">A → Z</option>
              <option value="name_desc">Z → A</option>
              <option value="recent">Recent</option>
              <option value="shuffle">Shuffled</option>
            </select>

            {/* View toggle */}
            <div className="hidden lg:flex items-center gap-1 glass-deep rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                title="Grid view"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                title="List view"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* A–Z letter rail */}
        <div className="flex items-center gap-1 mb-8 -mt-6 overflow-x-auto pb-1 px-1">
          <button
            onClick={() => setLetterFilter(null)}
            className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer
              ${letterFilter === null
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-700 hover:bg-white/60'}`}
          >
            ALL
          </button>
          {Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map((letter) => (
            <button
              key={letter}
              onClick={() => setLetterFilter(letterFilter === letter ? null : letter)}
              className={`shrink-0 w-7 h-7 rounded-lg text-[11px] font-black transition-all cursor-pointer
                ${letterFilter === letter
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'text-slate-400 hover:text-blue-600 hover:bg-white/60'}`}
            >
              {letter}
            </button>
          ))}
        </div>

        {/* Companies Grid / List */}
        {loadingCompanies ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-64 glass-card rounded-[2rem] animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        ) : hasCompanies ? (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                {currentCompanies.map((company) => (
                  <CompanyCard
                    key={company.id}
                    company={company}
                    onEdit={handleEdit}
                    jobCount={jobCounts[company.name] ?? 0}
                    onClick={setSelectedCompany}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-8 duration-700">
                {currentCompanies.map((company) => (
                  <CompanyListRow
                    key={company.id}
                    company={company}
                    onEdit={handleEdit}
                    jobCount={jobCounts[company.name] ?? 0}
                    onClick={setSelectedCompany}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-12 flex justify-center items-center gap-3">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-5 py-3 rounded-2xl glass-panel font-bold cursor-pointer text-slate-700 hover:bg-white/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                  </svg>
                  Prev
                </button>

                <div className="flex items-center gap-2 px-5 py-3 glass-deep rounded-2xl">
                  <span className="text-slate-700 font-bold text-sm tabular-nums">
                    {currentPage} / {totalPages || 1}
                  </span>
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="px-5 py-3 rounded-2xl glass-panel font-bold cursor-pointer text-slate-700 hover:bg-white/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 text-sm"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-24">
            <div className="w-20 h-20 glass-deep rounded-3xl flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-9 h-9 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-extrabold text-slate-800 mb-2">
              No companies found
            </h3>
            <p className="text-slate-500 text-base mb-6">
              Try adjusting your filters or add a new company.
            </p>
            <button
              onClick={() => {
                setEditingCompany(null);
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-6 py-3 rounded-2xl cursor-pointer shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 transition-all duration-300 hover:-translate-y-0.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
              </svg>
              Add your first company
            </button>
          </div>
        )}
      </main>

      {showAddModal && (
        <AddCompanyModal
          onClose={() => {
            setShowAddModal(false);
            setEditingCompany(null);
          }}
          onSuccess={handleAddSuccess}
          initialData={editingCompany}
        />
      )}

      <CompanyDetailPanel
        company={selectedCompany}
        onClose={() => setSelectedCompany(null)}
        userId={user.id}
        onEdit={(company) => {
          setSelectedCompany(null);
          handleEdit(company);
        }}
        tavilyConfigured={Boolean(keysStatus?.tavily)}
      />
    </div>
  );
}
