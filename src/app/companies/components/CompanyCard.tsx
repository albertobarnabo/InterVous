import React, { useEffect, useState } from 'react';
import { CompanyWithTags } from '../../../../lib/types';
import { getProfileAvatar } from '../../../../lib/backend/profiles';

interface CompanyCardProps {
    company: CompanyWithTags & { created_by: string };
    onEdit: (company: CompanyWithTags) => void;
}

const CompanyCard: React.FC<CompanyCardProps> = ({ company, onEdit }) => {
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!company.created_by) return;

        getProfileAvatar(company.created_by).then(url => {
            if (url) setAvatarUrl(url);
        });
    }, [company.created_by]);

    return (
        <div className="relative group h-full overflow-hidden rounded-[1.75rem] md:rounded-[2rem]">
            {/* Nature background image */}
            <div 
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                style={{
                    backgroundImage: `url('https://i.pinimg.com/736x/4a/b8/e0/4ab8e051eea7d33cf6ef937f9ece2cb1.jpg')`,
                }}
            />
            
            {/* Overlay for better contrast */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/10"></div>
            
            {/* Subtle glow on hover */}
            <div className="absolute inset-0 bg-white/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            
            {/* Padding container - creates the gap */}
            <div className="relative h-full p-4 md:p-5">
                {/* Main glass card */}
                <div className="h-full backdrop-blur-2xl bg-white/30 rounded-[1.25rem] md:rounded-[1.5rem] p-6 md:p-8 flex flex-col border border-white/40 shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] transition-all duration-500 group-hover:bg-white/40 group-hover:shadow-[0_8px_48px_0_rgba(0,0,0,0.15)] group-hover:border-white/60">
                    
                    {/* Edit button */}
                    <button 
                        onClick={(e) => {
                            e.preventDefault();
                            onEdit(company);
                        }}
                        className="absolute top-7 right-7 md:top-9 md:right-9 p-2 md:p-2.5 backdrop-blur-xl bg-white/60 rounded-xl md:rounded-2xl text-slate-500 hover:text-blue-600 hover:bg-white/90 transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-[0_4px_16px_0_rgba(0,0,0,0.1)] z-20 cursor-pointer border border-white/50 hover:scale-105 active:scale-95"
                        title="Edit Company"
                    >
                        <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </button>
                    
                    {/* Header section */}
                    <div className="flex items-start justify-between mb-6 md:mb-8">
                        <div className="flex items-center gap-3 md:gap-5">
                            {/* Logo container */}
                            {company.logo_url ? (
                                <div className="w-16 h-16 md:w-[4.5rem] md:h-[4.5rem] rounded-[1rem] md:rounded-[1.125rem] overflow-hidden backdrop-blur-md bg-white/80 shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] p-2.5 md:p-3 flex items-center justify-center border border-white/70 transition-all duration-300 group-hover:scale-105 group-hover:bg-white/90">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={company.logo_url} alt={`${company.name} logo`} className="w-full h-full object-contain" />
                                </div>
                            ) : (
                                <div className="w-16 h-16 md:w-[4.5rem] md:h-[4.5rem] rounded-[1rem] md:rounded-[1.125rem] bg-white/60 backdrop-blur-md flex items-center justify-center shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] border border-white/70 transition-all duration-300 group-hover:scale-105 group-hover:bg-white/70">
                                    <span className="text-xl md:text-2xl font-semibold text-slate-500 tracking-tight">{company.name.substring(0, 2).toUpperCase()}</span>
                                </div>
                            )}
                            
                            {/* Company info */}
                            <div>
                                <h3 className="text-lg md:text-[1.375rem] font-semibold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors duration-300 tracking-[-0.02em] drop-shadow-sm">
                                    {company.name}
                                </h3>
                                {company.website && (
                                    <a 
                                        href={company.website} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-xs md:text-[0.8125rem] font-medium text-slate-600 hover:text-blue-600 transition-colors duration-300 flex items-center gap-1.5 mt-1.5 drop-shadow-sm"
                                    >
                                        <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        <span>Visit Website</span>
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tags + Creator Avatar row */}
                    <div className="mt-auto flex items-end justify-between gap-3">
                        {/* Tags section */}
                        <div className="flex flex-wrap gap-1.5 md:gap-2">
                            {company.tags.map((tag) => (
                                <span 
                                    key={tag.id} 
                                    className="px-3 py-1 md:px-3.5 md:py-1.5 rounded-full backdrop-blur-md bg-white/50 text-slate-700 text-[0.625rem] md:text-[0.6875rem] font-medium tracking-wide border border-white/60 shadow-[0_4px_16px_0_rgba(0,0,0,0.08)] transition-all duration-300 hover:bg-white/70 hover:shadow-[0_4px_20px_0_rgba(0,0,0,0.12)] hover:scale-105"
                                >
                                    {tag.name}
                                </span>
                            ))}
                            {company.tags.length === 0 && (
                                <span className="px-3 py-1 md:px-3.5 md:py-1.5 rounded-full backdrop-blur-md bg-white/30 text-slate-500 text-[0.625rem] md:text-[0.6875rem] font-medium tracking-wide border border-white/40">
                                    No Tags
                                </span>
                            )}
                        </div>

                        {/* Creator avatar */}
                        {avatarUrl && (
                            <div
                                className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-xl md:rounded-2x overflow-hidden border border-white/70 shadow-[0_4px_16px_0_rgba(0,0,0,0.12)] backdrop-blur-md bg-white/60 transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_4px_20px_0_rgba(0,0,0,0.18)]"
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