
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import TopBar from '@/components/TopBar';
import { useAuth } from '../../../contexts/AuthContext';
import { getCompanies, getCompanyTags } from '../../../lib/backend/companies';
import { getKeysByUser } from '../../../lib/keyService';
import { CompanyWithTags, CompanyTag, ApiKeys } from '../../../lib/types';
import CompanyCard from './components/CompanyCard';
import AddCompanyModal from './components/AddCompanyModal';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';

export default function CompaniesPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [companies, setCompanies] = useState<CompanyWithTags[]>([]);
    const [allTags, setAllTags] = useState<CompanyTag[]>([]);
    const [keys, setKeys] = useState<ApiKeys | null>(null);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingCompany, setEditingCompany] = useState<CompanyWithTags | null>(null);

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [companiesData, tagsData, keysData] = await Promise.all([
                getCompanies(),
                getCompanyTags(),
                getKeysByUser(user.id)
            ]);
            setCompanies(companiesData);
            setAllTags(tagsData);
            setKeys(keysData || null);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) {
            // router.push("/login"); // AuthContext handles redirect or we should checks
             // For now assuming AuthContext or layout protection. 
             // But valid to check.
             return;
        }
        fetchData();
    }, [user, fetchData]);

    const filteredCompanies = useMemo(() => {
        return companies.filter(company => {
            const matchesSearch = company.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesTag = selectedTagId 
                ? company.tags.some(tag => tag.id === selectedTagId)
                : true;
            return matchesSearch && matchesTag;
        });
    }, [companies, searchQuery, selectedTagId]);

    const handleAddSuccess = () => {
        setShowAddModal(false);
        setEditingCompany(null);
        fetchData();
    };

    const handleEdit = (company: CompanyWithTags) => {
        setEditingCompany(company);
        setShowAddModal(true);
    };

    if (!user) return null; // or loading spinner

    return (
        <div className="min-h-screen bg-slate-50 relative overflow-hidden">
             {/* Background decorative elements */}
            <div className="absolute top-0 left-1/4 w-[50%] h-[50%] bg-blue-200/30 rounded-full blur-[120px] -z-10" />
            <div className="absolute bottom-0 right-1/4 w-[40%] h-[40%] bg-indigo-200/30 rounded-full blur-[100px] -z-10" />
            <div className="absolute top-1/2 left-0 w-[30%] h-[30%] bg-cyan-200/20 rounded-full blur-[80px] -z-10" />

            <TopBar keys={keys} />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                            Global <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-500 bg-clip-text text-transparent">Companies</span>
                        </h1>
                        <p className="text-slate-500 mt-4 text-lg max-w-lg font-medium">
                            Explore and manage the database of companies worldwide.
                        </p>
                    </div>

                    <button
                        onClick={() => {
                            setEditingCompany(null);
                            setShowAddModal(true);
                        }}
                        className='bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white font-black px-8 py-4 rounded-2xl cursor-pointer shadow-[0_15px_30px_rgba(37,99,235,0.25)] hover:shadow-[0_20px_40px_rgba(37,99,235,0.35)] transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-3'
                    >
                        <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                        </div>
                        Add Company
                    </button>
                </div>

                {/* Filters & Controls Area */}
                <div className="bg-white/70 rounded-[2.5rem] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white p-2 mb-10 sticky top-20 z-40 backdrop-blur-2xl">
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
                        {/* Search Filter */}
                        <div className="flex-1 relative group">
                            <div className="absolute inset-y-0 left-0 flex items-center ps-5 pointer-events-none text-blue-500/50 group-focus-within:text-blue-600 transition-colors">
                                <svg className="w-5 h-5" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="block w-full p-4 ps-14 text-sm text-slate-900 border-none bg-transparent focus:ring-0 placeholder:text-slate-400 font-bold"
                                placeholder="Search companies..."
                            />
                        </div>

                         {/* Divider - Desktop only */}
                         <div className="hidden lg:block w-px h-10 bg-slate-100 mx-2" />

                        {/* Tag Filter */}
                         <div className="flex items-center min-w-[240px]">
                            <Listbox value={selectedTagId} onChange={setSelectedTagId}>
                                <div className="relative w-full">
                                    <ListboxButton className="cursor-pointer text-sm font-black text-slate-700 
                                        px-6 py-4 w-full rounded-[1.8rem] hover:bg-slate-50
                                        flex items-center justify-between gap-3
                                        transition-all duration-200">
                                        <span className="truncate">
                                            {selectedTagId ? allTags.find(t => t.id === selectedTagId)?.name : "Filter by Tag"}
                                        </span>
                                        <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                    </ListboxButton>

                                    <ListboxOptions className="absolute right-0 z-50 mt-3 w-full bg-white border border-slate-100 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] py-3 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 max-h-60 overflow-y-auto">
                                        <ListboxOption
                                            value={null}
                                            className={({ active }) =>
                                                `cursor-pointer px-6 py-3.5 flex items-center gap-4 text-sm font-bold transition-all ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'}`
                                            }
                                        >
                                            All Tags
                                        </ListboxOption>
                                        {allTags.map((tag) => (
                                            <ListboxOption
                                                key={tag.id}
                                                value={tag.id}
                                                className={({ active }) =>
                                                    `cursor-pointer px-6 py-3.5 flex items-center gap-4 text-sm font-bold transition-all ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'}`
                                                }
                                            >
                                                {tag.name}
                                            </ListboxOption>
                                        ))}
                                    </ListboxOptions>
                                </div>
                            </Listbox>
                        </div>
                    </div>
                </div>

                {/* Companies Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="h-48 bg-white/40 rounded-[2rem] border border-white/50"></div>
                        ))}
                    </div>
                ) : filteredCompanies.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {filteredCompanies.map((company) => (
                            <CompanyCard key={company.id} company={company} onEdit={handleEdit} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </div>
                        <h3 className="text-xl font-black text-slate-800">No companies found</h3>
                        <p className="text-slate-500 mt-2">Try adjusting your filters or add a new company.</p>
                    </div>
                )}
            </main>

            {showAddModal && (
                <AddCompanyModal 
                    onClose={() => {
                        setShowAddModal(false);
                        setEditingCompany(null);
                    }} 
                    onSuccess={handleAddSuccess}
                    initialData={editingCompany}
                />
            )}
        </div>
    );
}
