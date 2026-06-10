"use client";

import { useEffect, useMemo, useState } from "react";
import { JobEntry } from "../../lib/types";

interface StatsOverviewProps {
  jobs: JobEntry[];
}

/* Animated counter that eases up to its target value */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
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

function KpiCard({
  label,
  value,
  accent,
  icon,
  delay,
}: {
  label: string;
  value: number;
  accent: string;
  icon: React.ReactNode;
  delay: number;
}) {
  const display = useCountUp(value);
  return (
    <div
      className="glass-card rounded-[1.5rem] p-5 md:p-6 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <div
        className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0 text-white shadow-lg"
        style={{ background: accent, boxShadow: `0 8px 24px ${accent}40` }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-3xl md:text-4xl font-extrabold text-slate-900 tabular-nums leading-none tracking-tight">
          {display}
        </p>
        <p className="text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-widest mt-1.5 truncate">
          {label}
        </p>
      </div>
    </div>
  );
}

/* Bar chart of applications per week over the last 12 weeks */
function TimelineChart({ jobs }: { jobs: JobEntry[] }) {
  const weeks = useMemo(() => {
    const WEEKS = 12;
    const now = new Date();
    const buckets: { label: string; count: number }[] = [];
    for (let i = WEEKS - 1; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() - i * 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      const count = jobs.filter((j) => {
        if (!j.application_date) return false;
        const d = new Date(j.application_date);
        return d >= start && d < end;
      }).length;
      buckets.push({
        label: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count,
      });
    }
    return buckets;
  }, [jobs]);

  const max = Math.max(...weeks.map((w) => w.count), 1);
  const W = 560;
  const H = 180;
  const PAD = 8;
  const barGap = 10;
  const barWidth = (W - PAD * 2 - barGap * (weeks.length - 1)) / weeks.length;

  return (
    <div className="glass-card rounded-[1.75rem] p-6 md:p-7">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">
          Applications · last 12 weeks
        </h3>
        <span className="text-xs font-bold text-slate-400 tabular-nums">
          {weeks.reduce((s, w) => s + w.count, 0)} total
        </span>
      </div>
      <style>{`@keyframes barGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }`}</style>
      <svg viewBox={`0 0 ${W} ${H + 28}`} className="w-full" role="img" aria-label="Applications per week">
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>
        {weeks.map((w, i) => {
          const h = Math.max((w.count / max) * H, w.count > 0 ? 6 : 3);
          const x = PAD + i * (barWidth + barGap);
          const y = H - h;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={6}
                fill={w.count > 0 ? "url(#barGrad)" : "rgba(148,163,184,0.25)"}
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "bottom",
                  animation: `barGrow 0.6s cubic-bezier(0.4,0,0.2,1) ${i * 40}ms backwards`,
                }}
              />
              {w.count > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  className="fill-slate-500"
                  fontSize="11"
                  fontWeight="700"
                >
                  {w.count}
                </text>
              )}
              {i % 2 === 0 && (
                <text
                  x={x + barWidth / 2}
                  y={H + 18}
                  textAnchor="middle"
                  className="fill-slate-400"
                  fontSize="10"
                  fontWeight="600"
                >
                  {w.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* Donut chart of applications by stage */
function StageDonut({ jobs }: { jobs: JobEntry[] }) {
  const segments = useMemo(() => {
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

  const total = jobs.length;
  const R = 56;
  const CIRC = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="glass-card rounded-[1.75rem] p-6 md:p-7">
      <h3 className="text-sm font-extrabold text-slate-800 tracking-tight mb-5">
        Pipeline by stage
      </h3>
      {total === 0 ? (
        <p className="text-sm text-slate-400 font-medium py-10 text-center">
          No applications yet
        </p>
      ) : (
        <div className="flex items-center gap-6">
          <svg viewBox="0 0 140 140" className="w-32 h-32 md:w-36 md:h-36 shrink-0 -rotate-90">
            {segments.map((s) => {
              const frac = s.count / total;
              const dash = frac * CIRC;
              const el = (
                <circle
                  key={s.stage}
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="18"
                  strokeDasharray={`${dash} ${CIRC - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += dash;
              return el;
            })}
            <text
              x="70"
              y="70"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-slate-900 rotate-90"
              transform="rotate(90 70 70)"
              fontSize="26"
              fontWeight="800"
            >
              {total}
            </text>
          </svg>
          <div className="flex-1 space-y-2 min-w-0">
            {segments.slice(0, 6).map((s) => (
              <div key={s.stage} className="flex items-center gap-2.5 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: s.color }}
                />
                <span className="font-semibold text-slate-600 truncate flex-1">{s.stage}</span>
                <span className="font-bold text-slate-800 tabular-nums">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StatsOverview({ jobs }: StatsOverviewProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const active = jobs.filter((j) => j.status?.toLowerCase() === "active").length;
    const interviews = jobs.filter((j) =>
      ["video interview", "hr interview", "technical interview", "final round"].includes(
        (j.stage || "").toLowerCase()
      )
    ).length;
    const thisMonth = jobs.filter(
      (j) => j.application_date && new Date(j.application_date) >= monthStart
    ).length;
    return { total: jobs.length, active, interviews, thisMonth };
  }, [jobs]);

  return (
    <section className="space-y-6 md:space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <KpiCard
          label="Total applications"
          value={stats.total}
          accent="linear-gradient(135deg,#3B82F6,#6366F1)"
          delay={0}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        />
        <KpiCard
          label="Active"
          value={stats.active}
          accent="linear-gradient(135deg,#10B981,#34D399)"
          delay={80}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <KpiCard
          label="In interviews"
          value={stats.interviews}
          accent="linear-gradient(135deg,#8B5CF6,#A78BFA)"
          delay={160}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
            </svg>
          }
        />
        <KpiCard
          label="This month"
          value={stats.thisMonth}
          accent="linear-gradient(135deg,#F59E0B,#FBBF24)"
          delay={240}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <TimelineChart jobs={jobs} />
        <StageDonut jobs={jobs} />
      </div>
    </section>
  );
}
