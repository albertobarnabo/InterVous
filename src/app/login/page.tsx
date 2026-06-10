"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { useRouter } from "next/navigation";
import logo from "../../../public/intervous_logo.png";
import background from "../../../public/background.png";

export default function LoginPage() {
  const { user, signIn, signUp } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.push("/dashboard/");
    }
  }, [user, router]);

  const switchMode = (next: "login" | "signup" | "forgot") => {
    setMode(next);
    setErrorMsg("");
    setInfoMsg("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
        router.push("/dashboard/");
        return;
      }
      if (mode === "signup") {
        await signUp(email, password);
        setInfoMsg("Account created — check your email to confirm, then log in.");
        setMode("login");
      } else {
        const { supabase } = await import("../../../lib/supbaseClient");
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/intervous/reset-password`,
        });
        if (error) throw error;
        setInfoMsg("Reset link sent — check your email.");
      }
      setLoading(false);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg(String(error));
      }
      setLoading(false);
    }
  };

  const heading = mode === "signup" ? "Create your account." : mode === "forgot" ? "Reset your password." : "Continue your professional adventure.";
  const buttonLabel = mode === "signup" ? "Sign Up" : mode === "forgot" ? "Send Reset Link" : "Log In";
  const loadingLabel = mode === "forgot" ? "Sending..." : "Authenticating...";

  return (
    <>
      {/* SVG Filter for Glass Distortion */}
      <svg style={{ display: "none" }}>
        <filter id="glass-distortion">
          <feTurbulence type="turbulence" baseFrequency="0.008" numOctaves="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="77" />
        </filter>
      </svg>

      <style jsx>{`
        @keyframes floatDistort {
          0%   { background-position: 0% 0%; }
          50%  { background-position: 100% 100%; }
          100% { background-position: 0% 0%; }
        }
        .glass-distortion-overlay {
          background:
            radial-gradient(circle at 20% 30%, rgba(255,255,255,0.06) 0%, transparent 80%),
            radial-gradient(circle at 80% 70%, rgba(255,255,255,0.06) 0%, transparent 80%);
          background-size: 300% 300%;
          animation: floatDistort 10s infinite ease-in-out;
          mix-blend-mode: overlay;
        }
        @keyframes blobFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          33%  { transform: translateY(-20px) scale(1.04); }
          66%  { transform: translateY(10px) scale(0.97); }
        }
        .blob-1 { animation: blobFloat 12s ease-in-out infinite; }
        .blob-2 { animation: blobFloat 15s ease-in-out infinite 2s; }
        .blob-3 { animation: blobFloat 10s ease-in-out infinite 4s; }
        .blob-4 { animation: blobFloat 14s ease-in-out infinite 1s; }
      `}</style>

      <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden selection:bg-blue-500/30">
        {/* Animated background blobs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="blob-1 absolute top-[-18%] left-[-12%] w-[60%] h-[60%] bg-blue-400/30 rounded-full blur-[140px]" />
          <div className="blob-2 absolute top-[5%] right-[-15%] w-[55%] h-[55%] bg-purple-400/24 rounded-full blur-[140px]" />
          <div className="blob-3 absolute bottom-[-15%] left-[8%] w-[55%] h-[60%] bg-cyan-400/24 rounded-full blur-[140px]" />
          <div className="blob-4 absolute bottom-[15%] right-[5%] w-[40%] h-[40%] bg-indigo-400/18 rounded-full blur-[120px]" />
        </div>

        {/* Card container with nature background */}
        <div className="max-w-md w-full mx-4 relative overflow-hidden rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_24px_80px_rgba(37,99,235,0.20),0_8px_32px_rgba(0,0,0,0.12)]">
          {/* Nature background image */}
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${background.src})` }} />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/8 via-transparent to-purple-900/8" />

          {/* Padding container */}
          <div className="relative p-4 md:p-5">
            {/* Layered glass container */}
            <div className="relative overflow-hidden rounded-[2.25rem] md:rounded-[3rem]">
              {/* Distortion layer */}
              <div
                className="absolute inset-0 rounded-[2.25rem] md:rounded-[3rem] z-[1]"
                style={{ backdropFilter: "blur(4px)", filter: "url(#glass-distortion) saturate(130%) brightness(1.12)" }}
              />

              {/* Animated distortion overlay */}
              <div className="glass-distortion-overlay absolute inset-0 rounded-[2.25rem] md:rounded-[3rem] z-[2] pointer-events-none" />

              {/* Primary glass layer */}
              <div className="absolute inset-0 rounded-[2.25rem] md:rounded-[3rem] z-[2] bg-white/28" />

              {/* Specular highlight */}
              <div
                className="absolute inset-0 rounded-[2.25rem] md:rounded-[3rem] z-[3]"
                style={{ boxShadow: "inset 1px 1px 1px rgba(255,255,255,0.80), inset -1px -1px 1px rgba(255,255,255,0.10)" }}
              />

              {/* Content */}
              <div className="relative z-[4] p-8 md:p-10 lg:p-12 animate-in zoom-in-95 duration-500">
                {/* Logo + Brand */}
                <div className="flex flex-col items-center mb-8 md:mb-10">
                  <div className="w-20 h-20 md:w-24 md:h-24 mb-5 md:mb-6 transform -rotate-3 hover:rotate-0 transition-transform duration-500 overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.14)] rounded-[1.75rem] md:rounded-[2rem] backdrop-blur-md bg-white/92 border border-white/65">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo.src} alt="Intervous Logo" className="w-full h-full object-contain" />
                  </div>

                  <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight italic drop-shadow-sm">
                    INTERVOUS
                  </h1>
                  <p className="text-slate-700 mt-2 text-center font-semibold text-sm md:text-base drop-shadow-sm">
                    {heading}
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
                  <div className="space-y-2 md:space-y-3">
                    <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-[0.18em] ml-3 drop-shadow-sm">
                      Access Email
                    </label>
                    <input
                      type="email"
                      placeholder="pilot@intervous.io"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full backdrop-blur-md bg-white/62 border border-white/65 rounded-2xl md:rounded-3xl px-6 py-4 md:px-8 md:py-5 text-sm md:text-base font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:bg-white/82 focus:border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] transition-all duration-200 placeholder:text-slate-400/80"
                    />
                  </div>

                  {mode !== "forgot" && (
                    <div className="space-y-2 md:space-y-3">
                      <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-[0.18em] ml-3 drop-shadow-sm">
                        Password
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={mode === "signup" ? 6 : undefined}
                        className="w-full backdrop-blur-md bg-white/62 border border-white/65 rounded-2xl md:rounded-3xl px-6 py-4 md:px-8 md:py-5 text-sm md:text-base font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:bg-white/82 focus:border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] transition-all duration-200 placeholder:text-slate-400/80"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 md:py-5 px-6 mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-extrabold rounded-2xl md:rounded-3xl text-xs uppercase tracking-[0.18em] text-white shadow-[0_8px_32px_rgba(37,99,235,0.35)] hover:shadow-[0_12px_40px_rgba(37,99,235,0.45)] transition-all duration-300 transform hover:-translate-y-1 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-3 border border-white/20"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>{loadingLabel}</span>
                      </>
                    ) : (
                      <>
                        <span>{buttonLabel}</span>
                        <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </button>

                  {errorMsg && (
                    <div className="backdrop-blur-md bg-rose-100/80 border-2 border-rose-200/60 text-rose-700 text-[11px] font-bold py-4 px-6 rounded-2xl md:rounded-3xl flex items-center gap-3 shadow-[0_4px_20px_rgba(244,63,94,0.15)] animate-in slide-in-from-top-2 duration-300">
                      <div className="p-1.5 bg-rose-200/80 rounded-lg shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      {errorMsg}
                    </div>
                  )}

                  {infoMsg && (
                    <div className="backdrop-blur-md bg-emerald-100/80 border-2 border-emerald-200/60 text-emerald-700 text-[11px] font-bold py-4 px-6 rounded-2xl md:rounded-3xl flex items-center gap-3 shadow-[0_4px_20px_rgba(16,185,129,0.15)] animate-in slide-in-from-top-2 duration-300">
                      <div className="p-1.5 bg-emerald-200/80 rounded-lg shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      {infoMsg}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 px-1">
                    {mode === "login" ? (
                      <>
                        <button type="button" onClick={() => switchMode("signup")} className="text-[11px] font-extrabold text-slate-700 hover:text-blue-700 uppercase tracking-wider transition-colors cursor-pointer drop-shadow-sm">
                          Create account
                        </button>
                        <button type="button" onClick={() => switchMode("forgot")} className="text-[11px] font-extrabold text-slate-700 hover:text-blue-700 uppercase tracking-wider transition-colors cursor-pointer drop-shadow-sm">
                          Forgot password?
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => switchMode("login")} className="text-[11px] font-extrabold text-slate-700 hover:text-blue-700 uppercase tracking-wider transition-colors cursor-pointer drop-shadow-sm mx-auto">
                        ← Back to login
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
