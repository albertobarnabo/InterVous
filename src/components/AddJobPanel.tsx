'use client';

import { useState } from 'react';
import { useAuth } from "../../contexts/AuthContext";
import { createJob } from '../../lib/jobService';
import { supabase } from '../../lib/supbaseClient';
import { useToast } from './Toast';

interface AddJobPanelProps {
    onClose: () => void;
    model: string;
}

const STATUSES = ["Active", "Not Applied", "Inactive"];
const STAGES = [
    "Screening",
    "Coding Assessment",
    "Video Interview",
    "HR Interview",
    "Technical Interview",
    "Final Round",
];

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

const inputClasses =
    "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-blue-400 transition-all placeholder:text-slate-300";

export default function AddJobPanel({ onClose, model }: AddJobPanelProps) {
    const [mode, setMode] = useState<'link' | 'manual'>('link');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Link mode
    const [url, setUrl] = useState('');
    const [applied, setApplied] = useState(true);

    // Manual mode
    const [manual, setManual] = useState({
        company_name: '',
        role: '',
        location: '',
        application_date: today(),
        status: 'Active',
        stage: 'Screening',
        url: '',
    });

    const { user } = useAuth();
    const { toast } = useToast();

    const handleExtract = async () => {
        setError('');
        setLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setError("You must be signed in to add an application.");
                return;
            }

            const res = await fetch('/intervous/api/scrape-job/', {
                method: 'POST',
                body: JSON.stringify({ url, applied, model }),
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
            });

            if (!res.ok) {
                const errorText = await res.text();
                setError(errorText);
                return;
            }

            const data = await res.json();

            if (!user) {
                setError("You must be signed in to add an application.");
                return;
            }

            await createJob({ ...data.fullJobEntry, user_id: user.id });
            toast(`Added ${data.fullJobEntry.company_name} — ${data.fullJobEntry.role}`);
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    const handleManualSubmit = async () => {
        if (!user) {
            setError("You must be signed in to add an application.");
            return;
        }
        setError('');
        setLoading(true);
        try {
            await createJob({
                company_name: manual.company_name.trim(),
                role: manual.role.trim(),
                location: manual.location.trim(),
                application_date: manual.application_date || null,
                status: manual.status,
                stage: manual.stage,
                url: manual.url.trim(),
                user_id: user.id,
            });
            toast(`Added ${manual.company_name.trim()} — ${manual.role.trim()}`);
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    const manualValid = manual.company_name.trim() && manual.role.trim();

    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/20 backdrop-blur-md">
            <div className="flex min-h-full items-center justify-center p-4 md:p-6">
                <div className="w-full max-w-xl glass-panel !bg-white/95 relative animate-in zoom-in-95 duration-300 text-left rounded-[2rem] shadow-2xl overflow-hidden">

                    {/* Header */}
                    <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight">Add Application</h2>
                                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                                    {mode === 'link' ? 'Paste a job link — AI fills in the details' : 'Type the details yourself'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="Close"
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="px-7 py-5 space-y-5">
                        {/* Mode toggle */}
                        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                            <button
                                onClick={() => { setMode('link'); setError(''); }}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    mode === 'link' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                From Link
                            </button>
                            <button
                                onClick={() => { setMode('manual'); setError(''); }}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    mode === 'manual' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                Manual
                            </button>
                        </div>

                        {mode === 'link' ? (
                            <>
                                {/* URL input */}
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                                        Job posting URL
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            placeholder="https://linkedin.com/jobs/view/..."
                                            className={`${inputClasses} pr-11`}
                                        />
                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                {/* Applied toggle */}
                                <button
                                    type="button"
                                    className="w-full flex items-center gap-3 bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100/60 hover:bg-indigo-50 transition-colors cursor-pointer text-left"
                                    onClick={() => setApplied(!applied)}
                                >
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 shrink-0 ${
                                        applied
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/30'
                                            : 'bg-white border-slate-200'
                                    }`}>
                                        {applied && (
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                    <div>
                                        <span className="block text-sm font-bold text-slate-800">Already submitted</span>
                                        <span className="text-[10px] font-semibold text-slate-400">
                                            Sets today as the application date
                                        </span>
                                    </div>
                                </button>

                                <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 px-1">
                                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Extraction uses the AI model selected on the dashboard — make sure its key is set in Configs.
                                </p>
                            </>
                        ) : (
                            <div className="space-y-3.5">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                                            Company <span className="text-rose-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={manual.company_name}
                                            onChange={(e) => setManual((m) => ({ ...m, company_name: e.target.value }))}
                                            placeholder="Acme Inc."
                                            className={inputClasses}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                                            Role <span className="text-rose-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={manual.role}
                                            onChange={(e) => setManual((m) => ({ ...m, role: e.target.value }))}
                                            placeholder="Software Engineer"
                                            className={inputClasses}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Location</label>
                                        <input
                                            type="text"
                                            value={manual.location}
                                            onChange={(e) => setManual((m) => ({ ...m, location: e.target.value }))}
                                            placeholder="Berlin, Germany"
                                            className={inputClasses}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Applied on</label>
                                        <input
                                            type="date"
                                            value={manual.application_date}
                                            onChange={(e) => setManual((m) => ({ ...m, application_date: e.target.value }))}
                                            className={inputClasses}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Status</label>
                                        <select
                                            value={manual.status}
                                            onChange={(e) => setManual((m) => ({ ...m, status: e.target.value }))}
                                            className={`${inputClasses} cursor-pointer`}
                                        >
                                            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Stage</label>
                                        <select
                                            value={manual.stage}
                                            onChange={(e) => setManual((m) => ({ ...m, stage: e.target.value }))}
                                            className={`${inputClasses} cursor-pointer`}
                                        >
                                            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                                        Job URL <span className="normal-case font-semibold text-slate-300">(optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={manual.url}
                                        onChange={(e) => setManual((m) => ({ ...m, url: e.target.value }))}
                                        placeholder="https://..."
                                        className={inputClasses}
                                    />
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold py-3 px-4 rounded-xl flex items-center gap-2.5 animate-in slide-in-from-bottom-2">
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-2 px-7 py-4 bg-slate-50/60 border-t border-slate-100">
                        <button
                            onClick={onClose}
                            className="cursor-pointer px-5 py-2.5 rounded-xl text-xs font-black text-slate-500 hover:bg-slate-100 uppercase tracking-widest transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={mode === 'link' ? handleExtract : handleManualSubmit}
                            disabled={loading || (mode === 'link' ? !url : !manualValid)}
                            className="cursor-pointer px-6 py-2.5 rounded-xl text-xs font-black text-white uppercase tracking-widest bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    {mode === 'link' ? 'Extracting...' : 'Saving...'}
                                </>
                            ) : (
                                <>
                                    {mode === 'link' ? (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                        </svg>
                                    )}
                                    {mode === 'link' ? 'Extract & Add' : 'Add Application'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
