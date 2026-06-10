import { useState } from "react";
import { setApiKeys, KeysStatus, KeyField } from "../../lib/keyService";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "./Toast";
import { AiFillOpenAI } from "react-icons/ai";
import DeepseekIcon from "./DeepSeekIcon";
import MistralIcon from "./MistralIcon";

interface KeysPanelProps {
    keysStatus: KeysStatus | null;
    onClose: () => void;
    onSaved?: () => void;
}

const PROVIDERS: {
    field: KeyField;
    label: string;
    description: string;
    icon: React.ReactNode;
}[] = [
    {
        field: "open_ai",
        label: "OpenAI",
        description: "Job extraction with GPT models",
        icon: <AiFillOpenAI className="w-5 h-5 text-slate-700" />,
    },
    {
        field: "deep_seek",
        label: "DeepSeek",
        description: "Job extraction with DeepSeek",
        icon: <DeepseekIcon className="w-5 h-5" />,
    },
    {
        field: "mistral",
        label: "Mistral",
        description: "Job extraction with Mistral",
        icon: <MistralIcon className="w-5 h-5" />,
    },
    {
        field: "tavily",
        label: "Tavily",
        description: "Web search for company research",
        icon: (
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
            </svg>
        ),
    },
];

export default function KeysPanel({ keysStatus, onClose, onSaved }: KeysPanelProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [visible, setVisible] = useState<Record<string, boolean>>({});
    const [formData, setFormData] = useState<Record<KeyField, string>>({
        open_ai: "",
        deep_seek: "",
        mistral: "",
        tavily: "",
    });

    const { user } = useAuth();
    const { toast } = useToast();

    const hasChanges = Object.values(formData).some((v) => v.trim());

    const handleSubmit = async () => {
        setError("");
        setLoading(true);
        try {
            if (!user) throw new Error("Not signed in");
            await setApiKeys(user.id, formData);
            toast("API keys saved");
            onSaved?.();
            onClose();
        } catch (err) {
            setError("There was a problem while saving your keys. Try again.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/20 backdrop-blur-md">
            <div className="flex min-h-full items-center justify-center p-4 md:p-6">
                <div className="w-full max-w-xl glass-panel !bg-white/95 relative animate-in zoom-in-95 duration-300 text-left rounded-[2rem] shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-900/20 shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight">API Keys</h2>
                                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                                    Keys stay on the server — the browser only sees whether they exist
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="Close"
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Provider rows */}
                    <div className="px-7 py-5 space-y-4">
                        {PROVIDERS.map(({ field, label, description, icon }) => {
                            const hasSavedKey = Boolean(keysStatus?.[field]);
                            return (
                                <div key={field} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                                                {icon}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800 leading-none">{label}</p>
                                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">{description}</p>
                                            </div>
                                        </div>
                                        <span
                                            className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${
                                                hasSavedKey
                                                    ? "text-emerald-600 bg-emerald-50 border-emerald-100"
                                                    : "text-slate-400 bg-slate-50 border-slate-200"
                                            }`}
                                        >
                                            {hasSavedKey ? "Saved" : "Not set"}
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type={visible[field] ? "text" : "password"}
                                            name={field}
                                            value={formData[field]}
                                            onChange={(e) =>
                                                setFormData((prev) => ({ ...prev, [field]: e.target.value }))
                                            }
                                            placeholder={hasSavedKey ? "Saved — type to replace" : `Paste your ${label} key...`}
                                            autoComplete="off"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pr-11 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-blue-400 transition-all placeholder:text-slate-300"
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setVisible((prev) => ({ ...prev, [field]: !prev[field] }))
                                            }
                                            aria-label={visible[field] ? "Hide key" : "Show key"}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors cursor-pointer"
                                        >
                                            {visible[field] ? (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {error && (
                            <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold py-3 px-4 rounded-xl flex items-center gap-2.5 animate-in slide-in-from-bottom-2">
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between gap-3 px-7 py-4 bg-slate-50/60 border-t border-slate-100">
                        <p className="text-[10px] text-slate-400 font-semibold hidden sm:block">
                            Empty fields keep their saved value.
                        </p>
                        <div className="flex items-center gap-2 ml-auto">
                            <button
                                onClick={onClose}
                                className="cursor-pointer px-5 py-2.5 rounded-xl text-xs font-black text-slate-500 hover:bg-slate-100 uppercase tracking-widest transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading || !hasChanges}
                                className="cursor-pointer px-6 py-2.5 rounded-xl text-xs font-black text-white uppercase tracking-widest bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Saving...
                                    </>
                                ) : (
                                    "Save Keys"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
