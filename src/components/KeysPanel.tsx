import { useState } from "react";
import { ApiKeys } from "../../lib/types";
import { setApiKeys } from "../../lib/keyService";
import { useAuth } from "../../contexts/AuthContext";

interface KeysPanelProps {
    keys: ApiKeys | null;
    onClose: () => void;
}

type FormField = keyof Pick<ApiKeys, "open_ai" | "deep_seek" | "mistral">;

export default function KeysPanel({ keys, onClose }: KeysPanelProps) {

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { user } = useAuth();

    const [formData, setFormData] = useState<ApiKeys>({
        user_id: user?.id ?? '',
        open_ai: keys?.open_ai ?? '',
        deep_seek: keys?.deep_seek ?? '',
        mistral: keys?.mistral ?? '',
    });

    const handleSubmit = async () => {
        setError('');
        setLoading(true);

        try {
            if (!user) throw new Error("Not signed in");
            await setApiKeys(user.id, formData as ApiKeys);
            onClose();
        } catch (err) {
            setError("There was a problem while submitting your keys. Try again");
            console.log(err)
        } finally {
            setLoading(false);
        }
    };


    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }


    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/20 backdrop-blur-md">
            <div className="flex min-h-full items-center justify-center p-4 md:p-6 text-center">
                <div className="w-full max-w-2xl glass-panel !bg-white/90 relative animate-in zoom-in-95 duration-300 text-left rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl">
                    {/* Decorative background accents */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-400/10 rounded-full blur-[80px] -mr-20 -mt-20 -z-10" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full blur-[60px] -ml-10 -mb-10 -z-10" />

                <div className="relative z-10 p-6 md:p-8">
                    <header className="mb-8 md:mb-10 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] text-white mb-5 md:mb-6 shadow-xl shadow-slate-900/20">
                            <svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                        </div>
                        <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">AI Command Center</h2>
                        <p className="text-slate-500 font-bold text-sm md:text-base mt-1 md:mt-2">Deploy your API keys to empower the extraction engine.</p>
                    </header>

                    <div className="space-y-6 md:space-y-8 mb-8 md:mb-10">
                        {(["open_ai", "deep_seek", "mistral"] as FormField[]).map(field => (
                            <div key={field} className="space-y-3 group">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2 group-focus-within:text-blue-600 transition-colors">
                                    {field.replace(/_/g, ' ')} Secure Key
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        name={field}
                                        value={formData[field] ?? ''}
                                        onChange={handleChange}
                                        placeholder="••••••••••••••••"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl md:rounded-3xl px-6 py-4 md:px-8 md:py-5 text-sm md:text-base font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500 transition-all placeholder:text-slate-400 pr-14 md:pr-16"
                                    />
                                    <div className="absolute right-6 md:right-8 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {error && (
                            <div className="bg-rose-50 border-2 border-rose-100 text-rose-600 text-xs font-black py-4 px-6 rounded-3xl flex items-center gap-3 animate-in slide-in-from-bottom-2">
                                <div className="p-1.5 bg-rose-100 rounded-lg">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                </div>
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
                        <button
                            onClick={onClose}
                            className="cursor-pointer flex-1 bg-slate-100/80 text-slate-500 px-8 py-4 md:px-10 md:py-5 rounded-2xl md:rounded-3xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-200 transition-all active:scale-95"
                        >
                            Not Now
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="cursor-pointer flex-[2] bg-slate-900 text-white px-10 py-4 md:px-12 md:py-5 rounded-2xl md:rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 hover:shadow-2xl hover:shadow-slate-900/30 transition-all transform hover:-translate-y-1 active:scale-95"
                        >
                            {loading ? 'Initializing...' : 'Sync Configs'}
                        </button>
                    </div>
                    
                    </div>
                </div>
            </div>
        </div>
    );
}