'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';

import TopBar from '@/components/TopBar';
import EditJobPanel from '@/components/EditJobPanel';
import JobsTable from '@/components/JobsTable';
import AddJobPanel from '@/components/AddJobPanel';
import StatsOverview from '@/components/StatsOverview';
import KanbanBoard from '@/components/KanbanBoard';
import LinkCompanyModal from '@/components/LinkCompanyModal';
import JobDetailPanel from '@/components/JobDetailPanel';
import { PENDING_ACTION_KEY, EVENT_ADD_APPLICATION } from '@/components/CommandPalette';
import { useToast } from '@/components/Toast';

import { useAuth } from '../../../contexts/AuthContext';

import { getJobsByUser, updateJob, deleteJob } from '../../../lib/jobService';
import { getKeysStatus, KeysStatus } from '../../../lib/keyService';
import { getCompanyLogoMap } from '../../../lib/backend/companies';

import { JobEntry } from '../../../lib/types';

import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';

import { AiFillOpenAI } from "react-icons/ai";
import DeepseekIcon from '@/components/DeepSeekIcon';
import MistralIcon from '@/components/MistralIcon';

const models = [
    {
        value: "gpt-3.5-turbo",
        label: 'GPT 3.5 - Turbo',
        icon: <AiFillOpenAI className="text-blue-600 text-xl" />,
    },
    {
        value: "deep_seek",
        label: 'DeepSeek',
        icon: <DeepseekIcon className="w-5 h-5" />,
    },
    {
        value: "mistral",
        label: "Mistral",
        icon: <MistralIcon className='w-5 h-5' />
    }
];

const STATUS_FILTERS = ["All", "Active", "Not Applied", "Inactive"];

function exportJobsToCsv(jobs: JobEntry[]) {
    const headers = ["Company", "Role", "Location", "Applied On", "Status", "Stage", "URL"];
    const escape = (value: string | null) => {
        const s = value ?? "";
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = jobs.map((j) =>
        [j.company_name, j.role, j.location, j.application_date, j.status, j.stage, j.url]
            .map(escape)
            .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `intervous-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

export default function DashboardPage() {

    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [jobs, setJobs] = useState<JobEntry[]>([]);
    const [keysStatus, setKeysStatus] = useState<KeysStatus | null>(null);
    const [selectedModel, setSelectedModel] = useState("gpt-3.5-turbo");

    // Panels
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [editingJob, setEditingJob] = useState<JobEntry | null>(null);
    const [linkingJob, setLinkingJob] = useState<JobEntry | null>(null);
    const [selectedJob, setSelectedJob] = useState<JobEntry | null>(null);

    // Company linkage: name → logo_url for every tracked company
    const [companyLogos, setCompanyLogos] = useState<Record<string, string | null>>({});
    const companyNames = useMemo(() => new Set(Object.keys(companyLogos)), [companyLogos]);

    // Filters & view
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [viewMode, setViewMode] = useState<'table' | 'board'>('table');
    const [showInsights, setShowInsights] = useState(true);

    const handleUpdateJob = async (updatedJob: JobEntry) => {
        if (!user) return;
        try {
            await updateJob(updatedJob, user.id);
            setEditingJob(null);
            toast("Application updated");
            fetchJobs();
        } catch (error) {
            console.error("Failed to update job:", error);
            toast("Failed to update application", "error");
        }
    };

    const handleStageChange = async (job: JobEntry, newStage: string) => {
        if (!user) return;
        // Optimistic update so the card lands in its new column instantly
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, stage: newStage } : j)));
        try {
            await updateJob({ ...job, stage: newStage }, user.id);
            toast(`Moved to ${newStage}`);
        } catch (error) {
            console.error("Failed to move application:", error);
            setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, stage: job.stage } : j)));
            toast("Failed to move application", "error");
        }
    };

    const handleDeleteJob = async (id: number) => {
        if (!user) return;
        try {
            await deleteJob(id, user.id);
            setEditingJob(null);
            setSelectedJob(null);
            toast("Application deleted");
            fetchJobs();
        } catch (error) {
            console.error("Failed to delete job:", error);
            toast("Failed to delete application", "error");
        }
    };

    const filteredJobs = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return jobs.filter((job) => {
            const matchesSearch =
                !q ||
                job.company_name.toLowerCase().includes(q) ||
                job.role?.toLowerCase().includes(q) ||
                job.location?.toLowerCase().includes(q);
            const matchesStatus =
                statusFilter === 'All' ||
                job.status?.toLowerCase() === statusFilter.toLowerCase();
            return matchesSearch && matchesStatus;
        });
    }, [jobs, searchQuery, statusFilter]);

    const fetchJobs = useCallback(async () => {
        if (!user) return;
        try {
            const data = await getJobsByUser(user.id);
            setJobs(data || []);
        } catch (error) {
            console.log("Error retrieving jobs", error);
        }
    }, [user]);

    const fetchCompanyNames = useCallback(async () => {
        try {
            const logos = await getCompanyLogoMap();
            setCompanyLogos(logos);
        } catch (error) {
            console.log("Error retrieving company names", error);
        }
    }, []);

    const fetchKeysStatus = useCallback(async () => {
        if (!user) return;
        try {
            const status = await getKeysStatus();
            setKeysStatus(status);
        } catch (error) {
            console.log("Error retrieving key status", error);
        }
    }, [user]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push("/login");
            return;
        }
        fetchJobs();
        fetchKeysStatus();
        fetchCompanyNames();
    }, [user, authLoading, router, fetchJobs, fetchKeysStatus, fetchCompanyNames]);

    // Command palette: open Add Application panel when requested
    useEffect(() => {
        const openAdd = () => {
            sessionStorage.removeItem(PENDING_ACTION_KEY);
            setShowAddPanel(true);
        };
        if (sessionStorage.getItem(PENDING_ACTION_KEY) === EVENT_ADD_APPLICATION) {
            openAdd();
        }
        window.addEventListener(EVENT_ADD_APPLICATION, openAdd);
        return () => window.removeEventListener(EVENT_ADD_APPLICATION, openAdd);
    }, []);

    if (authLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="glass-panel rounded-[2rem] px-8 py-6 flex items-center gap-4">
                    <svg className="animate-spin w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm font-bold text-slate-600">Loading your workspace...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative overflow-x-hidden">
            {/* Liquid Background Blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-400/20 rounded-full blur-[120px] mix-blend-multiply animate-pulse" />
                <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-purple-400/20 rounded-full blur-[120px] mix-blend-multiply animate-pulse delay-1000" />
                <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[60%] bg-cyan-400/20 rounded-full blur-[120px] mix-blend-multiply animate-pulse delay-2000" />
            </div>

            <TopBar keysStatus={keysStatus} onKeysSaved={fetchKeysStatus} />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 md:pt-32 pb-12 relative z-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-10 gap-4 md:gap-6">
                    <div>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-none mb-3 md:mb-4">
                            Track your next <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">Career Move</span>
                        </h1>
                        <p className="text-slate-600 text-base sm:text-lg md:text-xl max-w-2xl font-medium leading-relaxed">
                            Keep all your job applications organized and add new jobs quickly.
                        </p>
                    </div>

                    <button
                        onClick={() => setShowAddPanel(true)}
                        className='bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-6 py-3 md:px-8 md:py-4 rounded-2xl cursor-pointer shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 md:gap-3 text-sm md:text-base whitespace-nowrap'
                    >
                        <div className="w-5 h-5 md:w-6 md:h-6 bg-white/20 rounded-lg flex items-center justify-center">
                            <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                        </div>
                        Add Application
                    </button>
                </div>

                {/* Insights */}
                <div className="mb-8 md:mb-10">
                    <button
                        onClick={() => setShowInsights((v) => !v)}
                        className="flex items-center gap-2 mb-4 text-xs font-black text-slate-500 hover:text-blue-600 uppercase tracking-widest transition-colors cursor-pointer"
                    >
                        <svg
                            className={`w-4 h-4 transition-transform duration-300 ${showInsights ? 'rotate-90' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        Insights
                    </button>
                    {showInsights && <StatsOverview jobs={jobs} />}
                </div>

                {/* Filters & Controls Area */}
                <div className="glass-panel rounded-[2rem] p-3 mb-6 sticky top-28 z-40">
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
                        {/* Search Filter */}
                        <div className="flex-1 relative group">
                            <div className="absolute inset-y-0 left-0 flex items-center ps-5 pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                <svg className="w-5 h-5" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                id="table-search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="block w-full p-4 ps-14 text-base text-slate-800 border-none bg-transparent focus:ring-0 placeholder:text-slate-400 font-bold"
                                placeholder="Filter by company, role or location..."
                            />
                        </div>

                        {/* Divider - Desktop only */}
                        <div className="hidden lg:block w-px h-10 bg-slate-200/50 mx-2" />

                        {/* Model Selection */}
                        <div className="flex items-center min-w-[280px]">
                            <Listbox value={selectedModel} onChange={setSelectedModel}>
                                <div className="relative w-full">
                                    <ListboxButton className="cursor-pointer text-sm font-bold text-slate-700
                                        px-6 py-4 w-full rounded-2xl hover:bg-slate-50/50
                                        flex items-center justify-between gap-3
                                        transition-all duration-200">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-100/80 rounded-xl group-hover:bg-white transition-colors">
                                                {models.find(m => m.value === selectedModel)?.icon}
                                            </div>
                                            <span className="truncate">{models.find(m => m.value === selectedModel)?.label}</span>
                                        </div>
                                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                    </ListboxButton>

                                    <ListboxOptions className="absolute right-0 z-50 mt-3 w-full bg-white/95 backdrop-blur-xl rounded-2xl py-3 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 shadow-2xl">
                                        <p className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100/50 mb-2">AI Extraction Model</p>
                                        {models.map((model) => (
                                            <ListboxOption
                                                key={model.value}
                                                value={model.value}
                                                className={({ active }) =>
                                                    `cursor-pointer px-6 py-3.5 flex items-center gap-4 text-sm font-bold transition-all ${active ? 'bg-blue-50/50 text-blue-700' : 'text-slate-600'}`
                                                }
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center p-1.5 shadow-sm">
                                                    {model.icon}
                                                </div>
                                                {model.label}
                                            </ListboxOption>
                                        ))}
                                    </ListboxOptions>
                                </div>
                            </Listbox>
                        </div>
                    </div>
                </div>

                {/* Status chips + view toggle + export */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-2 flex-wrap">
                        {STATUS_FILTERS.map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer
                                    ${statusFilter === status
                                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                                        : 'glass-deep text-slate-600 hover:bg-white/60'}`}
                            >
                                {status}
                                {status !== 'All' && (
                                    <span className={`ml-2 tabular-nums ${statusFilter === status ? 'text-white/60' : 'text-slate-400'}`}>
                                        {jobs.filter((j) => j.status?.toLowerCase() === status.toLowerCase()).length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Export CSV */}
                        <button
                            onClick={() => exportJobsToCsv(filteredJobs)}
                            disabled={filteredJobs.length === 0}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl glass-deep text-xs font-bold text-slate-600 hover:bg-white/60 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Export filtered applications as CSV"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Export
                        </button>

                        {/* View toggle */}
                        <div className="flex items-center gap-1 glass-deep rounded-xl p-1">
                            <button
                                onClick={() => setViewMode('table')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'table' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Table
                            </button>
                            <button
                                onClick={() => setViewMode('board')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'board' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                                </svg>
                                Board
                            </button>
                        </div>
                    </div>
                </div>

                {viewMode === 'table' ? (
                    <div className="glass-panel !rounded-[2.5rem] overflow-hidden min-h-[500px]">
                        <JobsTable
                            jobs={filteredJobs}
                            onEditJob={setEditingJob}
                            onRowClick={setSelectedJob}
                            companyLogos={companyLogos}
                            linkedCompanyNames={companyNames}
                            onLinkCompany={setLinkingJob}
                            onViewCompany={(job) => router.push(`/companies?company=${encodeURIComponent(job.company_name)}`)}
                        />
                    </div>
                ) : (
                    <KanbanBoard
                        jobs={filteredJobs}
                        onEditJob={setSelectedJob}
                        onStageChange={handleStageChange}
                        companyLogos={companyLogos}
                    />
                )}
            </main>

            {showAddPanel && (
                <>
                    <div className="fixed inset-0 backdrop-blur-xl bg-slate-900/20 z-50 animate-in fade-in duration-500" />
                    <AddJobPanel
                        onClose={() => {
                            fetchJobs();
                            setShowAddPanel(false)
                        }}
                        model={selectedModel}
                    />
                </>
            )}

            {linkingJob && user && (
                <LinkCompanyModal
                    job={linkingJob}
                    userId={user.id}
                    onClose={() => setLinkingJob(null)}
                    onLinked={() => {
                        setLinkingJob(null);
                        setSelectedJob(null);
                        toast("Application linked to company");
                        fetchJobs();
                        fetchCompanyNames();
                    }}
                />
            )}

            <JobDetailPanel
                job={selectedJob}
                onClose={() => setSelectedJob(null)}
                onEdit={(job) => {
                    setSelectedJob(null);
                    setEditingJob(job);
                }}
                companyLinked={selectedJob ? companyNames.has(selectedJob.company_name) : false}
                companyLogo={selectedJob ? companyLogos[selectedJob.company_name] ?? null : null}
                onViewCompany={(job) => router.push(`/companies?company=${encodeURIComponent(job.company_name)}`)}
                onLinkCompany={(job) => {
                    setSelectedJob(null);
                    setLinkingJob(job);
                }}
            />

            {editingJob && (
                <>
                    <div className="fixed inset-0 backdrop-blur-2xl bg-slate-900/40 z-50 animate-in fade-in duration-500" />
                    <EditJobPanel
                        job={editingJob}
                        onClose={() => setEditingJob(null)}
                        onSave={handleUpdateJob}
                        onDelete={handleDeleteJob}
                    />
                </>
            )}
        </div>
    );
}
