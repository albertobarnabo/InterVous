"use client";

import { useMemo, useState } from "react";
import { JobEntry } from "../../lib/types";

interface KanbanBoardProps {
  jobs: JobEntry[];
  onEditJob: (job: JobEntry) => void;
  onStageChange: (job: JobEntry, newStage: string) => Promise<void>;
  companyLogos?: Record<string, string | null>;
}

const STAGES = [
  "Screening",
  "Coding Assessment",
  "Video Interview",
  "HR Interview",
  "Technical Interview",
  "Final Round",
];

const STAGE_ACCENTS: Record<string, string> = {
  Screening: "#60A5FA",
  "Coding Assessment": "#818CF8",
  "Video Interview": "#A78BFA",
  "HR Interview": "#34D399",
  "Technical Interview": "#FBBF24",
  "Final Round": "#F472B6",
};

function statusDot(status: string) {
  const s = status?.toLowerCase();
  if (s === "active") return "bg-emerald-500";
  if (s === "inactive" || s === "rejected" || s === "closed") return "bg-rose-500";
  return "bg-slate-400";
}

export default function KanbanBoard({ jobs, onEditJob, onStageChange, companyLogos }: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const columns = useMemo(() => {
    const known = new Set(STAGES);
    const extra = Array.from(
      new Set(jobs.map((j) => j.stage).filter((s) => s && !known.has(s)))
    );
    const all = [...STAGES, ...extra];
    return all.map((stage) => ({
      stage,
      jobs: jobs.filter((j) => j.stage === stage),
    }));
  }, [jobs]);

  const unstaged = useMemo(
    () => jobs.filter((j) => !j.stage),
    [jobs]
  );

  const handleDrop = async (stage: string) => {
    setDragOverStage(null);
    if (draggingId == null) return;
    const job = jobs.find((j) => j.id === draggingId);
    setDraggingId(null);
    if (!job || job.stage === stage) return;
    setSavingId(job.id);
    try {
      await onStageChange(job, stage);
    } finally {
      setSavingId(null);
    }
  };

  const renderCard = (job: JobEntry) => (
    <div
      key={job.id}
      draggable
      onDragStart={(e) => {
        setDraggingId(job.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        setDraggingId(null);
        setDragOverStage(null);
      }}
      onClick={() => onEditJob(job)}
      className={`group glass-card rounded-2xl p-4 cursor-grab active:cursor-grabbing select-none
        ${draggingId === job.id ? "opacity-40 scale-95" : ""}
        ${savingId === job.id ? "animate-pulse" : ""}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {companyLogos?.[job.company_name] ? (
            <div className="w-6 h-6 rounded-lg bg-white border border-slate-100 shadow-sm p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={companyLogos[job.company_name]!} alt="" className="w-full h-full object-contain" />
            </div>
          ) : null}
          <p className="font-bold text-slate-900 text-sm leading-snug truncate">
            {job.company_name}
          </p>
        </div>
        <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${statusDot(job.status)}`} title={job.status} />
      </div>
      <p className="text-xs text-slate-500 font-medium truncate mb-2">{job.role}</p>
      <div className="flex items-center justify-between gap-2">
        {job.location && (
          <span className="text-[10px] text-slate-400 font-semibold truncate">{job.location}</span>
        )}
        {job.application_date && (
          <span className="text-[10px] text-slate-400 font-semibold tabular-nums shrink-0">
            {new Date(job.application_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {unstaged.length > 0 && (
        <p className="text-xs font-semibold text-slate-400 px-1">
          {unstaged.length} application{unstaged.length === 1 ? "" : "s"} without a stage —
          edit them to assign one.
        </p>
      )}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 snap-x">
        {columns.map(({ stage, jobs: stageJobs }) => {
          const accent = STAGE_ACCENTS[stage] || "#94A3B8";
          const isOver = dragOverStage === stage;
          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverStage(stage);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverStage(null);
                }
              }}
              onDrop={() => handleDrop(stage)}
              className={`shrink-0 w-[270px] snap-start rounded-[1.5rem] p-3 transition-all duration-200
                ${isOver
                  ? "bg-blue-500/10 ring-2 ring-blue-400/60 ring-inset"
                  : "glass-deep"}`}
            >
              <div className="flex items-center justify-between px-2 py-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: accent }} />
                  <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider truncate">
                    {stage}
                  </h3>
                </div>
                <span className="text-xs font-bold text-slate-400 tabular-nums bg-white/60 rounded-full px-2 py-0.5">
                  {stageJobs.length}
                </span>
              </div>
              <div className="space-y-2.5 min-h-[80px]">
                {stageJobs.map(renderCard)}
                {stageJobs.length === 0 && (
                  <div className={`rounded-2xl border-2 border-dashed py-8 text-center transition-colors
                    ${isOver ? "border-blue-400/60" : "border-slate-300/40"}`}>
                    <p className="text-[11px] font-semibold text-slate-400">Drop here</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
