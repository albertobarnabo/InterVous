// components/EditJobPanel.tsx
'use client';

import { useState, useEffect } from 'react';
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

    useEffect(() => {
        // Lock body scroll when panel is open
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }

    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/20 backdrop-blur-md">
            <div className="flex min-h-full items-start justify-center p-4 md:p-6 pt-24 text-center">
                <div className="w-full max-w-2xl glass-panel !bg-white/90 relative animate-in zoom-in-95 duration-300 text-left rounded-[3.5rem] shadow-2xl">
                    {/* Decorative background accents */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-400/10 rounded-full blur-[80px] -mr-20 -mt-20 -z-10" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full blur-[60px] -ml-10 -mb-10 -z-10" />

                <div className="relative z-10 p-2">
                    <header className="mb-8 text-center">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">Edit Job</h2>
                    </header>

                    <div className="max-h-[55vh] overflow-y-auto px-4 -mx-2 space-y-6 custom-scrollbar mb-10 pb-4">
                        {["company_name", "role", "location", "application_date", "status", "stage", "url"].map((field) => {
                            const key = field as FormField;

                            return (
                                <div key={field} className="space-y-2 group">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-3 group-focus-within:text-blue-600 transition-colors">
                                        {field.replace(/_/g, ' ')}
                                    </label>

                                    {field === "status" ? (
                                        <CustomSelect
                                            value={formData[field] ?? ''}
                                            options={["Active", "Not Applied", "Inactive"]}
                                            onChange={(val) => setFormData(prev => ({ ...prev, [key]: val }))}
                                        />
                                    ) : field === "stage" ? (
                                        <CustomSelect
                                            value={formData[field] ?? ''}
                                            options={[
                                                "Screening",
                                                "Coding Assessment",
                                                "Video Interview",
                                                "HR Interview",
                                                "Technical Interview",
                                                "Final Round"
                                            ]}
                                            onChange={(val) => setFormData(prev => ({ ...prev, [key]: val }))}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            name={field}
                                            value={formData[key] ?? ''}
                                            onChange={handleChange}
                                            className="w-full bg-slate-50/50 border border-slate-200/60 rounded-[1.5rem] px-6 py-4 text-sm font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500/50 transition-all placeholder:text-slate-300 shadow-sm"
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
                                className="cursor-pointer flex-[2] sm:flex-none bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white px-10 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all transform hover:-translate-y-1 active:scale-95 whitespace-nowrap"
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

function CustomSelect({ value, options, onChange }: { value: string, options: string[], onChange: (val: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="cursor-pointer w-full bg-slate-50/50 border border-slate-200/60 rounded-[1.5rem] px-6 py-4 text-sm font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500/50 text-left flex justify-between items-center transition-all shadow-sm"
            >
                <span className="truncate">{value || "Select..."}</span>
                <svg className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            
            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-30" 
                        onClick={() => setIsOpen(false)} 
                    />
                    <div className="cursor-pointer absolute z-40 w-full mt-2 glass-panel !bg-white/95 rounded-[1.5rem] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="cursor-pointer max-h-60 overflow-y-auto custom-scrollbar p-2">
                            {options.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => {
                                        onChange(option);
                                        setIsOpen(false);
                                    }}
                                    className={`cursor-pointer w-full text-left px-4 py-3 rounded-xl text-sm font-black transition-all ${
                                        value === option 
                                            ? 'bg-blue-50 text-blue-600' 
                                            : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
