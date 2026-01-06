'use client';

import { useState } from 'react';
import { useAuth } from "../../contexts/AuthContext";
import { ApiKeys } from '../../lib/types';
import { createJob } from '../../lib/jobService';

interface AddJobPanelProps {
    onClose: () => void;
    model: string;
    keys: ApiKeys | null;
}

export default function AddJobPanel({ onClose, model, keys }: AddJobPanelProps) {
    const [url, setUrl] = useState('');
    const [applied, setApplied] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { user } = useAuth();

    const handleSubmit = async () => {
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/intervous/api/scrape-job/', {
                method: 'POST',
                body: JSON.stringify({
                    url: url,
                    applied: applied,
                    model: model,
                    keys: keys
                }),
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) {
                const errorText = await res.text();
                setError(errorText);
                return;
            }

            const data = await res.json()

            const job = { ...data.fullJobEntry, user_id: user.id }

            try {
                await createJob(job);
            } catch (error) {
                console.error("Failed to insert job:", error);
            }

            onClose(); // Close panel on success
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

    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/10 backdrop-blur-sm">
            <div className="flex min-h-full items-center justify-center p-4 md:p-6 text-center">
                <div className="w-full max-w-2xl backdrop-blur-3xl bg-white/95 rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_40px_100px_rgba(37,99,235,0.15)] border border-white p-7 md:p-12 relative overflow-hidden animate-in zoom-in-95 duration-300 text-left">
                    {/* Decorative background accents */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100/50 rounded-full blur-[80px] -mr-20 -mt-20 -z-10" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-100/40 rounded-full blur-[60px] -ml-10 -mb-10 -z-10" />

                <div className="relative z-10">
                    <header className="mb-10">
                        <div className="flex items-center gap-5 mb-6">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-[0_10px_25px_rgba(37,99,235,0.3)] transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">Add New Job</h2>
                                <p className="text-slate-500 font-medium text-sm mt-1">Paste the link of the job application to proceed</p>
                            </div>
                        </div>
                    </header>

                    <div className="space-y-8">
                        <div className="space-y-4">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Job Application URL</label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://linkedin.com/jobs/view/..."
                                    className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.8rem] px-8 py-5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-400 transition-all placeholder:text-slate-300"
                                />
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 text-blue-500/50 group-focus-within:text-blue-500 transition-colors">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 bg-indigo-50/30 p-5 rounded-[1.8rem] border border-indigo-50 group hover:bg-indigo-50/50 transition-colors cursor-pointer" onClick={() => setApplied(!applied)}>
                            <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${applied ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110' : 'bg-white border-slate-200'}`}>
                                {applied && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <div>
                                <span className="block text-sm font-black text-slate-800">Already Submitted?</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Toggle if you have already applied to this role</span>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-rose-50 border border-rose-100 text-rose-600 text-[11px] font-black py-4 px-6 rounded-[1.5rem] flex items-center gap-3 animate-in slide-in-from-bottom-2">
                                <div className="p-1.5 bg-rose-100 rounded-lg">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                </div>
                                {error}
                            </div>
                        )}

                        <div className="flex gap-4 pt-6">
                            <button
                                onClick={onClose}
                                className="cursor-pointer flex-1 bg-slate-100 text-slate-500 px-8 py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-200 transition-all active:scale-95"
                            >
                                Not Now
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading || !url}
                                className="cursor-pointer flex-[2] bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white px-8 py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-[0.2em] shadow-[0_15px_30px_rgba(37,99,235,0.25)] hover:shadow-[0_20px_40px_rgba(37,99,235,0.35)] transition-all transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 min-w-[200px]"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Extracting...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        <span>Extract Job Details</span>
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
