
/* eslint-disable @next/next/no-img-element */
import React, { useState, useRef } from 'react';
import { useAuth } from "../../contexts/AuthContext";
import { uploadAvatar, deleteAvatar } from '../../lib/backend/storage';
import { updateProfileAvatar } from '../../lib/backend/profiles';

interface AvatarUploadModalProps {
    onClose: () => void;
    onSuccess: (newUrl: string) => void;
    currentAvatarUrl: string | null;
}

export default function AvatarUploadModal({ onClose, onSuccess, currentAvatarUrl }: AvatarUploadModalProps) {
    const { user } = useAuth();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setError('File size must be less than 5MB');
                return;
            }
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setError('');
        }
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file) {
             if (file.size > 5 * 1024 * 1024) {
                setError('File size must be less than 5MB');
                return;
            }
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
             setError('');
        }
    };

    const handleSave = async () => {
        if (!user || !selectedFile) return;
        setLoading(true);
        setError('');

        try {
            // 1. Upload new avatar
            const newAvatarUrl = await uploadAvatar(user.id, selectedFile);

            // 2. Update profile
            await updateProfileAvatar(user.id, newAvatarUrl);

            // 3. Delete old avatar if exists and different
            if (currentAvatarUrl && currentAvatarUrl !== newAvatarUrl) {
                await deleteAvatar(currentAvatarUrl);
            }

            onSuccess(newAvatarUrl);
            onClose();
        } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
             console.error("Upload failed", err);
            setError(err.message || 'Failed to upload avatar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-900/20 backdrop-blur-md">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
                <div className="w-full max-w-md glass-panel !bg-white/90 relative animate-in zoom-in-95 duration-300 text-left rounded-[2.5rem] shadow-2xl p-8">
                    
                    <h2 className="text-2xl font-black text-slate-900 mb-2 text-center">Update Avatar</h2>
                    <p className="text-slate-500 text-center text-sm font-bold mb-8">Upload a new profile picture</p>

                    <div 
                        className="flex flex-col items-center gap-6"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                    >
                        {/* Preview Area */}
                        <div 
                            className="relative group cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="w-32 h-32 rounded-full ring-4 ring-slate-100 shadow-xl overflow-hidden relative">
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
                                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    </div>
                                )}
                                
                                {/* Overlay */}
                                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </div>
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                                accept="image/*" 
                                className="hidden" 
                            />
                        </div>

                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Click or Drag to Upload
                        </p>
                    </div>

                    {error && (
                        <div className="mt-6 bg-rose-50 text-rose-600 text-xs font-black py-3 px-4 rounded-xl flex items-center gap-2">
                             <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 mt-8">
                        <button
                            onClick={onClose}
                            className="flex-1 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!selectedFile || loading}
                            className="flex-1 cursor-pointer bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-slate-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Saving...
                                </>
                            ) : 'Save'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
