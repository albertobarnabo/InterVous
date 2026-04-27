"use client";

import { useState, useMemo } from "react";
import { JobEntry } from "../../lib/types";
import tableBackground from "../../public/table_background.png";

interface JobsTableProps {
  jobs: JobEntry[];
  onEditJob: (job: JobEntry) => void;
}

const ITEMS_PER_PAGE = 8;

export default function JobsTable({ jobs, onEditJob }: JobsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<
    "status" | "application_date" | "location" | null
  >(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (field: "status" | "application_date" | "location") => {
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
      const valA = a[sortField] || "";
      const valB = b[sortField] || "";
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [jobs, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedJobs.length / ITEMS_PER_PAGE);
  const currentJobs = sortedJobs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const renderSortSymbol = (field: string) => {
    if (sortField !== field) return "⇅";
    return sortDirection === "asc" ? "▲" : "▼";
  };

  const getStatusStyle = (status: string) => {
    const normalizedStatus = status?.toLowerCase();
    if (normalizedStatus === "active") {
      return "bg-emerald-500 text-white border-emerald-400 shadow-[0_5px_15px_rgba(16,185,129,0.3)]";
    }
    if (
      normalizedStatus === "inactive" ||
      normalizedStatus === "rejected" ||
      normalizedStatus === "closed"
    ) {
      return "bg-rose-500 text-white border-rose-400 shadow-[0_5px_15px_rgba(244,63,94,0.3)]";
    }
    return "bg-slate-500 text-white border-slate-400 shadow-[0_5px_15px_rgba(100,116,139,0.3)]";
  };

  return (
    <div className="relative overflow-hidden rounded-[2rem]">
      {/* Nature background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${tableBackground.src})`,
        }}
      />

      {/* Overlay for better contrast */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/10"></div>

      {/* Padding container */}
      <div className="relative p-6">
        {/* Main glass container */}
        <div className="backdrop-blur-2xl bg-white/30 rounded-[1.5rem] border border-white/40 shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto overflow-y-visible">
            <table className="w-full text-sm text-left text-slate-600 table-auto border-separate border-spacing-0">
              <thead className="text-xs font-black text-slate-800 uppercase tracking-widest bg-white/40 backdrop-blur-xl sticky top-0 z-10 border-b border-white/30 shadow-sm">
                <tr>
                  <th className="px-10 py-6 border-b border-white/20">
                    Company & Role
                  </th>
                  <th
                    className="px-6 py-6 border-b border-white/20 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => handleSort("location")}
                  >
                    <div className="flex items-center gap-2">
                      Location {renderSortSymbol("location")}
                    </div>
                  </th>
                  <th
                    className="px-6 py-6 border-b border-white/20 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => handleSort("application_date")}
                  >
                    <div className="flex items-center gap-2 text-nowrap">
                      Applied On {renderSortSymbol("application_date")}
                    </div>
                  </th>
                  <th
                    className="px-6 py-6 border-b border-white/20 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-2">
                      Status {renderSortSymbol("status")}
                    </div>
                  </th>
                  <th className="px-6 py-6 border-b border-white/20">Stage</th>
                  <th className="px-10 py-6 border-b border-white/20 text-right font-black">
                    Manage
                  </th>
                </tr>
              </thead>
              <tbody className="bg-transparent">
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-32 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-24 h-24 backdrop-blur-md bg-white/60 rounded-[2rem] flex items-center justify-center text-blue-400 shadow-lg border border-white/50">
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
                              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                            />
                          </svg>
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-900 font-black text-xl tracking-tight drop-shadow-sm">
                            Your hunt starts here.
                          </p>
                          <p className="text-slate-700 font-medium max-w-xs mx-auto drop-shadow-sm">
                            Click &quot;Add Application&quot; above to start
                            tracking your professional journey.
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentJobs.map((job) => (
                    <tr
                      key={job.id}
                      className="group hover:bg-white/50 hover:backdrop-blur-xl transition-all duration-300 cursor-pointer relative border-b border-white/10 last:border-b-0"
                      onClick={() => window.open(job.url, "_blank")}
                    >
                      <td className="px-10 py-7 relative">
                        {/* Row accent color */}
                        <div
                          className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/5 rounded-r-full transition-all duration-300 opacity-30 group-hover:opacity-100 ${job.status === "Active" ? "bg-emerald-500 scale-y-125" : job.status === "Inactive" ? "bg-rose-500" : "bg-slate-400"}`}
                        />

                        <div className="flex flex-col">
                          <span className="text-lg font-black text-slate-900 group-hover:text-blue-700 transition-colors tracking-tight drop-shadow-sm">
                            {job.company_name}
                          </span>
                          <span className="text-sm text-slate-700 mt-1 flex items-center gap-2 drop-shadow-sm">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            {job.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-7">
                        <div className="flex items-center gap-2 text-slate-900 drop-shadow-sm text-lg">
                          <svg
                            className="w-6 h-6 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          {job.location}
                        </div>
                      </td>
                      <td className="px-6 py-7">
                        <div className="flex items-center gap-2 text-slate-900 text-[13px] uppercase tracking-wider drop-shadow-sm">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          {job.application_date ?? "-"}
                        </div>
                      </td>
                      <td className="px-6 py-7">
                        <span
                          className={`px-4 py-1.5 rounded-[10px] text-[10px] font-black uppercase tracking-[0.15em] border transition-all duration-300 whitespace-nowrap ${getStatusStyle(job.status)}`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="px-6 py-7">
                        <div className="flex items-center gap-2.5">
                          <div className="px-3 py-1 backdrop-blur-md bg-blue-500/20 text-blue-900 rounded-lg text-xs font-black tracking-tight border border-blue-400/30">
                            {job.stage}
                          </div>
                        </div>
                      </td>
                      <td
                        className="px-10 py-7 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => onEditJob(job)}
                          className="p-3 text-slate-500 hover:text-blue-600 backdrop-blur-md hover:bg-white/70 rounded-2xl transition-all duration-300 group/btn border border-white/40"
                        >
                          <svg
                            className="w-5 h-5 group-hover/btn:scale-110 transition-transform"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3 p-3">
            {jobs.length === 0 ? (
              <div className="backdrop-blur-xl bg-white/50 rounded-2xl p-8 text-center border border-white/50 shadow-sm">
                <p className="text-slate-700 font-black italic tracking-tight drop-shadow-sm text-sm">
                  No adventures found yet.
                </p>
              </div>
            ) : (
              currentJobs.map((job) => (
                <div
                  key={job.id}
                  className={`backdrop-blur-xl bg-white/60 rounded-2xl p-4 border border-white/50 shadow-xl active:scale-[0.97] transition-all relative overflow-hidden`}
                  onClick={() => window.open(job.url, "_blank")}
                >
                  {/* Card accent bar */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 ${job.status?.toLowerCase() === "active" ? "bg-emerald-500" : job.status?.toLowerCase() === "inactive" || job.status?.toLowerCase() === "rejected" || job.status?.toLowerCase() === "closed" ? "bg-rose-500" : "bg-slate-300"}`}
                  />

                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight drop-shadow-sm truncate">
                        {job.company_name}
                      </h3>
                      <p className="text-[10px] font-black text-slate-700 uppercase tracking-wider mt-1.5 backdrop-blur-md bg-white/60 inline-block px-2 py-0.5 rounded-full border border-white/50">
                        {job.role}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border self-start whitespace-nowrap flex-shrink-0 ${getStatusStyle(job.status)}`}
                    >
                      {job.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 py-3 border-y border-white/30 my-3">
                    <div>
                      <p className="text-[8px] font-black text-slate-600 uppercase tracking-wider mb-1 drop-shadow-sm">
                        Location
                      </p>
                      <p className="text-xs font-bold text-slate-900 flex items-center gap-1 drop-shadow-sm truncate">
                        <div className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                        <span className="truncate">{job.location}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-600 uppercase tracking-wider mb-1 drop-shadow-sm">
                        Applied On
                      </p>
                      <p className="text-xs font-bold text-slate-900 drop-shadow-sm">
                        {job.application_date ?? "-"}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1 gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-[8px] font-black text-slate-600 uppercase tracking-wider drop-shadow-sm flex-shrink-0">
                        Stage
                      </span>
                      <span className="text-xs font-black text-blue-900 backdrop-blur-md bg-blue-400/30 px-2.5 py-1 rounded-lg border border-blue-500/30 truncate">
                        {job.stage}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditJob(job);
                      }}
                      className="px-4 py-2 backdrop-blur-md bg-slate-900/80 text-white font-black text-[9px] uppercase tracking-wider rounded-xl hover:bg-slate-900 transition-colors shadow-lg border border-white/20 flex-shrink-0"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination Controls */}
          {sortedJobs.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between px-10 py-8 border-t border-white/30 bg-white/20 backdrop-blur-xl">
              <p className="hidden sm:block text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] drop-shadow-sm">
                Voyage {currentPage} of {totalPages}
              </p>
              <div className="flex gap-3 w-full sm:w-auto justify-center">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => prev - 1)}
                  className={`p-3 rounded-2xl border transition-all duration-300 ${currentPage === 1 ? "border-white/20 text-slate-300" : "border-white/50 backdrop-blur-md bg-white/60 text-slate-700 hover:bg-white/80 hover:text-blue-600 shadow-sm"}`}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                <div className="flex items-center gap-1.5">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-11 h-11 rounded-2xl font-black text-xs transition-all duration-300 ${currentPage === i + 1 ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-[0_10px_20px_rgba(37,99,235,0.3)] scale-110" : "text-slate-700 backdrop-blur-md bg-white/40 hover:bg-white/70 border border-white/40"}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                  className={`p-3 rounded-2xl border transition-all duration-300 ${currentPage === totalPages ? "border-white/20 text-slate-300" : "border-white/50 backdrop-blur-md bg-white/60 text-slate-700 hover:bg-white/80 hover:text-blue-600 shadow-sm"}`}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
