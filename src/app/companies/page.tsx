"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/TopBar";
import { useAuth } from "../../../contexts/AuthContext";
import { getCompanies, getCompanyTags } from "../../../lib/backend/companies";
import { getKeysByUser } from "../../../lib/keyService";
import { CompanyWithTags, CompanyTag, ApiKeys } from "../../../lib/types";
import CompanyCard from "./components/CompanyCard";
import AddCompanyModal from "./components/AddCompanyModal";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";

export default function CompaniesPage() {
  const { user } = useAuth();
  const ITEMS_PER_PAGE = 15;

  // Data State
  const [currentPage, setCurrentPage] = useState(1);
  const [companiesCache, setCompaniesCache] = useState<
    Record<number, CompanyWithTags[]>
  >({});
  const [totalCount, setTotalCount] = useState(0);

  const [allTags, setAllTags] = useState<CompanyTag[]>([]);
  const [keys, setKeys] = useState<ApiKeys | null>(null);

  // Loading State
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyWithTags | null>(
    null,
  );

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
    // Don't reset totalCount here to avoid UI jump, it will update on fetch
  }, [debouncedSearchQuery, selectedTagId]);

  // Initial Data Fetch (Tags & Keys)
  useEffect(() => {
    if (!user) return;
    const initData = async () => {
      try {
        const [tagsData, keysData] = await Promise.all([
          getCompanyTags(),
          getKeysByUser(user.id),
        ]);
        setAllTags(tagsData);
        setKeys(keysData || null);
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };
    initData();
  }, [user]);

  // Fetch Companies
  const fetchCompanies = useCallback(async () => {
    if (!user) return;

    // Check if we have valid cache for this page
    // Note: we only check cache if we believe it's valid for the current filters.
    // The cache clearing effect runs before this effect usually, or we depend on cache state?
    // Actually, if we just cleared cache, companiesCache[currentPage] will be undefined.
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
      );

      setCompaniesCache((prev) => ({
        ...prev,
        [currentPage]: data,
      }));
      setTotalCount(count);
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setLoadingCompanies(false);
    }
  }, [user, currentPage, debouncedSearchQuery, selectedTagId, companiesCache]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleAddSuccess = () => {
    setShowAddModal(false);
    setEditingCompany(null);
    // Clear cache and refetch page 1 to show new data
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
      {/* Liquid Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-400/20 rounded-full blur-[120px] mix-blend-multiply animate-pulse" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-purple-400/20 rounded-full blur-[120px] mix-blend-multiply animate-pulse delay-1000" />
        <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[60%] bg-cyan-400/20 rounded-full blur-[120px] mix-blend-multiply animate-pulse delay-2000" />
      </div>

      <TopBar keys={keys} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-12 gap-4 md:gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-none mb-3 md:mb-4">
              Global{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
                Companies
              </span>
            </h1>
            <p className="text-slate-600 text-base sm:text-lg md:text-xl max-w-2xl font-medium leading-relaxed">
              Explore and manage your organization&apos;s global database with
              style and precision.
            </p>
          </div>

          <button
            onClick={() => {
              setEditingCompany(null);
              setShowAddModal(true);
            }}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3 md:px-8 md:py-4 rounded-2xl cursor-pointer shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 md:gap-3 ring-1 ring-white/20 text-sm md:text-base whitespace-nowrap"
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
        <div className="glass-panel rounded-[2rem] p-3 mb-12 sticky top-24 z-40">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
            {/* Search Filter */}
            <div className="flex-1 relative group">
              <div className="absolute inset-y-0 left-0 flex items-center ps-5 pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
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
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full p-4 ps-14 text-base text-slate-800 border-none bg-transparent focus:ring-0 placeholder:text-slate-400 font-bold"
                placeholder="Search companies..."
              />
            </div>

            {/* Divider - Desktop only */}
            <div className="hidden lg:block w-px h-10 bg-slate-200/50 mx-2" />

            {/* Tag Filter */}
            <div className="flex items-center min-w-[240px]">
              <Listbox value={selectedTagId} onChange={setSelectedTagId}>
                <div className="relative w-full">
                  <ListboxButton
                    className="cursor-pointer text-sm font-bold text-slate-700 
                                        px-6 py-4 w-full rounded-2xl hover:bg-slate-50/50
                                        flex items-center justify-between gap-3
                                        transition-all duration-200"
                  >
                    <span className="truncate">
                      {selectedTagId
                        ? allTags.find((t) => t.id === selectedTagId)?.name
                        : "Filter by Tag"}
                    </span>
                    <svg
                      className="w-5 h-5 text-slate-400"
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

                  <ListboxOptions className="absolute right-0 z-50 mt-3 w-full bg-white/95 backdrop-blur-xl rounded-2xl py-2 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 max-h-60 overflow-y-auto focus:outline-none">
                    <ListboxOption
                      value={null}
                      className={({ active }) =>
                        `cursor-pointer px-6 py-3 flex items-center gap-4 text-sm font-bold transition-all ${active ? "bg-blue-50/50 text-blue-700" : "text-slate-600"}`
                      }
                    >
                      All Tags
                    </ListboxOption>
                    {allTags.map((tag) => (
                      <ListboxOption
                        key={tag.id}
                        value={tag.id}
                        className={({ active }) =>
                          `cursor-pointer px-6 py-3 flex items-center gap-4 text-sm font-bold transition-all ${active ? "bg-blue-50/50 text-blue-700" : "text-slate-600"}`
                        }
                      >
                        {tag.name}
                      </ListboxOption>
                    ))}
                  </ListboxOptions>
                </div>
              </Listbox>
            </div>
          </div>
        </div>

        {/* Companies Grid */}
        {loadingCompanies ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 glass-card rounded-[2.5rem]"></div>
            ))}
          </div>
        ) : hasCompanies ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
              {currentCompanies.map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  onEdit={handleEdit}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="mt-12 flex justify-center items-center gap-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-6 py-3 rounded-2xl glass-panel font-bold cursor-pointer text-slate-700 hover:bg-white/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>

              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-bold">
                  Page {currentPage} of {totalPages || 1}
                </span>
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="px-6 py-3 rounded-2xl glass-panel font-bold cursor-pointer text-slate-700 hover:bg-white/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 glass-panel rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
              <svg
                className="w-10 h-10"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-black text-slate-800">
              No companies found
            </h3>
            <p className="text-slate-500 mt-2 text-lg">
              Try adjusting your filters or add a new company.
            </p>
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
    </div>
  );
}
