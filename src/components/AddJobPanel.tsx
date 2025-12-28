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
            const res = await fetch('/intervous/api/scrape-job', {
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
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-30 bg-white p-6 rounded-xl shadow-2xl w-[28rem] border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-center text-gray-800">Add Job Description Link</h2>
            <h1 className="text-gray-500 mb-3"
            >If you have applied (or intend to apply) for a position, drop the link of the job description here! Intervous will fill out the table automatically </h1>
            <input
                type="text"
                placeholder="https://example.com/job-posting"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full border rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
            />

            <div className="flex items-center mb-4 justify-center">
                <input
                    type="checkbox"
                    checked={applied}
                    onChange={(e) => setApplied(e.target.checked)}
                    id="appliedCheckbox"
                    className=" mr-2 accent-cyan-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="appliedCheckbox" className="text-gray-700 text-lg">
                    I have already applied
                </label>
            </div>

            {error && <p className="text-red-500 text-m mb-3 text-center">{error}</p>}

            <div className="flex justify-around gap-3">
                <button
                    onClick={onClose}
                    className="bg-gradient-to-r from-neutral-300 to-stone-400 font-bold py-2 px-4 rounded-full cursor-pointer text-gray-700 shadow-2xl"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="bg-gradient-to-r from-blue-200 to-cyan-200 text-gray-700 font-bold py-2 px-4 rounded-full cursor-pointer shadow-2xl"
                >
                    {loading ? 'Adding...' : 'Add'}
                </button>
            </div>
        </div>
    );
}
