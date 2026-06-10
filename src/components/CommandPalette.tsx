"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";

export const PENDING_ACTION_KEY = "intervous:pending-action";
export const EVENT_ADD_APPLICATION = "intervous:add-application";
export const EVENT_ADD_COMPANY = "intervous:add-company";

interface Command {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  icon: React.ReactNode;
  run: () => void;
}

export default function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuth();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const navigate = useCallback(
    (href: string, event?: string) => {
      close();
      if (event) {
        sessionStorage.setItem(PENDING_ACTION_KEY, event);
        window.dispatchEvent(new Event(event));
      }
      if (pathname !== href) router.push(href);
    },
    [close, pathname, router]
  );

  const commands: Command[] = useMemo(
    () => [
      {
        id: "dashboard",
        label: "Go to Dashboard",
        hint: "Navigate",
        keywords: "dashboard home jobs applications table",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
        run: () => navigate("/dashboard"),
      },
      {
        id: "companies",
        label: "Go to Companies",
        hint: "Navigate",
        keywords: "companies organizations database browse",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1" />
          </svg>
        ),
        run: () => navigate("/companies"),
      },
      {
        id: "add-application",
        label: "Add Application",
        hint: "Action",
        keywords: "new job application create track add",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        ),
        run: () => navigate("/dashboard", EVENT_ADD_APPLICATION),
      },
      {
        id: "add-company",
        label: "Add Company",
        hint: "Action",
        keywords: "new company create organization add",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        ),
        run: () => navigate("/companies", EVENT_ADD_COMPANY),
      },
      {
        id: "sign-out",
        label: "Sign Out",
        hint: "Account",
        keywords: "logout sign out exit leave",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        ),
        run: async () => {
          close();
          await signOut();
          router.push("/login");
        },
      },
    ],
    [navigate, close, signOut, router]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.keywords.includes(q)
    );
  }, [commands, query]);

  // Global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [close]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300]">
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={close}
      />
      <div className="absolute left-1/2 top-[18%] -translate-x-1/2 w-[92%] max-w-xl animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200">
        <div className="glass-panel !bg-white/95 rounded-[1.75rem] shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIndex((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter" && filtered[activeIndex]) {
                  filtered[activeIndex].run();
                }
              }}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-sm font-semibold text-slate-800 placeholder:text-slate-400"
            />
            <kbd className="hidden sm:block text-[10px] font-bold text-slate-400 bg-slate-100 rounded-md px-2 py-1">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="py-2 max-h-[320px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm font-medium text-slate-400">
                No matching commands
              </p>
            ) : (
              filtered.map((cmd, i) => (
                <button
                  key={cmd.id}
                  onClick={cmd.run}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`w-full flex items-center gap-3.5 px-5 py-3 text-left transition-colors cursor-pointer
                    ${i === activeIndex ? "bg-blue-50" : ""}`}
                >
                  <span
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0
                      ${i === activeIndex ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}
                  >
                    {cmd.icon}
                  </span>
                  <span
                    className={`flex-1 text-sm font-bold ${i === activeIndex ? "text-blue-700" : "text-slate-700"}`}
                  >
                    {cmd.label}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {cmd.hint}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
              <kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5">↑↓</kbd> navigate
            </span>
            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
              <kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5">↵</kbd> select
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
