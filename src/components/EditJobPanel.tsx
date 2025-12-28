// components/EditJobPanel.tsx
'use client';

import { useState } from 'react';
import { JobEntry } from '../../lib/types';

interface EditJobPanelProps {
    job: JobEntry | null;
    onClose: () => void;
    onSave: (updatedJob: JobEntry) => void;
    onDelete: (id: number) => void;
}

type FormField = keyof Pick<JobEntry,
    "company_name" | "role" | "location" | "application_date" | "status" | "stage" | "url"
>;

export default function EditJobPanel({ job, onClose, onSave, onDelete }: EditJobPanelProps) {
    const [formData, setFormData] = useState({ ...job });

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }

    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/20 backdrop-blur-sm">
            <div className="flex min-h-full items-center justify-center p-4 md:p-6 text-center">
                <div className="w-full max-w-2xl backdrop-blur-3xl bg-white/95 rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_40px_100px_rgba(37,99,235,0.15)] border border-white p-7 md:p-12 relative overflow-hidden animate-in zoom-in-95 duration-300 text-left">
                    {/* Decorative background accents */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100/50 rounded-full blur-[80px] -mr-20 -mt-20 -z-10" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-100/40 rounded-full blur-[60px] -ml-10 -mb-10 -z-10" />

                <div className="relative z-10">
                    <header className="mb-10 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-[1.5rem] text-blue-600 mb-4 shadow-inner">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">Master Record</h2>
                        <p className="text-slate-500 font-medium text-sm mt-1">Refine the details of your professional pursuit.</p>
                    </header>

                    <div className="max-h-[45vh] overflow-y-auto px-2 space-y-6 custom-scrollbar mb-10">
                        {["company_name", "role", "location", "application_date", "status", "stage", "url"].map((field) => {
                            const key = field as FormField;

                            return (
                                <div key={field} className="space-y-2 group">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 group-focus-within:text-blue-600 transition-colors">
                                        {field.replace(/_/g, ' ')}
                                    </label>

                                    {field === "status" ? (
                                        <div className="relative">
                                            <select
                                                name={key}
                                                value={formData[field] ?? ''}
                                                onChange={handleChange}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] px-6 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-400 appearance-none cursor-pointer transition-all"
                                            >
                                                <option value="Active">Active</option>
                                                <option value="Not Applied">Not Applied</option>
                                                <option value="Inactive">Inactive</option>
                                            </select>
                                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            name={field}
                                            value={formData[key] ?? ''}
                                            onChange={handleChange}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] px-6 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-400 transition-all placeholder:text-slate-300"
                                            placeholder={`Enter ${field.replace(/_/g, ' ')}...`}
                                        />
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                        <button
                            className="cursor-pointer w-full sm:w-auto px-8 py-4 text-[10px] font-black text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all duration-300 uppercase tracking-[0.2em] border border-transparent hover:border-rose-100"
                            onClick={() => onDelete(job ? job.id : 0)}
                        >
                            Delete Position
                        </button>
                        
                        <div className="flex gap-4 w-full sm:w-auto">
                            <button
                                className="cursor-pointer flex-1 sm:flex-none bg-slate-100 text-slate-500 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-200 transition-all active:scale-95"
                                onClick={onClose}
                            >
                                Cancel
                            </button>
                            <button
                                className="cursor-pointer flex-[2] sm:flex-none bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white px-10 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_15px_30px_rgba(37,99,235,0.25)] hover:shadow-[0_20px_40px_rgba(37,99,235,0.35)] transition-all transform hover:-translate-y-1 active:scale-95 whitespace-nowrap"
                                onClick={() => onSave(formData as JobEntry)}
                            >
                                Update
                            </button>
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
