"use client";

import { CompanyWithTags } from "../../../../lib/types";

interface CompanyListRowProps {
  company: CompanyWithTags & { created_by: string };
  onEdit: (company: CompanyWithTags) => void;
  onClick?: (company: CompanyWithTags) => void;
  jobCount?: number;
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function getDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function CompanyListRow({
  company,
  onEdit,
  onClick,
  jobCount,
}: CompanyListRowProps) {
  const domain = getDomain(company.website);
  const visibleTags = company.tags.slice(0, 3);
  const extraTagCount = company.tags.length - visibleTags.length;

  return (
    <div
      className="group relative flex items-center gap-4 px-5 py-4 glass-card rounded-2xl cursor-pointer transition-all duration-200 hover:bg-white/80"
      onClick={() => onClick?.(company)}
    >
      {/* Logo / Initials */}
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 flex items-center justify-center overflow-hidden">
        {company.logo_url ? (
          <img
            src={company.logo_url}
            alt={company.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-sm font-semibold text-slate-600">
            {getInitials(company.name)}
          </span>
        )}
      </div>

      {/* Name + Website */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 truncate">{company.name}</p>
        {domain && (
          <p className="text-xs text-slate-400 truncate">{domain}</p>
        )}
      </div>

      {/* Tags */}
      <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
        {visibleTags.map((tag) => (
          <span
            key={tag.id}
            className="bg-white/60 text-slate-600 text-[10px] rounded-full px-2 py-0.5 border border-white/50"
          >
            {tag.name}
          </span>
        ))}
        {extraTagCount > 0 && (
          <span className="bg-white/60 text-slate-600 text-[10px] rounded-full px-2 py-0.5 border border-white/50">
            +{extraTagCount}
          </span>
        )}
      </div>

      {/* Job count badge */}
      {jobCount != null && jobCount > 0 && (
        <span className="flex-shrink-0 bg-blue-50 text-blue-600 text-xs font-bold px-2.5 py-1 rounded-full">
          {jobCount}
        </span>
      )}

      {/* Edit button */}
      <button
        className="flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-white/60"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(company);
        }}
        aria-label="Edit company"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4 text-slate-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
    </div>
  );
}
