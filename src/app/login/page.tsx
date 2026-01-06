'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const { user, signIn } = useAuth();
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user?.isAuthenticated) {
            router.push('/dashboard/');
        }
    }, [user, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await signIn(email, password);
            router.push('/dashboard/');
        } catch (error: unknown) {
            if (error instanceof Error) {
                setErrorMsg(error.message);
            } else {
                setErrorMsg(String(error));
            }
            setLoading(false);
        }
    };


    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute top-0 left-1/4 w-[60%] h-[60%] bg-blue-200/40 rounded-full blur-[120px] -z-10" />
            <div className="absolute bottom-0 right-1/4 w-[50%] h-[50%] bg-indigo-200/40 rounded-full blur-[100px] -z-10" />

            <div className="max-w-md w-full backdrop-blur-3xl bg-white/80 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.1)] border border-white p-10 md:p-12 relative z-10 animate-in zoom-in-95 duration-500">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 rounded-[1.5rem] flex items-center justify-center shadow-[0_10px_25px_rgba(37,99,235,0.3)] mb-6 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight italic">INTERVOUS</h1>
                    <p className="text-slate-500 mt-2 text-center font-medium">Continue your professional adventure.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2rem] ml-2">Access Email</label>
                        <input
                            type="email"
                            placeholder="pilot@intervous.io"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[1.5rem] focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-400 transition-all duration-300 text-slate-700 font-bold placeholder:text-slate-300"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2rem] ml-2">Password</label>
                        <input
                            type="password"
                            placeholder="••••••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[1.5rem] focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-400 transition-all duration-300 text-slate-700 font-bold placeholder:text-slate-300"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-5 px-6 border border-transparent font-black rounded-[1.5rem] text-xs uppercase tracking-[0.2rem] text-white bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 shadow-[0_15px_30px_rgba(37,99,235,0.25)] hover:shadow-[0_20px_40px_rgba(37,99,235,0.35)] transition-all transform hover:-translate-y-1 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-3 overflow-hidden group"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Authenticating...</span>
                            </>
                        ) : (
                            <>
                                <span>Log In</span>
                                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                            </>
                        )}
                    </button>

                    {errorMsg && (
                        <div className="bg-rose-50 border border-rose-100 text-rose-600 text-[11px] font-black py-4 px-6 rounded-[1.5rem] flex items-center gap-3 animate-in shake-in">
                            <div className="p-1.5 bg-rose-100 rounded-lg">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                            {errorMsg}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
