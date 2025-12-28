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
        <div className="absolute top-10 left-1/2 transform -translate-x-1/2 z-30 bg-white p-6 rounded-xl shadow-2xl w-[30rem] border border-gray-200">
            <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800">Edit Job</h2>

            {["company_name", "role", "location", "application_date", "status", "stage", "url"].map((field) => {
                const key = field as FormField;

                return (
                    <div key={field} className="mb-4">
                        <label className="block font-bold text-gray-700 capitalize">
                            {field.replace(/_/g, ' ')}
                        </label>

                        {field === "status" ? (
                            <select
                                name={key}
                                value={formData[field] ?? ''}
                                onChange={handleChange}
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border text-gray-700"
                            >
                                <option value="Active">Active</option>
                                <option value="Not Applied">Not Applied</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        ) : (
                            <input
                                type="text"
                                name={field}
                                value={formData[key] ?? ''}
                                onChange={handleChange}
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border text-gray-500"
                            />
                        )}
                    </div>
                )

            })}


            <div className="flex justify-between mt-6">
                <button
                    className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-2 rounded-full cursor-pointer"
                    onClick={() => onDelete(job ? job.id : 0)}
                >
                    Delete this job
                </button>
                <div className="flex gap-2">
                    <button
                        className="bg-gradient-to-r from-neutral-300 to-stone-400 text-gray-700 px-4 py-2 rounded-full cursor-pointer"
                        onClick={() => {
                            console.log("Cancel clicked");
                            onClose();
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        className="bg-gradient-to-r from-blue-200 to-cyan-200 text-gray-700 px-4 py-2 rounded-full cursor-pointer"
                        onClick={() => onSave(formData as JobEntry)}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
