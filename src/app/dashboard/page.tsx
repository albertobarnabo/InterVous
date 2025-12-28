'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

import TopBar from '@/components/TopBar';
import JobsTable from '@/components/JobsTable';
import AddJobPanel from '@/components/AddJobPanel';

import { useAuth } from '../../../contexts/AuthContext';

import { getJobsByUser } from '../../../lib/jobService';
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
    }, [user?.id]);

    const fetchKeys = useCallback(async () => {
        if (!user) return;
        try {
            const keys = await getKeysByUser(user.id);
            setKeys(keys || null);
        } catch (error) {
            console.log("Error retrieving api keys", error);
        }
    }, [user?.id]);

    useEffect(() => {
        if (!user) {
            router.push("/login");
            return;
        }
        fetchJobs();
        fetchKeys();
    }, [user, router, fetchJobs, fetchKeys]);


    return (
        <div>
            <TopBar keys={keys} />

            <div className="flex justify-center mt-6">
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    {/* Top Controls */}
                    <div className="w-full flex items-center justify-between pb-4 flex-wrap gap-4">
                        {/* Add a new job button */}
                        <div className="flex-1 flex justify-start">
                            <button
                                onClick={() => setShowAddPanel(true)}
                                className='ml-4 bg-gradient-to-r from-blue-200 to-cyan-200 text-gray-700 font-bold px-5 py-2 rounded-full cursor-pointer'>
                                Add a New Job
                            </button>
                        </div>
                        {/* Model Selection */}
                        <div className="flex-1 flex justify-center">
                            <div className="text-center">

                                <Listbox value={selectedModel} onChange={setSelectedModel}>
                                    <div className="relative w-[280px] sm:w-[400px]">
                                        <ListboxButton className="cursor-pointer text-lg font-semibold text-gray-800 
          px-5 py-2 w-full rounded-xl border-4 bg-white 
          flex items-center justify-center gap-3
          border-gradient border-gradient-futuristic
          focus:outline-none transition-all duration-300">
                                            {models.find(m => m.value === selectedModel)?.icon}
                                            {models.find(m => m.value === selectedModel)?.label}
                                        </ListboxButton>

                                        <ListboxOptions className="text-gray-700 justify-center absolute z-10 mt-2 w-full bg-white border border-gray-300 rounded-xl shadow-md">
                                            {models.map((model) => (
                                                <ListboxOption
                                                    key={model.value}
                                                    value={model.value}
                                                    className={({ active }) =>
                                                        `cursor-pointer px-4 py-2 flex items-center gap-3 ${active ? 'bg-blue-100' : ''
                                                        }`
                                                    }
                                                >
                                                    {model.icon}
                                                    {model.label}
                                                </ListboxOption>
                                            ))}
                                        </ListboxOptions>
                                    </div>
                                </Listbox>
                            </div>
                        </div>

                        {/* Search Filter */}
                        <div className="flex-1 flex justify-end mr-4">
                            <label htmlFor="table-search" className="sr-only">Search</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 flex items-center ps-3 pointer-events-none">
                                    <svg
                                        className="w-5 h-5 text-gray-700"
                                        aria-hidden="true"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    id="table-search"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="block p-2 ps-10 text-m text-gray-900 border border-gray-300 rounded-lg w-50 bg-gradient-to-r from-blue-200 to-cyan-200 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Filter companies"
                                />
                            </div>
                        </div>
                    </div>
                    <JobsTable jobs={filteredJobs} fetchJobs={fetchJobs} />
                </div>
            </div>

            {showAddPanel && (
                <>
                    {/* Background blur layer */}
                    <div className="fixed inset-0 backdrop-blur-sm z-20" />
                    {/* Panel */}
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

        </div>
    );
}
