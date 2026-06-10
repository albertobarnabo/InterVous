import React, { useEffect, useState } from "react";
import { CompanyWithTags } from "../../../../lib/types";
import { getProfileAvatar } from "../../../../lib/backend/profiles";

/* Deterministic pastel gradient derived from the company name,
   so every company gets its own stable visual identity */
function companyGradient(name: string): React.CSSProperties {
  // FNV-1a: small name differences produce completely different hues
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const h1 = hash % 360;
  const h2 = (h1 + 40 + (hash % 80)) % 360;
  const h3 = (h2 + 60) % 360;
  return {
    backgroundImage: `
      radial-gradient(at 18% 18%, hsl(${h1} 85% 76%) 0px, transparent 55%),
      radial-gradient(at 82% 22%, hsl(${h2} 80% 72%) 0px, transparent 55%),
      radial-gradient(at 28% 88%, hsl(${h3} 75% 78%) 0px, transparent 60%),
      linear-gradient(135deg, hsl(${h1} 70% 85%), hsl(${h2} 65% 78%))`,
  };
}

interface CompanyCardProps {
  company: CompanyWithTags & { created_by: string };
  onEdit: (company: CompanyWithTags) => void;
  jobCount?: number;
  onClick?: (company: CompanyWithTags) => void;
}

const CompanyCard: React.FC<CompanyCardProps> = ({ company, onEdit, jobCount, onClick }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!company.created_by) return;
    getProfileAvatar(company.created_by).then((url) => {
      if (url) setAvatarUrl(url);
    });
  }, [company.created_by]);

  return (
    <div className="relative group h-full overflow-hidden rounded-[1.75rem] md:rounded-[2rem] cursor-pointer" onClick={() => onClick?.(company)}>
      {/* Per-company gradient background */}
      <div
        className="absolute inset-0 transition-transform duration-700 group-hover:scale-110"
        style={companyGradient(company.name)}
      />

      {/* Watermark initial */}
      <span
        aria-hidden
        className="absolute -right-3 -bottom-7 text-[9rem] md:text-[10rem] font-black leading-none text-white/25 select-none pointer-events-none transition-transform duration-700 group-hover:scale-110 group-hover:-rotate-3"
      >
        {company.name.charAt(0).toUpperCase()}
      </span>

      {/* Depth overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/5 via-transparent to-slate-900/10 group-hover:from-slate-900/10 group-hover:to-slate-900/15 transition-all duration-700" />

      {/* Glow on hover */}
      <div className="absolute inset-0 bg-white/15 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      {/* Padding container */}
      <div className="relative h-full p-4 md:p-5">
        {/* Main glass card */}
        <div
          className="h-full rounded-[1.25rem] md:rounded-[1.5rem] p-6 md:p-8 flex flex-col
            transition-all duration-500
            backdrop-blur-2xl bg-white/32 border border-white/45
            shadow-[0_8px_32px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.85)]
            group-hover:bg-white/48 group-hover:border-white/60
            group-hover:shadow-[0_16px_56px_rgba(37,99,235,0.16),inset_0_1px_0_rgba(255,255,255,0.95)]
            group-hover:-translate-y-0.5"
        >
          {/* Edit button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(company);
            }}
            className="absolute top-7 right-7 md:top-9 md:right-9 p-2 md:p-2.5
              backdrop-blur-xl bg-white/65 rounded-xl md:rounded-2xl
              text-slate-500 hover:text-blue-600 hover:bg-white/90
              transition-all duration-300 opacity-0 group-hover:opacity-100
              shadow-[0_4px_16px_rgba(0,0,0,0.10)] z-20 cursor-pointer
              border border-white/55 hover:scale-105 active:scale-95"
            title="Edit Company"
          >
            <svg
              className="w-3.5 h-3.5 md:w-4 md:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>

          {/* Header */}
          <div className="flex items-start justify-between mb-6 md:mb-8">
            <div className="flex items-center gap-3 md:gap-5">
              {/* Logo */}
              {company.logo_url ? (
                <div
                  className="w-16 h-16 md:w-[4.5rem] md:h-[4.5rem] rounded-[1rem] md:rounded-[1.125rem] overflow-hidden
                    backdrop-blur-md bg-white/85 shadow-[0_8px_32px_rgba(0,0,0,0.12)]
                    p-2.5 md:p-3 flex items-center justify-center
                    border border-white/75 transition-all duration-300
                    group-hover:scale-105 group-hover:bg-white/95 group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.15)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={company.logo_url}
                    alt={`${company.name} logo`}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div
                  className="w-16 h-16 md:w-[4.5rem] md:h-[4.5rem] rounded-[1rem] md:rounded-[1.125rem]
                    bg-gradient-to-br from-blue-500/15 to-indigo-500/15
                    backdrop-blur-md flex items-center justify-center
                    shadow-[0_8px_32px_rgba(0,0,0,0.10)] border border-white/70
                    transition-all duration-300 group-hover:scale-105"
                >
                  <span className="text-xl md:text-2xl font-bold text-slate-600 tracking-tight">
                    {company.name.substring(0, 2).toUpperCase()}
                  </span>
                </div>
              )}

              {/* Company info */}
              <div>
                <h3
                  className="text-lg md:text-[1.375rem] font-bold text-slate-900 leading-tight
                    group-hover:text-blue-700 transition-colors duration-300
                    tracking-tight drop-shadow-sm"
                >
                  {company.name}
                </h3>
                {company.website && (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs md:text-[0.8125rem] font-medium text-slate-600 hover:text-blue-600
                      transition-colors duration-200 flex items-center gap-1.5 mt-1.5 drop-shadow-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg
                      className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    <span className="truncate max-w-[140px]">Visit Website</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Tags + Creator Avatar row */}
          <div className="mt-auto flex items-end justify-between gap-3">
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              {jobCount !== undefined && jobCount > 0 && (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 md:px-3.5 md:py-1.5 rounded-full
                    bg-blue-600/85 backdrop-blur-md text-white
                    text-[0.625rem] md:text-[0.6875rem] font-bold tracking-wide
                    border border-blue-400/40 shadow-[0_4px_16px_rgba(37,99,235,0.25)]"
                >
                  <svg className="w-2.5 h-2.5 md:w-3 md:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {jobCount} {jobCount === 1 ? "app" : "apps"}
                </span>
              )}
              {company.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="px-3 py-1 md:px-3.5 md:py-1.5 rounded-full
                    backdrop-blur-md bg-white/55 text-slate-700
                    text-[0.625rem] md:text-[0.6875rem] font-semibold tracking-wide
                    border border-white/65 shadow-[0_4px_16px_rgba(0,0,0,0.06)]
                    transition-all duration-200 hover:bg-white/75 hover:scale-105 cursor-default"
                >
                  {tag.name}
                </span>
              ))}
              {company.tags.length === 0 && (
                <span
                  className="px-3 py-1 md:px-3.5 md:py-1.5 rounded-full
                    backdrop-blur-md bg-white/30 text-slate-500
                    text-[0.625rem] md:text-[0.6875rem] font-medium tracking-wide
                    border border-white/40"
                >
                  No Tags
                </span>
              )}
            </div>

            {avatarUrl && (
              <div
                className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-xl md:rounded-2xl overflow-hidden
                  border border-white/75 shadow-[0_4px_16px_rgba(0,0,0,0.12)]
                  backdrop-blur-md bg-white/65
                  transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_4px_20px_rgba(0,0,0,0.18)]"
                title="Added by"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl}
                  alt="Added by"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyCard;
