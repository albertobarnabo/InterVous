
import React, { useState, useEffect } from 'react';
import { useAuth } from "../../../../contexts/AuthContext";
import { createCompany, createCompanyTag, getCompanyTags, updateCompany, updateCompanyTag, deleteCompanyTag } from '../../../../lib/backend/companies';
import { CompanyTag, CompanyWithTags } from '../../../../lib/types';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { useToast } from '@/components/Toast';

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
    const [newTagName, setNewTagName] = useState('');
    const [isCreatingTag, setIsCreatingTag] = useState(false);
    const [manageTags, setManageTags] = useState(false);
    const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
    const [busyTagId, setBusyTagId] = useState<string | null>(null);
    const { toast } = useToast();

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
            toast(initialData ? `${name} updated` : `${name} added to companies`);
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

    const handleCreateTag = async () => {
        const trimmed = newTagName.trim();
        if (!trimmed) return;
        setIsCreatingTag(true);
        try {
            const newTag = await createCompanyTag(trimmed, null);
            setAvailableTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
            setSelectedTagIds(prev => [...prev, newTag.id]);
            setNewTagName('');
        } catch (err) {
            console.error('Failed to create tag', err);
        } finally {
            setIsCreatingTag(false);
        }
    };

    const handleRenameTag = async (tag: CompanyTag) => {
        const draft = (tagDrafts[tag.id] ?? tag.name).trim();
        if (!draft || draft === tag.name) return;
        setBusyTagId(tag.id);
        try {
            const updated = await updateCompanyTag(tag.id, draft);
            setAvailableTags(prev =>
                prev.map(t => (t.id === tag.id ? updated : t)).sort((a, b) => a.name.localeCompare(b.name))
            );
            toast(`Tag renamed to "${draft}"`);
        } catch (err) {
            console.error('Failed to rename tag', err);
            toast('Failed to rename tag', 'error');
        } finally {
            setBusyTagId(null);
        }
    };

    const handleDeleteTag = async (tag: CompanyTag) => {
        if (!window.confirm(`Delete tag "${tag.name}"? It will be removed from all companies.`)) return;
        setBusyTagId(tag.id);
        try {
            await deleteCompanyTag(tag.id);
            setAvailableTags(prev => prev.filter(t => t.id !== tag.id));
            setSelectedTagIds(prev => prev.filter(id => id !== tag.id));
            toast(`Tag "${tag.name}" deleted`);
        } catch (err) {
            console.error('Failed to delete tag', err);
            toast('Failed to delete tag', 'error');
        } finally {
            setBusyTagId(null);
        }
    };

    const toggleTag = (tagId: string) => {
        setSelectedTagIds(prev => 
            prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
        );
    };

    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/20 backdrop-blur-md">
             <div className="flex min-h-full items-center justify-center p-4 md:p-6 text-center">
                <div className="w-full max-w-2xl glass-panel !bg-white/90 relative animate-in zoom-in-95 duration-300 text-left rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl">
                     {/* Decorative background accents inside modal */}
                     <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100/50 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none" />
                     <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-100/40 rounded-full blur-[60px] -ml-10 -mb-10 pointer-events-none" />

                    <div className="relative z-10 p-6 md:p-8 lg:p-14">
                        <header className="mb-8 md:mb-10">
                            <div className="flex items-center gap-4 md:gap-6 mb-6 md:mb-8">
                                <div className="w-14 h-14 md:w-20 md:h-20 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center text-white shadow-xl shadow-slate-900/20">
                                    <svg className="w-7 h-7 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                </div>
                                <div>
                                    <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">{initialData ? 'Edit Company' : 'Add Company'}</h2>
                                    <p className="text-slate-500 font-bold text-sm md:text-base mt-1 md:mt-2">{initialData ? 'Update company details' : 'Add a new company to your database'}</p>
                                </div>
                            </div>
                        </header>

                        <div className="space-y-6 md:space-y-8">
                            <div className="space-y-3">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Company Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Acme Inc."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl md:rounded-3xl px-6 py-4 md:px-8 md:py-5 text-sm md:text-base font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500 transition-all placeholder:text-slate-400"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                                <div className="space-y-3">
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Website URL</label>
                                    <input
                                        type="text"
                                        value={website}
                                        onChange={(e) => setWebsite(e.target.value)}
                                        placeholder="https://acme.com"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl md:rounded-3xl px-6 py-4 md:px-8 md:py-5 text-xs md:text-sm font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500 transition-all placeholder:text-slate-400"
                                    />
                                </div>
                                <div className="space-y-3">
                                     <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Logo URL</label>
                                    <input
                                        type="text"
                                        value={logoUrl}
                                        onChange={(e) => setLogoUrl(e.target.value)}
                                        placeholder="https://acme.com/logo.png"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl md:rounded-3xl px-6 py-4 md:px-8 md:py-5 text-xs md:text-sm font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500 transition-all placeholder:text-slate-400"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Tags</label>
                                    <button
                                        type="button"
                                        onClick={() => setManageTags(v => !v)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                                            manageTags
                                                ? 'bg-slate-900 text-white'
                                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                                        }`}
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        </svg>
                                        {manageTags ? 'Done' : 'Manage tags'}
                                    </button>
                                </div>

                                {manageTags && (
                                    <div className="space-y-2 rounded-2xl bg-slate-50/80 border border-slate-200/80 p-3 max-h-56 overflow-y-auto">
                                        {availableTags.length === 0 && (
                                            <p className="text-xs text-slate-400 font-medium text-center py-3">No tags yet</p>
                                        )}
                                        {availableTags.map((tag) => (
                                            <div key={tag.id} className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={tagDrafts[tag.id] ?? tag.name}
                                                    onChange={(e) => setTagDrafts(prev => ({ ...prev, [tag.id]: e.target.value }))}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRenameTag(tag); } }}
                                                    disabled={busyTagId === tag.id}
                                                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all disabled:opacity-50"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRenameTag(tag)}
                                                    disabled={busyTagId === tag.id || (tagDrafts[tag.id] ?? tag.name).trim() === tag.name || !(tagDrafts[tag.id] ?? tag.name).trim()}
                                                    title="Save new name"
                                                    className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteTag(tag)}
                                                    disabled={busyTagId === tag.id}
                                                    title="Delete tag"
                                                    className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-30"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                    <Listbox value={selectedTagIds} onChange={setSelectedTagIds} multiple>
                                        <div className="relative w-full">
                                            <ListboxButton className="cursor-pointer text-xs md:text-sm font-bold text-slate-700 
                                                px-6 py-4 md:px-8 md:py-5 w-full bg-slate-50 border border-slate-200 rounded-2xl md:rounded-3xl hover:bg-slate-100
                                                flex items-center justify-between gap-3 text-left
                                                transition-all duration-200">
                                                <span className="truncate block text-slate-900">
                                                    {selectedTagIds.length > 0 
                                                        ? `${selectedTagIds.length} tags selected` 
                                                        : "Select tags..."}
                                                </span>
                                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                            </ListboxButton>

                                            <ListboxOptions className="absolute w-full z-50 mt-3 bg-white border border-slate-100 rounded-[2.5rem] shadow-2xl shadow-blue-900/20 py-3 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 max-h-60 overflow-y-auto">
                                                {availableTags.map((tag) => (
                                                    <ListboxOption
                                                        key={tag.id}
                                                        value={tag.id}
                                                        className={({ active }) =>
                                                            `cursor-pointer px-8 py-3.5 flex items-center justify-between text-sm font-bold transition-all ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600'}`
                                                        }
                                                    >
                                                        {({ selected }) => (
                                                            <>
                                                                <span className={selected ? 'text-blue-600' : ''}>{tag.name}</span>
                                                                {selected && (
                                                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                                                )}
                                                            </>
                                                        )}
                                                    </ListboxOption>
                                                ))}
                                                 {availableTags.length === 0 && (
                                                    <div className="px-8 py-4 text-sm text-slate-400 italic">No tags available</div>
                                                )}
                                            </ListboxOptions>
                                        </div>
                                    </Listbox>
                                </div>
                                
                                {/* Selected Tags Pills */}
                                {selectedTagIds.length > 0 && (
                                    <div className="flex flex-wrap gap-2.5 mt-2 ml-2">
                                        {selectedTagIds.map(id => {
                                            const tag = availableTags.find(t => t.id === id);
                                            if (!tag) return null;
                                            return (
                                                <span 
                                                    key={id} 
                                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-50 text-blue-700 text-xs font-black uppercase tracking-wide border border-blue-100/50"
                                                >
                                                    {tag.name}
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleTag(id);
                                                        }}
                                                        className="hover:text-blue-900 transition-colors"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mt-3">
                                    <input
                                        type="text"
                                        value={newTagName}
                                        onChange={(e) => setNewTagName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateTag(); } }}
                                        placeholder="Create new tag..."
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all placeholder:text-slate-400"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCreateTag}
                                        disabled={!newTagName.trim() || isCreatingTag}
                                        className="shrink-0 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-sm rounded-2xl border border-blue-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                                    >
                                        {isCreatingTag ? (
                                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
                                        )}
                                        Add
                                    </button>
                                </div>

                            {error && (
                                <div className="bg-rose-50 border-2 border-rose-100 text-rose-600 text-xs font-black py-4 px-6 rounded-2xl flex items-center gap-3 animate-in slide-in-from-bottom-2">
                                    <div className="p-1.5 bg-rose-100 rounded-lg">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    </div>
                                    {error}
                                </div>
                            )}

                             <div className="flex flex-col sm:flex-row gap-3 md:gap-4 pt-4 md:pt-6">
                                <button
                                    onClick={onClose}
                                    className="cursor-pointer flex-1 bg-slate-100/80 text-slate-500 px-6 py-4 md:px-8 md:py-5 rounded-2xl md:rounded-3xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-200 transition-all active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || !name}
                                    className="cursor-pointer flex-[2] bg-slate-900 text-white px-6 py-4 md:px-8 md:py-5 rounded-2xl md:rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 hover:shadow-2xl hover:shadow-slate-900/30 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 min-w-0 sm:min-w-[200px]"
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
