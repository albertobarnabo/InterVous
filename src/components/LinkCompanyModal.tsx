"use client";

import { useEffect, useState } from "react";
import { JobEntry, CompanyWithTags } from "../../lib/types";
import { getCompanies, createCompany } from "../../lib/backend/companies";
import { updateJob } from "../../lib/jobService";

interface LinkCompanyModalProps {
  job: JobEntry;
  userId: string;
  onClose: () => void;
  onLinked: () => void;
}

export default function LinkCompanyModal({ job, userId, onClose, onLinked }: LinkCompanyModalProps) {
  const [query, setQuery] = useState(job.company_name);
  const [results, setResults] = useState<CompanyWithTags[]>([]);
  const [searching, setSearching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await getCompanies(1, 6, query.trim());
        if (!cancelled) setResults(data);
      } catch (err) {
        console.error("Company search failed", err);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const linkToExisting = async (company: CompanyWithTags) => {
    setSaving(true);
    setError("");
    try {
      // Canonicalize the job's company name so it matches the company record
      await updateJob({ ...job, company_name: company.name }, userId);
      onLinked();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  const createAndLink = async () => {
    const name = query.trim() || job.company_name;
    setSaving(true);
    setError("");
    try {
      await createCompany({ name, website: null, logo_url: null }, [], userId);
      if (name !== job.company_name) {
        await updateJob({ ...job, company_name: name }, userId);
      }
      onLinked();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  const exactMatch = results.some(
    (c) => c.name.toLowerCase() === query.trim().toLowerCase()
  );

  return (
    <div className="fixed inset-0 z-[250] overflow-y-auto bg-slate-900/30 backdrop-blur-md animate-in fade-in duration-200">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-lg glass-panel !bg-white/95 rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
          {/* Header */}
          <div className="px-7 pt-7 pb-5 border-b border-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Link to a company</h2>
                <p className="text-sm text-slate-500 font-medium mt-1 truncate">
                  Application: <span className="font-bold text-slate-700">{job.company_name}</span> · {job.role}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-3 leading-relaxed">
              Linking renames this application&apos;s company to match the company record, so counts
              and the company panel stay in sync.
            </p>
          </div>

          {/* Search */}
          <div className="px-7 py-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 pointer-events-none">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                placeholder="Search companies..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Results */}
          <div className="px-4 pb-2 max-h-[260px] overflow-y-auto">
            {searching ? (
              <div className="space-y-2 px-3 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : results.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm font-medium text-slate-400">
                No matching companies
              </p>
            ) : (
              results.map((company) => (
                <button
                  key={company.id}
                  onClick={() => linkToExisting(company)}
                  disabled={saving}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-50 transition-colors cursor-pointer text-left disabled:opacity-50 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    {company.logo_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={company.logo_url} alt="" className="w-full h-full object-contain p-1" />
                    ) : (
                      <span className="text-xs font-bold text-slate-500">
                        {company.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-700">
                      {company.name}
                    </p>
                    {company.tags.length > 0 && (
                      <p className="text-[11px] text-slate-400 font-medium truncate">
                        {company.tags.map((t) => t.name).join(" · ")}
                      </p>
                    )}
                  </div>
                  {company.name.toLowerCase() === job.company_name.toLowerCase() && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5 shrink-0">
                      Name match
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Create new */}
          {!exactMatch && query.trim() && (
            <div className="px-7 pb-3">
              <button
                onClick={createAndLink}
                disabled={saving}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-dashed border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm font-bold truncate">
                  Create company &quot;{query.trim()}&quot; and link
                </span>
              </button>
            </div>
          )}

          {error && (
            <p className="px-7 pb-3 text-xs font-bold text-rose-600">{error}</p>
          )}

          <div className="px-7 py-4 bg-slate-50/60 border-t border-slate-100 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-black text-slate-500 hover:bg-slate-100 uppercase tracking-widest transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
