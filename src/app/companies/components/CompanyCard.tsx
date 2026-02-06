
import React from 'react';
import { CompanyWithTags } from '../../../../lib/types';

interface CompanyCardProps {
    company: CompanyWithTags;
    onEdit: (company: CompanyWithTags) => void;
}

const CompanyCard: React.FC<CompanyCardProps> = ({ company, onEdit }) => {
    return (
        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] transition-all duration-300 transform hover:-translate-y-1 group flex flex-col h-full relative">
            <button 
                onClick={(e) => {
                    e.preventDefault();
                    onEdit(company);
                }}
                className="absolute top-4 right-4 p-2 bg-white/80 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100 shadow-sm z-20 cursor-pointer"
                title="Edit Company"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                    {company.logo_url ? (
                        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-100 p-2 flex items-center justify-center">
                            <img src={company.logo_url} alt={`${company.name} logo`} className="w-full h-full object-contain" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-sm border border-slate-100">
                             <span className="text-2xl font-black text-slate-400 uppercase">{company.name.substring(0, 2)}</span>
                        </div>
                    )}
                    <div>
                        <h3 className="text-xl font-black text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">{company.name}</h3>
                         {company.website && (
                            <a 
                                href={company.website} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-sm font-bold text-slate-400 hover:text-blue-500 transition-colors flex items-center gap-1 mt-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                Visit Website
                            </a>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-auto pt-4">
                <div className="flex flex-wrap gap-2">
                    {company.tags.map((tag) => (
                        <span 
                            key={tag.id} 
                            className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-[11px] font-black uppercase tracking-wide border border-blue-100"
                        >
                            {tag.name}
                        </span>
                    ))}
                     {company.tags.length === 0 && (
                        <span className="px-3 py-1.5 rounded-xl bg-slate-50 text-slate-400 text-[11px] font-black uppercase tracking-wide border border-slate-100">
                            No Tags
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CompanyCard;
