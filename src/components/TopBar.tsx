'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { User } from 'lucide-react';
import { useState } from 'react';
import KeysPanel from './KeysPanel';
import { ApiKeys } from '../../lib/types';

interface TopBarProps {
    keys: ApiKeys | null;
}

export default function TopBar({ keys }: TopBarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, signOut } = useAuth();

    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [showKeysPanel, setShowKeysPanel] = useState(false);

    const handleLogout = async () => {
        await signOut();
        router.push('/login');
    };

    return (
        <>
            <header className="w-full glass-panel !rounded-none !border-x-0 !border-t-0 shadow-[0_4px_30px_rgba(0,0,0,0.03)] sticky top-0 z-[100] flex items-center justify-between py-4 px-6 md:px-12 bg-white/70">
                {/* Left: Logo */}
                <div 
                    className="flex items-center gap-4 cursor-pointer group" 
                    onClick={() => router.push('/dashboard')}
                >
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 rounded-[1.2rem] flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xl font-black text-slate-900 tracking-tighter leading-none italic group-hover:text-blue-600 transition-colors">INTERVOUS</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Smart Tracking Assistant</span>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-6 md:gap-8">

                    <button
                        onClick={() => router.push('/companies')}
                        className={`cursor-pointer hidden md:flex items-center gap-3 text-sm font-black transition-all group ${
                            pathname?.startsWith('/companies') 
                            ? 'text-blue-600' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <div className={`p-2.5 rounded-2xl transition-all ${
                            pathname?.startsWith('/companies')
                            ? 'bg-blue-50 text-blue-600 shadow-sm'
                            : 'bg-transparent group-hover:bg-slate-50'
                        }`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </div>
                        Companies
                    </button>

                    <button
                        onClick={() => setShowKeysPanel(true)}
                        className="cursor-pointer hidden md:flex items-center gap-3 text-sm font-black text-slate-500 hover:text-slate-800 transition-all group"
                    >
                        <div className="p-2.5 rounded-2xl group-hover:bg-slate-50 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                        </div>
                        Configs
                    </button>

                    <div className="w-px h-8 bg-slate-200/60 hidden md:block" />

                    <div className="relative">
                        <button
                            onClick={() => setDropdownOpen(prev => !prev)}
                            className="cursor-pointer flex items-center gap-3 p-1.5 rounded-[1.6rem] hover:bg-white/50 hover:shadow-sm transition-all duration-300 focus:outline-none group border border-transparent hover:border-white/50"
                        >
                            <div className="w-11 h-11 rounded-[1.2rem] bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center text-white shadow-lg shadow-slate-900/10 group-hover:scale-95 transition-transform duration-300">
                                <User size={20} strokeWidth={2.5} />
                            </div>
                            <div className="hidden sm:flex flex-col items-end">
                                <span className="text-xs font-black text-slate-900 tracking-tight leading-none truncate max-w-[120px]">{user?.email?.split('@')[0]}</span>
                                <span className="text-[9px] font-bold text-emerald-500 mt-1.5 flex items-center gap-1.5 leading-none bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Active
                                </span>
                            </div>
                        </button>

                        {dropdownOpen && (
                            <div className="absolute right-0 mt-4 w-64 glass-panel rounded-[2rem] shadow-2xl z-[110] p-2 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="px-6 py-4 border-b border-slate-100/50 mb-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Account Info</p>
                                    <p className="text-xs font-black text-slate-900 truncate">{user?.email}</p>
                                </div>
                                
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-4 px-5 py-4 text-xs font-black text-rose-500 hover:bg-rose-50 rounded-2xl transition-all duration-300 group"
                                >
                                    <div className="p-2.5 bg-rose-50 group-hover:bg-rose-100 transition-colors rounded-xl">
                                        <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                    </div>
                                    Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>
            {showKeysPanel && (
                <>
                    {/* Background blur layer */}
                    <div className="fixed inset-0 backdrop-blur-sm z-20" />
                    {/* Panel */}
                    <KeysPanel
                        onClose={() => {
                            setShowKeysPanel(false);
                        }}
                        keys={keys}
                    />
                </>
            )}
        </>
    );
}
