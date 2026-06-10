"use client";

import { JobEntry } from "../../lib/types";

interface JobDetailPanelProps {
  job: JobEntry | null;
  onClose: () => void;
  onEdit: (job: JobEntry) => void;
  companyLinked?: boolean;
  companyLogo?: string | null;
  onViewCompany?: (job: JobEntry) => void;
  onLinkCompany?: (job: JobEntry) => void;
}

const STAGE_COLORS: Record<string, string> = {
  Screening: "#60A5FA",
  "Coding Assessment": "#818CF8",
  "Video Interview": "#A78BFA",
  "HR Interview": "#34D399",
  "Technical Interview": "#FBBF24",
  "Final Round": "#F472B6",
};

function statusClasses(status: string): string {
  switch (status?.toLowerCase()) {
    case "active":
      return "bg-emerald-100 text-emerald-700";
    case "not applied":
      return "bg-amber-100 text-amber-700";
    case "inactive":
    case "rejected":
    case "closed":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Not applied yet";
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function JobDetailPanel({
  job,
  onClose,
  onEdit,
  companyLinked,
  companyLogo,
  onViewCompany,
  onLinkCompany,
}: JobDetailPanelProps) {
  const isOpen = job !== null;
  const stageColor = job?.stage ? STAGE_COLORS[job.stage] || "#94A3B8" : "#94A3B8";

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[200] transition-opacity duration-400 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md z-[201] flex flex-col
          backdrop-blur-[28px] bg-white/92 border-l border-white/72 shadow-[-8px_0_40px_rgba(0,0,0,0.08)]
          transition-transform duration-400 ease-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 backdrop-blur-[28px] bg-white/80 border-b border-white/72 flex items-center justify-between px-5 py-4 gap-3">
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 transition-colors flex-shrink-0 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="flex-1 text-base font-extrabold text-slate-800 text-right truncate">
            Application
          </h2>
          {job && (
            <button
              onClick={() => onEdit(job)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
              title="Edit application"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
          {/* Title block */}
          <div className="space-y-2">
            <h3 className="text-2xl font-extrabold text-slate-900 leading-tight">
              {job?.role || "—"}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {companyLogo && (
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-100 shadow-sm p-1 flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={companyLogo} alt="" className="w-full h-full object-contain" />
                </div>
              )}
              <span className="text-base font-bold text-slate-600">{job?.company_name}</span>
              {companyLinked && job ? (
                <button
                  onClick={() => onViewCompany?.(job)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1" />
                  </svg>
                  View company
                </button>
              ) : job ? (
                <button
                  onClick={() => onLinkCompany?.(job)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-400 bg-slate-50 border border-dashed border-slate-300 hover:text-blue-600 hover:border-blue-300 transition-colors cursor-pointer"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Link company
                </button>
              ) : null}
            </div>
          </div>

          {/* Status + stage */}
          <div className="flex items-center gap-2 flex-wrap">
            {job?.status && (
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize ${statusClasses(job.status)}`}>
                {job.status}
              </span>
            )}
            {job?.stage && job.stage !== "-" && (
              <span
                className="px-3 py-1.5 rounded-full text-xs font-bold border"
                style={{
                  color: stageColor,
                  borderColor: `${stageColor}50`,
                  background: `${stageColor}15`,
                }}
              >
                {job.stage}
              </span>
            )}
          </div>

          {/* Facts */}
          <div className="space-y-2">
            <div className="rounded-xl bg-white/60 border border-white/60 px-4 py-3 flex items-center gap-3">
              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</p>
                <p className="text-sm font-semibold text-slate-700">{job?.location || "—"}</p>
              </div>
            </div>
            <div className="rounded-xl bg-white/60 border border-white/60 px-4 py-3 flex items-center gap-3">
              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Applied on</p>
                <p className="text-sm font-semibold text-slate-700">{formatDate(job?.application_date ?? null)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/50 bg-white/60 backdrop-blur-sm flex gap-2">
          {job?.url ? (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-md shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open posting
            </a>
          ) : (
            <p className="flex-1 py-3 text-center text-xs font-semibold text-slate-400">
              No posting URL saved
            </p>
          )}
        </div>
      </div>
    </>
  );
}
