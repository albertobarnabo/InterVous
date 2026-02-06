
import React from 'react';
import { CompanyWithTags } from '../../../../lib/types';

interface CompanyCardProps {
    company: CompanyWithTags;
    onEdit: (company: CompanyWithTags) => void;
}

const CompanyCard: React.FC<CompanyCardProps> = ({ company, onEdit }) => {
    return (
        <div className="glass-card rounded-[2.5rem] p-8 flex flex-col h-full relative group transition-all duration-300">
            <button 
                onClick={(e) => {
                    e.preventDefault();
                    onEdit(company);
                }}
                className="absolute top-6 right-6 p-2.5 bg-white/50 backdrop-blur-md rounded-xl text-slate-500 hover:text-blue-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100 shadow-sm z-20 cursor-pointer border border-white/50"
                title="Edit Company"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            
            <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-6">
                    {company.logo_url ? (
                        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white shadow-lg shadow-blue-900/5 p-3 flex items-center justify-center ring-1 ring-black/5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={company.logo_url} alt={`${company.name} logo`} className="w-full h-full object-contain" />
                        </div>
                    ) : (
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-lg shadow-blue-900/5 ring-1 ring-black/5">
                             <span className="text-3xl font-black text-slate-400 uppercase">{company.name.substring(0, 2)}</span>
                        </div>
                    )}
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors tracking-tight">{company.name}</h3>
                         {company.website && (
                            <a 
                                href={company.website} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-sm font-bold text-slate-500 hover:text-blue-500 transition-colors flex items-center gap-1.5 mt-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                Visit Website
                            </a>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-auto">
                <div className="flex flex-wrap gap-2.5">
                    {company.tags.map((tag) => (
                        <span 
                            key={tag.id} 
                            className="px-4 py-2 rounded-xl bg-white/50 text-slate-600 text-[11px] font-black uppercase tracking-wider border border-white/60 shadow-sm"
                        >
                            {tag.name}
                        </span>
                    ))}
                     {company.tags.length === 0 && (
                        <span className="px-4 py-2 rounded-xl bg-slate-50/50 text-slate-400 text-[11px] font-black uppercase tracking-wider border border-slate-100/50">
                            No Tags
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CompanyCard;
