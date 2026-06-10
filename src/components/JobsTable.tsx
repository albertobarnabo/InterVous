"use client";

import { useState, useMemo } from "react";
import { JobEntry } from "../../lib/types";

interface JobsTableProps {
  jobs: JobEntry[];
  onEditJob: (job: JobEntry) => void;
  onRowClick?: (job: JobEntry) => void;
  companyLogos?: Record<string, string | null>;
  linkedCompanyNames?: Set<string>;
  onLinkCompany?: (job: JobEntry) => void;
  onViewCompany?: (job: JobEntry) => void;
}

const ITEMS_PER_PAGE = 8;

type SortField = "company_name" | "location" | "application_date" | "status";

const STAGE_COLORS: Record<string, string> = {
  Screening: "#60A5FA",
  "Coding Assessment": "#818CF8",
  "Video Interview": "#A78BFA",
  "HR Interview": "#34D399",
  "Technical Interview": "#FBBF24",
  "Final Round": "#F472B6",
};

/* Same FNV-1a identity gradient used by the company cards */
function tileGradient(name: string): React.CSSProperties {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const h1 = hash % 360;
  const h2 = (h1 + 40 + (hash % 80)) % 360;
  return {
    backgroundImage: `linear-gradient(135deg, hsl(${h1} 75% 82%), hsl(${h2} 70% 72%))`,
  };
}

function CompanyTile({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  if (logoUrl) {
    return (
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white border border-slate-100 shadow-sm p-1.5 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={`${name} logo`} className="w-full h-full object-contain" />
      </div>
    );
  }
  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
      style={tileGradient(name)}
    >
      <span className="text-[13px] font-extrabold text-white drop-shadow-sm">
        {name.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
}

function statusChip(status: string): string {
  switch (status?.toLowerCase()) {
    case "active":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "not applied":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "inactive":
    case "rejected":
    case "closed":
      return "bg-rose-50 text-rose-600 border-rose-100";
    default:
      return "bg-slate-50 text-slate-500 border-slate-200";
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SortIcon({ state }: { state: "none" | "asc" | "desc" }) {
  if (state === "none") {
    return (
      <svg className="w-3 h-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
      </svg>
    );
  }
  return (
    <svg
      className={`w-3 h-3 text-blue-600 transition-transform duration-200 ${state === "desc" ? "rotate-180" : ""}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

export default function JobsTable({
  jobs,
  onEditJob,
  onRowClick,
  companyLogos,
  linkedCompanyNames,
  onLinkCompany,
  onViewCompany,
}: JobsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const sortedJobs = useMemo(() => {
    if (!sortField) return jobs;
    return [...jobs].sort((a, b) => {
      const valA = (a[sortField] || "").toString().toLowerCase();
      const valB = (b[sortField] || "").toString().toLowerCase();
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [jobs, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedJobs.length / ITEMS_PER_PAGE);
  const safePage = Math.min(currentPage, Math.max(totalPages, 1));
  const currentJobs = sortedJobs.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );
  const rangeStart = sortedJobs.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1;
  const rangeEnd = Math.min(safePage * ITEMS_PER_PAGE, sortedJobs.length);

  const sortState = (field: SortField): "none" | "asc" | "desc" =>
    sortField !== field ? "none" : sortDirection;

  const companyActions = (job: JobEntry, alwaysVisible = false) => {
    if (!linkedCompanyNames) return null;
    const isLinked = linkedCompanyNames.has(job.company_name);
    const visibility = alwaysVisible ? "" : "opacity-0 group-hover:opacity-100";
    return isLinked ? (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onViewCompany?.(job);
        }}
        className={`p-2 rounded-xl text-blue-500 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all duration-200 cursor-pointer ${visibility}`}
        title={`View ${job.company_name} in Companies`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1" />
        </svg>
      </button>
    ) : (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onLinkCompany?.(job);
        }}
        className={`p-2 rounded-xl text-slate-300 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all duration-200 cursor-pointer ${visibility}`}
        title="Link to a company"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </button>
    );
  };

  const emptyState = (
    <div className="flex flex-col items-center gap-5 py-24 px-8 text-center">
      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-100">
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <div className="space-y-1">
        <p className="text-slate-800 font-extrabold text-lg tracking-tight">Your hunt starts here</p>
        <p className="text-slate-400 text-sm font-medium max-w-xs mx-auto">
          Click &quot;Add Application&quot; above to start tracking your professional journey.
        </p>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-slate-200/60">
              <th
                className="px-8 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 transition-colors select-none"
                onClick={() => handleSort("company_name")}
              >
                <div className="flex items-center gap-1.5">Company & Role <SortIcon state={sortState("company_name")} /></div>
              </th>
              <th
                className="px-5 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 transition-colors select-none"
                onClick={() => handleSort("location")}
              >
                <div className="flex items-center gap-1.5">Location <SortIcon state={sortState("location")} /></div>
              </th>
              <th
                className="px-5 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 transition-colors select-none whitespace-nowrap"
                onClick={() => handleSort("application_date")}
              >
                <div className="flex items-center gap-1.5">Applied <SortIcon state={sortState("application_date")} /></div>
              </th>
              <th
                className="px-5 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 transition-colors select-none"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center gap-1.5">Status <SortIcon state={sortState("status")} /></div>
              </th>
              <th className="px-5 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Stage</th>
              <th className="px-8 py-4" />
            </tr>
          </thead>
          <tbody>
            {sortedJobs.length === 0 ? (
              <tr>
                <td colSpan={6}>{emptyState}</td>
              </tr>
            ) : (
              currentJobs.map((job) => {
                const stageColor = STAGE_COLORS[job.stage] || "#94A3B8";
                return (
                  <tr
                    key={job.id}
                    onClick={() => onRowClick ? onRowClick(job) : job.url && window.open(job.url, "_blank")}
                    className="group border-b border-slate-100/70 last:border-b-0 hover:bg-white/70 transition-colors duration-200 cursor-pointer"
                  >
                    {/* Company & Role */}
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3.5">
                        <CompanyTile name={job.company_name} logoUrl={companyLogos?.[job.company_name]} />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 leading-tight truncate group-hover:text-blue-700 transition-colors">
                            {job.company_name}
                          </p>
                          <p className="text-xs text-slate-400 font-medium truncate mt-0.5">{job.role}</p>
                        </div>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="px-5 py-4">
                      <span className="text-[13px] font-semibold text-slate-500 truncate block max-w-[180px]">
                        {job.location || "—"}
                      </span>
                    </td>

                    {/* Applied on */}
                    <td className="px-5 py-4">
                      <span className="text-[13px] font-semibold text-slate-500 tabular-nums whitespace-nowrap">
                        {formatDate(job.application_date)}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${statusChip(job.status)}`}>
                        {job.status}
                      </span>
                    </td>

                    {/* Stage */}
                    <td className="px-5 py-4">
                      {job.stage && job.stage !== "-" ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap"
                          style={{
                            color: stageColor,
                            borderColor: `${stageColor}40`,
                            background: `${stageColor}14`,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: stageColor }} />
                          {job.stage}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs font-semibold">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-8 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {companyActions(job)}
                        <button
                          onClick={() => onEditJob(job)}
                          className="p-2 rounded-xl text-slate-300 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all duration-200 cursor-pointer opacity-0 group-hover:opacity-100"
                          title="Edit application"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden p-3 space-y-2.5">
        {sortedJobs.length === 0 ? (
          emptyState
        ) : (
          currentJobs.map((job) => {
            const stageColor = STAGE_COLORS[job.stage] || "#94A3B8";
            return (
              <div
                key={job.id}
                onClick={() => onRowClick ? onRowClick(job) : job.url && window.open(job.url, "_blank")}
                className="bg-white/70 rounded-2xl p-4 border border-white/80 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <CompanyTile name={job.company_name} logoUrl={companyLogos?.[job.company_name]} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 leading-tight truncate">{job.company_name}</p>
                    <p className="text-xs text-slate-400 font-medium truncate mt-0.5">{job.role}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${statusChip(job.status)}`}>
                    {job.status}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    {job.stage && job.stage !== "-" && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap"
                        style={{
                          color: stageColor,
                          borderColor: `${stageColor}40`,
                          background: `${stageColor}14`,
                        }}
                      >
                        {job.stage}
                      </span>
                    )}
                    <span className="text-[11px] font-semibold text-slate-400 tabular-nums truncate">
                      {formatDate(job.application_date)}
                    </span>
                  </div>
                  <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                    {companyActions(job, true)}
                    <button
                      onClick={() => onEditJob(job)}
                      className="p-2 rounded-xl text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
                      title="Edit application"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {sortedJobs.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between px-6 md:px-8 py-4 border-t border-slate-200/60">
          <p className="text-xs font-semibold text-slate-400 tabular-nums">
            {rangeStart}–{rangeEnd} of {sortedJobs.length}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              disabled={safePage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/70 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-8 h-8 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer tabular-nums ${
                  safePage === i + 1
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                    : "text-slate-400 hover:text-slate-700 hover:bg-white/70"
                }`}
              >
                {i + 1}
              </button>
            ))}

            <button
              disabled={safePage === totalPages}
              onClick={() => setCurrentPage((prev) => prev + 1)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/70 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
