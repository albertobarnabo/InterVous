
import React, { useState, useEffect } from 'react';
import { useAuth } from "../../../../contexts/AuthContext";
import { createCompany, getCompanyTags, updateCompany } from '../../../../lib/backend/companies';
import { CompanyTag, CompanyWithTags } from '../../../../lib/types';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';

interface AddCompanyModalProps {
    onClose: () => void;
    onSuccess: () => void;
    initialData?: CompanyWithTags | null;
}

export default function AddCompanyModal({ onClose, onSuccess, initialData }: AddCompanyModalProps) {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [website, setWebsite] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [availableTags, setAvailableTags] = useState<CompanyTag[]>([]);
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');


    // New tag creation
    // const [newTagName, setNewTagName] = useState('');
    // const [isCreatingTag, setIsCreatingTag] = useState(false);

    useEffect(() => {
        loadTags();
        if (initialData) {
            setName(initialData.name);
            setWebsite(initialData.website || '');
            setLogoUrl(initialData.logo_url || '');
            setSelectedTagIds(initialData.tags.map(t => t.id));
        }
    }, [initialData]);

    const loadTags = async () => {
        try {
            const tags = await getCompanyTags();
            setAvailableTags(tags);
        } catch (err) {
            console.error("Failed to load tags", err);
        }
    };

    const handleSubmit = async () => {
        if (!user) return;
        setLoading(true);
        setError('');

        try {
            if (initialData) {
                 await updateCompany(initialData.id, {
                    name,
                    website: website || null,
                    logo_url: logoUrl || null,
                }, selectedTagIds);
            } else {
                await createCompany({
                    name,
                    website: website || null,
                    logo_url: logoUrl || null,
                }, selectedTagIds, user.id);
            }
            onSuccess();
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError(String(err));
            }
        } finally {
            setLoading(false);
        }
    };

    const toggleTag = (tagId: string) => {
        setSelectedTagIds(prev => 
            prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
        );
    };

    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/10 backdrop-blur-sm">
             <div className="flex min-h-full items-center justify-center p-4 md:p-6 text-center">
                <div className="w-full max-w-2xl shadow-[0_40px_100px_rgba(37,99,235,0.15)] relative animate-in zoom-in-95 duration-300 text-left">
                     {/* Background & Decor Container (Clipped) */}
                    <div className="absolute inset-0 rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden border border-white bg-white/95 backdrop-blur-3xl">
                         <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100/50 rounded-full blur-[80px] -mr-20 -mt-20" />
                         <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-100/40 rounded-full blur-[60px] -ml-10 -mb-10" />
                    </div>

                    <div className="relative z-10 p-7 md:p-12">
                        <header className="mb-8">
                            <div className="flex items-center gap-5 mb-6">
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-[0_10px_25px_rgba(37,99,235,0.3)] transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">{initialData ? 'Edit Company' : 'Add Company'}</h2>
                                    <p className="text-slate-500 font-medium text-sm mt-1">{initialData ? 'Update company details' : 'Add a new company to your database'}</p>
                                </div>
                            </div>
                        </header>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Company Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Acme Inc."
                                    className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.8rem] px-6 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-400 transition-all placeholder:text-slate-300"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Website URL</label>
                                    <input
                                        type="text"
                                        value={website}
                                        onChange={(e) => setWebsite(e.target.value)}
                                        placeholder="https://acme.com"
                                        className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.8rem] px-6 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-400 transition-all placeholder:text-slate-300"
                                    />
                                </div>
                                <div className="space-y-2">
                                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Logo URL</label>
                                    <input
                                        type="text"
                                        value={logoUrl}
                                        onChange={(e) => setLogoUrl(e.target.value)}
                                        placeholder="https://acme.com/logo.png"
                                        className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.8rem] px-6 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-400 transition-all placeholder:text-slate-300"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Tags</label>
                                    <Listbox value={selectedTagIds} onChange={setSelectedTagIds} multiple>
                                        <div className="relative w-full">
                                            <ListboxButton className="cursor-pointer text-sm font-bold text-slate-700 
                                                px-6 py-4 w-full bg-slate-50/50 border border-slate-100 rounded-[1.8rem] hover:bg-slate-100
                                                flex items-center justify-between gap-3 text-left
                                                transition-all duration-200">
                                                <span className="truncate block">
                                                    {selectedTagIds.length > 0 
                                                        ? `${selectedTagIds.length} tags selected` 
                                                        : "Select tags..."}
                                                </span>
                                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                            </ListboxButton>

                                            <ListboxOptions className="absolute w-full z-50 mt-2 bg-white border border-slate-100 rounded-[1.8rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 max-h-60 overflow-y-auto">
                                                {availableTags.map((tag) => (
                                                    <ListboxOption
                                                        key={tag.id}
                                                        value={tag.id}
                                                        className={({ active, selected }) =>
                                                            `cursor-pointer px-6 py-3 flex items-center justify-between text-sm font-bold transition-all ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'}`
                                                        }
                                                    >
                                                        {({ selected }) => (
                                                            <>
                                                                <span className={selected ? 'text-indigo-600' : ''}>{tag.name}</span>
                                                                {selected && (
                                                                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                                                )}
                                                            </>
                                                        )}
                                                    </ListboxOption>
                                                ))}
                                                 {availableTags.length === 0 && (
                                                    <div className="px-6 py-3 text-sm text-slate-400 italic">No tags available</div>
                                                )}
                                            </ListboxOptions>
                                        </div>
                                    </Listbox>
                                </div>
                                
                                {/* Selected Tags Pills */}
                                {selectedTagIds.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {selectedTagIds.map(id => {
                                            const tag = availableTags.find(t => t.id === id);
                                            if (!tag) return null;
                                            return (
                                                <span 
                                                    key={id} 
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-[11px] font-black uppercase tracking-wide border border-blue-100"
                                                >
                                                    {tag.name}
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleTag(id);
                                                        }}
                                                        className="hover:text-blue-800 transition-colors"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}

                            {error && (
                                <div className="bg-rose-50 border border-rose-100 text-rose-600 text-[11px] font-black py-4 px-6 rounded-[1.5rem] flex items-center gap-3 animate-in slide-in-from-bottom-2">
                                    <div className="p-1.5 bg-rose-100 rounded-lg">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    </div>
                                    {error}
                                </div>
                            )}

                             <div className="flex gap-4 pt-4">
                                <button
                                    onClick={onClose}
                                    className="cursor-pointer flex-1 bg-slate-100 text-slate-500 px-8 py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-200 transition-all active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || !name}
                                    className="cursor-pointer flex-[2] bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white px-8 py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-[0.2em] shadow-[0_15px_30px_rgba(37,99,235,0.25)] hover:shadow-[0_20px_40px_rgba(37,99,235,0.35)] transition-all transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 min-w-[200px]"
                                >
                                    {loading ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                                            <span>{initialData ? 'Update Company' : 'Add Company'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
