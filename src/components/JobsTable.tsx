"use client"

import { useState, useMemo } from "react";
import { JobEntry } from "../../lib/types";
import EditJobPanel from "./EditJobPanel";
import { deleteJob, updateJob } from "../../lib/jobService";
import { useAuth } from "../../contexts/AuthContext";

interface JobsTableProps {
    jobs: JobEntry[];
    fetchJobs: () => void;
}

const ITEMS_PER_PAGE = 8;

export default function JobsTable({ jobs, fetchJobs }: JobsTableProps) {
    const [selectedJob, setSelectedJob] = useState<JobEntry | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState<'status' | 'application_date' | 'location' | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const { user } = useAuth();

    const handleSave = async (updatedJob: JobEntry) => {
        try {
            await updateJob(updatedJob, user.id);
            setSelectedJob(null);
            fetchJobs();
        } catch (error) {
            console.error("Failed to update job:", error);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteJob(id, user.id);
            setSelectedJob(null);
            fetchJobs();
        } catch (error) {
            console.error("Failed to delete job:", error);
        }
    };

    const handleSort = (field: 'status' | 'application_date' | 'location') => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
        setCurrentPage(1);
    };

    const sortedJobs = useMemo(() => {
        if (!sortField) return jobs;
        return [...jobs].sort((a, b) => {
            const valA = a[sortField] || '';
            const valB = b[sortField] || '';
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [jobs, sortField, sortDirection]);

    const totalPages = Math.ceil(sortedJobs.length / ITEMS_PER_PAGE);
    const currentJobs = sortedJobs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const renderSortSymbol = (field: string) => {
        if (sortField !== field) return '⇅';
        return sortDirection === 'asc' ? '▲' : '▼';
    };

    return (
        <div className="overflow-x-auto shadow-md sm:rounded-lg">
            <table className="w-full text-l text-center rtl:text-right text-gray-700 table-auto">
                <thead className="text-lg text-zinc-200 bg-gradient-to-r from-slate-600 to-slate-800">
                    <tr>
                        <th className="px-6 py-3">Company Name</th>
                        <th className="px-6 py-3">Role</th>
                        <th className="px-6 py-3 cursor-pointer" onClick={() => handleSort('location')}>
                            Location <span className="ml-1">{renderSortSymbol('location')}</span>
                        </th>
                        <th className="px-6 py-3 cursor-pointer" onClick={() => handleSort('application_date')}>
                            Applied on <span className="ml-1">{renderSortSymbol('application_date')}</span>
                        </th>
                        <th className="px-6 py-3 cursor-pointer" onClick={() => handleSort('status')}>
                            Status <span className="ml-1">{renderSortSymbol('status')}</span>
                        </th>
                        <th className="px-6 py-3">Interview Stage</th>
                        <th className="px-6 py-3">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {jobs.length === 0 ? (
                        <tr className="bg-gradient-to-r from-blue-100 to-cyan-100">
                            <td colSpan={7} className="px-6 py-8 text-gray-600 italic text-xl">
                                You haven&apos;t added any job applications yet.
                            </td>
                        </tr>
                    ) : (
                        currentJobs.map((job, index) => (
                            <tr
                                key={job.id}
                                onClick={() => window.open(job.url, '_blank')}
                                className={`transition cursor-pointer hover:from-cyan-100 hover:to-cyan-100 bg-gradient-to-r 
                                    ${index % 2 === 0 ? 'from-blue-200 to-cyan-200' : 'from-blue-100 to-cyan-100'}
                                `}
                            >
                                <th className="px-6 py-4 font-medium text-gray-700 whitespace-nowrap">{job.company_name}</th>
                                <td className="px-6 py-4">{job.role}</td>
                                <td className="px-6 py-4">{job.location}</td>
                                <td className="px-6 py-4">{job.application_date ?? "-"}</td>
                                <td className="px-6 py-4">
                                    <span className={`
                                        px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap
                                        ${job.status === 'Active'
                                            ? 'bg-green-100 text-green-900'
                                            : job.status === 'Inactive'
                                                ? 'bg-red-100 text-red-900'
                                                : 'bg-gray-100 text-gray-900'}
                                    `}>
                                        {job.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">{job.stage}</td>
                                <td
                                    className="px-6 py-4"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedJob(job);
                                    }}
                                >
                                    <span className="font-medium text-blue-900 hover:underline">Edit</span>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>

            {/* Pagination controls */}
            {sortedJobs.length > ITEMS_PER_PAGE && (
                <div className="flex justify-center mt-4 gap-2 text-gray-800 font-medium">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((prev) => prev - 1)}
                        className={`px-3 py-1 rounded cursor-pointer mb-2 ${currentPage === 1 ? 'text-gray-400' : 'hover:bg-gray-200'}`}
                    >
                        ← Prev
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                        <button
                            key={i + 1}
                            onClick={() => setCurrentPage(i + 1)}
                            className={`px-3 py-1 rounded cursor-pointer mb-2 ${currentPage === i + 1 ? 'bg-blue-200' : 'hover:bg-gray-200'}`}
                        >
                            {i + 1}
                        </button>
                    ))}
                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((prev) => prev + 1)}
                        className={`px-3 py-1 rounded cursor-pointer mb-2 ${currentPage === totalPages ? 'text-gray-400' : 'hover:bg-gray-200'}`}
                    >
                        Next →
                    </button>
                </div>
            )}

            {/* Edit panel */}
            {selectedJob && (
                <>
                    <div className="fixed inset-0 backdrop-blur-sm z-20" />
                    <EditJobPanel
                        job={selectedJob}
                        onClose={() => setSelectedJob(null)}
                        onSave={handleSave}
                        onDelete={handleDelete}
                    />
                </>
            )}
        </div>
    );
}
