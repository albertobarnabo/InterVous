"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { useRouter } from "next/navigation";
import logo from "../../../public/intervous_logo.png";
import background from "../../../public/background.png";

export default function LoginPage() {
  const { user, signIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.isAuthenticated) {
      router.push("/dashboard/");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      router.push("/dashboard/");
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
    <>
      {/* SVG Filter for Glass Distortion */}
      <svg style={{ display: "none" }}>
        <filter id="glass-distortion">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.008"
            numOctaves="2"
            result="noise"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="77" />
        </filter>
      </svg>

      <style jsx>{`
        @keyframes floatDistort {
          0% {
            background-position: 0% 0%;
          }
          50% {
            background-position: 100% 100%;
          }
          100% {
            background-position: 0% 0%;
          }
        }
        .glass-distortion-overlay {
          background:
            radial-gradient(
              circle at 20% 30%,
              rgba(255, 255, 255, 0.05) 0%,
              transparent 80%
            ),
            radial-gradient(
              circle at 80% 70%,
              rgba(255, 255, 255, 0.05) 0%,
              transparent 80%
            );
          background-size: 300% 300%;
          animation: floatDistort 10s infinite ease-in-out;
          mix-blend-mode: overlay;
        }
      `}</style>

      <div className="min-h-screen w-full flex items-center justify-center relative bg-slate-50 overflow-hidden selection:bg-blue-500/30">
        {/* Main card container with nature background */}
        <div className="max-w-md w-full mx-4 relative overflow-hidden rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_6px_24px_rgba(0,0,0,0.2)]">
          {/* Nature background image */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${background.src})`,
            }}
          />

          {/* Overlay for better contrast */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/10"></div>

          {/* Padding container */}
          <div className="relative p-4 md:p-5">
            {/* Glass container with layered effects */}
            <div className="relative overflow-hidden rounded-[2.25rem] md:rounded-[3rem]">
              {/* Glass filter layer */}
              <div
                className="absolute inset-0 rounded-[2.25rem] md:rounded-[3rem] z-[1]"
                style={{
                  backdropFilter: "blur(4px)",
                  filter:
                    "url(#glass-distortion) saturate(120%) brightness(1.15)",
                }}
              />

              {/* Distortion overlay animation */}
              <div className="glass-distortion-overlay absolute inset-0 rounded-[2.25rem] md:rounded-[3rem] z-[2] pointer-events-none" />

              {/* Glass overlay */}
              <div className="absolute inset-0 rounded-[2.25rem] md:rounded-[3rem] z-[2] bg-white/25" />

              {/* Glass specular highlight */}
              <div
                className="absolute inset-0 rounded-[2.25rem] md:rounded-[3rem] z-[3]"
                style={{
                  boxShadow: "inset 1px 1px 1px rgba(255, 255, 255, 0.75)",
                }}
              />

              {/* Content layer */}
              <div className="relative z-[4] p-8 md:p-10 lg:p-12 animate-in zoom-in-95 duration-500">
                <div className="flex flex-col items-center mb-8 md:mb-10">
                  <div className="w-20 h-20 md:w-24 md:h-24 mb-5 md:mb-6 transform -rotate-3 hover:rotate-0 transition-transform duration-500 overflow-hidden shadow-xl shadow-black/10 rounded-[1.75rem] md:rounded-[2rem] backdrop-blur-md bg-white/90 border border-white/60">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logo.src}
                      alt="Intervous Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight italic drop-shadow-sm">
                    INTERVOUS
                  </h1>
                  <p className="text-slate-800 mt-2 text-center font-bold text-sm md:text-base drop-shadow-sm">
                    Continue your professional adventure.
                  </p>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="space-y-5 md:space-y-6"
                >
                  <div className="space-y-2 md:space-y-3">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-[0.2em] ml-3 drop-shadow-sm">
                      Access Email
                    </label>
                    <input
                      type="email"
                      placeholder="pilot@intervous.io"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full backdrop-blur-md bg-white/60 border border-white/60 rounded-2xl md:rounded-3xl px-6 py-4 md:px-8 md:py-5 text-sm md:text-base font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:bg-white/80 focus:border-white/80 transition-all placeholder:text-slate-500 shadow-sm"
                    />
                  </div>

                  <div className="space-y-2 md:space-y-3">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-[0.2em] ml-3 drop-shadow-sm">
                      Password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full backdrop-blur-md bg-white/60 border border-white/60 rounded-2xl md:rounded-3xl px-6 py-4 md:px-8 md:py-5 text-sm md:text-base font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:bg-white/80 focus:border-white/80 transition-all placeholder:text-slate-500 shadow-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 md:py-5 px-6 font-black rounded-2xl md:rounded-3xl text-xs uppercase tracking-[0.2em] text-white bg-slate-900/90 hover:bg-slate-900 backdrop-blur-md shadow-xl shadow-slate-900/20 hover:shadow-2xl hover:shadow-slate-900/30 transition-all transform hover:-translate-y-1 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-3 overflow-hidden group mt-4 border border-white/20"
                  >
                    {loading ? (
                      <>
                        <svg
                          className="animate-spin h-5 w-5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <span>Log In</span>
                        <svg
                          className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="3"
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                      </>
                    )}
                  </button>

                  {errorMsg && (
                    <div className="backdrop-blur-md bg-rose-100/80 border-2 border-rose-200/60 text-rose-700 text-[11px] font-black py-4 px-6 rounded-2xl md:rounded-3xl flex items-center gap-3 animate-in shake-in shadow-lg">
                      <div className="p-1.5 bg-rose-200/80 rounded-lg">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="3"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                      </div>
                      {errorMsg}
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
