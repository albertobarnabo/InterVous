'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

import TopBar from '@/components/TopBar';
import EditJobPanel from '@/components/EditJobPanel';
import JobsTable from '@/components/JobsTable';
import AddJobPanel from '@/components/AddJobPanel';

import { useAuth } from '../../../contexts/AuthContext';

import { getJobsByUser, updateJob, deleteJob } from '../../../lib/jobService';
import { getKeysByUser } from '../../../lib/keyService';

import { ApiKeys, JobEntry } from '../../../lib/types';

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

export default function DashboardPage() {

    const { user } = useAuth();
    const router = useRouter();
    const [jobs, setJobs] = useState<JobEntry[]>([]);
    const [keys, setKeys] = useState<ApiKeys | null>(null);
    const [selectedModel, setSelectedModel] = useState("gpt-3.5-turbo");

    // Panels
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [editingJob, setEditingJob] = useState<JobEntry | null>(null);

    const handleUpdateJob = async (updatedJob: JobEntry) => {
        if (!user) return;
        try {
            await updateJob(updatedJob, user.id);
            setEditingJob(null);
            fetchJobs();
        } catch (error) {
            console.error("Failed to update job:", error);
        }
    };

    const handleDeleteJob = async (id: number) => {
        if (!user) return;
        try {
            await deleteJob(id, user.id);
            setEditingJob(null);
            fetchJobs();
        } catch (error) {
            console.error("Failed to delete job:", error);
        }
    };

    const [searchQuery, setSearchQuery] = useState('');

    const filteredJobs = jobs.filter(job =>
        job.company_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const fetchJobs = useCallback(async () => {
        if (!user) return;
        try {
            const data = await getJobsByUser(user.id);
            setJobs(data || []);
        } catch (error) {
            console.log("Error retrieving jobs", error);
        }
    }, [user]);

    const fetchKeys = useCallback(async () => {
        if (!user) return;
        try {
            const keys = await getKeysByUser(user.id);
            setKeys(keys || null);
        } catch (error) {
            console.log("Error retrieving api keys", error);
        }
    }, [user]);

    useEffect(() => {
        if (!user) {
            router.push("/login");
            return;
        }
        fetchJobs();
        fetchKeys();
    }, [user, router, fetchJobs, fetchKeys]);


    return (
        <div className="min-h-screen relative overflow-x-hidden">
            {/* Liquid Background Blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-400/20 rounded-full blur-[120px] mix-blend-multiply animate-pulse" />
                <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-purple-400/20 rounded-full blur-[120px] mix-blend-multiply animate-pulse delay-1000" />
                <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[60%] bg-cyan-400/20 rounded-full blur-[120px] mix-blend-multiply animate-pulse delay-2000" />
            </div>

            <TopBar keys={keys} />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                    <div>
                        <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-none mb-4">
                            Track your next <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">Career Move</span>
                        </h1>
                        <p className="text-slate-600 text-xl max-w-2xl font-medium leading-relaxed">
                            Keep all your job applications organized and add new jobs quickly.
                        </p>
                    </div>

                    <button
                        onClick={() => setShowAddPanel(true)}
                        className='bg-slate-900 hover:bg-slate-800 text-white font-bold px-8 py-4 rounded-2xl cursor-pointer shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-3 ring-1 ring-white/20'
                    >
                        <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                        </div>
                        Add Application
                    </button>
                </div>

                {/* Filters & Controls Area */}
                <div className="glass-panel rounded-[2rem] p-3 mb-10 sticky top-24 z-40">
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
                                placeholder="Quickly filter by company..."
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

                                    <ListboxOptions className="absolute right-0 z-50 mt-3 w-full glass-panel rounded-2xl py-3 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 shadow-2xl">
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

                <div className="glass-panel !rounded-[2.5rem] overflow-hidden min-h-[500px]">
                    <JobsTable jobs={filteredJobs} onEditJob={setEditingJob} />
                </div>
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
                        keys={keys}
                    />
                </>
            )}

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
