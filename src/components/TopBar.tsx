/* eslint-disable @next/next/no-img-element */
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { User, LogOut, Camera } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import KeysPanel from './KeysPanel';
import { ApiKeys } from '../../lib/types';
import logo from '../../public/intervous_logo.png';
import { getProfile } from '../../lib/backend/profiles';
import AvatarUploadModal from './AvatarUploadModal';
import CommandPalette from './CommandPalette';

interface TopBarProps {
    keys: ApiKeys | null;
}

const NAV_ITEMS = [
    {
        href: '/dashboard',
        label: 'Dashboard',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
    },
    {
        href: '/companies',
        label: 'Companies',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1" />
            </svg>
        ),
    },
];

export default function TopBar({ keys }: TopBarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, signOut } = useAuth();

    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [showKeysPanel, setShowKeysPanel] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!user) return;
        async function loadProfile() {
            try {
                const profile = await getProfile(user!.id);
                if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
            } catch (error) {
                console.error("Failed to load profile avatar", error);
            }
        }
        loadProfile();
    }, [user]);

    // Close the account menu on outside click
    useEffect(() => {
        if (!dropdownOpen) return;
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [dropdownOpen]);

    const handleLogout = async () => {
        await signOut();
        router.push('/login');
    };

    const isActive = (href: string) => pathname?.startsWith(href);

    return (
        <>
            <header className="fixed top-4 inset-x-4 z-[100] glass-panel rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-between h-16 px-3 md:px-4">

                {/* Left: logo */}
                <button
                    className="flex items-center gap-2.5 cursor-pointer group px-1.5 py-1 rounded-xl"
                    onClick={() => router.push('/dashboard')}
                >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden bg-white shadow-sm border border-slate-100 group-hover:scale-105 transition-transform duration-300">
                        <img src={logo.src} alt="InterVous" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-[15px] font-black text-slate-900 tracking-tight italic group-hover:text-blue-600 transition-colors">
                        INTERVOUS
                    </span>
                </button>

                {/* Center: nav pills (desktop) */}
                <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2 bg-slate-100/70 rounded-xl p-1">
                    {NAV_ITEMS.map(({ href, label, icon }) => (
                        <button
                            key={href}
                            onClick={() => router.push(href)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all duration-200 cursor-pointer ${
                                isActive(href)
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <span className={isActive(href) ? 'text-blue-600' : ''}>{icon}</span>
                            {label}
                        </button>
                    ))}
                </nav>

                {/* Right: actions */}
                <div className="flex items-center gap-1.5 md:gap-2">

                    {/* Command palette trigger */}
                    <button
                        onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                        className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 transition-all duration-200 cursor-pointer"
                        title="Command palette"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
                        </svg>
                        <kbd className="text-[10px] font-black tracking-wide bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">⌘K</kbd>
                    </button>

                    {/* Configs */}
                    <button
                        onClick={() => setShowKeysPanel(true)}
                        className="hidden md:flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 transition-all duration-200 cursor-pointer"
                        title="API keys & configs"
                    >
                        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    </button>

                    <div className="hidden md:block w-px h-6 bg-slate-200/80 mx-1" />

                    {/* Mobile menu button */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:bg-slate-100/80 transition-colors cursor-pointer"
                        aria-label="Menu"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                            {mobileMenuOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>

                    {/* Account */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setDropdownOpen(prev => !prev)}
                            className="cursor-pointer flex items-center gap-1.5 p-1 rounded-xl hover:bg-slate-100/80 transition-all duration-200 group"
                        >
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white overflow-hidden shadow-sm">
                                {avatarUrl ? (
                                    <img
                                        src={avatarUrl}
                                        alt="Avatar"
                                        className="w-full h-full object-cover"
                                        onError={() => setAvatarUrl(null)}
                                    />
                                ) : (
                                    <User size={17} strokeWidth={2.4} />
                                )}
                            </div>
                            <svg
                                className={`hidden sm:block w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {dropdownOpen && (
                            <div className="absolute right-0 mt-3 w-60 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.12)] border border-slate-100 z-[110] py-2 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                                <div className="px-4 py-2.5 border-b border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Signed in as</p>
                                    <p className="text-sm font-bold text-slate-800 truncate">{user?.email}</p>
                                </div>

                                <div className="py-1.5">
                                    <button
                                        onClick={() => {
                                            setDropdownOpen(false);
                                            setShowAvatarModal(true);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                                    >
                                        <Camera size={15} className="text-slate-400" />
                                        Change avatar
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDropdownOpen(false);
                                            setShowKeysPanel(true);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer md:hidden"
                                    >
                                        <svg className="w-[15px] h-[15px] text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                        </svg>
                                        API keys
                                    </button>
                                </div>

                                <div className="border-t border-slate-100 pt-1.5">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                                    >
                                        <LogOut size={15} />
                                        Sign out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Mobile menu */}
            {mobileMenuOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[90] md:hidden"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                    <div className="fixed top-24 inset-x-4 z-[95] glass-panel !bg-white/95 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.10)] p-2 animate-in slide-in-from-top-4 duration-300 md:hidden">
                        <nav className="space-y-1">
                            {NAV_ITEMS.map(({ href, label, icon }) => (
                                <button
                                    key={href}
                                    onClick={() => {
                                        router.push(href);
                                        setMobileMenuOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                                        isActive(href)
                                            ? 'bg-blue-50 text-blue-600'
                                            : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {icon}
                                    {label}
                                </button>
                            ))}
                            <button
                                onClick={() => {
                                    setShowKeysPanel(true);
                                    setMobileMenuOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                                API keys
                            </button>
                        </nav>
                    </div>
                </>
            )}

            {showKeysPanel && (
                <KeysPanel
                    onClose={() => setShowKeysPanel(false)}
                    keys={keys}
                />
            )}

            <CommandPalette />

            {showAvatarModal && (
                <AvatarUploadModal
                    onClose={() => setShowAvatarModal(false)}
                    onSuccess={(newUrl) => {
                        setAvatarUrl(newUrl);
                        setShowAvatarModal(false);
                    }}
                    currentAvatarUrl={avatarUrl}
                />
            )}
        </>
    );
}
