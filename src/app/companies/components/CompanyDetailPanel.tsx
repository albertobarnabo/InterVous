"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../../../lib/supbaseClient";
import { JobEntry, CompanyWithTags } from "../../../../lib/types";
import { PENDING_ACTION_KEY, EVENT_ADD_APPLICATION } from "@/components/CommandPalette";

interface CompanyDetailPanelProps {
  company: CompanyWithTags | null;
  onClose: () => void;
  userId: string;
  onEdit?: (company: CompanyWithTags) => void;
}

const STAGE_COLORS: Record<string, string> = {
  Screening: "#60A5FA",
  "Coding Assessment": "#818CF8",
  "Video Interview": "#A78BFA",
  "HR Interview": "#34D399",
  "Technical Interview": "#FBBF24",
  "Final Round": "#F472B6",
};
const FALLBACK_COLOR = "#94A3B8";

function getStatusClasses(status: string): string {
  switch (status?.toLowerCase()) {
    case "active":
      return "bg-emerald-100 text-emerald-700";
    case "applied":
      return "bg-blue-100 text-blue-700";
    case "interview":
      return "bg-amber-100 text-amber-700";
    case "offer":
    case "accepted":
      return "bg-green-100 text-green-700";
    case "inactive":
    case "rejected":
    case "closed":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function CompanyInitials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 text-white font-bold text-2xl shadow-md flex-shrink-0">
      {initials}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="p-4 rounded-xl border border-white/40 animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200/70 rounded w-2/3" />
          <div className="h-3 bg-slate-200/50 rounded w-1/3" />
        </div>
        <div className="h-6 w-20 bg-slate-200/60 rounded-full" />
      </div>
    </div>
  );
}

export default function CompanyDetailPanel({
  company,
  onClose,
  userId,
  onEdit,
}: CompanyDetailPanelProps) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!company) {
      setJobs([]);
      return;
    }
    let cancelled = false;
    async function fetchJobs() {
      setLoading(true);
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("user_id", userId)
        .eq("company_name", company!.name)
        .order("application_date", { ascending: false });
      if (!cancelled) {
        setJobs(!error && data ? (data as JobEntry[]) : []);
        setLoading(false);
      }
    }
    fetchJobs();
    return () => {
      cancelled = true;
    };
  }, [company, userId]);

  const stats = useMemo(() => {
    const active = jobs.filter((j) => j.status?.toLowerCase() === "active").length;
    const interviews = jobs.filter((j) =>
      ["video interview", "hr interview", "technical interview", "final round"].includes(
        (j.stage || "").toLowerCase()
      )
    ).length;
    return { total: jobs.length, active, interviews };
  }, [jobs]);

  const stageSegments = useMemo(() => {
    const counts = new Map<string, number>();
    for (const j of jobs) {
      const stage = j.stage || "Unspecified";
      counts.set(stage, (counts.get(stage) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([stage, count]) => ({
        stage,
        count,
        color: STAGE_COLORS[stage] || FALLBACK_COLOR,
      }));
  }, [jobs]);

  const trackApplication = () => {
    sessionStorage.setItem(PENDING_ACTION_KEY, EVENT_ADD_APPLICATION);
    router.push("/dashboard");
  };

  const isOpen = company !== null;

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
        className={`fixed top-0 right-0 h-full w-full max-w-lg z-[201] flex flex-col
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
            {company?.name ?? ""}
          </h2>
          {onEdit && company && (
            <button
              onClick={() => onEdit(company)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
              title="Edit company"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </button>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
          {/* Company info */}
          <div className="flex items-start gap-4">
            {company?.logo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={company.logo_url}
                alt={`${company.name} logo`}
                className="w-16 h-16 rounded-2xl object-contain border border-white/60 shadow-sm flex-shrink-0 bg-white p-1.5"
              />
            ) : (
              <CompanyInitials name={company?.name ?? ""} />
            )}
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="font-extrabold text-slate-900 text-lg leading-tight truncate">
                {company?.name}
              </p>
              {company?.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline truncate flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span className="truncate">{company.website.replace(/^https?:\/\//, "")}</span>
                </a>
              )}
              {company?.tags && company.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {company.tags.map((tag: { id: string; name: string }) => (
                    <span
                      key={tag.id}
                      className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-100"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stats chips */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: "Applications", value: stats.total, accent: "text-blue-600" },
              { label: "Active", value: stats.active, accent: "text-emerald-600" },
              { label: "In interview", value: stats.interviews, accent: "text-violet-600" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-white/70 border border-white/60 shadow-sm px-3 py-3 text-center"
              >
                <p className={`text-2xl font-extrabold tabular-nums leading-none ${s.accent}`}>
                  {loading ? "—" : s.value}
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* Stage pipeline bar */}
          {!loading && stats.total > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Pipeline
              </h3>
              <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
                {stageSegments.map((s) => (
                  <div
                    key={s.stage}
                    style={{ width: `${(s.count / stats.total) * 100}%`, background: s.color }}
                    title={`${s.stage}: ${s.count}`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {stageSegments.map((s) => (
                  <span key={s.stage} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    {s.stage} · {s.count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Applications list */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Applications
            </h3>

            {loading ? (
              <div className="space-y-2">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                <svg className="w-14 h-14 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                </svg>
                <div>
                  <p className="text-slate-500 text-sm font-medium">
                    No applications yet for this company
                  </p>
                  <p className="text-slate-400 text-xs mt-1 max-w-[260px]">
                    Tip: applications link to companies by name — use the link button on the
                    dashboard table if a name doesn&apos;t match exactly.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => job.url && window.open(job.url, "_blank")}
                    className={`p-4 rounded-xl border border-white/50 bg-white/50 hover:bg-white/80 transition-colors group
                      ${job.url ? "cursor-pointer" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-semibold text-slate-800 text-sm leading-snug truncate flex items-center gap-1.5">
                          {job.role}
                          {job.url && (
                            <svg className="w-3 h-3 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          )}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {job.location && (
                            <span className="text-xs text-slate-400 truncate">{job.location}</span>
                          )}
                          {job.application_date && (
                            <span className="text-xs text-slate-400 tabular-nums">
                              {formatDate(job.application_date)}
                            </span>
                          )}
                          {job.stage && (
                            <span
                              className="text-[10px] font-bold rounded-full px-2 py-0.5 border"
                              style={{
                                color: STAGE_COLORS[job.stage] || FALLBACK_COLOR,
                                borderColor: `${STAGE_COLORS[job.stage] || FALLBACK_COLOR}50`,
                                background: `${STAGE_COLORS[job.stage] || FALLBACK_COLOR}15`,
                              }}
                            >
                              {job.stage}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusClasses(job.status)}`}
                      >
                        {job.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/50 bg-white/60 backdrop-blur-sm">
          <button
            onClick={trackApplication}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-md shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Track new application
          </button>
        </div>
      </div>
    </>
  );
}
