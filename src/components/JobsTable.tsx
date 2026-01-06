"use client"

import { useState, useMemo } from "react";
import { JobEntry } from "../../lib/types";

interface JobsTableProps {
    jobs: JobEntry[];
    onEditJob: (job: JobEntry) => void;
}

const ITEMS_PER_PAGE = 8;

export default function JobsTable({ jobs, onEditJob }: JobsTableProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState<'status' | 'application_date' | 'location' | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const handleSort = (field: 'status' | 'application_date' | 'location') => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
        setCurrentPage(1);
    };

    const sortedJobs = useMemo(() => {
        if (!sortField) return jobs;
        return [...jobs].sort((a, b) => {
            const valA = a[sortField] || '';
            const valB = b[sortField] || '';
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [jobs, sortField, sortDirection]);

    const totalPages = Math.ceil(sortedJobs.length / ITEMS_PER_PAGE);
    const currentJobs = sortedJobs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const renderSortSymbol = (field: string) => {
        if (sortField !== field) return '⇅';
        return sortDirection === 'asc' ? '▲' : '▼';
    };

    const getStatusStyle = (status: string) => {
        const normalizedStatus = status?.toLowerCase();
        if (normalizedStatus === 'active') {
            return 'bg-emerald-500 text-white border-emerald-400 shadow-[0_5px_15px_rgba(16,185,129,0.3)]';
        }
        if (normalizedStatus === 'inactive' || normalizedStatus === 'rejected' || normalizedStatus === 'closed') {
            return 'bg-rose-500 text-white border-rose-400 shadow-[0_5px_15px_rgba(244,63,94,0.3)]';
        }
        return 'bg-slate-500 text-white border-slate-400 shadow-[0_5px_15px_rgba(100,116,139,0.3)]';
    };

    return (
        <div className="relative">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto overflow-y-visible">
                <table className="w-full text-sm text-left text-slate-600 table-auto border-separate border-spacing-0">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-white/50 sticky top-0 z-10">
                        <tr>
                            <th className="px-10 py-6 border-b border-slate-100">Company & Role</th>
                            <th className="px-6 py-6 border-b border-slate-100 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('location')}>
                                <div className="flex items-center gap-2">
                                    Location {renderSortSymbol('location')}
                                </div>
                            </th>
                            <th className="px-6 py-6 border-b border-slate-100 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('application_date')}>
                                <div className="flex items-center gap-2 text-nowrap">
                                    Applied On {renderSortSymbol('application_date')}
                                </div>
                            </th>
                            <th className="px-6 py-6 border-b border-slate-100 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('status')}>
                                <div className="flex items-center gap-2">
                                    Status {renderSortSymbol('status')}
                                </div>
                            </th>
                            <th className="px-6 py-6 border-b border-slate-100">Stage</th>
                            <th className="px-10 py-6 border-b border-slate-100 text-right font-black">Manage</th>
                        </tr>
                    </thead>
                    <tbody className="bg-transparent">
                        {jobs.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-8 py-32 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[2rem] flex items-center justify-center text-blue-400 shadow-inner">
                                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-slate-800 font-black text-xl tracking-tight">Your hunt starts here.</p>
                                            <p className="text-slate-400 font-medium max-w-xs mx-auto">Click &quot;Add Application&quot; above to start tracking your professional journey.</p>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            currentJobs.map((job) => (
                                <tr
                                    key={job.id}
                                    className="group hover:bg-white transition-all duration-300 cursor-pointer relative"
                                    onClick={() => window.open(job.url, '_blank')}
                                >
                                    <td className="px-10 py-7 relative">
                                        {/* Row accent color */}
                                        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/5 rounded-r-full transition-all duration-300 opacity-30 group-hover:opacity-100 ${job.status === 'Active' ? 'bg-emerald-500 scale-y-125' : job.status === 'Inactive' ? 'bg-rose-500' : 'bg-slate-400'}`} />
                                        
                                        <div className="flex flex-col">
                                            <span className="text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors tracking-tight">{job.company_name}</span>
                                            <span className="text-xs font-bold text-slate-400 mt-1 flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                                {job.role}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-7">
                                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                                            <svg className="w-4 h-4 text-blue-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            {job.location}
                                        </div>
                                    </td>
                                    <td className="px-6 py-7">
                                        <div className="flex items-center gap-2 text-indigo-600/70 font-black text-[11px] uppercase tracking-wider">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            {job.application_date ?? "-"}
                                        </div>
                                    </td>
                                    <td className="px-6 py-7">
                                        <span className={`px-4 py-1.5 rounded-[10px] text-[10px] font-black uppercase tracking-[0.15em] border transition-all duration-300 whitespace-nowrap ${getStatusStyle(job.status)}`}>
                                            {job.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-7">
                                        <div className="flex items-center gap-2.5">
                                            <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-black tracking-tight border border-blue-100">
                                                {job.stage}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-10 py-7 text-right" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => onEditJob(job)}
                                            className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all duration-300 group/btn"
                                        >
                                            <svg className="w-5 h-5 group-hover/btn:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-5 p-5">
                {jobs.length === 0 ? (
                    <div className="bg-white/50 backdrop-blur-md rounded-[2.5rem] p-16 text-center border border-white/50 shadow-sm">
                        <p className="text-slate-400 font-black italic tracking-tight">No adventures found yet.</p>
                    </div>
                ) : (
                    currentJobs.map((job) => (
                        <div
                            key={job.id}
                            className={`bg-white rounded-[2.2rem] p-8 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.02)] active:scale-[0.97] transition-all relative overflow-hidden`}
                            onClick={() => window.open(job.url, '_blank')}
                        >
                            {/* Card accent bar */}
                            <div className={`absolute left-0 top-0 bottom-0 w-2 ${job.status?.toLowerCase() === 'active' ? 'bg-emerald-500' : (job.status?.toLowerCase() === 'inactive' || job.status?.toLowerCase() === 'rejected' || job.status?.toLowerCase() === 'closed') ? 'bg-rose-500' : 'bg-slate-300'}`} />
                            
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{job.company_name}</h3>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mt-2 bg-slate-50 inline-block px-3 py-1 rounded-full">{job.role}</p>
                                </div>
                                <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border self-start whitespace-nowrap ${getStatusStyle(job.status)}`}>
                                    {job.status}
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 py-5 border-y border-slate-50 my-6">
                                <div>
                                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Location</p>
                                    <p className="text-sm font-black text-slate-700 flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                        {job.location}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Applied On</p>
                                    <p className="text-sm font-black text-indigo-500">{job.application_date ?? "-"}</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-2">
                                <div className="flex items-center gap-2.5">
                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Stage</span>
                                    <span className="text-sm font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-xl border border-blue-100">{job.stage}</span>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onEditJob(job); }}
                                    className="px-6 py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-black transition-colors shadow-lg shadow-slate-200"
                                >
                                    Modify
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination Controls */}
            {sortedJobs.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between px-10 py-8 border-t border-slate-50 bg-white/30 backdrop-blur-md">
                    <p className="hidden sm:block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        Voyage {currentPage} of {totalPages}
                    </p>
                    <div className="flex gap-3 w-full sm:w-auto justify-center">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((prev) => prev - 1)}
                            className={`p-3 rounded-2xl border transition-all duration-300 ${currentPage === 1 ? 'border-transparent text-slate-200' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-600 shadow-sm'}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        
                        <div className="flex items-center gap-1.5">
                            {Array.from({ length: totalPages }, (_, i) => (
                                <button
                                    key={i + 1}
                                    onClick={() => setCurrentPage(i + 1)}
                                    className={`w-11 h-11 rounded-2xl font-black text-xs transition-all duration-300 ${currentPage === i + 1 ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-[0_10px_20px_rgba(37,99,235,0.3)] scale-110' : 'text-slate-400 hover:bg-white hover:text-slate-900'}`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                        </div>

                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage((prev) => prev + 1)}
                            className={`p-3 rounded-2xl border transition-all duration-300 ${currentPage === totalPages ? 'border-transparent text-slate-200' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-600 shadow-sm'}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
