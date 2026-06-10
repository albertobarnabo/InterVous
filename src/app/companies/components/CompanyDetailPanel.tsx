"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../../../lib/supbaseClient";
import { JobEntry, CompanyWithTags, CompanyInfo } from "../../../../lib/types";
import { getCompanyInfo, upsertCompanyInfo } from "../../../../lib/backend/companyInfo";
import { PENDING_ACTION_KEY, EVENT_ADD_APPLICATION } from "@/components/CommandPalette";

interface CompanyDetailPanelProps {
  company: CompanyWithTags | null;
  onClose: () => void;
  userId: string;
  onEdit?: (company: CompanyWithTags) => void;
  tavilyKey?: string | null;
}

type InfoDraft = {
  description: string;
  industry: string;
  headquarters: string;
  founded: string;
  employee_count: string;
};

const EMPTY_DRAFT: InfoDraft = {
  description: "",
  industry: "",
  headquarters: "",
  founded: "",
  employee_count: "",
};

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
  tavilyKey,
}: CompanyDetailPanelProps) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Company info (about section)
  const [info, setInfo] = useState<CompanyInfo | null>(null);
  const [editingInfo, setEditingInfo] = useState(false);
  const [draft, setDraft] = useState<InfoDraft>(EMPTY_DRAFT);
  const [researching, setResearching] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoError, setInfoError] = useState("");

  useEffect(() => {
    setInfo(null);
    setEditingInfo(false);
    setInfoError("");
    if (!company) return;
    let cancelled = false;
    getCompanyInfo(company.id)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch((err) => console.error("Failed to load company info", err));
    return () => {
      cancelled = true;
    };
  }, [company]);

  const startEditing = () => {
    setDraft({
      description: info?.description ?? "",
      industry: info?.industry ?? "",
      headquarters: info?.headquarters ?? "",
      founded: info?.founded ?? "",
      employee_count: info?.employee_count ?? "",
    });
    setInfoError("");
    setEditingInfo(true);
  };

  const handleResearch = async () => {
    if (!company || !tavilyKey) return;
    setResearching(true);
    setInfoError("");
    try {
      const res = await fetch("/intervous/api/company-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: company.name,
          website: company.website,
          apiKey: tavilyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Research failed");
      // Pre-fill the edit form so the user reviews before saving
      setDraft({
        description: data.description || "",
        industry: data.industry || "",
        headquarters: data.headquarters || "",
        founded: data.founded || "",
        employee_count: data.employee_count || "",
      });
      setEditingInfo(true);
    } catch (err) {
      setInfoError(err instanceof Error ? err.message : String(err));
    } finally {
      setResearching(false);
    }
  };

  const handleSaveInfo = async () => {
    if (!company) return;
    setSavingInfo(true);
    setInfoError("");
    try {
      const saved = await upsertCompanyInfo(
        {
          company_id: company.id,
          description: draft.description.trim() || null,
          industry: draft.industry.trim() || null,
          headquarters: draft.headquarters.trim() || null,
          founded: draft.founded.trim() || null,
          employee_count: draft.employee_count.trim() || null,
        },
        userId
      );
      setInfo(saved);
      setEditingInfo(false);
    } catch (err) {
      setInfoError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingInfo(false);
    }
  };

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

          {/* About section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                About
              </h3>
              {!editingInfo && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleResearch}
                    disabled={researching || !tavilyKey}
                    title={tavilyKey ? "Auto-fill with web search" : "Add a Tavily API key in Configs to enable"}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-sm shadow-indigo-500/25 hover:from-violet-600 hover:to-indigo-600 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {researching ? (
                      <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    )}
                    {researching ? "Searching..." : "Auto-fill"}
                  </button>
                  <button
                    onClick={startEditing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200/80 transition-colors cursor-pointer"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit
                  </button>
                </div>
              )}
            </div>

            {infoError && (
              <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                {infoError}
              </p>
            )}

            {editingInfo ? (
              <div className="space-y-2.5 rounded-2xl bg-white/70 border border-white/60 p-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</label>
                  <textarea
                    value={draft.description}
                    onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-y"
                    placeholder="What does this company do?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {([
                    ["industry", "Industry"],
                    ["headquarters", "Headquarters"],
                    ["founded", "Founded"],
                    ["employee_count", "Employees"],
                  ] as [keyof InfoDraft, string][]).map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</label>
                      <input
                        type="text"
                        value={draft[field]}
                        onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => { setEditingInfo(false); setInfoError(""); }}
                    className="px-4 py-2 rounded-xl text-[11px] font-black text-slate-500 hover:bg-slate-100 uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveInfo}
                    disabled={savingInfo}
                    className="px-5 py-2 rounded-xl text-[11px] font-black text-white bg-slate-900 hover:bg-slate-800 uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingInfo && (
                      <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    Save
                  </button>
                </div>
              </div>
            ) : info && (info.description || info.industry || info.headquarters || info.founded || info.employee_count) ? (
              <div className="space-y-3">
                {info.description && (
                  <p className="text-sm text-slate-600 leading-relaxed">{info.description}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["Industry", info.industry],
                    ["Headquarters", info.headquarters],
                    ["Founded", info.founded],
                    ["Employees", info.employee_count],
                  ] as [string, string | null][])
                    .filter(([, v]) => v)
                    .map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-white/60 border border-white/60 px-3 py-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                        <p className="text-xs font-semibold text-slate-700 mt-0.5">{value}</p>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 font-medium rounded-xl border border-dashed border-slate-300/60 px-4 py-4 text-center">
                No company info yet — use <span className="font-bold text-indigo-500">Auto-fill</span> to research it
                or <span className="font-bold text-slate-500">Edit</span> to add it manually.
              </p>
            )}
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
